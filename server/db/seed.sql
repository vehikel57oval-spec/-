-- 消防ポータルシステム 初期シードデータ

-- 1. 消防本部の挿入
INSERT INTO fire_departments (id, name, code, shift_system, cycle_days)
VALUES (1, '指宿市消防本部', 'ibusuki', '2bu', 28);

-- 2. 消防署の挿入
INSERT INTO stations (id, department_id, name, code) VALUES
(1, 1, '指宿消防署（本署）', 'honsho'),
(2, 1, '山川分遣所（北署）', 'kita'),
(3, 1, '開聞分遣所（南署）', 'minami');

-- 3. デフォルト丸め設定の挿入
-- 出勤時は15分切り上げ（早めに来ても15分単位に切り上げ）、退勤時は15分切り捨て（残業は15分単位で切り捨て）
INSERT INTO rounding_settings (department_id, clock_in_unit, clock_in_direction, clock_out_unit, clock_out_direction)
VALUES (1, 15, 'up', 15, 'down');

-- 4. 職員マスタの挿入
-- 全員の初期暗証番号は '1234' （bcryptハッシュ値：$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy）
-- ロール: sysadmin(システム管理者), admin(本部管理者/消防司令), chief(署長・当番当直頭/消防司令補), staff(一般職員)
INSERT INTO staff (
    id, department_id, station_id, employee_number, pin_hash, name,
    platoon, rank, has_large_license, is_paramedic, is_rescue, is_kikan,
    is_day_worker, role, annual_leave_balance
) VALUES
-- 本署勤務者
(1, 1, 1, '0001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'システム管理者', 'nikkin', '情報管理主任', 0, 0, 0, 0, 1, 'sysadmin', 20.0),
(2, 1, 1, '1001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '田中 太郎', 'nikkin', '消防司令', 1, 0, 0, 0, 1, 'admin', 20.0),
(3, 1, 1, '1002', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '鈴木 一郎', '1bu', '消防司令補', 1, 1, 0, 1, 0, 'chief', 20.0),
(4, 1, 1, '1003', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '佐藤 次郎', '2bu', '消防司令補', 1, 0, 1, 1, 0, 'chief', 18.5),
(5, 1, 1, '1004', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '高橋 健二', '1bu', '消防士長', 1, 1, 0, 1, 0, 'staff', 15.0),
(6, 1, 1, '1005', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '渡辺 誠', '2bu', '消防士長', 1, 0, 1, 1, 0, 'staff', 20.0),
(7, 1, 1, '1006', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '伊藤 翼', '1bu', '消防士', 0, 1, 0, 0, 0, 'staff', 12.0),
(8, 1, 1, '1007', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '小林 翔', '2bu', '消防士', 1, 0, 1, 0, 0, 'staff', 10.0),

-- 北署勤務者
(9, 1, 2, '2001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '中村 護', '1bu', '消防司令補', 1, 0, 0, 1, 0, 'chief', 20.0),
(10, 1, 2, '2002', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '加藤 恵', '2bu', '消防司令補', 1, 1, 0, 0, 0, 'chief', 16.0),
(11, 1, 2, '2003', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '吉田 大輔', '1bu', '消防士長', 1, 0, 0, 1, 0, 'staff', 14.5),
(12, 1, 2, '2004', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '山田 花子', '2bu', '消防士', 0, 1, 0, 0, 0, 'staff', 20.0),

-- 南署勤務者
(13, 1, 3, '3001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '佐々木 茂', '1bu', '消防司令補', 1, 0, 0, 1, 0, 'chief', 19.0),
(14, 1, 3, '3002', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '山口 剛', '2bu', '消防司令補', 1, 0, 0, 1, 0, 'chief', 20.0),
(15, 1, 3, '3003', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '松本 淳', '1bu', '消防士長', 0, 1, 0, 0, 0, 'staff', 11.0),
(16, 1, 3, '3004', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '井上 陸', '2bu', '消防士', 1, 0, 0, 1, 0, 'staff', 20.0);
