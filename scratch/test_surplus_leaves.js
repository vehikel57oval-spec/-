const fs = require('fs');
const path = require('path');

// データベースから staffList を読み込む
const dbData = JSON.parse(fs.readFileSync(path.join(__dirname, '../server/db/db.json'), 'utf8'));

// 1. 本署(station_id=1)の staffList を構築し、platoonを数値(1bu->1, 2bu->2, nikkin->0)にマッピング
const rawStaff = dbData.staff.filter(s => s.station_id === 1 && s.is_active === 1);
const staffList = rawStaff.map(s => ({
    id: s.id.toString(), // 文字列IDとして扱う
    name: s.name,
    platoon: s.platoon === '1bu' ? 1 : (s.platoon === '2bu' ? 2 : 0),
    rank: s.rank,
    hasLargeLicense: s.has_large_license === 1,
    isParamedic: s.is_paramedic === 1,
    isRescue: s.is_rescue === 1,
    isKikan: s.is_kikan === 1,
    isDayWorker: s.is_day_worker === 1,
    isSupport: false
}));

// アプリケーション状態 (state) のモック
const state = {
    startDate: "2026-04-01",
    activeCycle: 1,
    minStaffing: 11,
    minSubOfficer: 1,  // デフォルト値
    minLarge: 1,       // デフォルト値
    minParamedic: 1,   // デフォルト値
    minRescue: 0,
    staffList: staffList,
    roster: {},
    hopeShifts: {}
};

// 空の勤務表を初期生成 (当・明のデフォルト交互)
function generateEmptyRoster() {
    state.roster = {};
    for (let c = 1; c <= 1; c++) {
        state.staffList.forEach(staff => {
            const key = `${c}_${staff.id}`;
            const schedule = new Array(28);
            for (let d = 0; d < 28; d++) {
                const absoluteDay = (c - 1) * 28 + d;
                if (staff.platoon === 1) {
                    schedule[d] = (absoluteDay % 2 === 0) ? '当' : '明';
                } else if (staff.platoon === 2) {
                    schedule[d] = (absoluteDay % 2 === 1) ? '当' : '明';
                } else {
                    schedule[d] = '日'; // 日勤
                }
            }
            state.roster[key] = schedule;
        });
    }
}

// 祝日判定のダミー
function getJapaneseHoliday(date) {
    return null; // テストでは祝日なしとする
}

// 年間累積年休カウント
function getYearlyAnnualLeaveCounts(targetYear) {
    const counts = {};
    state.staffList.forEach(s => { counts[s.id] = 0; });

    Object.keys(state.roster).forEach(key => {
        const underscoreIdx = key.indexOf('_');
        if (underscoreIdx === -1) return;
        const cycleNum = parseInt(key.slice(0, underscoreIdx));
        const staffId = key.slice(underscoreIdx + 1); // 文字列ID
        if (isNaN(cycleNum)) return;

        const cycleStart = new Date(state.startDate);
        cycleStart.setDate(cycleStart.getDate() + (cycleNum - 1) * 28);
        if (cycleStart.getFullYear() !== targetYear) return;

        const schedule = state.roster[key] || [];
        const staff = state.staffList.find(s => s.id === staffId);
        if (!staff) return;

        let annualCount = 0;
        for (let d = 0; d < schedule.length; d++) {
            if (schedule[d] === '有') {
                const hourlyKey = `${cycleNum}_${staffId}_${d}`;
                if (state.hourlyLeaves && state.hourlyLeaves[hourlyKey]) {
                    annualCount += state.hourlyLeaves[hourlyKey].hours / 8.0;
                } else {
                    annualCount += staff.isDayWorker ? 1.0 : 2.0;
                }
            }
        }

        if (counts[staffId] !== undefined) {
            counts[staffId] += annualCount;
        }
    });

    return counts;
}

// 余剰人員日への年休（有）自動割当ロジック (public/js/schedule.js からコピーした最新ロジック)
function adjustSurplusLeaves(cycleNum, platoonNum) {
    const minStaff = state.minStaffing;
    const minSub = state.minSubOfficer;
    const minLarge = state.minLarge;
    const minPara = state.minParamedic;
    const YEARLY_TARGET = 20;

    const cycleStartDate = new Date(state.startDate);
    cycleStartDate.setDate(cycleStartDate.getDate() + (cycleNum - 1) * 28);
    const targetYear = cycleStartDate.getFullYear();

    const yearlyCounts = getYearlyAnnualLeaveCounts(targetYear);

    function isHolidayOrNewYear(dayIndex) {
        const activeStartDate = new Date(state.startDate);
        activeStartDate.setDate(activeStartDate.getDate() + (cycleNum - 1) * 28);
        
        const date = new Date(activeStartDate);
        date.setDate(activeStartDate.getDate() + dayIndex);
        
        const holidayName = getJapaneseHoliday(date);
        if (holidayName) return true;
        
        const month = date.getMonth() + 1;
        const day = date.getDate();
        if ((month === 12 && day >= 29) || (month === 1 && day <= 3)) {
            return true;
        }
        
        return false;
    }
    
    const targetStaff = state.staffList.filter(staff => {
        if (staff.isSupport) return false;
        if (staff.platoon !== platoonNum) return false;
        const key = `${cycleNum}_${staff.id}`;
        const schedule = state.roster[key] || [];
        if (!schedule.includes('当')) return false;
        const currentYearly = yearlyCounts[staff.id] || 0;
        if (currentYearly >= YEARLY_TARGET) {
            return false;
        }
        return true;
    });

    if (targetStaff.length === 0) {
        return;
    }

    function canTakeLeave(rosterState, staff, day) {
        const key = `${cycleNum}_${staff.id}`;
        if ((rosterState[key] && rosterState[key][day]) !== '当') {
            return false;
        }

        let onDuty = [];
        state.staffList.forEach(s => {
            if (s.platoon !== platoonNum) return;
            const k = `${cycleNum}_${s.id}`;
            const shift = (rosterState[k] && rosterState[k][day]) || '-';
            if (shift === '当') {
                onDuty.push(s);
            }
        });

        const remaining = onDuty.filter(s => s.id !== staff.id);
        if (remaining.length < minStaff) return false;

        const subCount = remaining.filter(s => s.rank === "消防司令" || s.rank === "消防司令補").length;
        const currentSubCount = onDuty.filter(s => s.rank === "消防司令" || s.rank === "消防司令補").length;
        if (subCount < minSub && subCount < currentSubCount) return false;

        const largeCount = remaining.filter(s => s.hasLargeLicense).length;
        const currentLargeCount = onDuty.filter(s => s.hasLargeLicense).length;
        if (largeCount < minLarge && largeCount < currentLargeCount) return false;

        const paraCount = remaining.filter(s => s.isParamedic).length;
        const currentParaCount = onDuty.filter(s => s.isParamedic).length;
        if (paraCount < minPara && paraCount < currentParaCount) return false;

        if (state.minRescue !== null && state.minRescue !== undefined && !isNaN(state.minRescue)) {
            const rescueCount = remaining.filter(s => s.isRescue).length;
            const currentRescueCount = onDuty.filter(s => s.isRescue).length;
            if (rescueCount < state.minRescue && rescueCount < currentRescueCount) return false;
        }

        return true;
    }

    function hasConsecutiveLeave(rosterState, staff, day) {
        const key = `${cycleNum}_${staff.id}`;
        const schedule = rosterState[key] || [];
        if (day >= 2) {
            const prevShift = schedule[day - 2];
            if (prevShift && prevShift !== '当' && prevShift !== '明') {
                return true;
            }
        }
        if (day <= 25) {
            const nextShift = schedule[day + 2];
            if (nextShift && nextShift !== '当' && nextShift !== '明') {
                return true;
            }
        }
        return false;
    }

    function getDaySurplus(rosterState) {
        const surplus = [];
        for (let d = 0; d < 28; d++) {
            let onDutyCount = 0;
            state.staffList.forEach(s => {
                if (s.platoon !== platoonNum) return;
                const key = `${cycleNum}_${s.id}`;
                const shift = (rosterState[key] && rosterState[key][d]) || '-';
                if (shift === '当') {
                    onDutyCount++;
                }
            });
            const s = onDutyCount - minStaff;
            surplus.push(s > 0 ? s : 0);
        }
        return surplus;
    }

    const localYearlyCounts = { ...yearlyCounts };
    const cycleAssignedCounts = {};
    state.staffList.forEach(s => { cycleAssignedCounts[s.id] = 0; });

    let workingRoster = JSON.parse(JSON.stringify(state.roster));
    let totalAssigned = 0;

    for (let limit = 1; limit <= 5; limit++) {
        let madeChangeInLimit = true;

        while (madeChangeInLimit) {
            madeChangeInLimit = false;
            const daySurplus = getDaySurplus(workingRoster);
            const allCandidates = [];

            targetStaff.forEach(staff => {
                const currentYearly = localYearlyCounts[staff.id] || 0;
                if (currentYearly >= YEARLY_TARGET) return;

                const currentCycleAssigned = cycleAssignedCounts[staff.id] || 0;
                if (currentCycleAssigned >= limit) return;

                for (let d = 0; d < 28; d++) {
                    if (daySurplus[d] <= 0) continue;
                    if (isHolidayOrNewYear(d)) continue;
                    if (!canTakeLeave(workingRoster, staff, d)) continue;

                    const hasConsec = hasConsecutiveLeave(workingRoster, staff, d);
                    allCandidates.push({
                        staff,
                        day: d,
                        yearlyCount: currentYearly,
                        cycleAssigned: currentCycleAssigned,
                        surplus: daySurplus[d],
                        hasConsec
                    });
                }
            });

            if (allCandidates.length === 0) break;

            const nonConsec = allCandidates.filter(c => !c.hasConsec);
            const pool = nonConsec.length > 0 ? nonConsec : allCandidates;

            pool.sort((a, b) => {
                if (a.cycleAssigned !== b.cycleAssigned) return a.cycleAssigned - b.cycleAssigned;
                if (a.yearlyCount !== b.yearlyCount) return a.yearlyCount - b.yearlyCount;
                if (a.surplus !== b.surplus) return b.surplus - a.surplus;
                return Math.random() - 0.5;
            });

            const best = pool[0];
            const key = `${cycleNum}_${best.staff.id}`;
            workingRoster[key][best.day] = '有';
            localYearlyCounts[best.staff.id] = (localYearlyCounts[best.staff.id] || 0) + (best.staff.isDayWorker ? 1.0 : 2.0);
            cycleAssignedCounts[best.staff.id] = (cycleAssignedCounts[best.staff.id] || 0) + 1;
            totalAssigned++;
            madeChangeInLimit = true;
        }
    }

    state.roster = workingRoster;
}

// 実行テスト
generateEmptyRoster();

// 過去のサイクルで有給を取得していたことをモック
// 小林 翔太(id: 9)は過去に18日取得済み (残り2日)
state.roster['2_9'] = new Array(28).fill('明');
for (let i = 0; i < 18; i++) {
    state.roster['2_9'][i] = '有';
}
// 後藤 正義(id: 25)は過去に19日取得済み (残り1日)
state.roster['2_25'] = new Array(28).fill('明');
for (let i = 0; i < 19; i++) {
    state.roster['2_25'][i] = '有';
}

console.log('--- 初期割当実行前 ---');

// 小隊1(1bu)の割当
adjustSurplusLeaves(1, 1);
// 小隊2(2bu)の割当
adjustSurplusLeaves(1, 2);

console.log('\n--- 割当結果統計 (サイクル1) ---');
console.log('職員ID | 名前 | 小隊 | 有給取得日数 | 役職/階級 | 大型 | 救命士');
console.log('------------------------------------------------------------');

const resultStaff = state.staffList.filter(s => s.platoon === 1 || s.platoon === 2);
resultStaff.forEach(s => {
    const key = `1_${s.id}`;
    const schedule = state.roster[key] || [];
    const count = schedule.filter(shift => shift === '有').length;
    console.log(`${s.id.padEnd(5)} | ${s.name.padEnd(6)} | ${s.platoon === 1 ? '1部' : '2部'} | ${count.toString().padStart(4)}日 | ${s.rank.padEnd(6)} | ${s.hasLargeLicense ? 'Y' : 'N'} | ${s.isParamedic ? 'Y' : 'N'}`);
});

console.log('------------------------------------------------------------');
console.log(`総割当有給日数: ${resultStaff.reduce((acc, s) => acc + (state.roster[`1_${s.id}`].filter(sh => sh === ' 有').length || state.roster[`1_${s.id}`].filter(sh => sh === '有').length), 0)}`);
