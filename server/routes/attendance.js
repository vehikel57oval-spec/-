const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const { roundTime } = require('../utils/timeRounding');

// 時刻ヘルパー
function getLocalDetails(dateInput = new Date()) {
    const d = new Date(dateInput);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    
    return {
        dateStr: `${yyyy}-${mm}-${dd}`,
        dateTimeStr: `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`,
        timeStr: `${hh}:${min}`
    };
}

/**
 * @route   POST /api/attendance/clock-in
 * @desc    出勤打刻
 */
router.post('/clock-in', verifyToken, (req, res) => {
    const { dateStr, dateTimeStr } = getLocalDetails();
    
    try {
        // すでに未退勤のレコードがあるか確認
        const activeRecord = db.prepare(
            'SELECT * FROM attendance_records WHERE staff_id = ? AND actual_clock_out IS NULL'
        ).get(req.user.id);
        
        if (activeRecord) {
            return res.status(400).json({ error: 'すでに退勤していない出勤データが存在します。先に退勤してください。' });
        }
        
        // 丸め設定の取得
        const rounding = db.prepare(
            'SELECT * FROM rounding_settings WHERE department_id = ?'
        ).get(req.user.department_id) || { clock_in_unit: 15, clock_in_direction: 'up' };
        
        // 出勤時刻の丸め
        const roundedIn = roundTime(dateTimeStr, rounding.clock_in_unit, rounding.clock_in_direction);
        
        // 今日のスケジュールを確認（勤務表との連動）
        const schedule = db.prepare(
            'SELECT * FROM schedule_entries WHERE staff_id = ? AND work_date = ?'
        ).get(req.user.id, dateStr);
        
        let scheduledShift = 'nik'; // デフォルトは日勤
        let scheduledStart = '08:30';
        let scheduledEnd = '17:15';
        let scheduledHours = 7.75; // 8時間45分拘束、1時間休憩 = 7.75時間 (7時間45分)
        
        if (schedule) {
            // スケジュールエントリーの shift_key に応じたデフォルト時間設定
            // 当=当務, 日=日勤, 非/明/休=休み等
            if (schedule.shift_key === '当') {
                scheduledShift = 'tou';
                scheduledStart = schedule.start_time || '08:30';
                scheduledEnd = schedule.end_time || '08:30'; // 翌日
                scheduledHours = 15.5; // 24時間拘束 - 8.5時間休憩
            } else if (schedule.shift_key === '日') {
                scheduledShift = 'nik';
                scheduledStart = schedule.start_time || '08:30';
                scheduledEnd = schedule.end_time || '17:15';
                scheduledHours = 7.75;
            } else {
                // 非番、週休などでの打刻（緊急呼び出し・時間外など）
                scheduledShift = 'off';
                scheduledStart = '';
                scheduledEnd = '';
                scheduledHours = 0.0;
            }
        } else {
            // スケジュール未登録時のユーザーの部区分によるデフォルト
            if (req.user.platoon === 'nikkin') {
                scheduledShift = 'nik';
                scheduledHours = 7.75;
            } else {
                // 交代制職員でスケジュール未登録の場合はデフォルトで当務扱いにするか、あるいは休み扱い
                scheduledShift = 'tou';
                scheduledHours = 15.5;
            }
        }
        
        // レコードの作成 (同日での重複打刻はUNIQUE制約でエラーになるためINSERT OR REPLACEまたは確認が必要)
        // ここでは同じ日付(work_date)で既存のレコード(退勤済)がある場合は、エラーにするか、上書きするか。
        // 基本的には同日に2回勤務する場合もあるため、一度退勤済のデータがある場合は別日付とするか、今回はシンプルに1日1件。
        const todayRecord = db.prepare(
            'SELECT * FROM attendance_records WHERE staff_id = ? AND work_date = ?'
        ).get(req.user.id, dateStr);
        
        if (todayRecord) {
            return res.status(400).json({ error: '本日分の出退勤データがすでに存在します（退勤済）。修正が必要な場合は申請を行ってください。' });
        }
        
        const insertQuery = `
            INSERT INTO attendance_records (
                staff_id, work_date, scheduled_shift, scheduled_start, scheduled_end,
                actual_clock_in, rounded_clock_in, scheduled_hours, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const info = db.prepare(insertQuery).run(
            req.user.id,
            dateStr,
            scheduledShift,
            scheduledStart,
            scheduledEnd,
            dateTimeStr,
            roundedIn,
            scheduledHours,
            'working'
        );
        
        // ログ
        db.prepare('INSERT INTO audit_logs (staff_id, action, target_table, target_id, details) VALUES (?, ?, ?, ?, ?)')
            .run(req.user.id, 'clock_in', 'attendance_records', info.lastInsertRowid, `出勤打刻: ${dateTimeStr} (丸め後: ${roundedIn})`);
            
        res.json({
            message: '出勤打刻を記録しました。今日も一日無事故で頑張りましょう！',
            record: {
                id: info.lastInsertRowid,
                work_date: dateStr,
                actual_clock_in: dateTimeStr,
                rounded_clock_in: roundedIn,
                scheduled_shift: scheduledShift,
                status: 'working'
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   POST /api/attendance/clock-out
 * @desc    退勤打刻
 */
router.post('/clock-out', verifyToken, (req, res) => {
    const { dateTimeStr } = getLocalDetails();
    
    try {
        // 未退勤のアクティブなレコードを検索 (最新の1件)
        const activeRecord = db.prepare(
            'SELECT * FROM attendance_records WHERE staff_id = ? AND actual_clock_out IS NULL ORDER BY work_date DESC LIMIT 1'
        ).get(req.user.id);
        
        if (!activeRecord) {
            return res.status(400).json({ error: '出勤打刻が記録されていません。先に出勤打刻を行ってください。' });
        }
        
        // 丸め設定の取得
        const rounding = db.prepare(
            'SELECT * FROM rounding_settings WHERE department_id = ?'
        ).get(req.user.department_id) || { clock_out_unit: 15, clock_out_direction: 'down' };
        
        // 退勤時刻の丸め
        const roundedOut = roundTime(dateTimeStr, rounding.clock_out_unit, rounding.clock_out_direction);
        
        // 労働時間の計算
        const inTime = new Date(activeRecord.rounded_clock_in.replace(/-/g, '/')).getTime();
        const outTime = new Date(roundedOut.replace(/-/g, '/')).getTime();
        
        if (outTime <= inTime) {
            return res.status(400).json({ error: '退勤時刻が出勤時刻以前になっています。正しく丸めが計算できません。' });
        }
        
        const totalBoundHours = (outTime - inTime) / (1000 * 60 * 60); // 拘束時間 (時間単位)
        
        let actualHours = 0.0;
        let overtimeHours = 0.0;
        
        if (activeRecord.scheduled_shift === 'tou') {
            // 当務 (24時間拘束、15.5時間勤務、8.5時間休憩)
            // 拘束時間が24時間以内の場合は休憩時間8.5時間を引く
            if (totalBoundHours <= 24.0) {
                // 1日の勤務で引く休憩時間は、実際の拘束時間に比例させるか、固定で引くか。
                // 消防では基本的に丸24時間勤務した場合は8.5h休憩。
                // 短時間の場合は拘束時間から通常の休憩（4時間につき30分等）を考慮するが、
                // ここでは簡略化し、「最大15.5時間勤務、24時間未満の場合は拘束時間 - (8.5 * 拘束率) または 最小1時間休憩」とする。
                // 安全のため、24h未満でも 休憩比率(8.5/24)を引く。
                const breakTime = (8.5 / 24.0) * totalBoundHours;
                actualHours = Math.max(0, totalBoundHours - breakTime);
                overtimeHours = 0.0;
            } else {
                // 24時間を超える超過勤務
                actualHours = 15.5;
                overtimeHours = totalBoundHours - 24.0; // 24時間を超えた拘束時間は全て超勤(休憩なし計算)
            }
        } else if (activeRecord.scheduled_shift === 'nik') {
            // 日勤 (8.75時間拘束、7.75時間勤務、1時間休憩)
            if (totalBoundHours <= 8.75) {
                // 1時間休憩を差し引く（短すぎる場合は引かない）
                const breakTime = totalBoundHours > 4 ? 1.0 : 0.0;
                actualHours = Math.max(0, totalBoundHours - breakTime);
                overtimeHours = 0.0;
            } else {
                // 8.75時間(8時間45分)を超える超過勤務
                actualHours = 7.75;
                overtimeHours = totalBoundHours - 8.75;
            }
        } else {
            // 非番・休日出勤などの場合（すべての時間が超過勤務扱い）
            // 休憩は4時間につき0.5時間、8時間につき1時間と想定して差し引く
            let breakTime = 0.0;
            if (totalBoundHours > 8.0) {
                breakTime = 1.0;
            } else if (totalBoundHours > 4.0) {
                breakTime = 0.5;
            }
            actualHours = Math.max(0, totalBoundHours - breakTime);
            overtimeHours = actualHours; // 休日勤務はすべて時間外勤務扱い
        }
        
        // 小数点第2位までに丸め
        actualHours = Math.round(actualHours * 100) / 100;
        overtimeHours = Math.round(overtimeHours * 100) / 100;
        
        // データベース更新
        const updateQuery = `
            UPDATE attendance_records 
            SET actual_clock_out = ?, rounded_clock_out = ?, 
                actual_hours = ?, overtime_hours = ?, status = 'present'
            WHERE id = ?
        `;
        db.prepare(updateQuery).run(
            dateTimeStr,
            roundedOut,
            actualHours,
            overtimeHours,
            activeRecord.id
        );
        
        // ログ
        db.prepare('INSERT INTO audit_logs (staff_id, action, target_table, target_id, details) VALUES (?, ?, ?, ?, ?)')
            .run(req.user.id, 'clock_out', 'attendance_records', activeRecord.id, `退勤打刻: ${dateTimeStr} (丸め後: ${roundedOut}), 実労働: ${actualHours}h, 超勤: ${overtimeHours}h`);
            
        res.json({
            message: '退勤打刻を記録しました。今日もお疲れ様でした！',
            record: {
                id: activeRecord.id,
                actual_clock_out: dateTimeStr,
                rounded_clock_out: roundedOut,
                actual_hours: actualHours,
                overtime_hours: overtimeHours,
                status: 'present'
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   GET /api/attendance/today
 * @desc    本日の出勤レコード取得
 */
router.get('/today', verifyToken, (req, res) => {
    const { dateStr } = getLocalDetails();
    
    try {
        // 今日打刻したか、または退勤していないアクティブなレコードを取得
        let record = db.prepare(
            'SELECT * FROM attendance_records WHERE staff_id = ? AND work_date = ?'
        ).get(req.user.id, dateStr);
        
        if (!record) {
            // 未退勤のアクティブなレコードを検索 (前日当務の翌日退勤対応)
            record = db.prepare(
                'SELECT * FROM attendance_records WHERE staff_id = ? AND actual_clock_out IS NULL ORDER BY work_date DESC LIMIT 1'
            ).get(req.user.id);
        }
        
        // 本日の予定勤務形態を取得
        const schedule = db.prepare(
            'SELECT * FROM schedule_entries WHERE staff_id = ? AND work_date = ?'
        ).get(req.user.id, dateStr);
        
        res.json({
            record: record || null,
            schedule: schedule || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   GET /api/attendance/history
 * @desc    勤務履歴一覧取得 (期間指定)
 */
router.get('/history', verifyToken, (req, res) => {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
        return res.status(400).json({ error: '開始日と終了日を指定してください。' });
    }
    
    try {
        const query = `
            SELECT ar.*, 
                   s.name as modified_by_name,
                   a.name as approved_by_name
            FROM attendance_records ar
            LEFT JOIN staff s ON ar.modified_by = s.id
            LEFT JOIN staff a ON ar.approved_by = a.id
            WHERE ar.staff_id = ? AND ar.work_date BETWEEN ? AND ?
            ORDER BY ar.work_date DESC
        `;
        const history = db.prepare(query).all(req.user.id, start_date, end_date);
        res.json({ history });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   PUT /api/attendance/:id/modify
 * @desc    打刻修正申請の作成
 */
router.put('/:id/modify', verifyToken, (req, res) => {
    const attendanceId = req.params.id;
    const { field_name, new_value, reason } = req.body;
    
    if (!field_name || !new_value || !reason) {
        return res.status(400).json({ error: '修正対象フィールド、新しい値、申請理由を入力してください。' });
    }
    
    if (field_name !== 'actual_clock_in' && field_name !== 'actual_clock_out') {
        return res.status(400).json({ error: '不正なフィールド名です。修正できるのは出勤時刻または退勤時刻のみです。' });
    }
    
    try {
        // レコード所有者または権限確認
        const record = db.prepare('SELECT * FROM attendance_records WHERE id = ?').get(attendanceId);
        if (!record) {
            return res.status(404).json({ error: '勤怠データが見つかりません。' });
        }
        
        if (record.staff_id !== req.user.id && req.user.role === 'staff') {
            return res.status(403).json({ error: '他の職員の勤怠データを修正申請することはできません。' });
        }
        
        const oldValue = record[field_name];
        
        // 修正申請レコードを挿入
        const insertQuery = `
            INSERT INTO attendance_modifications (
                attendance_id, field_name, old_value, new_value, reason, requested_by
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const info = db.prepare(insertQuery).run(
            attendanceId,
            field_name,
            oldValue,
            new_value,
            reason,
            req.user.id
        );
        
        // ログ
        db.prepare('INSERT INTO audit_logs (staff_id, action, target_table, target_id, details) VALUES (?, ?, ?, ?, ?)')
            .run(req.user.id, 'request_modification', 'attendance_modifications', info.lastInsertRowid, `修正申請作成: ${field_name} を ${oldValue} から ${new_value} へ`);
            
        res.json({
            message: '修正申請を送信しました。承認をお待ちください。',
            modification_id: info.lastInsertRowid
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   GET /api/attendance/pending
 * @desc    未承認の修正申請一覧取得 (chief/admin用)
 */
router.get('/pending', verifyToken, requireRole('chief', 'admin', 'sysadmin'), (req, res) => {
    try {
        // 自部署の保留中申請の一覧
        // 管理者なら全部署、chiefなら自署のみ
        let query = `
            SELECT am.*, 
                   s.name as staff_name, s.employee_number, 
                   st.name as station_name,
                   ar.work_date
            FROM attendance_modifications am
            JOIN attendance_records ar ON am.attendance_id = ar.id
            JOIN staff s ON ar.staff_id = s.id
            JOIN stations st ON s.station_id = st.id
            WHERE am.status = 'pending'
        `;
        
        let params = [];
        if (req.user.role === 'chief') {
            query += ' AND s.station_id = ?';
            params.push(req.user.station_id);
        }
        
        query += ' ORDER BY am.created_at ASC';
        
        const pending = db.prepare(query).all(...params);
        res.json({ pending });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   PUT /api/attendance/:id/approve
 * @desc    修正申請の承認/却下 (chief/admin用)
 */
router.put('/:id/approve', verifyToken, requireRole('chief', 'admin', 'sysadmin'), (req, res) => {
    const modificationId = req.params.id;
    const { status } = req.body; // 'approved' or 'rejected'
    
    if (status !== 'approved' && status !== 'rejected') {
        return res.status(400).json({ error: 'ステータスは approved または rejected を指定してください。' });
    }
    
    const { dateTimeStr } = getLocalDetails();
    
    try {
        const mod = db.prepare(`
            SELECT am.*, ar.staff_id, ar.scheduled_shift, ar.rounded_clock_in, ar.rounded_clock_out, s.department_id, s.station_id
            FROM attendance_modifications am
            JOIN attendance_records ar ON am.attendance_id = ar.id
            JOIN staff s ON ar.staff_id = s.id
            WHERE am.id = ?
        `).get(modificationId);
        
        if (!mod) {
            return res.status(404).json({ error: '修正申請が見つかりません。' });
        }
        
        if (mod.status !== 'pending') {
            return res.status(400).json({ error: 'この申請はすでに処理済みです。' });
        }
        
        // 階級/署長権限チェック (chiefは自分の署の職員のみ承認可能)
        if (req.user.role === 'chief' && mod.station_id !== req.user.station_id) {
            return res.status(403).json({ error: '管轄外の部署の職員の申請を承認することはできません。' });
        }
        
        // トランザクション処理
        const processApproval = db.transaction(() => {
            // 1. 申請ステータスの更新
            db.prepare('UPDATE attendance_modifications SET status = ?, approved_by = ? WHERE id = ?')
                .run(status, req.user.id, modificationId);
                
            if (status === 'approved') {
                // 2. 勤怠レコードの更新
                const updateField = mod.field_name;
                
                // 丸め設定を取得して再計算
                const rounding = db.prepare('SELECT * FROM rounding_settings WHERE department_id = ?').get(mod.department_id) || { clock_in_unit: 15, clock_in_direction: 'up', clock_out_unit: 15, clock_out_direction: 'down' };
                
                let roundedTimeStr = '';
                if (updateField === 'actual_clock_in') {
                    roundedTimeStr = roundTime(mod.new_value, rounding.clock_in_unit, rounding.clock_in_direction);
                } else {
                    roundedTimeStr = roundTime(mod.new_value, rounding.clock_out_unit, rounding.clock_out_direction);
                }
                
                db.prepare(`
                    UPDATE attendance_records 
                    SET ${updateField} = ?, 
                        ${updateField === 'actual_clock_in' ? 'rounded_clock_in' : 'rounded_clock_out'} = ?,
                        modified_by = ?,
                        modification_reason = ?
                    WHERE id = ?
                `).run(mod.new_value, roundedTimeStr, req.user.id, mod.reason, mod.attendance_id);
                
                // 3. 労働時間の再計算
                const updatedRecord = db.prepare('SELECT * FROM attendance_records WHERE id = ?').get(mod.attendance_id);
                
                if (updatedRecord.rounded_clock_in && updatedRecord.rounded_clock_out) {
                    const inTime = new Date(updatedRecord.rounded_clock_in.replace(/-/g, '/')).getTime();
                    const outTime = new Date(updatedRecord.rounded_clock_out.replace(/-/g, '/')).getTime();
                    
                    if (outTime > inTime) {
                        const totalBoundHours = (outTime - inTime) / (1000 * 60 * 60);
                        
                        let actualHours = 0.0;
                        let overtimeHours = 0.0;
                        
                        if (updatedRecord.scheduled_shift === 'tou') {
                            if (totalBoundHours <= 24.0) {
                                const breakTime = (8.5 / 24.0) * totalBoundHours;
                                actualHours = Math.max(0, totalBoundHours - breakTime);
                            } else {
                                actualHours = 15.5;
                                overtimeHours = totalBoundHours - 24.0;
                            }
                        } else if (updatedRecord.scheduled_shift === 'nik') {
                            if (totalBoundHours <= 8.75) {
                                const breakTime = totalBoundHours > 4 ? 1.0 : 0.0;
                                actualHours = Math.max(0, totalBoundHours - breakTime);
                            } else {
                                actualHours = 7.75;
                                overtimeHours = totalBoundHours - 8.75;
                            }
                        } else {
                            let breakTime = totalBoundHours > 8.0 ? 1.0 : (totalBoundHours > 4.0 ? 0.5 : 0.0);
                            actualHours = Math.max(0, totalBoundHours - breakTime);
                            overtimeHours = actualHours;
                        }
                        
                        actualHours = Math.round(actualHours * 100) / 100;
                        overtimeHours = Math.round(overtimeHours * 100) / 100;
                        
                        db.prepare('UPDATE attendance_records SET actual_hours = ?, overtime_hours = ?, status = ? WHERE id = ?')
                            .run(actualHours, overtimeHours, 'present', mod.attendance_id);
                    }
                }
            }
        });
        
        processApproval();
        
        // ログ
        db.prepare('INSERT INTO audit_logs (staff_id, action, target_table, target_id, details) VALUES (?, ?, ?, ?, ?)')
            .run(req.user.id, `approve_modification_${status}`, 'attendance_modifications', modificationId, `修正申請の処理結果: ${status}`);
            
        res.json({ message: `申請を正常に${status === 'approved' ? '承認' : '却下'}しました。` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

module.exports = router;
