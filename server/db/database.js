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
    audit_logs: []
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
        { id: 1, department_id: 1, name: '指宿消防署（本署）', code: 'honsho' },
        { id: 2, department_id: 1, name: '山川分遣所（北署）', code: 'kita' },
        { id: 3, department_id: 1, name: '開聞分遣所（南署）', code: 'minami' }
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
        // 本署
        { id: 1, department_id: 1, station_id: 1, employee_number: '0001', pin_hash: hash, name: 'システム管理者', platoon: 'nikkin', rank: '情報管理主任', has_large_license: 0, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 1, role: 'sysadmin', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 2, department_id: 1, station_id: 1, employee_number: '1001', pin_hash: hash, name: '田中 太郎', platoon: 'nikkin', rank: '消防司令', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 0, is_day_worker: 1, role: 'admin', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 3, department_id: 1, station_id: 1, employee_number: '1002', pin_hash: hash, name: '鈴木 一郎', platoon: '1bu', rank: '消防司令補', has_large_license: 1, is_paramedic: 1, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'chief', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 4, department_id: 1, station_id: 1, employee_number: '1003', pin_hash: hash, name: '佐藤 次郎', platoon: '2bu', rank: '消防司令補', has_large_license: 1, is_paramedic: 0, is_rescue: 1, is_kikan: 1, is_day_worker: 0, role: 'chief', annual_leave_balance: 18.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 5, department_id: 1, station_id: 1, employee_number: '1004', pin_hash: hash, name: '高橋 健二', platoon: '1bu', rank: '消防士長', has_large_license: 1, is_paramedic: 1, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 15.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 6, department_id: 1, station_id: 1, employee_number: '1005', pin_hash: hash, name: '渡辺 誠', platoon: '2bu', rank: '消防士長', has_large_license: 1, is_paramedic: 0, is_rescue: 1, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 7, department_id: 1, station_id: 1, employee_number: '1006', pin_hash: hash, name: '伊藤 翼', platoon: '1bu', rank: '消防士', has_large_license: 0, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 12.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 8, department_id: 1, station_id: 1, employee_number: '1007', pin_hash: hash, name: '小林 翔', platoon: '2bu', rank: '消防士', has_large_license: 1, is_paramedic: 0, is_rescue: 1, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 10.0, is_active: 1, created_at: new Date().toISOString() },
        // 北署
        { id: 9, department_id: 1, station_id: 2, employee_number: '2001', pin_hash: hash, name: '中村 護', platoon: '1bu', rank: '消防司令補', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'chief', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 10, department_id: 1, station_id: 2, employee_number: '2002', pin_hash: hash, name: '加藤 恵', platoon: '2bu', rank: '消防司令補', has_large_license: 1, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'chief', annual_leave_balance: 16.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 11, department_id: 1, station_id: 2, employee_number: '2003', pin_hash: hash, name: '吉田 大輔', platoon: '1bu', rank: '消防士長', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 14.5, is_active: 1, created_at: new Date().toISOString() },
        { id: 12, department_id: 1, station_id: 2, employee_number: '2004', pin_hash: hash, name: '山田 花子', platoon: '2bu', rank: '消防士', has_large_license: 0, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        // 南署
        { id: 13, department_id: 1, station_id: 3, employee_number: '3001', pin_hash: hash, name: '佐々木 茂', platoon: '1bu', rank: '消防司令補', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'chief', annual_leave_balance: 19.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 14, department_id: 1, station_id: 3, employee_number: '3002', pin_hash: hash, name: '山口 剛', platoon: '2bu', rank: '消防司令補', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'chief', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 15, department_id: 1, station_id: 3, employee_number: '3003', pin_hash: hash, name: '松本 淳', platoon: '1bu', rank: '消防士長', has_large_license: 0, is_paramedic: 1, is_rescue: 0, is_kikan: 0, is_day_worker: 0, role: 'staff', annual_leave_balance: 11.0, is_active: 1, created_at: new Date().toISOString() },
        { id: 16, department_id: 1, station_id: 3, employee_number: '3004', pin_hash: hash, name: '井上 陸', platoon: '2bu', rank: '消防士', has_large_license: 1, is_paramedic: 0, is_rescue: 0, is_kikan: 1, is_day_worker: 0, role: 'staff', annual_leave_balance: 20.0, is_active: 1, created_at: new Date().toISOString() }
    ];
    dbData.staff.push(...staffList);
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
        if (sql.includes("FROM staff s") && sql.includes("s.employee_number = ? AND s.is_active = 1")) {
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
        if (sql.includes("FROM attendance_records ar JOIN staff s") && sql.includes("ar.status = ?")) {
            const deptId = params[0];
            const workDate = params[1];
            // sqlからstatusを判定
            const isWorking = sql.includes("status = 'working'");
            const statusTarget = isWorking ? 'working' : 'present';
            
            let records = dbData.attendance_records.filter(x => x.work_date === workDate && x.status === statusTarget);
            let list = records.filter(r => {
                const s = dbData.staff.find(x => x.id === r.staff_id);
                if (!s || s.department_id !== deptId || s.is_active !== 1) return false;
                // station_idフィルタがあるか確認
                if (sql.includes("AND s.station_id = ?")) {
                    const idx = isWorking ? 2 : 2; // パラメータ位置
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
        else if (sql.includes("INSERT INTO staff ( department_id")) {
            const id = dbData.staff.length + 1;
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
            lastInsertRowid = id;
            changes = 1;
        }
        
        // 10. 職員更新
        else if (sql.includes("UPDATE staff SET name = ?")) {
            const staffId = parseInt(params[12]);
            const s = dbData.staff.find(x => x.id === staffId);
            if (s) {
                s.name = params[0];
                s.station_id = params[1];
                s.platoon = params[2];
                s.rank = params[3];
                s.has_large_license = params[4];
                s.is_paramedic = params[5];
                s.is_rescue = params[6];
                s.is_kikan = params[7];
                s.is_day_worker = params[8];
                s.role = params[9];
                s.annual_leave_balance = params[10];
                s.is_active = params[11];
                changes = 1;
            }
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
