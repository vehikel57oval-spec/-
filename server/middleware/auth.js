const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fire_dept_secret_key_2026';

/**
 * JWTトークンを検証するミドルウェア
 */
function verifyToken(req, res, next) {
    // ヘッダーまたはクッキーからトークンを取得
    let token = req.headers['authorization'] || req.cookies?.token;
    
    if (token && token.startsWith('Bearer ')) {
        token = token.slice(7, token.length).trimLeft();
    }
    
    if (!token) {
        return res.status(401).json({ error: '認証トークンがありません。ログインしてください。' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, employee_number, name, role, department_id, station_id }
        next();
    } catch (err) {
        return res.status(403).json({ error: '認証トークンが無効または期限切れです。' });
    }
}

/**
 * 指定したロールのいずれかであるかを検証するミドルウェア
 * @param  {...string} roles - 許可されるロール ('sysadmin', 'admin', 'chief', 'staff')
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'ログインしていません。' });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'この操作を実行する権限がありません。' });
        }
        
        next();
    };
}

module.exports = {
    verifyToken,
    requireRole,
    JWT_SECRET
};
