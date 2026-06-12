-- 消防ポータルシステム データベーススキーマ

-- 消防本部テーブル
CREATE TABLE IF NOT EXISTS fire_departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    shift_system TEXT NOT NULL, -- '2bu' (2部制), '3bu' (3部制)
    cycle_days INTEGER NOT NULL, -- 28, 21
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 消防署・出張所テーブル
CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    FOREIGN KEY(department_id) REFERENCES fire_departments(id) ON DELETE CASCADE
);

-- 職員マスタテーブル
CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER NOT NULL,
    station_id INTEGER NOT NULL,
    employee_number TEXT NOT NULL UNIQUE, -- 職員番号
    pin_hash TEXT NOT NULL, -- 暗証番号 (4桁ハッシュ)
    name TEXT NOT NULL, -- 氏名
    platoon TEXT NOT NULL, -- 部区分: '1bu' (1部/A日), '2bu' (2部/B日), '3bu' (3部/C日), 'nikkin' (日勤)
    rank TEXT, -- 階級: 消防士, 消防副士長, 消防士長, 消防司令補, 消防司令, 消防監など
    has_large_license INTEGER DEFAULT 0, -- 大型免許: 0=なし, 1=あり
    is_paramedic INTEGER DEFAULT 0, -- 救急救命士: 0=なし, 1=あり
    is_rescue INTEGER DEFAULT 0, -- 救助隊員: 0=なし, 1=あり
    is_kikan INTEGER DEFAULT 0, -- 機関員: 0=なし, 1=あり
    is_day_worker INTEGER DEFAULT 0, -- 毎日勤務者: 0=交代制, 1=毎日勤務
    role TEXT NOT NULL DEFAULT 'staff', -- システムロール: 'sysadmin', 'admin', 'chief', 'staff'
    annual_leave_balance REAL DEFAULT 20.0, -- 年次有給休暇残日数
    is_active INTEGER DEFAULT 1, -- 0=退職・無効, 1=在籍・有効
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(department_id) REFERENCES fire_departments(id),
    FOREIGN KEY(station_id) REFERENCES stations(id)
);

-- 出退勤レコードテーブル
CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    work_date TEXT NOT NULL, -- 日付: YYYY-MM-DD
    scheduled_shift TEXT, -- 勤務区分: 'tou' (当務), 'off' (非番), 'hol' (週休), 'nik' (日勤), 'paid' (有給)
    scheduled_start TEXT, -- 予定勤務開始: HH:MM
    scheduled_end TEXT, -- 予定勤務終了: HH:MM
    actual_clock_in TEXT, -- 実際の出勤時刻: YYYY-MM-DD HH:MM:SS
    actual_clock_out TEXT, -- 実際の退勤時刻: YYYY-MM-DD HH:MM:SS
    rounded_clock_in TEXT, -- 丸め後の出勤時刻: YYYY-MM-DD HH:MM:SS
    rounded_clock_out TEXT, -- 丸め後の退勤時刻: YYYY-MM-DD HH:MM:SS
    scheduled_hours REAL DEFAULT 0.0, -- 所定勤務時間
    actual_hours REAL DEFAULT 0.0, -- 実労働時間
    overtime_hours REAL DEFAULT 0.0, -- 超過勤務時間
    status TEXT DEFAULT 'absent', -- 状態: 'present' (出勤), 'absent' (欠勤), 'working' (勤務中), 'leave' (休暇)
    modified_by INTEGER, -- 修正者ID
    modification_reason TEXT, -- 修正理由
    approved_by INTEGER, -- 承認者ID
    approved_at TEXT, -- 承認日時: YYYY-MM-DD HH:MM:SS
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(staff_id, work_date),
    FOREIGN KEY(staff_id) REFERENCES staff(id)
);

-- 勤務修正申請テーブル
CREATE TABLE IF NOT EXISTS attendance_modifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attendance_id INTEGER NOT NULL,
    field_name TEXT NOT NULL, -- 'actual_clock_in' または 'actual_clock_out'
    old_value TEXT,
    new_value TEXT,
    reason TEXT NOT NULL, -- 申請理由
    requested_by INTEGER NOT NULL, -- 申請者ID
    approved_by INTEGER, -- 承認者ID
    status TEXT DEFAULT 'pending', -- 状態: 'pending' (保留), 'approved' (承認), 'rejected' (却下)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(attendance_id) REFERENCES attendance_records(id) ON DELETE CASCADE,
    FOREIGN KEY(requested_by) REFERENCES staff(id),
    FOREIGN KEY(approved_by) REFERENCES staff(id)
);

-- 勤務表スケジュールエントリー（勤務表からの自動同期用）
CREATE TABLE IF NOT EXISTS schedule_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    work_date TEXT NOT NULL, -- YYYY-MM-DD
    cycle_number INTEGER, -- サイクル番号
    shift_key TEXT NOT NULL, -- 当, 明, 休, 日, 有, 公, 張, 特, 病 など
    start_time TEXT, -- 開始時間 HH:MM
    end_time TEXT, -- 終了時間 HH:MM
    is_confirmed INTEGER DEFAULT 0, -- 確定状態: 0=未確定, 1=確定
    confirmed_by INTEGER, -- 確定者
    confirmed_at TEXT, -- 確定日時
    UNIQUE(staff_id, work_date),
    FOREIGN KEY(staff_id) REFERENCES staff(id)
);

-- 休暇申請テーブル
CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    leave_type TEXT NOT NULL, -- 'annual' (年休), 'special' (特休), 'sick' (病休), 'compensatory' (代休)
    start_date TEXT NOT NULL, -- YYYY-MM-DD
    end_date TEXT NOT NULL, -- YYYY-MM-DD
    start_time TEXT, -- 時間単位の場合: HH:MM
    end_time TEXT, -- 時間単位の場合: HH:MM
    hours REAL, -- 取得時間数 (1日の場合はNULLまたは規定時間)
    reason TEXT, -- 理由
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_by INTEGER,
    approved_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(staff_id) REFERENCES staff(id)
);

-- 丸め設定テーブル
CREATE TABLE IF NOT EXISTS rounding_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER NOT NULL UNIQUE,
    clock_in_unit INTEGER DEFAULT 15, -- 5, 10, 15, 30 分
    clock_in_direction TEXT DEFAULT 'up', -- 'up' (切り上げ = 職員に厳しく/超過削減), 'down' (切り捨て = 職員に優しく)
    clock_out_unit INTEGER DEFAULT 15, -- 5, 10, 15, 30 分
    clock_out_direction TEXT DEFAULT 'down', -- 'down' (切り捨て), 'up' (切り上げ)
    FOREIGN KEY(department_id) REFERENCES fire_departments(id) ON DELETE CASCADE
);

-- 監査ログテーブル
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER,
    action TEXT NOT NULL, -- アクション名: 'login', 'clock_in', 'clock_out', 'modify_attendance', 'approve' など
    target_table TEXT,
    target_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(staff_id) REFERENCES staff(id)
);

-- 稼働車両設定テーブル
CREATE TABLE IF NOT EXISTS deployed_vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER NOT NULL,
    vehicle_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    UNIQUE(station_id, vehicle_name),
    FOREIGN KEY(station_id) REFERENCES stations(id)
);

-- 車両配置（乗車割り当て）テーブル
CREATE TABLE IF NOT EXISTS vehicle_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_date TEXT NOT NULL, -- YYYY-MM-DD
    station_id INTEGER NOT NULL,
    vehicle_name TEXT NOT NULL,
    role_name TEXT NOT NULL, -- 機関員, 隊長, 隊員1, etc.
    staff_id INTEGER NOT NULL,
    UNIQUE(work_date, station_id, vehicle_name, role_name),
    FOREIGN KEY(station_id) REFERENCES stations(id),
    FOREIGN KEY(staff_id) REFERENCES staff(id)
);

