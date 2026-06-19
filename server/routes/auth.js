const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');

/**
 * @route   GET /api/auth/departments
 * @desc    登録済みの消防本部一覧（名称とコード）を取得
 */
router.get('/departments', (req, res) => {
    try {
        const query = 'SELECT id, name, code FROM fire_departments';
        const departments = db.prepare(query).all();
        res.json({ departments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '消防本部リストの取得に失敗しました。' });
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    消防本部コード、職員番号、暗証番号(4桁)でログイン
 */
router.post('/login', (req, res) => {
    const { department_code, employee_number, pin } = req.body;
    
    if (!department_code || !employee_number || !pin) {
        return res.status(400).json({ error: '消防本部、職員番号、暗証番号を入力してください。' });
    }
    
    try {
        // 職員をデータベースから取得
        const query = `
            SELECT s.*, fd.name as department_name, st.name as station_name 
            FROM staff s
            JOIN fire_departments fd ON s.department_id = fd.id
            JOIN stations st ON s.station_id = st.id
            WHERE fd.code = ? AND s.employee_number = ? AND s.is_active = 1
        `;
        const staff = db.prepare(query).get(department_code, employee_number);
        
        if (!staff) {
            return res.status(401).json({ error: '職員番号または暗証番号が正しくありません。' });
        }
        
        // 暗証番号を比較
        const isMatch = bcrypt.compareSync(pin, staff.pin_hash);
        if (!isMatch) {
            return res.status(401).json({ error: '職員番号または暗証番号が正しくありません。' });
        }
        
        // トークン生成用のペイロード作成
        const payload = {
            id: staff.id,
            employee_number: staff.employee_number,
            name: staff.name,
            role: staff.role,
            department_id: staff.department_id,
            department_name: staff.department_name,
            station_id: staff.station_id,
            station_name: staff.station_name,
            platoon: staff.platoon,
            rank: staff.rank,
            annual_leave_balance: staff.annual_leave_balance
        };
        
        // トークンの署名 (有効期限: 24時間)
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
        
        // クッキー設定 (セキュリティ上の理由からHTTP-Onlyを推奨)
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24時間
        });
        
        // ログイン成功ログ
        db.prepare('INSERT INTO audit_logs (staff_id, action, details) VALUES (?, ?, ?)')
            .run(staff.id, 'login', 'ログイン成功');

        res.json({
            message: 'ログインに成功しました。',
            token,
            user: payload
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   POST /api/auth/logout
 * @desc    ログアウト
 */
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'ログアウトしました。' });
});

/**
 * @route   GET /api/auth/me
 * @desc    現在の認証ユーザー情報を取得
 */
router.get('/me', verifyToken, (req, res) => {
    try {
        const query = `
            SELECT s.id, s.employee_number, s.name, s.role, s.platoon, s.rank, 
                   s.has_large_license, s.is_paramedic, s.is_rescue, s.is_kikan, 
                   s.is_day_worker, s.annual_leave_balance, s.department_id, s.station_id,
                   fd.name as department_name, st.name as station_name 
            FROM staff s
            JOIN fire_departments fd ON s.department_id = fd.id
            JOIN stations st ON s.station_id = st.id
            WHERE s.id = ? AND s.is_active = 1
        `;
        const staff = db.prepare(query).get(req.user.id);
        
        if (!staff) {
            return res.status(404).json({ error: '職員情報が見つかりません。' });
        }
        
        res.json({ user: staff });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   PUT /api/auth/change-pin
 * @desc    暗証番号の変更
 */
router.put('/change-pin', verifyToken, (req, res) => {
    const { old_pin, new_pin } = req.body;
    
    if (!old_pin || !new_pin) {
        return res.status(400).json({ error: '旧暗証番号と新暗証番号を入力してください。' });
    }
    
    if (new_pin.length !== 4 || !/^\d{4}$/.test(new_pin)) {
        return res.status(400).json({ error: '新しい暗証番号は4桁の数字で指定してください。' });
    }
    
    try {
        const staff = db.prepare('SELECT pin_hash FROM staff WHERE id = ?').get(req.user.id);
        
        if (!staff) {
            return res.status(404).json({ error: '職員情報が見つかりません。' });
        }
        
        const isMatch = bcrypt.compareSync(old_pin, staff.pin_hash);
        if (!isMatch) {
            return res.status(400).json({ error: '旧暗証番号が正しくありません。' });
        }
        
        // 新しい暗証番号をハッシュ化して保存
        const salt = bcrypt.genSaltSync(10);
        const newPinHash = bcrypt.hashSync(new_pin, salt);
        
        db.prepare('UPDATE staff SET pin_hash = ? WHERE id = ?').run(newPinHash, req.user.id);
        
        // ログ書き込み
        db.prepare('INSERT INTO audit_logs (staff_id, action, details) VALUES (?, ?, ?)')
            .run(req.user.id, 'change_pin', '暗証番号の変更');
            
        res.json({ message: '暗証番号を正常に変更しました。' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   POST /api/auth/log-error
 * @desc    フロントエンドで発生したエラーをログ出力する
 */
router.post('/log-error', (req, res) => {
    const errorData = req.body;
    console.error('=== [CLIENT ERROR RECEIVED] ===');
    console.error('Type:', errorData.type);
    console.error('Message:', errorData.message);
    console.error('File:', errorData.filename, 'Line:', errorData.lineno, 'Col:', errorData.colno);
    console.error('Stack:', errorData.stack);
    console.error('===============================');
    res.json({ success: true });
});

module.exports = router;
