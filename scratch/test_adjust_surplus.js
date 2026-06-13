const fs = require('fs');
const path = require('path');

const state = {
    minStaffing: 11,
    minSubOfficer: 3, // 司令補を3人必要とするが、実際には1人しかいない
    minLarge: 1,
    minParamedic: 1,
    roster: {},
    staffList: []
};

// ダミースタッフリストを作成 (第1小隊 16名)
for (let i = 1; i <= 16; i++) {
    state.staffList.push({
        id: i,
        name: `隊員${i}`,
        platoon: 1,
        rank: i === 1 ? "消防司令補" : "消防士", // 司令補は 1 名のみ
        hasLargeLicense: i <= 3, // 3名が大型免許
        isParamedic: i >= 14, // 3名が救命士
        isRescue: false
    });
}

// 初期 roster (全員当直のサイクル。16名全員が出勤するので、毎日5名余剰)
for (let i = 1; i <= 16; i++) {
    const key = `1_${i}`;
    state.roster[key] = new Array(28).fill('当');
}

// 修正後の adjustSurplusLeaves ロジックを実行する
function adjustSurplusLeaves(cycleNum) {
    const minStaff = state.minStaffing;
    const minSub = state.minSubOfficer;
    const minLarge = state.minLarge;
    const minPara = state.minParamedic;
    
    for (let d = 0; d < 28; d++) {
        let onDutyStaff = [];
        state.staffList.forEach(staff => {
            const key = `${cycleNum}_${staff.id}`;
            const shift = (state.roster[key] && state.roster[key][d]) || '-';
            if (shift === '当') {
                onDutyStaff.push(staff);
            }
        });
        
        let surplus = onDutyStaff.length - minStaff;
        if (surplus <= 0) continue;
        
        const holidayCounts = {};
        state.staffList.forEach(staff => {
            const key = `${cycleNum}_${staff.id}`;
            const sched = state.roster[key] || [];
            let count = 0;
            sched.forEach(s => {
                if (s !== '当' && s !== '明') {
                    count++;
                }
            });
            holidayCounts[staff.id] = count;
        });
        
        while (surplus > 0) {
            let bestStaff = null;
            let maxScore = -999999;
            let bestStaffFallback = null;
            let maxScoreFallback = -999999;
            
            for (let i = 0; i < onDutyStaff.length; i++) {
                const staff = onDutyStaff[i];
                const remaining = onDutyStaff.filter(s => s.id !== staff.id);
                
                // 1. 最低人員チェック
                if (remaining.length < minStaff) continue;
                
                // 2. 司令補以上チェック（修正版：減っていない場合はスキップしない）
                const subCount = remaining.filter(s => s.rank === "消防司令" || s.rank === "消防司令補").length;
                const currentSubCount = onDutyStaff.filter(s => s.rank === "消防司令" || s.rank === "消防司令補").length;
                if (subCount < minSub && subCount < currentSubCount) continue;
                
                // 3. 大型免許チェック（修正版）
                const largeCount = remaining.filter(s => s.hasLargeLicense).length;
                const currentLargeCount = onDutyStaff.filter(s => s.hasLargeLicense).length;
                if (largeCount < minLarge && largeCount < currentLargeCount) continue;
                
                // 4. 救命士チェック（修正版）
                const paraCount = remaining.filter(s => s.isParamedic).length;
                const currentParaCount = onDutyStaff.filter(s => s.isParamedic).length;
                if (paraCount < minPara && paraCount < currentParaCount) continue;
                
                const rosterKey = `${cycleNum}_${staff.id}`;
                const schedule = state.roster[rosterKey] || [];
                
                let isConsecutiveHoliday = false;
                if (d >= 2) {
                    const prevShift = schedule[d - 2];
                    if (prevShift && prevShift !== '当' && prevShift !== '明') {
                        isConsecutiveHoliday = true;
                    }
                }
                if (d <= 25) {
                    const nextShift = schedule[d + 2];
                    if (nextShift && nextShift !== '当' && nextShift !== '明') {
                        isConsecutiveHoliday = true;
                    }
                }
                
                const baseScore = -holidayCounts[staff.id] * 100 + Math.random() * 5;
                
                if (!isConsecutiveHoliday) {
                    if (baseScore > maxScore) {
                        maxScore = baseScore;
                        bestStaff = staff;
                    }
                } else {
                    if (baseScore > maxScoreFallback) {
                        maxScoreFallback = baseScore;
                        bestStaffFallback = staff;
                    }
                }
            }
            
            let selectedStaff = null;
            if (bestStaff) {
                selectedStaff = bestStaff;
            } else if (bestStaffFallback) {
                selectedStaff = bestStaffFallback;
            }
            
            if (!selectedStaff) {
                break;
            }
            
            const rosterKey = `${cycleNum}_${selectedStaff.id}`;
            state.roster[rosterKey][d] = '有';
            
            onDutyStaff = onDutyStaff.filter(s => s.id !== selectedStaff.id);
            holidayCounts[selectedStaff.id]++;
            surplus--;
        }
    }
}

// 実行する
adjustSurplusLeaves(1);

// 結果の検証
console.log("=== Adjust Surplus Leaves Test (Sub-officer Bug Simulation) ===");
let allDaysOk = true;
for (let d = 0; d < 28; d++) {
    let activeDuty = 0;
    let annualLeaves = 0;
    for (let i = 1; i <= 16; i++) {
        const key = `1_${i}`;
        if (state.roster[key][d] === '当') activeDuty++;
        if (state.roster[key][d] === '有') annualLeaves++;
    }
    if (activeDuty !== 11 || annualLeaves !== 5) {
        allDaysOk = false;
        console.error(`Day ${d + 1}: FAILED (出勤=${activeDuty}, 年休=${annualLeaves})`);
    }
}

if (allDaysOk) {
    console.log("PASS: 司令補が不足している状態でも、他の役職の職員に年休が割り当てられ、余剰が正常に解消されました！");
} else {
    console.error("FAIL: 司令補不足が原因で、余剰人員の年休割り当てがスキップされました。");
    process.exit(1);
}
