const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

// データベースの初期化を実行するため、ここでロードする
require('./db/database');

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const adminRoutes = require('./routes/admin');
const scheduleRoutes = require('./routes/schedule');

const app = express();
const PORT = process.env.PORT || 3000;

// セキュリティ＆共通ミドルウェアの設定
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
            "script-src-attr": ["'unsafe-inline'"],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com"]
        }
    }
}));
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// APIルートのマウント
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/schedule', scheduleRoutes);

// 静的ファイルの提供 (フロントエンド)
app.use(express.static(path.join(__dirname, '../public')));

// SPA (Single Page Application) 対応のフォールバック
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'サーバー内部エラーが発生しました。' });
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`  消防ポータルシステム サーバー起動完了`);
    console.log(`  実行ポート: http://localhost:${PORT}`);
    console.log(`  データベース: server/db/fire_dept.db`);
    console.log(`==================================================`);
});
