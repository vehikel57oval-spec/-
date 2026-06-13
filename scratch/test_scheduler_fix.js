const fs = require('fs');
const path = require('path');
const db = require('../server/db/database');

// scheduler.js をロードして eval する
const schedulerCode = fs.readFileSync(path.join(__dirname, '../scheduler.js'), 'utf8');
eval(schedulerCode);

// スタッフリストと希望休のダミーデータを組み立てる
const allStaff = db.prepare("SELECT * FROM staff s WHERE s.department_id = ? AND s.station_id = ?").all(1, 1);
const staffList = allStaff.filter(s => s.platoon === '1bu' || s.platoon === '2bu');
// 1bu, 2bu を 1, 2 にマッピング
const mappedStaff = staffList.map(s => ({
    id: s.id,
    name: s.name,
    platoon: s.platoon === '1bu' ? 1 : 2,
    rank: s.rank,
    hasLargeLicense: s.has_large_license === 1,
    isParamedic: s.is_paramedic === 1,
    isRescue: s.is_rescue === 1,
    isDayWorker: s.is_day_worker === 1,
    isSupport: false
}));

// 小林翔太のID=9
// 小林翔太の週休希望を設定する (6/30, 7/1, 7/2)
// 起算日 = 2026-06-14 の場合、6/30 は dayIndex=16, 7/1 は 17, 7/2 は 18
const hopeShifts = {};
mappedStaff.forEach(s => {
    hopeShifts[s.id] = {};
});

hopeShifts[9] = {
    16: '休',
    17: '休',
    18: '休'
};

const startDate = new Date('2026-06-14');

// 実行する
const res = generateRoster(startDate, mappedStaff, hopeShifts, 11, 1, 1, 1);

if (res.success) {
    console.log("SUCCESS: generateRoster executed successfully!");
    const roster9 = res.roster[9];
    console.log("小林翔太のシフト:", roster9.join(','));
    
    // 休みが4日連続しているかチェックする
    let consecutiveHolidays = 0;
    let maxConsecutiveHolidays = 0;
    for (let d = 0; d < 28; d++) {
        if (roster9[d] === '休') {
            consecutiveHolidays++;
            if (consecutiveHolidays > maxConsecutiveHolidays) {
                maxConsecutiveHolidays = consecutiveHolidays;
            }
        } else {
            consecutiveHolidays = 0;
        }
    }
    
    console.log("最長連続休日数:", maxConsecutiveHolidays);
    
    const firstPeriodHolidays = roster9.slice(0, 4).filter(x => x === '休').length;
    console.log("最初の4日間(6/14-6/17)の休日数:", firstPeriodHolidays);
    if (firstPeriodHolidays === 4) {
        console.error("FAIL: 最初の4日間がすべて休み（4連続休）のままです！");
        process.exit(1);
    } else {
        console.log("PASS: 最初の4日間の4連続休みが解消されました！");
    }
    
    // 全体の週休合計数が 8 であることもアサートする
    const totalHolidays = roster9.filter(x => x === '休').length;
    console.log("合計週休日数:", totalHolidays);
    if (totalHolidays !== 8) {
        console.error(`FAIL: 合計週休数が ${totalHolidays} 日です（8日であるべき）`);
        process.exit(1);
    } else {
        console.log("PASS: 週休合計8日が維持されています。");
    }
} else {
    console.error("FAIL: generateRoster failed!", res.error);
    process.exit(1);
}
