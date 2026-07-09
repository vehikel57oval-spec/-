const fs = require('fs');
const path = require('path');

const dbFilePath = path.join(__dirname, 'db.json');

let dbData = {
    fire_departments: [],
    stations: [],
    staff: [],
    attendance_records: [],
    attendance_modifications: [],
    schedule_entries: [],
    leave_requests: [],
    rounding_settings: [],
    audit_logs: [],
    deployed_vehicles: [],
    vehicle_assignments: [],
    schedule_staff_overrides: [],
    holiday_allowance_ledgers: [],
    ledger_approvals: [],
    schedule_drafts: []
};

// シードデータ（初期データ）
function seedData() {
    console.log('Seeding database with default values...');
    dbData.fire_departments.push({
        id: 1,
        name: '指宿市消防本部',
        code: 'ibusuki',
        shift_system: '2bu',
        cycle_days: 28,
        created_at: new Date().toISOString()
    });

    dbData.stations.push(
        { id: 1, department_id: 1, name: '指宿消防署', code: 'honsho' },
        { id: 2, department_id: 1, name: '山川開聞分遣所', code: 'yamagawa' },
        { id: 3, department_id: 1, name: '頴娃分遣所', code: 'ei' }
    );

    dbData.rounding_settings.push({
        id: 1,
        department_id: 1,
        clock_in_unit: 15,
        clock_in_direction: 'up',
        clock_out_unit: 15,
        clock_out_direction: 'down'
    });

    const hash = '$2a$10$Rn57sxVVD7stNaMSBna7u.X6hzt9CMgmRovgdtsC3tZpqwq0aoGXG'; // '1234' (bcryptjs互換ハッシュ)
    const staffList = [
        // ==========================================
        // 指宿消防署 (station_id: 1) — 38名
        // 日勤者: 署長1名, 副署長1名, 事務1名, 予防係2名, 通信員1名 = 6名
        // 当務者: 1部16名 + 2部16名 = 32名
        // ==========================================
        // --- 日勤者 (6名) ---
        { id: 1, department_id: 1, station_id: 1, employee_number: '0001', pin_hash: hash, name: 'システム管理者', platoon: 'nikkin', rank: '情報管理主任', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 1, role: 'sysadmin', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 2, department_id: 1, station_id: 1, employee_number: '1001', pin_hash: hash, name: '田中 太郎', platoon: 'nikkin', rank: '消防司令', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 1, role: 'admin', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 3, department_id: 1, station_id: 1, employee_number: '1002', pin_hash: hash, name: '鈴木 一郎', platoon: 'nikkin', rank: '消防司令', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 1, role: 'admin', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 4, department_id: 1, station_id: 1, employee_number: '1003', pin_hash: hash, name: '佐藤 美咲', platoon: 'nikkin', rank: '消防士長', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 1, role: 'staff', annual_leave_balance: 18.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 5, department_id: 1, station_id: 1, employee_number: '1004', pin_hash: hash, name: '高橋 健二', platoon: 'nikkin', rank: '消防司令補', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 1, role: 'staff', annual_leave_balance: 19.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 6, department_id: 1, station_id: 1, employee_number: '1005', pin_hash: hash, name: '渡辺 誠', platoon: 'nikkin', rank: '消防司令補', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 1, role: 'staff', annual_leave_balance: 17.5, is_active: 1, created_at: new Date().toISOString() },
        // --- 1部 (16名) ---
        { id: 7,  department_id: 1, station_id: 1, employee_number: '1101', pin_hash: hash, name: '伊藤 浩一', platoon: '1bu', rank: '消防司令補', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'chief', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 8,  department_id: 1, station_id: 1, employee_number: '1102', pin_hash: hash, name: '中村 大輔', platoon: '1bu', rank: '消防司令補', has_large_license: 1, is_paramedic: 1, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'chief', annual_leave_balance: 19.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 9,  department_id: 1, station_id: 1, employee_number: '1103', pin_hash: hash, name: '小林 翔太', platoon: '1bu', rank: '消防士長', has_large_license: 1, is_paramedic: 1, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 18.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 10, department_id: 1, station_id: 1, employee_number: '1104', pin_hash: hash, name: '加藤 隆志', platoon: '1bu', rank: '消防士長', has_large_license: 1, is_paramedic: 0, is_rescue: 1, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 17.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 11, department_id: 1, station_id: 1, employee_number: '1105', pin_hash: hash, name: '吉田 誠一', platoon: '1bu', rank: '消防士長', has_large_license: 1, is_paramedic: 0, is_rescue: 1, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 16.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 12, department_id: 1, station_id: 1, employee_number: '1106', pin_hash: hash, name: '山田 拓也', platoon: '1bu', rank: '消防副士長', has_large_license: 1, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 15.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 13, department_id: 1, station_id: 1, employee_number: '1107', pin_hash: hash, name: '佐々木 亮', platoon: '1bu', rank: '消防副士長', has_large_license: 0, is_paramedic: 0, is_rescue: 1, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 14.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 14, department_id: 1, station_id: 1, employee_number: '1108', pin_hash: hash, name: '松本 和也', platoon: '1bu', rank: '消防副士長', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 14.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 15, department_id: 1, station_id: 1, employee_number: '1109', pin_hash: hash, name: '井上 直樹', platoon: '1bu', rank: '消防士', has_large_license: 1, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 13.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 16, department_id: 1, station_id: 1, employee_number: '1110', pin_hash: hash, name: '木村 康平', platoon: '1bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 1, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 12.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 17, department_id: 1, station_id: 1, employee_number: '1111', pin_hash: hash, name: '林 大地', platoon: '1bu', rank: '消防士', has_large_license: 0, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 12.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 18, department_id: 1, station_id: 1, employee_number: '1112', pin_hash: hash, name: '清水 裕太', platoon: '1bu', rank: '消防士', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 11.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 19, department_id: 1, station_id: 1, employee_number: '1113', pin_hash: hash, name: '山崎 光', platoon: '1bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 20, department_id: 1, station_id: 1, employee_number: '1114', pin_hash: hash, name: '池田 蓮', platoon: '1bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 21, department_id: 1, station_id: 1, employee_number: '1115', pin_hash: hash, name: '橋本 遼', platoon: '1bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 22, department_id: 1, station_id: 1, employee_number: '1116', pin_hash: hash, name: '石井 颯太', platoon: '1bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },
        // --- 2部 (16名) ---
        { id: 23, department_id: 1, station_id: 1, employee_number: '1201', pin_hash: hash, name: '前田 修一', platoon: '2bu', rank: '消防司令補', has_large_license: 1, is_paramedic: 0, is_rescue: 1, is_kikan: 1, is_day_worker: 0, role: 'chief', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 24, department_id: 1, station_id: 1, employee_number: '1202', pin_hash: hash, name: '藤田 圭介', platoon: '2bu', rank: '消防司令補', has_large_license: 1, is_paramedic: 1, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'chief', annual_leave_balance: 19.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 25, department_id: 1, station_id: 1, employee_number: '1203', pin_hash: hash, name: '後藤 正義', platoon: '2bu', rank: '消防士長', has_large_license: 1, is_paramedic: 0, is_rescue: 1, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 18.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 26, department_id: 1, station_id: 1, employee_number: '1204', pin_hash: hash, name: '長谷川 剛', platoon: '2bu', rank: '消防士長', has_large_license: 1, is_paramedic: 1, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 17.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 27, department_id: 1, station_id: 1, employee_number: '1205', pin_hash: hash, name: '村上 貴文', platoon: '2bu', rank: '消防士長', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 16.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 28, department_id: 1, station_id: 1, employee_number: '1206', pin_hash: hash, name: '近藤 雅人', platoon: '2bu', rank: '消防副士長', has_large_license: 1, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 15.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 29, department_id: 1, station_id: 1, employee_number: '1207', pin_hash: hash, name: '坂本 竜也', platoon: '2bu', rank: '消防副士長', has_large_license: 0, is_paramedic: 0, is_rescue: 1, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 14.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 30, department_id: 1, station_id: 1, employee_number: '1208', pin_hash: hash, name: '遠藤 瑛太', platoon: '2bu', rank: '消防副士長', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 13.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 31, department_id: 1, station_id: 1, employee_number: '1209', pin_hash: hash, name: '青木 裕介', platoon: '2bu', rank: '消防士', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 12.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 32, department_id: 1, station_id: 1, employee_number: '1210', pin_hash: hash, name: '藤井 陽介', platoon: '2bu', rank: '消防士', has_large_license: 0, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 11.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 33, department_id: 1, station_id: 1, employee_number: '1211', pin_hash: hash, name: '岡田 悠真', platoon: '2bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 1, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 11.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 34, department_id: 1, station_id: 1, employee_number: '1212', pin_hash: hash, name: '原田 奏汰', platoon: '2bu', rank: '消防士', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 35, department_id: 1, station_id: 1, employee_number: '1213', pin_hash: hash, name: '中島 海斗', platoon: '2bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 36, department_id: 1, station_id: 1, employee_number: '1214', pin_hash: hash, name: '小川 陸斗', platoon: '2bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 37, department_id: 1, station_id: 1, employee_number: '1215', pin_hash: hash, name: '松田 凌', platoon: '2bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 38, department_id: 1, station_id: 1, employee_number: '1216', pin_hash: hash, name: '上田 湊', platoon: '2bu', rank: '消防士', has_large_license: 0, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },

        // ==========================================
        // 山川開聞分遣所 (station_id: 2) — 18名
        // 日勤者: 所長1名, 事務1名 = 2名
        // 当務者: 1部8名 + 2部8名 = 16名
        // ==========================================
        // --- 日勤者 (2名) ---
        { id: 39, department_id: 1, station_id: 2, employee_number: '2001', pin_hash: hash, name: '中村 護', platoon: 'nikkin', rank: '消防司令', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 1, role: 'admin', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 40, department_id: 1, station_id: 2, employee_number: '2002', pin_hash: hash, name: '山口 真理', platoon: 'nikkin', rank: '消防士長', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 1, role: 'staff', annual_leave_balance: 18.0, is_active: 1, created_at: new Date().toISOString() },
        // --- 1部 (8名) ---
        { id: 41, department_id: 1, station_id: 2, employee_number: '2101', pin_hash: hash, name: '加藤 恵介', platoon: '1bu', rank: '消防司令補', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'chief', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 42, department_id: 1, station_id: 2, employee_number: '2102', pin_hash: hash, name: '吉田 大輔', platoon: '1bu', rank: '消防士長', has_large_license: 1, is_paramedic: 1, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 18.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 43, department_id: 1, station_id: 2, employee_number: '2103', pin_hash: hash, name: '石川 洋平', platoon: '1bu', rank: '消防副士長', has_large_license: 1, is_paramedic: 0, is_rescue: 1, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 15.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 44, department_id: 1, station_id: 2, employee_number: '2104', pin_hash: hash, name: '前川 悠希', platoon: '1bu', rank: '消防副士長', has_large_license: 0, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 14.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 45, department_id: 1, station_id: 2, employee_number: '2105', pin_hash: hash, name: '野口 健太', platoon: '1bu', rank: '消防士', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 12.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 46, department_id: 1, station_id: 2, employee_number: '2106', pin_hash: hash, name: '田村 颯', platoon: '1bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 11.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 47, department_id: 1, station_id: 2, employee_number: '2107', pin_hash: hash, name: '内田 蒼空', platoon: '1bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 48, department_id: 1, station_id: 2, employee_number: '2108', pin_hash: hash, name: '宮崎 瑛斗', platoon: '1bu', rank: '消防士', has_large_license: 0, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },
        // --- 2部 (8名) ---
        { id: 49, department_id: 1, station_id: 2, employee_number: '2201', pin_hash: hash, name: '安藤 信吾', platoon: '2bu', rank: '消防司令補', has_large_license: 1, is_paramedic: 1, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'chief', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 50, department_id: 1, station_id: 2, employee_number: '2202', pin_hash: hash, name: '高田 勝也', platoon: '2bu', rank: '消防士長', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 17.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 51, department_id: 1, station_id: 2, employee_number: '2203', pin_hash: hash, name: '森田 紘一', platoon: '2bu', rank: '消防副士長', has_large_license: 1, is_paramedic: 0, is_rescue: 1, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 15.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 52, department_id: 1, station_id: 2, employee_number: '2204', pin_hash: hash, name: '福田 翔馬', platoon: '2bu', rank: '消防副士長', has_large_license: 0, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 14.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 53, department_id: 1, station_id: 2, employee_number: '2205', pin_hash: hash, name: '西田 涼介', platoon: '2bu', rank: '消防士', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 12.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 54, department_id: 1, station_id: 2, employee_number: '2206', pin_hash: hash, name: '三浦 蓮太', platoon: '2bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 11.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 55, department_id: 1, station_id: 2, employee_number: '2207', pin_hash: hash, name: '川口 大翔', platoon: '2bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 56, department_id: 1, station_id: 2, employee_number: '2208', pin_hash: hash, name: '久保 晴', platoon: '2bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },

        // ==========================================
        // 頴娃分遣所 (station_id: 3) — 18名
        // 日勤者: 所長1名, 事務1名 = 2名
        // 当務者: 1部8名 + 2部8名 = 16名
        // ==========================================
        // --- 日勤者 (2名) ---
        { id: 57, department_id: 1, station_id: 3, employee_number: '3001', pin_hash: hash, name: '佐々木 茂', platoon: 'nikkin', rank: '消防司令', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 1, role: 'admin', annual_leave_balance: 19.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 58, department_id: 1, station_id: 3, employee_number: '3002', pin_hash: hash, name: '山本 智子', platoon: 'nikkin', rank: '消防士長', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 1, role: 'staff', annual_leave_balance: 17.0, is_active: 1, created_at: new Date().toISOString() },
        // --- 1部 (8名) ---
        { id: 59, department_id: 1, station_id: 3, employee_number: '3101', pin_hash: hash, name: '松尾 和彦', platoon: '1bu', rank: '消防司令補', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'chief', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 60, department_id: 1, station_id: 3, employee_number: '3102', pin_hash: hash, name: '山口 隆二', platoon: '1bu', rank: '消防士長', has_large_license: 1, is_paramedic: 1, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 18.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 61, department_id: 1, station_id: 3, employee_number: '3103', pin_hash: hash, name: '大野 智也', platoon: '1bu', rank: '消防副士長', has_large_license: 1, is_paramedic: 0, is_rescue: 1, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 15.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 62, department_id: 1, station_id: 3, employee_number: '3104', pin_hash: hash, name: '岩崎 陽翔', platoon: '1bu', rank: '消防副士長', has_large_license: 0, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 14.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 63, department_id: 1, station_id: 3, employee_number: '3105', pin_hash: hash, name: '菅原 大河', platoon: '1bu', rank: '消防士', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 12.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 64, department_id: 1, station_id: 3, employee_number: '3106', pin_hash: hash, name: '桜井 結斗', platoon: '1bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 11.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 65, department_id: 1, station_id: 3, employee_number: '3107', pin_hash: hash, name: '川上 朝陽', platoon: '1bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 66, department_id: 1, station_id: 3, employee_number: '3108', pin_hash: hash, name: '永井 壮馬', platoon: '1bu', rank: '消防士', has_large_license: 0, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },
        // --- 2部 (8名) ---
        { id: 67, department_id: 1, station_id: 3, employee_number: '3201', pin_hash: hash, name: '水野 賢治', platoon: '2bu', rank: '消防司令補', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'chief', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 68, department_id: 1, station_id: 3, employee_number: '3202', pin_hash: hash, name: '今村 雄大', platoon: '2bu', rank: '消防士長', has_large_license: 1, is_paramedic: 0, is_rescue: 1, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 17.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 69, department_id: 1, station_id: 3, employee_number: '3203', pin_hash: hash, name: '堀田 京介', platoon: '2bu', rank: '消防副士長', has_large_license: 1, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 15.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 70, department_id: 1, station_id: 3, employee_number: '3204', pin_hash: hash, name: '平田 航平', platoon: '2bu', rank: '消防副士長', has_large_license: 0, is_paramedic: 0, is_rescue: 1, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 14.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 71, department_id: 1, station_id: 3, employee_number: '3205', pin_hash: hash, name: '新井 拓海', platoon: '2bu', rank: '消防士', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 12.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 72, department_id: 1, station_id: 3, employee_number: '3206', pin_hash: hash, name: '古川 陽太', platoon: '2bu', rank: '消防士', has_large_license: 0, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 11.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 73, department_id: 1, station_id: 3, employee_number: '3207', pin_hash: hash, name: '吉村 琉生', platoon: '2bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 74, department_id: 1, station_id: 3, employee_number: '3208', pin_hash: hash, name: '河野 隼人', platoon: '2bu', rank: '消防士', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() }
    ];
    dbData.staff.push(...staffList);
}

function migrateData() {
    let modified = false;
    if (!dbData.ledger_approvals) {
        dbData.ledger_approvals = [];
        modified = true;
    }
    if (!dbData.schedule_drafts) {
        dbData.schedule_drafts = [];
        modified = true;
    }
    if (dbData.staff && Array.isArray(dbData.staff)) {
        dbData.staff.forEach(s => {
            if (s.position === undefined) {
                // Determine default position based on rank
                if (s.rank === "消防司令" || s.rank === "消防司令補" || s.rank === "主幹" || s.rank === "小隊長" || s.rank === "消防隊長" || s.rank === "救急隊長" || s.rank === "救助隊長" || s.rank === "庶務経理") {
                    s.position = "小隊長";
                    // If rank was saved as position in the previous design, revert rank to a standard one:
                    if (["小隊長", "消防隊長", "救急隊長", "救助隊長", "庶務経理", "主幹"].includes(s.rank)) {
                        s.position = s.rank;
                        s.rank = "消防司令補";
                    }
                } else if (s.rank === "消防士長") {
                    s.position = "消防副";
                } else {
                    if (s.is_paramedic) s.position = "救急隊";
                    else if (s.is_rescue) s.position = "救助隊";
                    else s.position = "消防隊";
                }
                modified = true;
            }
        });
    }
    if (modified) {
        console.log('Migrating database: Added default position fields to staff.');
        saveDatabase();
    }
}

function loadDatabase() {
    if (fs.existsSync(dbFilePath)) {
        try {
            dbData = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
            console.log('Database loaded from JSON file successfully.');
        } catch (err) {
            console.error('Failed to parse db.json, creating a new one.', err);
            seedData();
            saveDatabase();
        }
    } else {
        seedData();
        saveDatabase();
    }
    migrateData();
}

function saveDatabase() {
    try {
        fs.writeFileSync(dbFilePath, JSON.stringify(dbData, null, 2), 'utf8');
    } catch (err) {
        console.error('Failed to save db.json', err);
    }
}

loadDatabase();

// 擬似的な prepared statement クラス
class Statement {
    constructor(sql) {
        // スペースをトリムして比較しやすいようにする
        this.sql = sql.trim().replace(/\s+/g, ' ');
    }

    get(...params) {
        const sql = this.sql;
        // console.log('[DB MOCK GET] SQL:', sql, 'Params:', params);

        // 1. sqlite_master 存在チェック
        if (sql.includes("FROM sqlite_master")) {
            return { name: 'staff' };
        }

        // 2. staffテーブル件数チェック
        if (sql === "SELECT COUNT(*) as count FROM staff") {
            return { count: dbData.staff.length };
        }

        // 3. ログイン処理用スタッフ検索 (employee_number & active)
        if (sql.includes("FROM staff s") && sql.includes("s.employee_number = ? AND s.is_active = 1") && !sql.includes("fd.code = ?")) {
            const empNum = params[0];
            const s = dbData.staff.find(x => x.employee_number === empNum && x.is_active === 1);
            if (!s) return undefined;
            const dept = dbData.fire_departments.find(x => x.id === s.department_id) || {};
            const station = dbData.stations.find(x => x.id === s.station_id) || {};
            return {
                ...s,
                department_name: dept.name,
                station_name: station.name
            };
        }

        // 3-2. 消防本部コード＋職員番号でのログイン検索
        if (sql.includes("FROM staff s") && sql.includes("fd.code = ?") && sql.includes("s.employee_number = ?") && sql.includes("s.is_active = 1")) {
            const deptCode = params[0];
            const empNum = params[1];
            
            const dept = dbData.fire_departments.find(x => x.code === deptCode);
            if (!dept) return undefined;
            
            const s = dbData.staff.find(x => x.department_id === dept.id && x.employee_number === empNum && x.is_active === 1);
            if (!s) return undefined;
            
            const station = dbData.stations.find(x => x.id === s.station_id) || {};
            return {
                ...s,
                department_name: dept.name,
                station_name: station.name
            };
        }

        // 4. GET /api/auth/me 用スタッフ検索 (id & active)
        if (sql.includes("FROM staff s") && sql.includes("s.id = ? AND s.is_active = 1")) {
            const id = params[0];
            const s = dbData.staff.find(x => x.id === id && x.is_active === 1);
            if (!s) return undefined;
            const dept = dbData.fire_departments.find(x => x.id === s.department_id) || {};
            const station = dbData.stations.find(x => x.id === s.station_id) || {};
            return {
                ...s,
                department_name: dept.name,
                station_name: station.name
            };
        }

        // 5. パスワードハッシュ取得
        if (sql === "SELECT pin_hash FROM staff WHERE id = ?") {
            const s = dbData.staff.find(x => x.id === params[0]);
            return s ? { pin_hash: s.pin_hash } : undefined;
        }

        // 5-2. 休暇申請の詳細取得（承認審査用）
        if (sql.includes("FROM leave_requests lr") && sql.includes("lr.id = ?")) {
            const id = parseInt(params[0], 10);
            if (!dbData.leave_requests) dbData.leave_requests = [];
            const lr = dbData.leave_requests.find(x => x.id === id);
            if (!lr) return undefined;
            const s = dbData.staff.find(x => x.id === lr.staff_id) || {};
            return {
                ...lr,
                station_id: s.station_id,
                platoon: s.platoon,
                is_day_worker: s.is_day_worker,
                annual_leave_balance: s.annual_leave_balance
            };
        }

        // 6. 出勤中の勤怠レコードチェック
        if (sql === "SELECT * FROM attendance_records WHERE staff_id = ? AND actual_clock_out IS NULL") {
            return dbData.attendance_records.find(x => x.staff_id === params[0] && !x.actual_clock_out);
        }

        // 7. 丸め設定取得
        if (sql === "SELECT * FROM rounding_settings WHERE department_id = ?") {
            return dbData.rounding_settings.find(x => x.department_id === params[0]);
        }

        // 8. スケジュール取得
        if (sql === "SELECT * FROM schedule_entries WHERE staff_id = ? AND work_date = ?") {
            return dbData.schedule_entries.find(x => x.staff_id === params[0] && x.work_date === params[1]);
        }

        // 9. 本日の勤怠レコード取得 (日付指定)
        if (sql === "SELECT * FROM attendance_records WHERE staff_id = ? AND work_date = ?") {
            return dbData.attendance_records.find(x => x.staff_id === params[0] && x.work_date === params[1]);
        }

        // 9-2. 本日の車両配置アサインの取得
        if (sql === "SELECT * FROM vehicle_assignments WHERE staff_id = ? AND work_date = ?") {
            if (!dbData.vehicle_assignments) dbData.vehicle_assignments = [];
            return dbData.vehicle_assignments.find(x => x.staff_id === params[0] && x.work_date === params[1]);
        }

        // 10. 退勤打刻用の最新未退勤レコード取得
        if (sql.includes("SELECT * FROM attendance_records") && sql.includes("actual_clock_out IS NULL ORDER BY work_date DESC LIMIT 1")) {
            const records = dbData.attendance_records.filter(x => x.staff_id === params[0] && !x.actual_clock_out);
            if (records.length === 0) return undefined;
            // work_dateで降順ソート
            records.sort((a, b) => b.work_date.localeCompare(a.work_date));
            return records[0];
        }

        // 11. IDによる勤怠レコード取得
        if (sql === "SELECT * FROM attendance_records WHERE id = ?") {
            return dbData.attendance_records.find(x => x.id === parseInt(params[0]));
        }

        // 12. 修正申請詳細の取得 (JOIN多用クエリ)
        if (sql.includes("SELECT am.*, ar.staff_id") && sql.includes("WHERE am.id = ?")) {
            const modId = parseInt(params[0]);
            const am = dbData.attendance_modifications.find(x => x.id === modId);
            if (!am) return undefined;
            const ar = dbData.attendance_records.find(x => x.id === am.attendance_id) || {};
            const s = dbData.staff.find(x => x.id === ar.staff_id) || {};
            return {
                ...am,
                staff_id: ar.staff_id,
                scheduled_shift: ar.scheduled_shift,
                rounded_clock_in: ar.rounded_clock_in,
                rounded_clock_out: ar.rounded_clock_out,
                department_id: s.department_id,
                station_id: s.station_id
            };
        }

        // 13. 職員番号による存在チェック
        if (sql === "SELECT id FROM staff WHERE employee_number = ?") {
            const s = dbData.staff.find(x => x.employee_number === params[0]);
            return s ? { id: s.id } : undefined;
        }

        // 14. IDによるスタッフ単体取得
        if (sql === "SELECT * FROM staff WHERE id = ?") {
            return dbData.staff.find(x => x.id === parseInt(params[0]));
        }

        // 14-2. 応援・補充職員の存在チェック
        if (sql === "SELECT id FROM staff WHERE station_id = ? AND name = ? AND role = ?") {
            const stationId = parseInt(params[0]);
            const name = params[1];
            const role = params[2];
            const s = dbData.staff.find(x => x.station_id === stationId && x.name === name && x.role === role);
            return s ? { id: s.id } : undefined;
        }

        // 15. 本部設定の取得
        if (sql === "SELECT * FROM fire_departments WHERE id = ?") {
            return dbData.fire_departments.find(x => x.id === params[0]);
        }

        // 16. ダッシュボード用集計: 在籍総職員数
        if (sql.includes("SELECT COUNT(*) as count FROM staff s WHERE s.department_id = ? AND s.is_active = 1")) {
            let list = dbData.staff.filter(x => x.department_id === params[0] && x.is_active === 1);
            if (sql.includes("AND s.station_id = ?")) {
                list = list.filter(x => x.station_id === params[1]);
            }
            return { count: list.length };
        }

        // 17. ダッシュボード用集計: 本日出勤中(working) or 本日退勤済(present)
        if (sql.includes("FROM attendance_records ar JOIN staff s") && sql.includes("ar.status")) {
            const deptId = params[0];
            const workDate = params[1];
            // sqlからstatusを判定
            const isWorking = sql.includes("status = 'working'") || (params[2] === 'working');
            const statusTarget = isWorking ? 'working' : 'present';
            
            let records = dbData.attendance_records.filter(x => x.work_date === workDate && x.status === statusTarget);
            let list = records.filter(r => {
                const s = dbData.staff.find(x => x.id === r.staff_id);
                if (!s || s.department_id !== deptId || s.is_active !== 1) return false;
                // station_idフィルタがあるか確認
                if (sql.includes("AND s.station_id = ?")) {
                    const idx = 2; // params[0]: deptId, params[1]: workDate, params[2]: stationId
                    return s.station_id === params[idx];
                }
                return true;
            });
            return { count: list.length };
        }

        // 18. ダッシュボード用集計: 保留中修正申請数
        if (sql.includes("FROM attendance_modifications am") && sql.includes("am.status = 'pending'")) {
            let list = dbData.attendance_modifications.filter(x => x.status === 'pending');
            if (sql.includes("AND s.station_id = ?")) {
                const stationId = params[0];
                list = list.filter(m => {
                    const ar = dbData.attendance_records.find(x => x.id === m.attendance_id);
                    if (!ar) return false;
                    const s = dbData.staff.find(x => x.id === ar.staff_id);
                    return s && s.station_id === stationId;
                });
            }
            return { count: list.length };
        }

        // 19. ダッシュボード用集計: スケジュール当務/日勤予定人数
        if (sql.includes("SELECT SUM(CASE WHEN se.shift_key = '当' THEN 1 ELSE 0 END) as tou_count")) {
            const deptId = params[0];
            const workDate = params[1];
            
            let list = dbData.schedule_entries.filter(x => x.work_date === workDate);
            let filtered = list.filter(e => {
                const s = dbData.staff.find(x => x.id === e.staff_id);
                if (!s || s.department_id !== deptId) return false;
                if (sql.includes("AND s.station_id = ?")) {
                    return s.station_id === params[2];
                }
                return true;
            });
            
            const tou_count = filtered.filter(x => x.shift_key === '当').length;
            const nik_count = filtered.filter(x => x.shift_key === '日').length;
            
            return { tou_count, nik_count };
        }

        // 20. 祝日手当の単一取得
        if (sql === "SELECT * FROM holiday_allowance_ledgers WHERE year_month = ? AND staff_id = ?") {
            if (!dbData.holiday_allowance_ledgers) dbData.holiday_allowance_ledgers = [];
            const staffId = parseInt(params[1], 10);
            return dbData.holiday_allowance_ledgers.find(x => x.year_month === params[0] && parseInt(x.staff_id, 10) === staffId);
        }

        // 20-2. 出勤簿の承認ステータスの取得
        if (sql === "SELECT * FROM ledger_approvals WHERE year_month = ? AND staff_id = ?") {
            if (!dbData.ledger_approvals) dbData.ledger_approvals = [];
            const staffId = parseInt(params[1], 10);
            return dbData.ledger_approvals.find(x => x.year_month === params[0] && parseInt(x.staff_id, 10) === staffId);
        }

        // 22. 特定の下書きロード用
        if (sql === "SELECT * FROM schedule_drafts WHERE id = ?") {
            if (!dbData.schedule_drafts) dbData.schedule_drafts = [];
            const id = parseInt(params[0], 10);
            return dbData.schedule_drafts.find(x => x.id === id);
        }

        // 21. schedule_staff_overrides 起算日の単一取得
        if (sql === "SELECT start_date FROM schedule_staff_overrides LIMIT 1") {
            if (!dbData.schedule_staff_overrides) dbData.schedule_staff_overrides = [];
            const row = dbData.schedule_staff_overrides[0];
            return row ? { start_date: row.start_date } : undefined;
        }

        console.warn('[DB MOCK UNHANDLED GET] Returning empty. SQL:', sql);
        return undefined;
    }

    all(...params) {
        const sql = this.sql;
        // console.log('[DB MOCK ALL] SQL:', sql, 'Params:', params);

        // 0. 消防本部一覧取得
        if (sql.includes("FROM fire_departments")) {
            return dbData.fire_departments.map(x => ({
                id: x.id,
                name: x.name,
                code: x.code
            }));
        }

        // 0-2. 休暇申請履歴の取得
        if (sql.includes("FROM leave_requests lr") && sql.includes("lr.staff_id = ?") && !sql.includes("lr.status = 'pending'")) {
            const staffId = params[0];
            if (!dbData.leave_requests) dbData.leave_requests = [];
            let list = dbData.leave_requests.filter(x => x.staff_id === staffId);
            
            let joined = list.map(item => {
                const approver = dbData.staff.find(x => x.id === item.approved_by);
                return {
                    ...item,
                    approved_by_name: approver ? approver.name : null
                };
            });
            joined.sort((a, b) => b.created_at.localeCompare(a.created_at));
            return joined;
        }

        // 0-3. 未承認の休暇申請一覧取得（管理者用）
        if (sql.includes("FROM leave_requests lr") && sql.includes("lr.status = 'pending'")) {
            if (!dbData.leave_requests) dbData.leave_requests = [];
            let list = dbData.leave_requests.filter(x => x.status === 'pending');
            
            let joined = list.map(item => {
                const s = dbData.staff.find(x => x.id === item.staff_id) || {};
                const st = dbData.stations.find(x => x.id === s.station_id) || {};
                return {
                    ...item,
                    staff_name: s.name,
                    employee_number: s.employee_number,
                    rank: s.rank,
                    position: s.position || s.rank,
                    station_name: st.name,
                    station_id: s.station_id
                };
            });
            
            if (sql.includes("AND s.station_id = ?")) {
                const stationId = params[0];
                joined = joined.filter(x => x.station_id === stationId);
            }
            
            joined.sort((a, b) => a.created_at.localeCompare(b.created_at));
            return joined;
        }

        // 0-4. 出勤簿(ledger)での休暇申請リストの取得
        if (sql.includes("FROM leave_requests") && sql.includes("status = 'approved'") && sql.includes("start_date BETWEEN")) {
            const staffId = params[0];
            const start = params[1];
            const end = params[2];
            if (!dbData.leave_requests) dbData.leave_requests = [];
            
            return dbData.leave_requests.filter(x => 
                x.staff_id === staffId && 
                x.status === 'approved' && 
                x.start_date >= start && 
                x.start_date <= end
            );
        }

        // 0-5. 手当検証(admin.js)での有給休暇リストの取得
        if (sql.includes("FROM leave_requests") && sql.includes("status = \"approved\"") && sql.includes("start_date <= ? AND end_date >= ?")) {
            const staffId = params[0];
            const targetDate1 = params[1];
            const targetDate2 = params[2];
            if (!dbData.leave_requests) dbData.leave_requests = [];
            
            return dbData.leave_requests.filter(x => 
                x.staff_id === staffId && 
                x.status === 'approved' && 
                x.start_date <= targetDate1 && 
                x.end_date >= targetDate2
            );
        }

        // 1. 履歴一覧取得
        if (sql.includes("FROM attendance_records ar") && sql.includes("ar.staff_id = ? AND ar.work_date BETWEEN ? AND ?")) {
            const staffId = params[0];
            const start = params[1];
            const end = params[2];
            
            let list = dbData.attendance_records.filter(x => x.staff_id === staffId && x.work_date >= start && x.work_date <= end);
            
            // JOIN処理
            const joined = list.map(item => {
                const modifier = dbData.staff.find(x => x.id === item.modified_by);
                const approver = dbData.staff.find(x => x.id === item.approved_by);
                return {
                    ...item,
                    modified_by_name: modifier ? modifier.name : null,
                    approved_by_name: approver ? approver.name : null
                };
            });
            
            // ソート
            joined.sort((a, b) => b.work_date.localeCompare(a.work_date));
            return joined;
        }

        // 2. 未承認の修正申請一覧取得
        if (sql.includes("FROM attendance_modifications am") && sql.includes("am.status = 'pending'")) {
            let list = dbData.attendance_modifications.filter(x => x.status === 'pending');
            
            // JOINとマッピング
            let joined = list.map(item => {
                const ar = dbData.attendance_records.find(x => x.id === item.attendance_id) || {};
                const s = dbData.staff.find(x => x.id === ar.staff_id) || {};
                const st = dbData.stations.find(x => x.id === s.station_id) || {};
                return {
                    ...item,
                    staff_name: s.name,
                    employee_number: s.employee_number,
                    station_name: st.name,
                    station_id: s.station_id,
                    work_date: ar.work_date
                };
            });
            
            // ロールによる拠点フィルタ (chief)
            if (sql.includes("AND s.station_id = ?")) {
                const stationId = params[0];
                joined = joined.filter(x => x.station_id === stationId);
            }
            
            joined.sort((a, b) => a.created_at.localeCompare(b.created_at));
            return joined;
        }

        // 3. 職員一覧取得
        if (sql.includes("FROM staff s") && sql.includes("s.department_id = ?")) {
            const deptId = params[0];
            let list = dbData.staff.filter(x => x.department_id === deptId);
            
            let joined = list.map(s => {
                const st = dbData.stations.find(x => x.id === s.station_id) || {};
                return {
                    ...s,
                    station_name: st.name,
                    station_id: st.id
                };
            });
            
            // 拠点フィルタ (chief用)
            if (sql.includes("AND s.station_id = ?")) {
                const stationId = params[1];
                joined = joined.filter(x => x.station_id === stationId);
            }
            
            // ソート ORDER BY st.id ASC, s.platoon ASC, s.employee_number ASC
            joined.sort((a, b) => {
                if (a.station_id !== b.station_id) return a.station_id - b.station_id;
                if (a.platoon !== b.platoon) return a.platoon.localeCompare(b.platoon);
                return a.employee_number.localeCompare(b.employee_number);
            });
            
            return joined;
        }

        // 職員データの取得 (station_id と is_active 指定)
        if (sql === "SELECT * FROM staff WHERE station_id = ? AND is_active = 1") {
            const stationId = parseInt(params[0]);
            return dbData.staff.filter(x => x.station_id === stationId && x.is_active === 1);
        }

        // 職員の部・日勤情報取得 (確定時の部・日勤判定用)
        if (sql === "SELECT id, platoon, is_day_worker FROM staff WHERE station_id = ?") {
            const stationId = parseInt(params[0]);
            return dbData.staff.filter(x => x.station_id === stationId).map(x => ({
                id: x.id,
                platoon: x.platoon,
                is_day_worker: x.is_day_worker
            }));
        }

        // 消防車両データの取得
        if (sql.includes("FROM deployed_vehicles")) {
            const stationId = parseInt(params[0]);
            if (!dbData.deployed_vehicles) dbData.deployed_vehicles = [];
            return dbData.deployed_vehicles.filter(x => x.station_id === stationId);
        }

        // 車両配置データの取得
        if (sql.includes("FROM vehicle_assignments")) {
            const stationId = parseInt(params[0]);
            const startDate = params[1];
            const endDate = params[2];
            if (!dbData.vehicle_assignments) dbData.vehicle_assignments = [];
            return dbData.vehicle_assignments.filter(x => 
                x.station_id === stationId && x.work_date >= startDate && x.work_date <= endDate
            );
        }

        // サイクル限定オーバーライド情報の取得
        if (sql.includes("FROM schedule_staff_overrides")) {
            const stationId = parseInt(params[0]);
            const startDate = params[1];
            if (!dbData.schedule_staff_overrides) dbData.schedule_staff_overrides = [];
            return dbData.schedule_staff_overrides.filter(x => 
                x.station_id === stationId && x.start_date === startDate
            );
        }

        // スケジュールエントリーの取得
        if (sql.includes("FROM schedule_entries")) {
            if (!dbData.schedule_entries) dbData.schedule_entries = [];
            
            let start, end;
            if (sql.includes("work_date BETWEEN ? AND ?")) {
                if (params.length === 2) {
                    start = params[0];
                    end = params[1];
                } else if (params.length === 3) {
                    start = params[1];
                    end = params[2];
                }
            }
            
            let result = dbData.schedule_entries;
            if (start && end) {
                result = result.filter(x => x.work_date >= start && x.work_date <= end);
            }
            
            if (sql.includes("staff_id = ?")) {
                const staffId = parseInt(params[0]);
                result = result.filter(x => x.staff_id === staffId);
            } else if (sql.includes("staff_id IN")) {
                // e.g. "staff_id IN (1, 2, 3)" の簡易パース
                const match = sql.match(/staff_id\s+IN\s*\(([^)]+)\)/i);
                if (match) {
                    const ids = match[1].split(',').map(x => parseInt(x.trim()));
                    result = result.filter(x => ids.includes(x.staff_id));
                }
            }
            return result;
        }

        // 21. 祝日手当の月次一括取得
        if (sql === "SELECT * FROM holiday_allowance_ledgers WHERE year_month = ?") {
            if (!dbData.holiday_allowance_ledgers) dbData.holiday_allowance_ledgers = [];
            return dbData.holiday_allowance_ledgers.filter(x => x.year_month === params[0]);
        }

        // 22. 休暇申請の取得 (特定職員・特定の期間)
        if (sql.includes("FROM leave_requests") && sql.includes("staff_id = ?")) {
            if (!dbData.leave_requests) dbData.leave_requests = [];
            const staffId = parseInt(params[0]);
            let result = dbData.leave_requests.filter(x => x.staff_id === staffId);
            
            if (sql.includes("status = 'approved'") || sql.includes('status = "approved"')) {
                result = result.filter(x => x.status === 'approved');
            }
            
            if (sql.includes("leave_type = 'weekly_off'") || sql.includes("leave_type = \"weekly_off\"")) {
                result = result.filter(x => x.leave_type === 'weekly_off');
            }
            
            if (sql.includes("start_date BETWEEN ? AND ?")) {
                const start = params[1];
                const end = params[2];
                result = result.filter(x => x.start_date >= start && x.start_date <= end);
            } else if (sql.includes("start_date <= ? AND end_date >= ?")) {
                const limitEnd = params[1];
                const limitStart = params[2];
                result = result.filter(x => x.start_date <= limitEnd && x.end_date >= limitStart);
            }
            return result;
        }

        // 23. 全職員の特定期間 of 休暇申請取得 (起算日スライド用などの日付重なり)
        if (sql.includes("FROM leave_requests") && sql.includes("start_date <= ? AND end_date >= ?")) {
            if (!dbData.leave_requests) dbData.leave_requests = [];
            const limitEnd = params[0];
            const limitStart = params[1];
            let result = dbData.leave_requests.filter(x => x.start_date <= limitEnd && x.end_date >= limitStart);
            if (sql.includes("status = 'approved'") || sql.includes('status = "approved"')) {
                result = result.filter(x => x.status === 'approved');
            }
            return result;
        }

        // 24. 全職員の特定期間の休暇申請取得 (BETWEEN指定)
        if (sql.includes("FROM leave_requests") && sql.includes("start_date BETWEEN ? AND ?")) {
            if (!dbData.leave_requests) dbData.leave_requests = [];
            const start = params[0];
            const end = params[1];
            let result = dbData.leave_requests.filter(x => x.start_date >= start && x.start_date <= end);
            
            if (sql.includes("status = 'approved'") || sql.includes('status = "approved"')) {
                result = result.filter(x => x.status === 'approved');
            }
            if (sql.includes("leave_type = 'weekly_off'") || sql.includes("leave_type = \"weekly_off\"")) {
                result = result.filter(x => x.leave_type === 'weekly_off');
            }
            return result;
        }

        // 22. 下書き履歴一覧の取得
        if (sql.includes("SELECT id, station_id, cycle_number, start_date, draft_name, created_at, created_by_name FROM schedule_drafts")) {
            if (!dbData.schedule_drafts) dbData.schedule_drafts = [];
            const station_id = parseInt(params[0], 10);
            const start_date = params[1];
            const cycle_number = parseInt(params[2], 10);
            
            let list = dbData.schedule_drafts.filter(x => 
                x.station_id === station_id && 
                x.start_date === start_date && 
                x.cycle_number === cycle_number
            );
            
            // メタデータのみ抽出
            const mappedList = list.map(x => ({
                id: x.id,
                station_id: x.station_id,
                cycle_number: x.cycle_number,
                start_date: x.start_date,
                draft_name: x.draft_name,
                created_at: x.created_at,
                created_by_name: x.created_by_name
            }));
            
            // ソート（作成日時の降順＝新しいものが上）
            mappedList.sort((a, b) => b.created_at.localeCompare(a.created_at));
            return mappedList;
        }

        console.warn('[DB MOCK UNHANDLED ALL] Returning empty array. SQL:', sql);
        return [];
    }

    run(...params) {
        const sql = this.sql;
        // console.log('[DB MOCK RUN] SQL:', sql, 'Params:', params);
        
        let changes = 0;
        let lastInsertRowid = 0;

        // 1. Audit Logsのインサート
        if (sql.startsWith("INSERT INTO audit_logs")) {
            const id = dbData.audit_logs.length + 1;
            if (params.length === 3) {
                dbData.audit_logs.push({
                    id,
                    staff_id: params[0],
                    action: params[1],
                    details: params[2],
                    created_at: new Date().toISOString()
                });
            } else {
                dbData.audit_logs.push({
                    id,
                    staff_id: params[0],
                    action: params[1],
                    target_table: params[2],
                    target_id: params[3],
                    details: params[4],
                    created_at: new Date().toISOString()
                });
            }
            lastInsertRowid = id;
            changes = 1;
        }
        
        // 2. 暗証番号変更
        else if (sql === "UPDATE staff SET pin_hash = ? WHERE id = ?") {
            const s = dbData.staff.find(x => x.id === params[1]);
            if (s) {
                s.pin_hash = params[0];
                changes = 1;
            }
        }
        
        // 3. 出勤打刻インサート
        else if (sql.includes("INSERT INTO attendance_records")) {
            const id = dbData.attendance_records.length + 1;
            dbData.attendance_records.push({
                id,
                staff_id: params[0],
                work_date: params[1],
                scheduled_shift: params[2],
                scheduled_start: params[3],
                scheduled_end: params[4],
                actual_clock_in: params[5],
                rounded_clock_in: params[6],
                scheduled_hours: params[7],
                actual_clock_out: null,
                rounded_clock_out: null,
                actual_hours: 0.0,
                overtime_hours: 0.0,
                status: params[8],
                created_at: new Date().toISOString()
            });
            lastInsertRowid = id;
            changes = 1;
        }
        
        // 4. 退勤打刻アップデート
        else if (sql.includes("UPDATE attendance_records SET actual_clock_out = ?")) {
            const recordId = params[4];
            const record = dbData.attendance_records.find(x => x.id === recordId);
            if (record) {
                record.actual_clock_out = params[0];
                record.rounded_clock_out = params[1];
                record.actual_hours = params[2];
                record.overtime_hours = params[3];
                record.status = 'present';
                changes = 1;
            }
        }
        
        // 5. 修正申請作成インサート
        else if (sql.includes("INSERT INTO attendance_modifications")) {
            const id = dbData.attendance_modifications.length + 1;
            dbData.attendance_modifications.push({
                id,
                attendance_id: parseInt(params[0]),
                field_name: params[1],
                old_value: params[2],
                new_value: params[3],
                reason: params[4],
                requested_by: params[5],
                approved_by: null,
                status: 'pending',
                created_at: new Date().toISOString()
            });
            lastInsertRowid = id;
            changes = 1;
        }
        
        // 6. 修正申請ステータス更新 (承認/却下)
        else if (sql === "UPDATE attendance_modifications SET status = ?, approved_by = ? WHERE id = ?") {
            const mod = dbData.attendance_modifications.find(x => x.id === params[2]);
            if (mod) {
                mod.status = params[0];
                mod.approved_by = params[1];
                changes = 1;
            }
        }
        
        // 7. 勤怠データ直接変更
        else if (sql.includes("UPDATE attendance_records SET actual_clock_in") || sql.includes("UPDATE attendance_records SET actual_clock_out")) {
            const recordId = params[4];
            const record = dbData.attendance_records.find(x => x.id === recordId);
            if (record) {
                // sqlクエリ文字列から書き換えフィールドを判定
                const isClockIn = sql.includes("actual_clock_in = ?");
                if (isClockIn) {
                    record.actual_clock_in = params[0];
                    record.rounded_clock_in = params[1];
                } else {
                    record.actual_clock_out = params[0];
                    record.rounded_clock_out = params[1];
                }
                record.modified_by = params[2];
                record.modification_reason = params[3];
                changes = 1;
            }
        }
        
        // 8. 勤怠データ時間更新
        else if (sql === "UPDATE attendance_records SET actual_hours = ?, overtime_hours = ?, status = ? WHERE id = ?") {
            const record = dbData.attendance_records.find(x => x.id === params[3]);
            if (record) {
                record.actual_hours = params[0];
                record.overtime_hours = params[1];
                record.status = params[2];
                changes = 1;
            }
        }
        
        // 9. 職員新規追加
        else if (sql.includes("INSERT INTO staff ( department_id") || sql.includes("INSERT INTO staff (department_id")) {
            const id = dbData.staff.length + 1;
            const hasPosition = sql.includes("position");
            if (hasPosition) {
                dbData.staff.push({
                    id,
                    department_id: params[0],
                    station_id: params[1],
                    employee_number: params[2],
                    pin_hash: params[3],
                    name: params[4],
                    platoon: params[5],
                    rank: params[6],
                    position: params[7],
                    has_large_license: params[8],
                    is_paramedic: params[9],
                    is_rescue: params[10],
                    is_kikan: params[11],
                    is_day_worker: params[12],
                    role: params[13],
                    annual_leave_balance: params[14],
                    is_active: 1,
                    created_at: new Date().toISOString()
                });
            } else {
                dbData.staff.push({
                    id,
                    department_id: params[0],
                    station_id: params[1],
                    employee_number: params[2],
                    pin_hash: params[3],
                    name: params[4],
                    platoon: params[5],
                    rank: params[6],
                    has_large_license: params[7],
                    is_paramedic: params[8],
                    is_rescue: params[9],
                    is_kikan: params[10],
                    is_day_worker: params[11],
                    role: params[12],
                    annual_leave_balance: params[13],
                    is_active: 1,
                    created_at: new Date().toISOString()
                });
            }
            lastInsertRowid = id;
            changes = 1;
        }
        
        // 10. 職員更新
        else if (sql.includes("UPDATE staff SET name = ?") || sql.includes("UPDATE staff SET name=?")) {
            const hasPosition = sql.includes("position = ?") || sql.includes("position=?");
            const staffId = parseInt(params[hasPosition ? 13 : 12]);
            const s = dbData.staff.find(x => x.id === staffId);
            if (s) {
                s.name = params[0];
                s.station_id = params[1];
                s.platoon = params[2];
                s.rank = params[3];
                if (hasPosition) {
                    s.position = params[4];
                    s.has_large_license = params[5];
                    s.is_paramedic = params[6];
                    s.is_rescue = params[7];
                    s.is_kikan = params[8];
                    s.is_day_worker = params[9];
                    s.role = params[10];
                    s.annual_leave_balance = params[11];
                    s.is_active = params[12];
                } else {
                    s.has_large_license = params[4];
                    s.is_paramedic = params[5];
                    s.is_rescue = params[6];
                    s.is_kikan = params[7];
                    s.is_day_worker = params[8];
                    s.role = params[9];
                    s.annual_leave_balance = params[10];
                    s.is_active = params[11];
                }
                changes = 1;
            }
        }

        // 10-2. 職員のアクティブ化
        else if (sql === "UPDATE staff SET is_active = 1 WHERE id = ?") {
            const staffId = parseInt(params[0]);
            const s = dbData.staff.find(x => x.id === staffId);
            if (s) {
                s.is_active = 1;
                changes = 1;
            }
        }
        
        // 10-3. 応援職員の非アクティブ化 (応援削除時)
        else if (sql.includes("UPDATE staff") && sql.includes("SET is_active = 0") && sql.includes("role LIKE 'support:%'")) {
            const stationId = parseInt(params[0]);
            const match = sql.match(/id\s+NOT\s+IN\s*\(([^)]+)\)/i);
            const excludedIds = match ? match[1].split(',').map(x => parseInt(x.trim())) : [];
            let count = 0;
            dbData.staff.forEach(s => {
                if (s.station_id === stationId && s.role && s.role.startsWith('support:') && !excludedIds.includes(s.id)) {
                    if (s.is_active !== 0) {
                        s.is_active = 0;
                        count++;
                    }
                }
            });
            changes = count;
        }
        
        // 11. 消防本部設定の更新
        else if (sql === "UPDATE fire_departments SET name = ?, shift_system = ?, cycle_days = ? WHERE id = ?") {
            const dept = dbData.fire_departments.find(x => x.id === params[3]);
            if (dept) {
                dept.name = params[0];
                dept.shift_system = params[1];
                dept.cycle_days = params[2];
                changes = 1;
            }
        }
        
        // 12. 丸め設定の挿入 / UPSERT
        else if (sql.includes("INSERT INTO rounding_settings")) {
            const deptId = params[0];
            const r = dbData.rounding_settings.find(x => x.department_id === deptId);
            if (r) {
                r.clock_in_unit = params[1];
                r.clock_in_direction = params[2];
                r.clock_out_unit = params[3];
                r.clock_out_direction = params[4];
            } else {
                dbData.rounding_settings.push({
                    id: dbData.rounding_settings.length + 1,
                    department_id: deptId,
                    clock_in_unit: params[1],
                    clock_in_direction: params[2],
                    clock_out_unit: params[3],
                    clock_out_direction: params[4]
                });
            }
            changes = 1;
        }

        // 消防車両データの削除
        else if (sql.includes("DELETE FROM deployed_vehicles")) {
            const stationId = parseInt(params[0]);
            if (!dbData.deployed_vehicles) dbData.deployed_vehicles = [];
            const initialLen = dbData.deployed_vehicles.length;
            dbData.deployed_vehicles = dbData.deployed_vehicles.filter(x => x.station_id !== stationId);
            changes = initialLen - dbData.deployed_vehicles.length;
        }

        // 消防車両データのインサート
        else if (sql.includes("INSERT INTO deployed_vehicles")) {
            if (!dbData.deployed_vehicles) dbData.deployed_vehicles = [];
            const id = dbData.deployed_vehicles.length + 1;
            dbData.deployed_vehicles.push({
                id,
                station_id: parseInt(params[0]),
                vehicle_name: params[1],
                is_active: 1
            });
            lastInsertRowid = id;
            changes = 1;
        }

        // 車両配置データの削除
        else if (sql.includes("DELETE FROM vehicle_assignments")) {
            const stationId = parseInt(params[0]);
            const start = params[1];
            const end = params[2];
            if (!dbData.vehicle_assignments) dbData.vehicle_assignments = [];
            const initialLen = dbData.vehicle_assignments.length;
            dbData.vehicle_assignments = dbData.vehicle_assignments.filter(x => 
                !(x.station_id === stationId && x.work_date >= start && x.work_date <= end)
            );
            changes = initialLen - dbData.vehicle_assignments.length;
        }

        // 車両配置データのインサート / 更新
        else if (sql.includes("INSERT INTO vehicle_assignments") || sql.includes("REPLACE INTO vehicle_assignments")) {
            if (!dbData.vehicle_assignments) dbData.vehicle_assignments = [];
            const work_date = params[0];
            const station_id = parseInt(params[1]);
            const vehicle_name = params[2];
            const role_name = params[3];
            const staff_id = parseInt(params[4]);
            
            const idx = dbData.vehicle_assignments.findIndex(x => 
                x.work_date === work_date && x.station_id === station_id && x.vehicle_name === vehicle_name && x.role_name === role_name
            );
            if (idx !== -1) {
                dbData.vehicle_assignments[idx].staff_id = staff_id;
            } else {
                const id = dbData.vehicle_assignments.length + 1;
                dbData.vehicle_assignments.push({
                    id,
                    work_date,
                    station_id,
                    vehicle_name,
                    role_name,
                    staff_id
                });
            }
            changes = 1;
        }
        
        // サイクル限定オーバーライド情報の保存
        else if (sql.includes("INSERT INTO schedule_staff_overrides") || sql.includes("REPLACE INTO schedule_staff_overrides") || sql.includes("INSERT OR REPLACE INTO schedule_staff_overrides")) {
            if (!dbData.schedule_staff_overrides) dbData.schedule_staff_overrides = [];
            const cycle_number = parseInt(params[0]);
            const start_date = params[1];
            const station_id = parseInt(params[2]);
            const staff_id = parseInt(params[3]);
            const platoon = params[4];
            const rank = params[5];
            
            const hasPosition = sql.includes("position");
            let position = '';
            let has_large_license = 0;
            let is_paramedic = 0;
            let is_rescue = 0;
            let is_kikan = 0;
            let is_day_worker = 0;
            
            if (hasPosition) {
                position = params[6];
                has_large_license = parseInt(params[7] || 0);
                is_paramedic = parseInt(params[8] || 0);
                is_rescue = parseInt(params[9] || 0);
                is_kikan = parseInt(params[10] || 0);
                is_day_worker = parseInt(params[11] || 0);
            } else {
                has_large_license = parseInt(params[6] || 0);
                is_paramedic = parseInt(params[7] || 0);
                is_rescue = parseInt(params[8] || 0);
                is_kikan = parseInt(params[9] || 0);
                is_day_worker = parseInt(params[10] || 0);
            }

            const idx = dbData.schedule_staff_overrides.findIndex(x =>
                x.cycle_number === cycle_number && x.start_date === start_date && x.staff_id === staff_id
            );
            const newObj = {
                cycle_number,
                start_date,
                station_id,
                staff_id,
                platoon,
                rank,
                position,
                has_large_license,
                is_paramedic,
                is_rescue,
                is_kikan,
                is_day_worker
            };
            if (idx !== -1) {
                dbData.schedule_staff_overrides[idx] = { ...dbData.schedule_staff_overrides[idx], ...newObj };
            } else {
                newObj.id = dbData.schedule_staff_overrides.length + 1;
                dbData.schedule_staff_overrides.push(newObj);
            }
            changes = 1;
        }
        else if (sql.includes("DELETE FROM schedule_staff_overrides")) {
            if (!dbData.schedule_staff_overrides) dbData.schedule_staff_overrides = [];
            if (sql.includes("WHERE station_id = ? AND start_date = ? AND staff_id = ?")) {
                const station_id = parseInt(params[0]);
                const start_date = params[1];
                const staff_id = parseInt(params[2]);
                const initialLen = dbData.schedule_staff_overrides.length;
                dbData.schedule_staff_overrides = dbData.schedule_staff_overrides.filter(x =>
                    !(x.station_id === station_id && x.start_date === start_date && x.staff_id === staff_id)
                );
                changes = initialLen - dbData.schedule_staff_overrides.length;
            } else if (sql.includes("WHERE station_id = ? AND start_date = ?")) {
                const station_id = parseInt(params[0]);
                const start_date = params[1];
                const initialLen = dbData.schedule_staff_overrides.length;
                dbData.schedule_staff_overrides = dbData.schedule_staff_overrides.filter(x =>
                    !(x.station_id === station_id && x.start_date === start_date)
                );
                changes = initialLen - dbData.schedule_staff_overrides.length;
            }
        }

        // スケジュール削除
        else if (sql.includes("DELETE FROM schedule_entries")) {
            if (!dbData.schedule_entries) dbData.schedule_entries = [];
            if (sql.includes("WHERE staff_id = ? AND work_date = ?")) {
                const staff_id = parseInt(params[0]);
                const work_date = params[1];
                const initialLen = dbData.schedule_entries.length;
                dbData.schedule_entries = dbData.schedule_entries.filter(x => !(x.staff_id === staff_id && x.work_date === work_date));
                changes = initialLen - dbData.schedule_entries.length;
            } else if (sql.includes("WHERE cycle_number = ?")) {
                const cycle = parseInt(params[0]);
                const initialLen = dbData.schedule_entries.length;
                dbData.schedule_entries = dbData.schedule_entries.filter(x => x.cycle_number !== cycle);
                changes = initialLen - dbData.schedule_entries.length;
            }
        }

        // 勤怠レコードの削除
        else if (sql.includes("DELETE FROM attendance_records")) {
            if (!dbData.attendance_records) dbData.attendance_records = [];
            if (sql.includes("WHERE staff_id = ? AND work_date = ? AND status = 'absent'")) {
                const staff_id = parseInt(params[0]);
                const work_date = params[1];
                const initialLen = dbData.attendance_records.length;
                dbData.attendance_records = dbData.attendance_records.filter(x => 
                    !(x.staff_id === staff_id && x.work_date === work_date && x.status === 'absent')
                );
                changes = initialLen - dbData.attendance_records.length;
            }
        }

        // スケジュールインサート / 更新
        else if (sql.includes("INSERT INTO schedule_entries") || sql.includes("REPLACE INTO schedule_entries")) {
            if (!dbData.schedule_entries) dbData.schedule_entries = [];
            
            let staff_id, work_date, cycle_number, shift_key, start_time = null, end_time = null, is_confirmed = 0, confirmed_by = null, confirmed_at = null;
            
            if (sql.includes("start_time")) {
                staff_id = parseInt(params[0]);
                work_date = params[1];
                cycle_number = parseInt(params[2]);
                shift_key = params[3];
                start_time = params[4] || null;
                end_time = params[5] || null;
                is_confirmed = parseInt(params[6] || 0);
                confirmed_by = params[7] ? parseInt(params[7]) : null;
                confirmed_at = params[8] || null;
            } else {
                staff_id = parseInt(params[0]);
                work_date = params[1];
                cycle_number = parseInt(params[2]);
                shift_key = params[3];
                is_confirmed = parseInt(params[4] || 0);
                confirmed_by = params[5] ? parseInt(params[5]) : null;
                confirmed_at = params[6] || null;
            }
            
            const idx = dbData.schedule_entries.findIndex(x => 
                x.staff_id === staff_id && x.work_date === work_date
            );
            if (idx !== -1) {
                dbData.schedule_entries[idx].cycle_number = cycle_number;
                dbData.schedule_entries[idx].shift_key = shift_key;
                dbData.schedule_entries[idx].start_time = start_time;
                dbData.schedule_entries[idx].end_time = end_time;
                dbData.schedule_entries[idx].is_confirmed = is_confirmed;
                dbData.schedule_entries[idx].confirmed_by = confirmed_by;
                dbData.schedule_entries[idx].confirmed_at = confirmed_at;
            } else {
                const id = dbData.schedule_entries.length + 1;
                dbData.schedule_entries.push({
                    id,
                    staff_id,
                    work_date,
                    cycle_number,
                    shift_key,
                    start_time,
                    end_time,
                    is_confirmed,
                    confirmed_by,
                    confirmed_at
                });
            }
            changes = 1;
        }

        // スケジュール更新 (確定フラグ)
        else if (sql.includes("UPDATE schedule_entries SET")) {
            if (!dbData.schedule_entries) dbData.schedule_entries = [];
            const is_confirmed = parseInt(params[0]);
            const confirmed_by = params[1] ? parseInt(params[1]) : null;
            const confirmed_at = params[2];
            
            if (sql.includes("WHERE staff_id = ? AND work_date = ?")) {
                const staff_id = parseInt(params[3]);
                const work_date = params[4];
                const entry = dbData.schedule_entries.find(x => x.staff_id === staff_id && x.work_date === work_date);
                if (entry) {
                    entry.is_confirmed = is_confirmed;
                    entry.confirmed_by = confirmed_by;
                    entry.confirmed_at = confirmed_at;
                    changes = 1;
                }
            } else if (sql.includes("WHERE cycle_number = ?")) {
                const cycle = parseInt(params[3]);
                const entries = dbData.schedule_entries.filter(x => x.cycle_number === cycle);
                entries.forEach(x => {
                    x.is_confirmed = is_confirmed;
                    x.confirmed_by = confirmed_by;
                    x.confirmed_at = confirmed_at;
                });
                changes = entries.length;
            }
        }

        // 祝日手当のインサート (ON CONFLICT時の処理も想定)
        else if (sql.includes("INSERT INTO holiday_allowance_ledgers") || sql.includes("INSERT OR REPLACE INTO holiday_allowance_ledgers")) {
            if (!dbData.holiday_allowance_ledgers) dbData.holiday_allowance_ledgers = [];
            const year_month = params[0];
            const staff_id = parseInt(params[1]);
            const status = params[2];
            const details = typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3];
            const total_hours = parseFloat(params[4]);
            const confirmed_by = params[5] ? parseInt(params[5]) : null;
            const confirmed_at = params[6] || null;

            const idx = dbData.holiday_allowance_ledgers.findIndex(x => x.year_month === year_month && x.staff_id === staff_id);
            if (idx !== -1) {
                dbData.holiday_allowance_ledgers[idx].status = status;
                dbData.holiday_allowance_ledgers[idx].details = details;
                dbData.holiday_allowance_ledgers[idx].total_hours = total_hours;
                dbData.holiday_allowance_ledgers[idx].confirmed_by = confirmed_by;
                dbData.holiday_allowance_ledgers[idx].confirmed_at = confirmed_at;
                lastInsertRowid = dbData.holiday_allowance_ledgers[idx].id;
            } else {
                const id = dbData.holiday_allowance_ledgers.length + 1;
                dbData.holiday_allowance_ledgers.push({
                    id,
                    year_month,
                    staff_id,
                    status,
                    details,
                    total_hours,
                    confirmed_by,
                    confirmed_at
                });
                lastInsertRowid = id;
            }
            changes = 1;
        }

        // 出勤簿の承認/提出レコードのインサート・更新
        else if (sql.includes("INSERT INTO ledger_approvals") || sql.includes("INSERT OR REPLACE INTO ledger_approvals")) {
            if (!dbData.ledger_approvals) dbData.ledger_approvals = [];
            const year_month = params[0];
            const staff_id = parseInt(params[1], 10);
            const status = params[2];
            const submitted_by = params[3] ? parseInt(params[3], 10) : null;
            const submitted_at = params[4] || null;
            const approved_by = params[5] ? parseInt(params[5], 10) : null;
            const approved_at = params[6] || null;

            const idx = dbData.ledger_approvals.findIndex(x => x.year_month === year_month && x.staff_id === staff_id);
            if (idx !== -1) {
                dbData.ledger_approvals[idx].status = status;
                dbData.ledger_approvals[idx].submitted_by = submitted_by;
                dbData.ledger_approvals[idx].submitted_at = submitted_at;
                dbData.ledger_approvals[idx].approved_by = approved_by;
                dbData.ledger_approvals[idx].approved_at = approved_at;
                lastInsertRowid = dbData.ledger_approvals[idx].id;
            } else {
                const id = dbData.ledger_approvals.length + 1;
                dbData.ledger_approvals.push({
                    id,
                    year_month,
                    staff_id,
                    status,
                    submitted_by,
                    submitted_at,
                    approved_by,
                    approved_at
                });
                lastInsertRowid = id;
            }
            changes = 1;
            saveDatabase();
        }

        // 祝日手当のアップデート
        else if (sql.includes("UPDATE holiday_allowance_ledgers SET")) {
            if (!dbData.holiday_allowance_ledgers) dbData.holiday_allowance_ledgers = [];
            if (sql.includes("WHERE year_month = ? AND staff_id = ?")) {
                const status = params[0];
                const confirmed_by = params[1] ? parseInt(params[1]) : null;
                const confirmed_at = params[2];
                const year_month = params[3];
                const staff_id = parseInt(params[4]);
                
                const entry = dbData.holiday_allowance_ledgers.find(x => x.year_month === year_month && x.staff_id === staff_id);
                if (entry) {
                    entry.status = status;
                    entry.confirmed_by = confirmed_by;
                    entry.confirmed_at = confirmed_at;
                    changes = 1;
                }
            }
        }

        // 祝日手当の削除
        else if (sql.includes("DELETE FROM holiday_allowance_ledgers")) {
            if (!dbData.holiday_allowance_ledgers) dbData.holiday_allowance_ledgers = [];
            if (sql.includes("WHERE year_month = ? AND staff_id = ?")) {
                const year_month = params[0];
                const staff_id = parseInt(params[1]);
                const beforeLen = dbData.holiday_allowance_ledgers.length;
                dbData.holiday_allowance_ledgers = dbData.holiday_allowance_ledgers.filter(
                    x => !(x.year_month === year_month && x.staff_id === staff_id)
                );
                changes = beforeLen - dbData.holiday_allowance_ledgers.length;
            }
        }

        // 休暇申請の削除 (週休希望の上書き削除用)
        else if (sql.includes("DELETE FROM leave_requests")) {
            if (!dbData.leave_requests) dbData.leave_requests = [];
            if (sql.includes("WHERE staff_id = ? AND leave_type = 'weekly_off' AND start_date BETWEEN ? AND ?")) {
                const staffId = parseInt(params[0]);
                const start = params[1];
                const end = params[2];
                const beforeLen = dbData.leave_requests.length;
                dbData.leave_requests = dbData.leave_requests.filter(
                    x => !(x.staff_id === staffId && x.leave_type === 'weekly_off' && x.start_date >= start && x.start_date <= end)
                );
                changes = beforeLen - dbData.leave_requests.length;
            }
        }

        // 休暇申請のインサート
        else if (sql.includes("INSERT INTO leave_requests")) {
            if (!dbData.leave_requests) dbData.leave_requests = [];
            const id = dbData.leave_requests.length + 1;
            
            if (params.length >= 8) {
                dbData.leave_requests.push({
                    id,
                    staff_id: parseInt(params[0]),
                    leave_type: params[1],
                    start_date: params[2],
                    end_date: params[3],
                    start_time: params[4],
                    end_time: params[5],
                    hours: params[6] ? parseFloat(params[6]) : null,
                    reason: params[7] || null,
                    status: sql.includes("'pending'") || sql.includes('"pending"') ? 'pending' : (params[8] || 'pending'),
                    created_at: new Date().toISOString()
                });
            } else if (params.length === 5) {
                dbData.leave_requests.push({
                    id,
                    staff_id: parseInt(params[0]),
                    leave_type: params[1],
                    start_date: params[2],
                    end_date: params[3],
                    status: params[4],
                    created_at: new Date().toISOString()
                });
            } else {
                dbData.leave_requests.push({
                    id,
                    staff_id: parseInt(params[0]),
                    leave_type: params[1],
                    start_date: params[2],
                    end_date: params[3],
                    reason: params[4] || null,
                    status: params[5] || 'pending',
                    created_at: new Date().toISOString()
                });
            }
            lastInsertRowid = id;
            changes = 1;
        }

        // 下書き削除
        else if (sql.includes("DELETE FROM schedule_drafts")) {
            if (!dbData.schedule_drafts) dbData.schedule_drafts = [];
            if (sql.includes("WHERE id = ?")) {
                const id = parseInt(params[0], 10);
                const beforeLen = dbData.schedule_drafts.length;
                dbData.schedule_drafts = dbData.schedule_drafts.filter(x => x.id !== id);
                changes = beforeLen - dbData.schedule_drafts.length;
            }
        }

        // 下書き保存 (INSERT)
        else if (sql.includes("INSERT INTO schedule_drafts")) {
            if (!dbData.schedule_drafts) dbData.schedule_drafts = [];
            const id = dbData.schedule_drafts.length + 1;
            
            const station_id = parseInt(params[0], 10);
            const cycle_number = parseInt(params[1], 10);
            const start_date = params[2];
            const draft_name = params[3];
            const created_at = params[4];
            const created_by = parseInt(params[5], 10);
            const created_by_name = params[6];
            const roster_data = typeof params[7] === 'string' ? JSON.parse(params[7]) : params[7];
            const vehicle_data = typeof params[8] === 'string' ? JSON.parse(params[8]) : params[8];
            const hourly_leaves = typeof params[9] === 'string' ? JSON.parse(params[9]) : params[9];
            const staff_list = typeof params[10] === 'string' ? JSON.parse(params[10]) : params[10];
            const hope_shifts = typeof params[11] === 'string' ? JSON.parse(params[11]) : params[11];
            
            dbData.schedule_drafts.push({
                id,
                station_id,
                cycle_number,
                start_date,
                draft_name,
                created_at,
                created_by,
                created_by_name,
                roster_data,
                vehicle_data,
                hourly_leaves,
                staff_list,
                hope_shifts
            });
            
            lastInsertRowid = id;
            changes = 1;
        }
        
        // 休暇申請の更新（承認・却下）
        else if (sql.includes("UPDATE leave_requests")) {
            if (!dbData.leave_requests) dbData.leave_requests = [];
            
            if (sql.includes("SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?")) {
                const status = params[0];
                const approved_by = parseInt(params[1], 10);
                const approved_at = params[2];
                const id = parseInt(params[3], 10);
                
                const item = dbData.leave_requests.find(x => x.id === id);
                if (item) {
                    item.status = status;
                    item.approved_by = approved_by;
                    item.approved_at = approved_at;
                    changes = 1;
                }
            }
        }

        saveDatabase();
        return { lastInsertRowid, changes };
    }
}

// better-sqlite3 互換の db オブジェクト
const db = {
    prepare(sql) {
        return new Statement(sql);
    },
    
    pragma(query) {
        // pragma は何もしない
        return null;
    },
    
    transaction(fn) {
        return (...args) => {
            // トランザクションのシミュレート
            try {
                const res = fn(...args);
                saveDatabase();
                return res;
            } catch (err) {
                // エラー時はJSONファイルからメモリを再ロード（ロールバック）
                loadDatabase();
                throw err;
            }
        };
    }
};

module.exports = db;
