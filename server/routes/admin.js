const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { verifyToken, requireRole } = require('../middleware/auth');

/**
 * @route   GET /api/admin/staff
 * @desc    職員一覧の取得
 */
router.get('/staff', verifyToken, requireRole('chief', 'admin', 'sysadmin'), (req, res) => {
    try {
        let query = `
            SELECT s.id, s.employee_number, s.name, s.platoon, s.rank, 
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
 * @desc    新規職員の登録 (admin, sysadmin)
 */
router.post('/staff', verifyToken, requireRole('admin', 'sysadmin'), (req, res) => {
    const {
        employee_number, pin, name, station_id, platoon, rank,
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
                platoon, rank, has_large_license, is_paramedic, is_rescue, is_kikan,
                is_day_worker, role, annual_leave_balance, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `;
        
        const info = db.prepare(insertQuery).run(
            req.user.department_id,
            station_id,
            employee_number,
            pinHash,
            name,
            platoon,
            rank || '',
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
 * @desc    職員情報の更新 (admin, sysadmin)
 */
router.put('/staff/:id', verifyToken, requireRole('admin', 'sysadmin'), (req, res) => {
    const staffId = req.params.id;
    const {
        pin, name, station_id, platoon, rank,
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
                SET name = ?, station_id = ?, platoon = ?, rank = ?,
                    has_large_license = ?, is_paramedic = ?, is_rescue = ?, is_kikan = ?,
                    is_day_worker = ?, role = ?, annual_leave_balance = ?, is_active = ?
                WHERE id = ?
            `).run(
                name, station_id, platoon, rank || '',
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

module.exports = router;
