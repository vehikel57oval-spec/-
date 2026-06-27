const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { verifyToken, requireRole } = require('../middleware/auth');

const DEFAULT_VEHICLES = ["指揮車", "タンク車", "救急車1", "救急車2", "救助工作車", "はしご車", "拠点機能車", "予備車", "卓上通信"];

// 時間文字列(HH:MM)を分換算するヘルパー
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

// 時間休の消化時間(時間)を計算するヘルパー (休憩時間の除外ロジック含む)
function calculateHourlyLeaveHours(startTimeStr, endTimeStr, isDayWorker) {
    if (!startTimeStr || !endTimeStr) return 0;
    
    let startMin = parseTimeToMinutes(startTimeStr);
    let endMin = parseTimeToMinutes(endTimeStr);
    
    if (endMin < startMin) {
        endMin += 24 * 60;
    }
    
    let diffMin = endMin - startMin;
    let breakMin = 0;
    
    for (let m = startMin; m < endMin; m++) {
        let currentDayMin = m % (24 * 60);
        
        if (isDayWorker) {
            // 日勤休憩: 12:00 - 13:00 (720 - 780)
            if (currentDayMin >= 720 && currentDayMin < 780) {
                breakMin++;
            }
        } else {
            // 当務休憩
            // 12:00 - 13:00 (720 - 780)
            if (currentDayMin >= 720 && currentDayMin < 780) {
                breakMin++;
            }
            // 17:15 - 18:00 (1035 - 1080)
            if (currentDayMin >= 1035 && currentDayMin < 1080) {
                breakMin++;
            }
            // 22:00 - 05:00 (1320 - 1440 or 0 - 300)
            if (currentDayMin >= 1320 || currentDayMin < 300) {
                breakMin++;
            }
        }
    }
    
    let actualWorkMin = diffMin - breakMin;
    return Math.max(0, actualWorkMin / 60);
}

// 応援・補充職員のデータベースIDマッピングおよび保存用ヘルパー
function processSupportStaff(staffList, station_id, departmentId) {
    const idMap = {};
    if (!staffList || !Array.isArray(staffList)) return idMap;

    staffList.forEach(s => {
        if (s.isSupport || (s.id && s.id.toString().startsWith('support-'))) {
            // 既存の応援職員であるかチェック
            const roleStr = `support:${s.origin || ''}:${s.supportStart || ''}:${s.supportEnd || ''}`;
            let existing = db.prepare('SELECT id FROM staff WHERE station_id = ? AND name = ? AND role = ?').get(station_id, s.name, roleStr);
            
            let dbId;
            if (existing) {
                dbId = existing.id;
                // もし非アクティブ化されていたらアクティブに戻す。また、最新の資格や階級・役職を更新する
                db.prepare(`
                    UPDATE staff 
                    SET is_active = 1,
                        platoon = ?,
                        rank = ?,
                        position = ?,
                        has_large_license = ?,
                        is_paramedic = ?,
                        is_rescue = ?,
                        is_kikan = ?
                    WHERE id = ?
                `).run(
                    s.platoon === 1 ? '1bu' : (s.platoon === 2 ? '2bu' : 'nikkin'),
                    s.rank || '',
                    s.position || '',
                    s.hasLargeLicense ? 1 : 0,
                    s.isParamedic ? 1 : 0,
                    s.isRescue ? 1 : 0,
                    s.isKikan ? 1 : 0,
                    dbId
                );
            } else {
                // 応援職員として新規にマスタ登録
                const employeeNumber = 'SUP-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                const pinHash = 'SUPPORT';
                const platoonVal = s.platoon === 1 ? '1bu' : (s.platoon === 2 ? '2bu' : 'nikkin');

                const info = db.prepare(`
                    INSERT INTO staff (
                        department_id, station_id, employee_number, pin_hash, name,
                        platoon, rank, position, has_large_license, is_paramedic, is_rescue, is_kikan,
                        is_day_worker, role, annual_leave_balance, is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 20.0, 1)
                `).run(
                    departmentId,
                    station_id,
                    employeeNumber,
                    pinHash,
                    s.name,
                    platoonVal,
                    s.rank || '',
                    s.position || '',
                    s.hasLargeLicense ? 1 : 0,
                    s.isParamedic ? 1 : 0,
                    s.isRescue ? 1 : 0,
                    s.isKikan ? 1 : 0,
                    s.isDayWorker ? 1 : 0,
                    roleStr
                );
                dbId = info.lastInsertRowid;
            }
            idMap[s.id] = dbId.toString();
        } else {
            idMap[s.id] = s.id;
        }
    });

    return idMap;
}

// 通常職員のサイクル限定一時変更（オーバーライド）の保存・削除
function saveStaffOverrides(staffList, station_id, cycle_number, start_date) {
    if (!staffList || !Array.isArray(staffList)) return;

    // 該当署所の通常職員マスタをデータベースから再取得して比較基準とする
    const masterStaff = db.prepare('SELECT * FROM staff WHERE station_id = ? AND is_active = 1').all(station_id);
    const masterStaffMap = {};
    masterStaff.forEach(s => {
        masterStaffMap[s.id.toString()] = s;
    });

    staffList.forEach(s => {
        const sIdStr = s.id.toString();
        if (s.isSupport || sIdStr.startsWith('support-')) return; // 応援職員はスキップ

        const master = masterStaffMap[sIdStr];
        if (!master) return;

        // 比較用にフォーマットを統一
        const masterPlatoon = master.platoon === '1bu' ? 1 : (master.platoon === '2bu' ? 2 : 0);
        const masterRank = master.rank || '';
        const masterPosition = master.position || '';
        const masterHasLarge = !!master.has_large_license;
        const masterIsParamedic = !!master.is_paramedic;
        const masterIsRescue = !!master.is_rescue;
        const masterIsKikan = !!master.is_kikan;
        const masterIsDayWorker = !!master.is_day_worker;

        const currentPlatoon = parseInt(s.platoon);
        const currentRank = s.rank || '';
        const currentPosition = s.position || '';
        const currentHasLarge = !!s.hasLargeLicense;
        const currentIsParamedic = !!s.isParamedic;
        const currentIsRescue = !!s.isRescue;
        const currentIsKikan = !!s.isKikan;
        const currentIsDayWorker = !!s.isDayWorker;

        const hasOverride = (
            masterPlatoon !== currentPlatoon ||
            masterRank !== currentRank ||
            masterPosition !== currentPosition ||
            masterHasLarge !== currentHasLarge ||
            masterIsParamedic !== currentIsParamedic ||
            masterIsRescue !== currentIsRescue ||
            masterIsKikan !== currentIsKikan ||
            masterIsDayWorker !== currentIsDayWorker
        );

        if (hasOverride) {
            const platoonVal = currentPlatoon === 1 ? '1bu' : (currentPlatoon === 2 ? '2bu' : 'nikkin');
            db.prepare(`
                INSERT OR REPLACE INTO schedule_staff_overrides (
                    cycle_number, start_date, station_id, staff_id,
                    platoon, rank, position, has_large_license, is_paramedic, is_rescue, is_kikan, is_day_worker
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                cycle_number,
                start_date,
                station_id,
                parseInt(sIdStr),
                platoonVal,
                currentRank,
                currentPosition,
                currentHasLarge ? 1 : 0,
                currentIsParamedic ? 1 : 0,
                currentIsRescue ? 1 : 0,
                currentIsKikan ? 1 : 0,
                currentIsDayWorker ? 1 : 0
            );
        } else {
            db.prepare(`
                DELETE FROM schedule_staff_overrides 
                WHERE station_id = ? AND start_date = ? AND staff_id = ?
            `).run(station_id, start_date, parseInt(sIdStr));
        }
    });
}


// 日付に27日を加算して28日間の期間の終了日を求めるヘルパー
function getEndDateStr(startDateStr) {
    const start = new Date(startDateStr.replace(/-/g, '/'));
    const end = new Date(start);
    end.setDate(start.getDate() + 27);
    const y = end.getFullYear();
    const m = String(end.getMonth() + 1).padStart(2, '0');
    const d = String(end.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// サイクル番号に応じて起算日をシフトするヘルパー
function getShiftedStartDateStr(startDateStr, cycleNumber) {
    const start = new Date(startDateStr.replace(/-/g, '/'));
    start.setDate(start.getDate() + (cycleNumber - 1) * 28);
    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, '0');
    const d = String(start.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * @route   GET /api/schedule/my-schedule
 * @desc    ログインユーザーの当月のスケジュールをカレンダー表示用に取得
 */
router.get('/my-schedule', verifyToken, (req, res) => {
    const { getJapaneseHoliday } = require('../utils/holidays');
    const staffId = req.user.id;
    const yearMonth = req.query.year_month; // YYYY-MM
    
    if (!yearMonth) {
        return res.status(400).json({ error: '年月を指定してください。' });
    }
    
    try {
        const startDate = `${yearMonth}-01`;
        const [year, month] = yearMonth.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const endDate = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;
        
        // 1. スケジュールエントリーの取得
        const entries = db.prepare(`
            SELECT work_date, shift_key, start_time, end_time 
            FROM schedule_entries 
            WHERE staff_id = ? AND work_date BETWEEN ? AND ?
        `).all(staffId, startDate, endDate);
        
        // 2. 休暇申請（承認済）の取得
        const leaves = db.prepare(`
            SELECT start_date, end_date, leave_type, reason
            FROM leave_requests
            WHERE staff_id = ? AND status = 'approved' AND (start_date <= ? AND end_date >= ?)
        `).all(staffId, endDate, startDate);
        
        // 3. 日付ごとのスケジュール・休暇情報のマッピング
        const days = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const dayStr = `${yearMonth}-${String(day).padStart(2, '0')}`;
            const dateObj = new Date(year, month - 1, day);
            const holidayName = getJapaneseHoliday(dateObj) || null;
            
            // シフトの検索
            const entry = entries.find(e => e.work_date === dayStr);
            const shiftKey = entry ? entry.shift_key : '-';
            const startTime = entry ? entry.start_time : null;
            const endTime = entry ? entry.end_time : null;
            
            // 休暇の検索
            const leave = leaves.find(l => dayStr >= l.start_date && dayStr <= l.end_date);
            const leaveType = leave ? leave.leave_type : null;
            const leaveReason = leave ? leave.reason : null;
            
            days.push({
                date: dayStr,
                day,
                dayOfWeek: dateObj.getDay(),
                holidayName,
                shiftKey,
                startTime,
                endTime,
                leaveType,
                leaveReason
            });
        }
        
        res.json({
            success: true,
            days
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

/**
 * @route   GET /api/schedule/roster
 * @desc    勤務表に必要なデータ（職員リスト、スケジュール、稼働車両、車両配置）を取得
 */
router.get('/roster', verifyToken, (req, res) => {
    const departmentId = req.user.department_id;
    const stationId = parseInt(req.query.station_id);
    const startDateStr = req.query.start_date; // YYYY-MM-DD

    if (!stationId || !startDateStr) {
        return res.status(400).json({ error: '署所IDと起算日を指定してください。' });
    }

    try {
        const cycleNum = parseInt(req.query.cycle_number) || 1;
        const shiftedStartDateStr = getShiftedStartDateStr(startDateStr, cycleNum);
        const endDateStr = getEndDateStr(shiftedStartDateStr);

        // 1. 職員リストの取得
        const staff = db.prepare(`
            SELECT s.*, st.name as station_name 
            FROM staff s
            JOIN stations st ON s.station_id = st.id
            WHERE s.department_id = ? AND s.station_id = ? AND s.is_active = 1
        `).all(departmentId, stationId);

        // サイクル限定オーバーライドのロード
        const overrides = db.prepare('SELECT * FROM schedule_staff_overrides WHERE station_id = ? AND start_date = ?').all(stationId, startDateStr);
        const overrideMap = {};
        overrides.forEach(o => {
            overrideMap[o.staff_id.toString()] = o;
        });

        // クライアントの scheduler.js / app.js が期待するキャメルケース形式にマッピング
        const mappedStaff = staff.map(s => {
            const isSupport = !!(s.role && s.role.startsWith('support:'));
            let origin = '';
            let supportStart = '';
            let supportEnd = '';
            if (isSupport) {
                const parts = s.role.split(':');
                origin = parts[1] || '';
                supportStart = parts[2] || '';
                supportEnd = parts[3] || '';
            }

            // デフォルトはマスタの値
            let platoon = s.platoon === '1bu' ? 1 : (s.platoon === '2bu' ? 2 : 0);
            let rank = s.rank;
            let position = s.position || '';
            let hasLargeLicense = !!s.has_large_license;
            let isParamedic = !!s.is_paramedic;
            let isRescue = !!s.is_rescue;
            let isKikan = !!s.is_kikan;
            let isDayWorker = !!s.is_day_worker;

            // オーバーライドが存在すれば適用
            const override = overrideMap[s.id.toString()];
            if (override) {
                if (override.platoon !== undefined && override.platoon !== null) {
                    platoon = override.platoon === '1bu' ? 1 : (override.platoon === '2bu' ? 2 : (override.platoon === 1 ? 1 : (override.platoon === 2 ? 2 : 0)));
                }
                if (override.rank !== undefined && override.rank !== null) rank = override.rank;
                if (override.position !== undefined && override.position !== null) position = override.position;
                if (override.has_large_license !== undefined && override.has_large_license !== null) hasLargeLicense = !!override.has_large_license;
                if (override.is_paramedic !== undefined && override.is_paramedic !== null) isParamedic = !!override.is_paramedic;
                if (override.is_rescue !== undefined && override.is_rescue !== null) isRescue = !!override.is_rescue;
                if (override.is_kikan !== undefined && override.is_kikan !== null) isKikan = !!override.is_kikan;
                if (override.is_day_worker !== undefined && override.is_day_worker !== null) isDayWorker = !!override.is_day_worker;
            }

            return {
                id: s.id.toString(),
                name: s.name,
                platoon,
                rank,
                position,
                hasLargeLicense,
                isParamedic,
                isRescue,
                isKikan,
                isDayWorker,
                isSupport,
                origin,
                supportStart,
                supportEnd
            };
        });

        // 2. スケジュールエントリーの取得 (この署所の職員全員分)
        const staffIds = staff.map(s => s.id);
        let scheduleEntries = [];
        if (staffIds.length > 0) {
            scheduleEntries = db.prepare(`
                SELECT * FROM schedule_entries 
                WHERE staff_id IN (${staffIds.join(',')}) AND work_date BETWEEN ? AND ?
            `).all(shiftedStartDateStr, endDateStr);
        }

        // 3. 稼働車両設定の取得
        const vehicles = db.prepare('SELECT * FROM deployed_vehicles WHERE station_id = ?').all(stationId);
        const deployedVehicles = vehicles.length > 0 ? vehicles.map(v => v.vehicle_name) : DEFAULT_VEHICLES;

        // 4. 車両配置データの取得
        const assignments = db.prepare(`
            SELECT * FROM vehicle_assignments 
            WHERE station_id = ? AND work_date BETWEEN ? AND ?
        `).all(stationId, shiftedStartDateStr, endDateStr);

        // クライアントが処理しやすい形式にvehicleAssignmentsをマッピング
        // { "YYYY-MM-DD": { "車両名": { "役割": "職員ID", ... } } }
        const mappedAssignments = {};
        assignments.forEach(a => {
            if (!mappedAssignments[a.work_date]) {
                mappedAssignments[a.work_date] = {};
            }
            if (!mappedAssignments[a.work_date][a.vehicle_name]) {
                mappedAssignments[a.work_date][a.vehicle_name] = {};
            }
            mappedAssignments[a.work_date][a.vehicle_name][a.role_name] = a.staff_id.toString();
        });

        // 5. 週休希望（leave_requestsのweekly_offかつapprovedのもの）を取得してhopeShiftsにマッピング
        const leaves = db.prepare(`
            SELECT * FROM leave_requests 
            WHERE status = 'approved' AND leave_type = 'weekly_off' AND start_date BETWEEN ? AND ?
        `).all(shiftedStartDateStr, endDateStr);

        const hopeShifts = {};
        mappedStaff.forEach(s => {
            hopeShifts[`${cycleNum}_${s.id}`] = {};
        });

        leaves.forEach(lr => {
            const key = `${cycleNum}_${lr.staff_id}`;
            if (!hopeShifts[key]) {
                hopeShifts[key] = {};
            }
            
            const start = new Date(shiftedStartDateStr.replace(/-/g, '/'));
            const target = new Date(lr.start_date.replace(/-/g, '/'));
            const diffTime = target - start;
            const dayIndex = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            if (dayIndex >= 0 && dayIndex < 28) {
                hopeShifts[key][dayIndex] = '休';
            }
        });

        res.json({
            success: true,
            staff: mappedStaff,
            scheduleEntries,
            deployedVehicles,
            vehicleAssignments: mappedAssignments,
            hopeShifts: hopeShifts
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '勤務表データの取得に失敗しました。' });
    }
});

/**
 * @route   POST /api/schedule/save
 * @desc    勤務スケジュールおよび車両配置の下書き保存
 */
router.post('/save', verifyToken, requireRole('admin', 'sysadmin', 'chief'), (req, res) => {
    const { station_id, start_date, cycle_number, roster, deployedVehicles, vehicleAssignments, hourlyLeaves, staffList } = req.body;

    if (!station_id || !start_date || !cycle_number || !roster) {
        return res.status(400).json({ error: '必要なパラメータが不足しています。' });
    }

    try {
        const cycleNum = parseInt(cycle_number) || 1;
        const shiftedStartDateStr = getShiftedStartDateStr(start_date, cycleNum);
        const shiftedEndDateStr = getEndDateStr(shiftedStartDateStr);
        const shiftedStart = new Date(shiftedStartDateStr.replace(/-/g, '/'));

        // トランザクションで保存処理を一括実行
        const saveTx = db.transaction(() => {
            // 応援職員の処理とデータベースIDへのマッピング
            const idMap = processSupportStaff(staffList, station_id, req.user.department_id);

            // 通常職員のサイクル限定一時変更（オーバーライド）の保存・削除
            saveStaffOverrides(staffList, station_id, cycle_number, start_date);

            // 削除された応援職員を非アクティブ化 (is_active = 0)
            const incomingSupportDbIds = Object.values(idMap).filter(id => id !== undefined);
            db.prepare(`
                UPDATE staff 
                SET is_active = 0 
                WHERE station_id = ? AND role LIKE 'support:%' AND id NOT IN (${incomingSupportDbIds.length > 0 ? incomingSupportDbIds.join(',') : '0'})
            `).run(station_id);

            // 1. 稼働車両設定の保存
            if (deployedVehicles && Array.isArray(deployedVehicles)) {
                db.prepare('DELETE FROM deployed_vehicles WHERE station_id = ?').run(station_id);
                deployedVehicles.forEach(vehicle => {
                    db.prepare('INSERT INTO deployed_vehicles (station_id, vehicle_name) VALUES (?, ?)').run(station_id, vehicle);
                });
            }

            // 2. 車両配置の保存
            if (vehicleAssignments) {
                db.prepare('DELETE FROM vehicle_assignments WHERE station_id = ? AND work_date BETWEEN ? AND ?').run(station_id, shiftedStartDateStr, shiftedEndDateStr);
                for (const [dateStr, vehiclesObj] of Object.entries(vehicleAssignments)) {
                    if (dateStr >= shiftedStartDateStr && dateStr <= shiftedEndDateStr) {
                        for (const [vehicleName, rolesObj] of Object.entries(vehiclesObj)) {
                            for (const [roleName, staffIdStr] of Object.entries(rolesObj)) {
                                if (staffIdStr) {
                                    let mappedStaffId = parseInt(idMap[staffIdStr] || staffIdStr);
                                    if (roleName === 'completed') {
                                        mappedStaffId = req.user.id;
                                    }
                                    if (!isNaN(mappedStaffId)) {
                                        db.prepare(`
                                            INSERT INTO vehicle_assignments (work_date, station_id, vehicle_name, role_name, staff_id)
                                            VALUES (?, ?, ?, ?, ?)
                                        `).run(dateStr, station_id, vehicleName, roleName, mappedStaffId);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 3. 勤務表下書き(schedule_entries)の保存
            for (const [staffIdStr, shifts] of Object.entries(roster)) {
                const mappedStaffId = parseInt(idMap[staffIdStr] || staffIdStr);
                if (isNaN(mappedStaffId)) continue;

                for (let d = 0; d < 28; d++) {
                    const dObj = new Date(shiftedStart);
                    dObj.setDate(shiftedStart.getDate() + d);
                    const year = dObj.getFullYear();
                    const month = String(dObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dObj.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    const shiftKey = shifts[d] || '-';

                    const hourlyKey = `${cycle_number}_${staffIdStr}_${d}`;
                    const hourlyLeave = (hourlyLeaves && hourlyLeaves[hourlyKey]) ? hourlyLeaves[hourlyKey] : null;
                    const startTime = hourlyLeave ? hourlyLeave.startTime : null;
                    const endTime = hourlyLeave ? hourlyLeave.endTime : null;

                    db.prepare(`
                        INSERT OR REPLACE INTO schedule_entries (staff_id, work_date, cycle_number, shift_key, start_time, end_time, is_confirmed)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).run(mappedStaffId, dateStr, cycle_number, shiftKey, startTime, endTime, 0);
                }
            }
        });

        saveTx();

        // ログ記録
        db.prepare('INSERT INTO audit_logs (staff_id, action, details) VALUES (?, ?, ?)')
            .run(req.user.id, 'save_schedule', `勤務表下書き保存: 署所ID=${station_id}, サイクル=${cycle_number}`);

        res.json({ success: true, message: '勤務表の下書きを保存しました。' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '下書きの保存に失敗しました。' });
    }
});

/**
 * @route   POST /api/schedule/confirm
 * @desc    勤務スケジュールの確定 ＆ 勤怠レコードの自動生成
 */
router.post('/confirm', verifyToken, requireRole('admin', 'sysadmin', 'chief'), (req, res) => {
    const { station_id, start_date, cycle_number, roster, deployedVehicles, vehicleAssignments, hourlyLeaves, staffList } = req.body;

    if (!station_id || !start_date || !cycle_number || !roster) {
        return res.status(400).json({ error: '必要なパラメータが不足しています。' });
    }

    try {
        const cycleNum = parseInt(cycle_number) || 1;
        const shiftedStartDateStr = getShiftedStartDateStr(start_date, cycleNum);
        const shiftedEndDateStr = getEndDateStr(shiftedStartDateStr);
        const shiftedStart = new Date(shiftedStartDateStr.replace(/-/g, '/'));
        const nowStr = new Date().toISOString();

        // トランザクションで保存・確定・勤怠生成を実行
        const confirmTx = db.transaction(() => {
            // 応援職員の処理とデータベースIDへのマッピング
            const idMap = processSupportStaff(staffList, station_id, req.user.department_id);

            // 通常職員のサイクル限定一時変更（オーバーライド）の保存・削除
            saveStaffOverrides(staffList, station_id, cycle_number, start_date);

            // 削除された応援職員を非アクティブ化 (is_active = 0)
            const incomingSupportDbIds = Object.values(idMap).filter(id => id !== undefined);
            db.prepare(`
                UPDATE staff 
                SET is_active = 0 
                WHERE station_id = ? AND role LIKE 'support:%' AND id NOT IN (${incomingSupportDbIds.length > 0 ? incomingSupportDbIds.join(',') : '0'})
            `).run(station_id);

            // 1. 稼働車両と車両配置の保存
            if (deployedVehicles && Array.isArray(deployedVehicles)) {
                db.prepare('DELETE FROM deployed_vehicles WHERE station_id = ?').run(station_id);
                deployedVehicles.forEach(vehicle => {
                    db.prepare('INSERT INTO deployed_vehicles (station_id, vehicle_name) VALUES (?, ?)').run(station_id, vehicle);
                });
            }

            if (vehicleAssignments) {
                db.prepare('DELETE FROM vehicle_assignments WHERE station_id = ? AND work_date BETWEEN ? AND ?').run(station_id, shiftedStartDateStr, shiftedEndDateStr);
                for (const [dateStr, vehiclesObj] of Object.entries(vehicleAssignments)) {
                    if (dateStr >= shiftedStartDateStr && dateStr <= shiftedEndDateStr) {
                        for (const [vehicleName, rolesObj] of Object.entries(vehiclesObj)) {
                            for (const [roleName, staffIdStr] of Object.entries(rolesObj)) {
                                if (staffIdStr) {
                                    let mappedStaffId = parseInt(idMap[staffIdStr] || staffIdStr);
                                    if (roleName === 'completed') {
                                        mappedStaffId = req.user.id;
                                    }
                                    if (!isNaN(mappedStaffId)) {
                                        db.prepare(`
                                            INSERT INTO vehicle_assignments (work_date, station_id, vehicle_name, role_name, staff_id)
                                            VALUES (?, ?, ?, ?, ?)
                                        `).run(dateStr, station_id, vehicleName, roleName, mappedStaffId);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 職員リストの取得 (休憩時間計算・部判定用) - 応援職員追加後なので再取得
            const fullStaffList = db.prepare('SELECT id, platoon, is_day_worker FROM staff WHERE station_id = ?').all(station_id);
            
            // サイクル限定オーバーライドのロードと適用
            const overridesConfirm = db.prepare('SELECT * FROM schedule_staff_overrides WHERE station_id = ? AND start_date = ?').all(station_id, start_date);
            const overrideConfirmMap = {};
            overridesConfirm.forEach(o => {
                overrideConfirmMap[o.staff_id.toString()] = o;
            });

            const staffMap = {};
            fullStaffList.forEach(s => {
                const o = overrideConfirmMap[s.id.toString()];
                if (o) {
                    if (o.platoon !== undefined && o.platoon !== null) s.platoon = o.platoon;
                    if (o.is_day_worker !== undefined && o.is_day_worker !== null) s.is_day_worker = o.is_day_worker;
                }
                staffMap[s.id] = s;
            });

            // 2. 勤務表確定(schedule_entries)の保存
            for (const [staffIdStr, shifts] of Object.entries(roster)) {
                const mappedStaffId = parseInt(idMap[staffIdStr] || staffIdStr);
                if (isNaN(mappedStaffId)) continue;

                for (let d = 0; d < 28; d++) {
                    const dObj = new Date(shiftedStart);
                    dObj.setDate(shiftedStart.getDate() + d);
                    const year = dObj.getFullYear();
                    const month = String(dObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dObj.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    const shiftKey = shifts[d] || '-';

                    const hourlyKey = `${cycle_number}_${staffIdStr}_${d}`;
                    const hourlyLeave = (hourlyLeaves && hourlyLeaves[hourlyKey]) ? hourlyLeaves[hourlyKey] : null;
                    const startTime = hourlyLeave ? hourlyLeave.startTime : null;
                    const endTime = hourlyLeave ? hourlyLeave.endTime : null;

                    db.prepare(`
                        INSERT OR REPLACE INTO schedule_entries (staff_id, work_date, cycle_number, shift_key, start_time, end_time, is_confirmed, confirmed_by, confirmed_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(mappedStaffId, dateStr, cycle_number, shiftKey, startTime, endTime, 1, req.user.id, nowStr);

                    // 3. 勤怠レコード（出勤予定）の自動生成
                    if (shiftKey === '当' || shiftKey === '日' || (shiftKey === '有' && startTime && endTime)) {
                        const s = staffMap[mappedStaffId];
                        const isDayWorker = s ? !!s.is_day_worker : false;
                        const platoon = s ? s.platoon : '';

                        let scheduledShift = 'nik';
                        let scheduledStart = '08:30';
                        let scheduledEnd = '17:15';
                        let scheduledHours = 7.75;

                        if (shiftKey === '当' || (shiftKey === '有' && startTime && endTime && platoon !== 'nikkin')) {
                            scheduledShift = 'tou';
                            scheduledStart = '08:30';
                            scheduledEnd = '08:30';
                            scheduledHours = 15.5;
                        }

                        if (shiftKey === '有' && startTime && endTime) {
                            const leaveHours = calculateHourlyLeaveHours(startTime, endTime, isDayWorker);
                            scheduledHours = Math.max(0, scheduledHours - leaveHours);
                        }

                        // 既存のレコードを確認（すでに打刻中'working'または打刻完了'present'のものは上書きしない）
                        const existing = db.prepare('SELECT * FROM attendance_records WHERE staff_id = ? AND work_date = ?').get(mappedStaffId, dateStr);

                        if (!existing) {
                            db.prepare(`
                                INSERT INTO attendance_records (
                                    staff_id, work_date, scheduled_shift, scheduled_start, scheduled_end,
                                    actual_clock_in, rounded_clock_in, scheduled_hours, status
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `).run(mappedStaffId, dateStr, scheduledShift, scheduledStart, scheduledEnd, null, null, scheduledHours, 'absent');
                        } else if (existing.status === 'absent') {
                            // 既存で未打刻の場合は、スケジュールに合わせ再構成
                            db.prepare('DELETE FROM attendance_records WHERE staff_id = ? AND work_date = ? AND status = \'absent\'').run(mappedStaffId, dateStr);
                            db.prepare(`
                                INSERT INTO attendance_records (
                                    staff_id, work_date, scheduled_shift, scheduled_start, scheduled_end,
                                    actual_clock_in, rounded_clock_in, scheduled_hours, status
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `).run(mappedStaffId, dateStr, scheduledShift, scheduledStart, scheduledEnd, null, null, scheduledHours, 'absent');
                        }
                    } else {
                        // 休み（週休や休暇）に変更された場合、既存の未打刻(absent)レコードがあれば削除する
                        db.prepare('DELETE FROM attendance_records WHERE staff_id = ? AND work_date = ? AND status = \'absent\'').run(mappedStaffId, dateStr);
                    }
                }
            }
        });

        confirmTx();

        // 確定時点のデータを「確定履歴（バックアップ）」として下書きテーブルに自動保存する
        try {
            const name = `[確定履歴] ${new Date().toLocaleDateString('ja-JP')} (第${cycle_number}サイクル)`;
            const createdAt = new Date().toISOString();
            const vehicleData = {
                deployedVehicles: deployedVehicles || [],
                vehicleAssignments: vehicleAssignments || {}
            };
            db.prepare(`
                INSERT INTO schedule_drafts (
                    station_id, cycle_number, start_date, draft_name, created_at, created_by, created_by_name,
                    roster_data, vehicle_data, hourly_leaves, staff_list, hope_shifts
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                parseInt(station_id, 10),
                parseInt(cycle_number, 10),
                start_date,
                name,
                createdAt,
                req.user.id,
                req.user.name || 'システム自動',
                JSON.stringify(roster),
                JSON.stringify(vehicleData),
                JSON.stringify(hourlyLeaves || {}),
                JSON.stringify(staffList || []),
                JSON.stringify(req.body.hopeShifts || {})
            );
        } catch (backupErr) {
            console.error('Failed to create confirm backup:', backupErr);
        }

        // ログ記録
        db.prepare('INSERT INTO audit_logs (staff_id, action, details) VALUES (?, ?, ?)')
            .run(req.user.id, 'confirm_schedule', `勤務表確定完了: 署所ID=${station_id}, サイクル=${cycle_number}`);

        res.json({ success: true, message: '勤務表を確定し、勤怠レコードを自動生成しました。' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '勤務表の確定処理に失敗しました。' });
    }
});

/**
 * @route   POST /api/schedule/unconfirm
 * @desc    確定された勤務表の確定解除 (編集モードへ引き戻す)
 */
router.post('/unconfirm', verifyToken, requireRole('admin', 'sysadmin', 'chief'), (req, res) => {
    const { station_id, start_date, cycle_number } = req.body;
    if (!station_id || !start_date || !cycle_number) {
        return res.status(400).json({ error: '必要なパラメータが不足しています。' });
    }

    try {
        const cycleNum = parseInt(cycle_number) || 1;
        const shiftedStartDateStr = getShiftedStartDateStr(start_date, cycleNum);
        const shiftedEndDateStr = getEndDateStr(shiftedStartDateStr);

        const unconfirmTx = db.transaction(() => {
            // 1. 該当サイクルの schedule_entries の確定フラグを 0 にリセット
            db.prepare(`
                UPDATE schedule_entries 
                SET is_confirmed = 0 
                WHERE cycle_number = ? AND staff_id IN (
                    SELECT id FROM staff WHERE station_id = ?
                )
            `).run(cycleNum, station_id);

            // 2. 該当サイクルの自動生成された未打刻勤怠レコード (status = 'absent') を削除
            db.prepare(`
                DELETE FROM attendance_records 
                WHERE work_date BETWEEN ? AND ? 
                  AND status = 'absent'
                  AND staff_id IN (
                    SELECT id FROM staff WHERE station_id = ?
                  )
            `).run(shiftedStartDateStr, shiftedEndDateStr, station_id);
        });

        unconfirmTx();

        // ログ記録
        db.prepare('INSERT INTO audit_logs (staff_id, action, details) VALUES (?, ?, ?)')
            .run(req.user.id, 'unconfirm_schedule', `勤務表確定解除: 署所ID=${station_id}, サイクル=${cycle_number}`);

        res.json({ success: true, message: '勤務表の確定を解除し、編集モードに戻しました。' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '確定の解除に失敗しました。' });
    }
});


/**
 * @route   POST /api/schedule/drafts
 * @desc    下書き履歴への名前付き保存
 */
router.post('/drafts', verifyToken, requireRole('admin', 'sysadmin', 'chief'), (req, res) => {
    const { station_id, start_date, cycle_number, draft_name, roster, deployedVehicles, vehicleAssignments, hourlyLeaves, staffList, hopeShifts } = req.body;

    if (!station_id || !start_date || !cycle_number || !roster) {
        return res.status(400).json({ error: '必要なパラメータが不足しています。' });
    }

    try {
        const name = draft_name ? draft_name.trim() : `下書き (${new Date().toLocaleString('ja-JP')})`;
        const createdAt = new Date().toISOString();
        const createdBy = req.user.id;
        const createdByName = req.user.name || '管理者';

        // 稼働車両と車両配置を1つのオブジェクトにパッケージングする
        const vehicleData = {
            deployedVehicles: deployedVehicles || [],
            vehicleAssignments: vehicleAssignments || {}
        };

        const result = db.prepare(`
            INSERT INTO schedule_drafts (
                station_id, cycle_number, start_date, draft_name, created_at, created_by, created_by_name,
                roster_data, vehicle_data, hourly_leaves, staff_list, hope_shifts
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            parseInt(station_id, 10),
            parseInt(cycle_number, 10),
            start_date,
            name,
            createdAt,
            createdBy,
            createdByName,
            JSON.stringify(roster),
            JSON.stringify(vehicleData),
            JSON.stringify(hourlyLeaves || {}),
            JSON.stringify(staffList || []),
            JSON.stringify(hopeShifts || {})
        );

        // ログ記録
        db.prepare('INSERT INTO audit_logs (staff_id, action, details) VALUES (?, ?, ?)')
            .run(req.user.id, 'save_schedule_draft', `名前付き下書き保存: 名前="${name}", ID=${result.lastInsertRowid}`);

        res.json({ success: true, message: `下書き「${name}」を保存しました。`, id: result.lastInsertRowid });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '下書きの保存に失敗しました。' });
    }
});

/**
 * @route   GET /api/schedule/drafts
 * @desc    指定条件に合致する下書き履歴一覧（メタデータのみ）の取得
 */
router.get('/drafts', verifyToken, requireRole('admin', 'sysadmin', 'chief'), (req, res) => {
    const stationId = parseInt(req.query.station_id, 10);
    const startDate = req.query.start_date;
    const cycleNumber = parseInt(req.query.cycle_number, 10);

    if (!stationId || !startDate || !cycleNumber) {
        return res.status(400).json({ error: '必要なパラメータが不足しています。' });
    }

    try {
        const drafts = db.prepare(`
            SELECT id, station_id, cycle_number, start_date, draft_name, created_at, created_by_name
            FROM schedule_drafts
            WHERE station_id = ? AND start_date = ? AND cycle_number = ?
        `).all(stationId, startDate, cycleNumber);

        res.json({ success: true, drafts });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '下書き履歴一覧の取得に失敗しました。' });
    }
});

/**
 * @route   GET /api/schedule/drafts/:id
 * @desc    特定の下書きの詳細データ取得
 */
router.get('/drafts/:id', verifyToken, requireRole('admin', 'sysadmin', 'chief'), (req, res) => {
    const draftId = parseInt(req.params.id, 10);

    if (isNaN(draftId)) {
        return res.status(400).json({ error: '無効な下書きIDです。' });
    }

    try {
        const draft = db.prepare('SELECT * FROM schedule_drafts WHERE id = ?').get(draftId);

        if (!draft) {
            return res.status(404).json({ error: '指定された下書きが見つかりません。' });
        }

        const vehicleData = typeof draft.vehicle_data === 'string' ? JSON.parse(draft.vehicle_data) : draft.vehicle_data;

        res.json({
            success: true,
            draft: {
                id: draft.id,
                station_id: draft.station_id,
                cycle_number: draft.cycle_number,
                start_date: draft.start_date,
                draft_name: draft.draft_name,
                created_at: draft.created_at,
                created_by_name: draft.created_by_name,
                roster: typeof draft.roster_data === 'string' ? JSON.parse(draft.roster_data) : draft.roster_data,
                deployedVehicles: (vehicleData && vehicleData.deployedVehicles) || [],
                vehicleAssignments: (vehicleData && vehicleData.vehicleAssignments) || {},
                hourlyLeaves: typeof draft.hourly_leaves === 'string' ? JSON.parse(draft.hourly_leaves) : draft.hourly_leaves,
                staffList: typeof draft.staff_list === 'string' ? JSON.parse(draft.staff_list) : draft.staff_list,
                hopeShifts: typeof draft.hope_shifts === 'string' ? JSON.parse(draft.hope_shifts) : (draft.hope_shifts || {})
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '下書きデータの取得に失敗しました。' });
    }
});

/**
 * @route   DELETE /api/schedule/drafts/:id
 * @desc    下書きの削除
 */
router.delete('/drafts/:id', verifyToken, requireRole('admin', 'sysadmin', 'chief'), (req, res) => {
    const draftId = parseInt(req.params.id, 10);

    if (isNaN(draftId)) {
        return res.status(400).json({ error: '無効な下書きIDです。' });
    }

    try {
        const existing = db.prepare('SELECT id, draft_name FROM schedule_drafts WHERE id = ?').get(draftId);
        if (!existing) {
            return res.status(404).json({ error: '指定された下書きが見つかりません。' });
        }

        db.prepare('DELETE FROM schedule_drafts WHERE id = ?').run(draftId);

        // ログ記録
        db.prepare('INSERT INTO audit_logs (staff_id, action, details) VALUES (?, ?, ?)')
            .run(req.user.id, 'delete_schedule_draft', `下書き削除: 名前="${existing.draft_name}", ID=${draftId}`);

        res.json({ success: true, message: '下書きを削除しました。' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '下書きの削除に失敗しました。' });
    }
});

module.exports = router;

