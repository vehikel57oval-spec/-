const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const { parseDate, getJapaneseHoliday, getHolidayType } = require('../utils/holidays');

/**
 * @route   GET /api/admin/staff
 * @desc    職員一覧の取得
 */
router.get('/staff', verifyToken, requireRole('chief', 'admin', 'sysadmin'), (req, res) => {
    try {
        let query = `
            SELECT s.id, s.employee_number, s.name, s.platoon, s.rank, s.position,
                   s.has_large_license, s.is_paramedic, s.is_rescue, s.is_kikan, 
                   s.is_day_worker, s.role, s.annual_leave_balance, s.is_active,
                   st.name as station_name, st.id as station_id
            FROM staff s
            JOIN stations st ON s.station_id = st.id
            WHERE s.department_id = ?
        `;
        let params = [req.user.department_id];
        
        // 署長(chief)は自分の署の職員のみ閲覧可能
        if (req.user.role === 'chief') {
            query += ' AND s.station_id = ?';
            params.push(req.user.station_id);
        }
        
        query += ' ORDER BY st.id ASC, s.platoon ASC, s.employee_number ASC';
        
        const staffList = db.prepare(query).all(...params);
        res.json({ staff: staffList });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   POST /api/admin/staff
 * @desc    新規職員の登録 (chief, admin, sysadmin)
 */
router.post('/staff', verifyToken, requireRole('chief', 'admin', 'sysadmin'), (req, res) => {
    const {
        employee_number, pin, name, station_id, platoon, rank, position,
        has_large_license, is_paramedic, is_rescue, is_kikan,
        is_day_worker, role, annual_leave_balance
    } = req.body;
    
    if (!employee_number || !pin || !name || !station_id || !platoon || !role) {
        return res.status(400).json({ error: '必須項目が入力されていません。' });
    }
    
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: '暗証番号は4桁の数字で指定してください。' });
    }
    
    try {
        // 職員番号の重複チェック
        const existing = db.prepare('SELECT id FROM staff WHERE employee_number = ?').get(employee_number);
        if (existing) {
            return res.status(400).json({ error: '入力された職員番号はすでに登録されています。' });
        }
        
        // 暗証番号のハッシュ化
        const salt = bcrypt.genSaltSync(10);
        const pinHash = bcrypt.hashSync(pin, salt);
        
        const insertQuery = `
            INSERT INTO staff (
                department_id, station_id, employee_number, pin_hash, name,
                platoon, rank, position, has_large_license, is_paramedic, is_rescue, is_kikan,
                is_day_worker, role, annual_leave_balance, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `;
        
        const info = db.prepare(insertQuery).run(
            req.user.department_id,
            station_id,
            employee_number,
            pinHash,
            name,
            platoon,
            rank || '',
            position || '',
            has_large_license ? 1 : 0,
            is_paramedic ? 1 : 0,
            is_rescue ? 1 : 0,
            is_kikan ? 1 : 0,
            is_day_worker ? 1 : 0,
            role,
            annual_leave_balance || 20.0
        );
        
        // 監査ログ
        db.prepare('INSERT INTO audit_logs (staff_id, action, target_table, target_id, details) VALUES (?, ?, ?, ?, ?)')
            .run(req.user.id, 'create_staff', 'staff', info.lastInsertRowid, `職員作成: ${name} (番号: ${employee_number})`);
            
        res.json({ message: '職員を新規登録しました。', staffId: info.lastInsertRowid });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   PUT /api/admin/staff/:id
 * @desc    職員情報の更新 (chief, admin, sysadmin)
 */
router.put('/staff/:id', verifyToken, requireRole('chief', 'admin', 'sysadmin'), (req, res) => {
    const staffId = req.params.id;
    const {
        pin, name, station_id, platoon, rank, position,
        has_large_license, is_paramedic, is_rescue, is_kikan,
        is_day_worker, role, annual_leave_balance, is_active
    } = req.body;
    
    if (!name || !station_id || !platoon || !role) {
        return res.status(400).json({ error: '必須項目が入力されていません。' });
    }
    
    try {
        const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(staffId);
        if (!staff) {
            return res.status(404).json({ error: '指定された職員が見つかりません。' });
        }
        
        // トランザクション処理で更新
        const updateStaff = db.transaction(() => {
            db.prepare(`
                UPDATE staff 
                SET name = ?, station_id = ?, platoon = ?, rank = ?, position = ?,
                    has_large_license = ?, is_paramedic = ?, is_rescue = ?, is_kikan = ?,
                    is_day_worker = ?, role = ?, annual_leave_balance = ?, is_active = ?
                WHERE id = ?
            `).run(
                name, station_id, platoon, rank || '', position || '',
                has_large_license ? 1 : 0,
                is_paramedic ? 1 : 0,
                is_rescue ? 1 : 0,
                is_kikan ? 1 : 0,
                is_day_worker ? 1 : 0,
                role,
                annual_leave_balance || 20.0,
                is_active !== undefined ? is_active : 1,
                staffId
            );
            
            // 暗証番号が入力されている場合は更新
            if (pin && pin.trim() !== '') {
                if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
                    throw new Error('pin_invalid');
                }
                const salt = bcrypt.genSaltSync(10);
                const pinHash = bcrypt.hashSync(pin, salt);
                db.prepare('UPDATE staff SET pin_hash = ? WHERE id = ?').run(pinHash, staffId);
            }
        });
        
        try {
            updateStaff();
        } catch (trxErr) {
            if (trxErr.message === 'pin_invalid') {
                return res.status(400).json({ error: '暗証番号は4桁の数字で指定してください。' });
            }
            throw trxErr;
        }
        
        // ログ
        db.prepare('INSERT INTO audit_logs (staff_id, action, target_table, target_id, details) VALUES (?, ?, ?, ?, ?)')
            .run(req.user.id, 'update_staff', 'staff', staffId, `職員情報更新: ${name}`);
            
        res.json({ message: '職員情報を更新しました。' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   POST /api/admin/staff/import
 * @desc    CSVから職員リストを一括インポート (Upsert) (chief, admin, sysadmin)
 */
router.post('/staff/import', verifyToken, requireRole('chief', 'admin', 'sysadmin'), (req, res) => {
    const { staffList } = req.body;
    if (!staffList || !Array.isArray(staffList)) {
        return res.status(400).json({ error: 'インポートする職員データが正しくありません。' });
    }

    try {
        let insertCount = 0;
        let updateCount = 0;

        const importTx = db.transaction(() => {
            staffList.forEach(s => {
                const {
                    employee_number, name, platoon, rank, position,
                    has_large_license, is_paramedic, is_rescue, is_kikan,
                    is_day_worker, role, annual_leave_balance, station_id
                } = s;

                if (!employee_number || !name || !platoon || !role || !station_id) {
                    throw new Error(`validation_failed: 職員番号 ${employee_number || '不明'} の必須項目(氏名、部区分、権限、所属ID)が不足しています。`);
                }

                // 既存の職員番号チェック
                const existing = db.prepare('SELECT id FROM staff WHERE employee_number = ?').get(employee_number);

                if (existing) {
                    // アップデート
                    db.prepare(`
                        UPDATE staff
                        SET name = ?, station_id = ?, platoon = ?, rank = ?, position = ?,
                            has_large_license = ?, is_paramedic = ?, is_rescue = ?, is_kikan = ?,
                            is_day_worker = ?, role = ?, annual_leave_balance = ?, is_active = 1
                        WHERE id = ?
                    `).run(
                        name,
                        parseInt(station_id),
                        platoon,
                        rank || '',
                        position || '',
                        parseInt(has_large_license || 0) ? 1 : 0,
                        parseInt(is_paramedic || 0) ? 1 : 0,
                        parseInt(is_rescue || 0) ? 1 : 0,
                        parseInt(is_kikan || 0) ? 1 : 0,
                        parseInt(is_day_worker || 0) ? 1 : 0,
                        role,
                        parseFloat(annual_leave_balance || 20.0),
                        existing.id
                    );
                    updateCount++;
                } else {
                    // 新規追加
                    // デフォルトの暗証番号 '1234'
                    const salt = bcrypt.genSaltSync(10);
                    const pinHash = bcrypt.hashSync('1234', salt);

                    db.prepare(`
                        INSERT INTO staff (
                            department_id, station_id, employee_number, pin_hash, name,
                            platoon, rank, position, has_large_license, is_paramedic, is_rescue, is_kikan,
                            is_day_worker, role, annual_leave_balance, is_active
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                    `).run(
                        req.user.department_id,
                        parseInt(station_id),
                        employee_number,
                        pinHash,
                        name,
                        platoon,
                        rank || '',
                        position || '',
                        parseInt(has_large_license || 0) ? 1 : 0,
                        parseInt(is_paramedic || 0) ? 1 : 0,
                        parseInt(is_rescue || 0) ? 1 : 0,
                        parseInt(is_kikan || 0) ? 1 : 0,
                        parseInt(is_day_worker || 0) ? 1 : 0,
                        role,
                        parseFloat(annual_leave_balance || 20.0)
                    );
                    insertCount++;
                }
            });
        });

        importTx();

        // 監査ログに記録
        db.prepare('INSERT INTO audit_logs (staff_id, action, details) VALUES (?, ?, ?)')
            .run(req.user.id, 'import_staff_csv', `CSVインポート成功: 新規追加 ${insertCount}件, 更新 ${updateCount}件`);

        res.json({ message: `CSVインポートが完了しました。新規登録: ${insertCount}件, 更新: ${updateCount}件` });
    } catch (err) {
        console.error(err);
        if (err.message.startsWith('validation_failed:')) {
            return res.status(400).json({ error: err.message.replace('validation_failed: ', '') });
        }
        res.status(500).json({ error: 'インポート処理中にサーバーエラーが発生しました。データ形式が正しいかご確認ください。' });
    }
});

/**
 * @route   GET /api/admin/dashboard
 * @desc    管理者ダッシュボード用の統計データ取得
 */
router.get('/dashboard', verifyToken, requireRole('chief', 'admin', 'sysadmin'), (req, res) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    
    try {
        let staffCountParams = [req.user.department_id];
        let attendanceParams = [req.user.department_id, today];
        let pendingParams = [];
        
        // 所属拠点フィルタ
        let stationFilterStaff = '';
        let stationFilterAtt = '';
        let stationFilterPend = '';
        
        if (req.user.role === 'chief') {
            stationFilterStaff = ' AND s.station_id = ?';
            staffCountParams.push(req.user.station_id);
            
            stationFilterAtt = ' AND s.station_id = ?';
            attendanceParams.push(req.user.station_id);
            
            stationFilterPend = ' AND s.station_id = ?';
            pendingParams.push(req.user.station_id);
        }
        
        // 1. 在籍総職員数
        const totalStaff = db.prepare(`
            SELECT COUNT(*) as count FROM staff s WHERE s.department_id = ? AND s.is_active = 1 ${stationFilterStaff}
        `).get(...staffCountParams).count;
        
        // 2. 本日の出勤中人数（status = 'working'）
        const workingStaff = db.prepare(`
            SELECT COUNT(*) as count 
            FROM attendance_records ar
            JOIN staff s ON ar.staff_id = s.id
            WHERE s.department_id = ? AND ar.work_date = ? AND ar.status = 'working' ${stationFilterAtt}
        `).get(...attendanceParams).count;
        
        // 3. 本日の退勤済人数（status = 'present'）
        const presentStaff = db.prepare(`
            SELECT COUNT(*) as count 
            FROM attendance_records ar
            JOIN staff s ON ar.staff_id = s.id
            WHERE s.department_id = ? AND ar.work_date = ? AND ar.status = 'present' ${stationFilterAtt}
        `).get(...attendanceParams).count;
        
        // 4. 保留中の修正申請数
        let pendingCountQuery = `
            SELECT COUNT(*) as count 
            FROM attendance_modifications am
            JOIN attendance_records ar ON am.attendance_id = ar.id
            JOIN staff s ON ar.staff_id = s.id
            WHERE am.status = 'pending'
        `;
        if (req.user.role === 'chief') {
            pendingCountQuery += ' AND s.station_id = ?';
        }
        const pendingApprovals = db.prepare(pendingCountQuery).get(...pendingParams).count;
        
        // 5. 本日の当務スケジュール人数と日勤人数
        const todaySchedules = db.prepare(`
            SELECT 
                SUM(CASE WHEN se.shift_key = '当' THEN 1 ELSE 0 END) as tou_count,
                SUM(CASE WHEN se.shift_key = '日' THEN 1 ELSE 0 END) as nik_count
            FROM schedule_entries se
            JOIN staff s ON se.staff_id = s.id
            WHERE s.department_id = ? AND se.work_date = ? ${stationFilterAtt}
        `).get(...attendanceParams);
        
        res.json({
            stats: {
                total_staff: totalStaff,
                working_now: workingStaff,
                completed_today: presentStaff,
                pending_approvals: pendingApprovals,
                scheduled_tou: todaySchedules.tou_count || 0,
                scheduled_nik: todaySchedules.nik_count || 0
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   GET /api/admin/settings
 * @desc    本部設定・丸め設定の取得
 */
router.get('/settings', verifyToken, requireRole('admin', 'sysadmin'), (req, res) => {
    try {
        const dept = db.prepare('SELECT * FROM fire_departments WHERE id = ?').get(req.user.department_id);
        const rounding = db.prepare('SELECT * FROM rounding_settings WHERE department_id = ?').get(req.user.department_id);
        
        res.json({
            department: dept,
            rounding: rounding || {
                clock_in_unit: 15,
                clock_in_direction: 'up',
                clock_out_unit: 15,
                clock_out_direction: 'down'
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   PUT /api/admin/settings
 * @desc    本部設定・丸め設定の更新
 */
router.put('/settings', verifyToken, requireRole('admin', 'sysadmin'), (req, res) => {
    const {
        name, shift_system, cycle_days,
        clock_in_unit, clock_in_direction, clock_out_unit, clock_out_direction
    } = req.body;
    
    if (!name || !shift_system || !cycle_days || !clock_in_unit || !clock_in_direction || !clock_out_unit || !clock_out_direction) {
        return res.status(400).json({ error: '設定パラメータが足りません。' });
    }
    
    try {
        const updateSettings = db.transaction(() => {
            // 本部名・シフト体制更新
            db.prepare('UPDATE fire_departments SET name = ?, shift_system = ?, cycle_days = ? WHERE id = ?')
                .run(name, shift_system, cycle_days, req.user.department_id);
                
            // 丸め設定更新 (なければ挿入)
            db.prepare(`
                INSERT INTO rounding_settings (department_id, clock_in_unit, clock_in_direction, clock_out_unit, clock_out_direction)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(department_id) DO UPDATE SET
                    clock_in_unit = excluded.clock_in_unit,
                    clock_in_direction = excluded.clock_in_direction,
                    clock_out_unit = excluded.clock_out_unit,
                    clock_out_direction = excluded.clock_out_direction
            `).run(
                req.user.department_id,
                clock_in_unit,
                clock_in_direction,
                clock_out_unit,
                clock_out_direction
            );
        });
        
        updateSettings();
        
        // ログ
        db.prepare('INSERT INTO audit_logs (staff_id, action, details) VALUES (?, ?, ?)')
            .run(req.user.id, 'update_settings', `設定更新: ${name}, システム: ${shift_system}, サイクル: ${cycle_days}日, 丸め: 出勤 ${clock_in_unit}分(${clock_in_direction}) / 退勤 ${clock_out_unit}分(${clock_out_direction})`);
            
        res.json({ message: 'システム設定を更新しました。' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

// A当番（第1小隊当直）の日かどうかを判定する
function isPlatoon1DutyDay(dateStr, anchorDateStr) {
    const anchor = parseDate(anchorDateStr || '2026-06-01');
    const target = parseDate(dateStr);
    const diffTime = Math.abs(target - anchor);
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) * (target < anchor ? -1 : 1);
    
    return (diffDays % 2 === 0);
}

// 翌日の日付文字列
function getNextDate(dateStr) {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dateVal = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dateVal}`;
}

// 前日の日付文字列
function getPreviousDate(dateStr) {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dateVal = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dateVal}`;
}

// 祝日手当の自動計算ロジック
function calculateHolidayAllowanceInternal(staff, yearMonth, anchorDateStr) {
    if (!anchorDateStr) {
        anchorDateStr = '2026-06-01'; // デフォルト (第1小隊当直日)
        try {
            const row = db.prepare('SELECT start_date FROM schedule_staff_overrides LIMIT 1').get();
            if (row && row.start_date) {
                anchorDateStr = row.start_date;
            }
        } catch (e) {
            // ignore
        }
    }

    const yearMonthParts = yearMonth.split('-');
    const year = parseInt(yearMonthParts[0], 10);
    const month = parseInt(yearMonthParts[1], 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    const platoon = staff.platoon;
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;
    
    // schedule_entries から当月のシフト取得
    const entries = db.prepare('SELECT * FROM schedule_entries WHERE staff_id = ? AND work_date BETWEEN ? AND ?')
        .all(staff.id, startDate, endDate);
        
    const entryMap = {};
    entries.forEach(e => {
        entryMap[e.work_date] = e.shift_key;
    });
    
    // 休暇申請取得
    const leaves = db.prepare('SELECT * FROM leave_requests WHERE staff_id = ? AND status = "approved" AND (start_date <= ? AND end_date >= ?)')
        .all(staff.id, endDate, startDate);
        
    const leaveMap = {};
    leaves.forEach(l => {
        const start = parseDate(l.start_date);
        const end = parseDate(l.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dateVal = String(d.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${dateVal}`;
            if (dateStr >= startDate && dateStr <= endDate) {
                leaveMap[dateStr] = l.leave_type;
            }
        }
    });

    const details = [];
    const slideQueue12 = [];
    const slideQueue4 = [];
    const allowanceMap = {};

    function getActualShift(dateStr, baseShift, entryMap) {
        const raw = entryMap[dateStr];
        if (raw && raw !== '-') return raw;
        if (baseShift === '当') return '当';
        if (baseShift === '非') return '明';
        return '日';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${yearMonth}-${String(day).padStart(2, '0')}`;
        const holidayType = getHolidayType(dateStr);
        const isHol = (holidayType !== null);
        
        let baseShift = '非';
        if (platoon === '1bu') {
            baseShift = isPlatoon1DutyDay(dateStr, anchorDateStr) ? '当' : '非';
        } else if (platoon === '2bu') {
            baseShift = isPlatoon1DutyDay(dateStr, anchorDateStr) ? '非' : '当';
        } else {
            baseShift = '日';
        }

        const actualShift = getActualShift(dateStr, baseShift, entryMap);
        
        if (isHol && (platoon === '1bu' || platoon === '2bu')) {
            const isLawHoliday = (holidayType === 'national');
            
            if (baseShift === '当') {
                if (actualShift === '休' || actualShift === '公' || actualShift === '週' || leaveMap[dateStr] === 'compensatory') {
                    if (isLawHoliday) {
                        slideQueue12.push({ sourceDate: dateStr });
                    }
                } else if (leaveMap[dateStr]) {
                    // 有給休暇・病休・特休等の場合は勤務していないため手当対象外（カット）
                    allowanceMap[dateStr] = {
                        type: '当日分',
                        original_hours: 12.0,
                        hours: 0.0,
                        is_cut: true,
                        reason: 'leave_on_holiday'
                    };
                } else {
                    allowanceMap[dateStr] = {
                        type: '当日分',
                        original_hours: 12.0,
                        hours: 12.0,
                        is_cut: false,
                        reason: 'duty_on_holiday'
                    };
                }
            } else if (baseShift === '非') {
                const isNewYear = (dateStr.endsWith('-12-29') || dateStr.endsWith('-12-30') || dateStr.endsWith('-12-31') || dateStr.endsWith('-01-02') || dateStr.endsWith('-01-03'));
                const hours = isNewYear ? 3.5 : 4.0;
                
                const yesterdayStr = getPreviousDate(dateStr);
                const yesterdayBaseShift = platoon === '1bu' ? (isPlatoon1DutyDay(yesterdayStr, anchorDateStr) ? '当' : '非') : (isPlatoon1DutyDay(yesterdayStr, anchorDateStr) ? '非' : '当');
                const yesterdayActualShift = getActualShift(yesterdayStr, yesterdayBaseShift, entryMap);
                
                // 前日に当直（当）予定であり、かつ週休・公休・有給等の休暇ではない＝実際に当直勤務を行っていたこと
                const wasOnDutyYesterday = (yesterdayBaseShift === '当') && (yesterdayActualShift !== '休' && yesterdayActualShift !== '公' && yesterdayActualShift !== '週') && !leaveMap[yesterdayStr];
                
                if (actualShift === '休' || actualShift === '公' || actualShift === '週' || leaveMap[dateStr] === 'compensatory') {
                    if (wasOnDutyYesterday) {
                        // 前日当直していたら朝の勤務が発生するため、当日公休であっても支給（スライドなし）
                        allowanceMap[dateStr] = {
                            type: '当日分',
                            original_hours: hours,
                            hours: hours,
                            is_cut: false,
                            reason: 'duty_on_holiday_off'
                        };
                    } else {
                        if (isLawHoliday) {
                            slideQueue4.push({ sourceDate: dateStr, hours: hours });
                        }
                    }
                } else if (leaveMap[dateStr]) {
                    if (wasOnDutyYesterday) {
                        allowanceMap[dateStr] = {
                            type: '当日分',
                            original_hours: hours,
                            hours: hours,
                            is_cut: false,
                            reason: 'duty_on_holiday_off'
                        };
                    } else {
                        // 前日に勤務しておらず、本日も休暇の場合はカット
                        allowanceMap[dateStr] = {
                            type: '当日分',
                            original_hours: hours,
                            hours: 0.0,
                            is_cut: true,
                            reason: 'leave_on_holiday'
                        };
                    }
                } else {
                    if (wasOnDutyYesterday) {
                        allowanceMap[dateStr] = {
                            type: '当日分',
                            original_hours: hours,
                            hours: hours,
                            is_cut: false,
                            reason: 'duty_on_holiday_off'
                        };
                    } else {
                        allowanceMap[dateStr] = {
                            type: '当日分',
                            original_hours: hours,
                            hours: 0.0,
                            is_cut: true,
                            reason: 'no_duty_yesterday'
                        };
                    }
                }
            }
        }
    }
    
    slideQueue12.forEach(item => {
        let targetDate = getNextDate(item.sourceDate);
        let mapped = false;
        let limit = 0;
        
        while (!mapped && limit < 60) {
            limit++;
            const baseShift = platoon === '1bu' ? (isPlatoon1DutyDay(targetDate, anchorDateStr) ? '当' : '非') : (isPlatoon1DutyDay(targetDate, anchorDateStr) ? '非' : '当');
            const actualShift = getActualShift(targetDate, baseShift, entryMap);
            
            const isOriginalHoliday = (actualShift === '休' || actualShift === '公' || actualShift === '週' || getHolidayType(targetDate) !== null) && (leaveMap[targetDate] !== 'compensatory');
            
            if (baseShift === '当' && !isOriginalHoliday && !allowanceMap[targetDate]) {
                // 週休・公休・有給休暇等の休暇がある場合は手当カット
                const isCut = (actualShift === '休' || actualShift === '公' || actualShift === '週' || !!leaveMap[targetDate]);
                allowanceMap[targetDate] = {
                    type: 'スライド分',
                    original_hours: 12.0,
                    hours: isCut ? 0.0 : 12.0,
                    is_cut: isCut,
                    reason: isCut ? (leaveMap[targetDate] === 'compensatory' ? 'cut_due_to_substitute_holiday' : 'leave_on_holiday') : `slided_from_${item.sourceDate}`,
                    source_date: item.sourceDate
                };
                mapped = true;
            } else {
                targetDate = getNextDate(targetDate);
            }
        }
    });

    slideQueue4.forEach(item => {
        let targetDate = getNextDate(item.sourceDate);
        let mapped = false;
        let limit = 0;
        
        while (!mapped && limit < 60) {
            limit++;
            const baseShift = platoon === '1bu' ? (isPlatoon1DutyDay(targetDate, anchorDateStr) ? '当' : '非') : (isPlatoon1DutyDay(targetDate, anchorDateStr) ? '非' : '当');
            const actualShift = getActualShift(targetDate, baseShift, entryMap);
            
            const isOriginalHoliday = (actualShift === '休' || actualShift === '公' || actualShift === '週' || getHolidayType(targetDate) !== null) && (leaveMap[targetDate] !== 'compensatory');
            
            if (baseShift === '非' && !isOriginalHoliday && !allowanceMap[targetDate]) {
                const isCut = (actualShift === '休' || actualShift === '公' || actualShift === '週' || !!leaveMap[targetDate]);
                allowanceMap[targetDate] = {
                    type: 'スライド分',
                    original_hours: item.hours,
                    hours: isCut ? 0.0 : item.hours,
                    is_cut: isCut,
                    reason: isCut ? (leaveMap[targetDate] === 'compensatory' ? 'cut_due_to_substitute_holiday' : 'leave_on_holiday') : `slided_from_${item.sourceDate}`,
                    source_date: item.sourceDate
                };
                mapped = true;
            } else {
                targetDate = getNextDate(targetDate);
            }
        }
    });

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${yearMonth}-${String(day).padStart(2, '0')}`;
        const item = allowanceMap[dateStr];
        
        const isHol = (getHolidayType(dateStr) !== null);
        const baseShift = platoon === '1bu' ? (isPlatoon1DutyDay(dateStr, anchorDateStr) ? '当' : '非') : (isPlatoon1DutyDay(dateStr, anchorDateStr) ? '非' : '当');
        const actualShift = getActualShift(dateStr, baseShift, entryMap);

        if (item) {
            details.push({
                date: dateStr,
                holiday_name: getJapaneseHoliday(parseDate(dateStr)) || '条例休日',
                base_shift: baseShift,
                actual_shift: actualShift,
                type: item.type,
                original_hours: item.original_hours,
                hours: item.hours,
                is_cut: item.is_cut,
                reason: item.reason,
                source_date: item.source_date || null
            });
        } else {
            details.push({
                date: dateStr,
                holiday_name: isHol ? (getJapaneseHoliday(parseDate(dateStr)) || '条例休日') : null,
                base_shift: baseShift,
                actual_shift: actualShift,
                type: '対象外',
                original_hours: 0.0,
                hours: 0.0,
                is_cut: false,
                reason: 'no_holiday_duty'
            });
        }
    }
    
    // 合計時間の算出
    const totalHours = details.push ? details.reduce((sum, d) => sum + d.hours, 0.0) : 0.0;
    
    return {
        details,
        totalHours
    };
}

/**
 * @route   GET /api/admin/holiday-allowance
 * @desc    月次祝日手当一覧の取得 (自動計算＆確定台帳ロード)
 */
router.get('/holiday-allowance', verifyToken, requireRole('chief', 'admin', 'sysadmin'), (req, res) => {
    const { year_month } = req.query;
    if (!year_month || !/^\d{4}-\d{2}$/.test(year_month)) {
        return res.status(400).json({ error: '対象月度 (YYYY-MM) を指定してください。' });
    }
    
    try {
        let query = `
            SELECT s.id, s.employee_number, s.name, s.platoon, s.rank, 
                   st.name as station_name, st.id as station_id
            FROM staff s
            JOIN stations st ON s.station_id = st.id
            WHERE s.department_id = ? AND s.is_active = 1 AND s.platoon IN ('1bu', '2bu')
        `;
        let params = [req.user.department_id];
        
        if (req.user.role === 'chief') {
            query += ' AND s.station_id = ?';
            params.push(req.user.station_id);
        }
        
        query += ' ORDER BY st.id ASC, s.employee_number ASC';
        const staffList = db.prepare(query).all(...params);
        
        let anchorDateStr = '2026-06-01'; // デフォルト (第1小隊当直日)
        try {
            const row = db.prepare('SELECT start_date FROM schedule_staff_overrides LIMIT 1').get();
            if (row && row.start_date) {
                anchorDateStr = row.start_date;
            }
        } catch (e) {
            // ignore
        }

        const ledgers = db.prepare('SELECT * FROM holiday_allowance_ledgers WHERE year_month = ?').all(year_month);
        const ledgerMap = {};
        ledgers.forEach(l => {
            ledgerMap[l.staff_id] = l;
        });
        
        const results = staffList.map(staff => {
            const ledger = ledgerMap[staff.id];
            if (ledger) {
                const details = typeof ledger.details === 'string' ? JSON.parse(ledger.details) : ledger.details;
                
                const holiday_tou = details.filter(d => d.type === '当日分' && d.base_shift === '当' && !d.is_cut).length;
                const holiday_off = details.filter(d => d.type === '当日分' && d.base_shift === '非' && !d.is_cut).length;
                const slided_days = details.filter(d => d.type === 'スライド分' && !d.is_cut).length;

                return {
                    staff_id: staff.id,
                    employee_number: staff.employee_number,
                    name: staff.name,
                    platoon: staff.platoon,
                    rank: staff.rank,
                    station_name: staff.station_name,
                    station_id: staff.station_id,
                    holiday_tou,
                    holiday_off,
                    slided_days,
                    total_hours: ledger.total_hours,
                    status: ledger.status,
                    confirmed_at: ledger.confirmed_at
                };
            } else {
                const { details, totalHours } = calculateHolidayAllowanceInternal(staff, year_month, anchorDateStr);
                
                const holiday_tou = details.filter(d => d.type === '当日分' && d.base_shift === '当' && !d.is_cut).length;
                const holiday_off = details.filter(d => d.type === '当日分' && d.base_shift === '非' && !d.is_cut).length;
                const slided_days = details.filter(d => d.type === 'スライド分' && !d.is_cut).length;

                return {
                    staff_id: staff.id,
                    employee_number: staff.employee_number,
                    name: staff.name,
                    platoon: staff.platoon,
                    rank: staff.rank,
                    station_name: staff.station_name,
                    station_id: staff.station_id,
                    holiday_tou,
                    holiday_off,
                    slided_days,
                    total_hours: totalHours,
                    status: 'auto',
                    confirmed_at: null
                };
            }
        });
        
        res.json({ results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   GET /api/admin/holiday-allowance/staff/:staffId
 * @desc    個別職員の月次詳細・マッピングの取得
 */
router.get('/holiday-allowance/staff/:staffId', verifyToken, requireRole('chief', 'admin', 'sysadmin'), (req, res) => {
    const { staffId } = req.params;
    const { year_month } = req.query;
    
    if (!year_month || !/^\d{4}-\d{2}$/.test(year_month)) {
        return res.status(400).json({ error: '対象月度 (YYYY-MM) を指定してください。' });
    }
    
    try {
        const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(staffId);
        if (!staff) {
            return res.status(404).json({ error: '指定された職員が見つかりません。' });
        }
        
        let anchorDateStr = '2026-06-01'; // デフォルト (第1小隊当直日)
        try {
            const row = db.prepare('SELECT start_date FROM schedule_staff_overrides LIMIT 1').get();
            if (row && row.start_date) {
                anchorDateStr = row.start_date;
            }
        } catch (e) {
            // ignore
        }

        const ledger = db.prepare('SELECT * FROM holiday_allowance_ledgers WHERE year_month = ? AND staff_id = ?').get(year_month, staffId);
        
        if (ledger) {
            const details = typeof ledger.details === 'string' ? JSON.parse(ledger.details) : ledger.details;
            res.json({
                staff,
                status: ledger.status,
                details,
                total_hours: ledger.total_hours,
                confirmed_at: ledger.confirmed_at
            });
        } else {
            const { details, totalHours } = calculateHolidayAllowanceInternal(staff, year_month, anchorDateStr);
            res.json({
                staff,
                status: 'auto',
                details,
                total_hours: totalHours,
                confirmed_at: null
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   POST /api/admin/holiday-allowance/save
 * @desc    職員の祝日手当の手動調整の保存 (draftとして保存)
 */
router.post('/holiday-allowance/save', verifyToken, requireRole('chief', 'admin', 'sysadmin'), (req, res) => {
    const { year_month, staff_id, details, total_hours } = req.body;
    
    if (!year_month || !staff_id || !details || total_hours === undefined) {
        return res.status(400).json({ error: 'パラメータが不足しています。' });
    }
    
    try {
        const existing = db.prepare('SELECT * FROM holiday_allowance_ledgers WHERE year_month = ? AND staff_id = ?').get(year_month, staff_id);
        if (existing && existing.status === 'locked') {
            return res.status(400).json({ error: 'このデータはすでに確定（ロック）されているため編集できません。' });
        }
        
        const detailsJson = typeof details === 'string' ? details : JSON.stringify(details);
        
        db.prepare(`
            INSERT OR REPLACE INTO holiday_allowance_ledgers 
            (year_month, staff_id, status, details, total_hours, confirmed_by, confirmed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            year_month,
            parseInt(staff_id),
            'draft',
            detailsJson,
            parseFloat(total_hours),
            null,
            null
        );
        
        res.json({ message: '手動調整内容を一時保存しました。' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   POST /api/admin/holiday-allowance/lock
 * @desc    月次祝日手当の確定・ロック (指定の年月の一括確定または単一職員確定)
 */
router.post('/holiday-allowance/lock', verifyToken, requireRole('chief', 'admin', 'sysadmin'), (req, res) => {
    const { year_month, staff_id } = req.body;
    
    if (!year_month) {
        return res.status(400).json({ error: '対象月度 (year_month) が必要です。' });
    }
    
    try {
        const confirmedAt = new Date().toISOString();
        
        let anchorDateStr = '2026-06-01'; // デフォルト (第1小隊当直日)
        try {
            const row = db.prepare('SELECT start_date FROM schedule_staff_overrides LIMIT 1').get();
            if (row && row.start_date) {
                anchorDateStr = row.start_date;
            }
        } catch (e) {
            // ignore
        }

        if (staff_id) {
            const existing = db.prepare('SELECT * FROM holiday_allowance_ledgers WHERE year_month = ? AND staff_id = ?').get(year_month, staff_id);
            let detailsJson, totalHours;
            
            if (existing) {
                detailsJson = typeof existing.details === 'string' ? existing.details : JSON.stringify(existing.details);
                totalHours = existing.total_hours;
            } else {
                const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(staff_id);
                if (!staff) return res.status(404).json({ error: '職員が見つかりません。' });
                const { details, totalHours: computedHours } = calculateHolidayAllowanceInternal(staff, year_month, anchorDateStr);
                detailsJson = JSON.stringify(details);
                totalHours = computedHours;
            }
            
            db.prepare(`
                INSERT OR REPLACE INTO holiday_allowance_ledgers 
                (year_month, staff_id, status, details, total_hours, confirmed_by, confirmed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                year_month,
                parseInt(staff_id),
                'locked',
                detailsJson,
                totalHours,
                req.user.id,
                confirmedAt
            );
            
            db.prepare('INSERT INTO audit_logs (staff_id, action, details) VALUES (?, ?, ?)')
                .run(req.user.id, 'lock_holiday_allowance_individual', `祝日手当確定 (職員ID: ${staff_id}, 月度: ${year_month})`);
                
        } else {
            let query = `
                SELECT s.id, s.platoon FROM staff s 
                WHERE s.department_id = ? AND s.is_active = 1 AND s.platoon IN ('1bu', '2bu')
            `;
            let params = [req.user.department_id];
            if (req.user.role === 'chief') {
                query += ' AND s.station_id = ?';
                params.push(req.user.station_id);
            }
            const staffList = db.prepare(query).all(...params);
            
            db.transaction(() => {
                staffList.forEach(staff => {
                    const existing = db.prepare('SELECT * FROM holiday_allowance_ledgers WHERE year_month = ? AND staff_id = ?').get(year_month, staff.id);
                    let detailsJson, totalHours;
                    
                    if (existing) {
                        detailsJson = typeof existing.details === 'string' ? existing.details : JSON.stringify(existing.details);
                        totalHours = existing.total_hours;
                    } else {
                        const { details, totalHours: computedHours } = calculateHolidayAllowanceInternal(staff, year_month, anchorDateStr);
                        detailsJson = JSON.stringify(details);
                        totalHours = computedHours;
                    }
                    
                    db.prepare(`
                        INSERT OR REPLACE INTO holiday_allowance_ledgers 
                        (year_month, staff_id, status, details, total_hours, confirmed_by, confirmed_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        year_month,
                        staff.id,
                        'locked',
                        detailsJson,
                        totalHours,
                        req.user.id,
                        confirmedAt
                    );
                });
            })();
            
            db.prepare('INSERT INTO audit_logs (staff_id, action, details) VALUES (?, ?, ?)')
                .run(req.user.id, 'lock_holiday_allowance_bulk', `祝日手当一括確定 (月度: ${year_month})`);
        }
        
        res.json({ message: '手当データを確定（ロック）しました。' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   POST /api/admin/holiday-allowance/unlock
 * @desc    確定ロックの解除 (年月の全職員または単一職員の台帳レコード削除)
 */
router.post('/holiday-allowance/unlock', verifyToken, requireRole('chief', 'admin', 'sysadmin'), (req, res) => {
    const { year_month, staff_id } = req.body;
    
    if (!year_month) {
        return res.status(400).json({ error: '対象月度 (year_month) が必要です。' });
    }
    
    try {
        if (staff_id) {
            db.prepare('DELETE FROM holiday_allowance_ledgers WHERE year_month = ? AND staff_id = ?').run(year_month, staff_id);
            
            db.prepare('INSERT INTO audit_logs (staff_id, action, details) VALUES (?, ?, ?)')
                .run(req.user.id, 'unlock_holiday_allowance_individual', `祝日手当確定解除 (職員ID: ${staff_id}, 月度: ${year_month})`);
        } else {
            let query = `
                SELECT s.id FROM staff s 
                WHERE s.department_id = ? AND s.is_active = 1 AND s.platoon IN ('1bu', '2bu')
            `;
            let params = [req.user.department_id];
            if (req.user.role === 'chief') {
                query += ' AND s.station_id = ?';
                params.push(req.user.station_id);
            }
            const staffList = db.prepare(query).all(...params);
            
            db.transaction(() => {
                staffList.forEach(staff => {
                    db.prepare('DELETE FROM holiday_allowance_ledgers WHERE year_month = ? AND staff_id = ?').run(year_month, staff.id);
                });
            })();
            
            db.prepare('INSERT INTO audit_logs (staff_id, action, details) VALUES (?, ?, ?)')
                .run(req.user.id, 'unlock_holiday_allowance_bulk', `祝日手当一括確定解除 (月度: ${year_month})`);
        }
        
        res.json({ message: '確定ロックを解除し、自動計算状態へリセットしました。' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

router.calculateHolidayAllowanceInternal = calculateHolidayAllowanceInternal;
module.exports = router;
