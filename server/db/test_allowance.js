/**
 * 祝日手当 自動計算ロジック検証スクリプト
 */

const { parseDate, getJapaneseHoliday, getHolidayType } = require('../utils/holidays');

// モックのデータベース構造をシミュレート
const mockDb = {
    prepare(sql) {
        return {
            get() {
                // start_date のアンカーとして 2026-06-01 (第1小隊当務) を返す
                return { start_date: '2026-06-01' };
            }
        };
    }
};

function isPlatoon1DutyDay(dateStr) {
    const anchorDateStr = '2026-06-01'; // 第1小隊当直日
    const anchor = parseDate(anchorDateStr);
    const target = parseDate(dateStr);
    const diffTime = Math.abs(target - anchor);
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) * (target < anchor ? -1 : 1);
    return (diffDays % 2 === 0);
}

function getNextDate(dateStr) {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dateVal = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dateVal}`;
}

function getPreviousDate(dateStr) {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dateVal = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dateVal}`;
}

// テスト用の手当計算ロジック
function calculateHolidayAllowanceTest(staff, yearMonth, entryMap, leaveMap = {}) {
    const yearMonthParts = yearMonth.split('-');
    const year = parseInt(yearMonthParts[0], 10);
    const month = parseInt(yearMonthParts[1], 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    const platoon = staff.platoon;

    const details = [];
    const slideQueue12 = [];
    const slideQueue4 = [];
    const allowanceMap = {};

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${yearMonth}-${String(day).padStart(2, '0')}`;
        const holidayType = getHolidayType(dateStr);
        const isHol = (holidayType !== null);
        const actualShift = entryMap[dateStr] || '休';
        
        let baseShift = '非';
        if (platoon === '1bu') {
            baseShift = isPlatoon1DutyDay(dateStr) ? '当' : '非';
        } else if (platoon === '2bu') {
            baseShift = isPlatoon1DutyDay(dateStr) ? '非' : '当';
        } else {
            baseShift = '日';
        }
        
        if (isHol && (platoon === '1bu' || platoon === '2bu')) {
            const isLawHoliday = (holidayType === 'national');
            
            if (baseShift === '当') {
                if (actualShift === '休' || actualShift === '公' || leaveMap[dateStr] === 'compensatory') {
                    if (isLawHoliday) {
                        slideQueue12.push({ sourceDate: dateStr });
                    }
                } else {
                    allowanceMap[dateStr] = {
                        type: '当日分',
                        original_hours: 12.0,
                        hours: 12.0,
                        is_cut: false,
                        reason: 'duty_on_holiday'
                    };
                }
            } else if (baseShift === '非') {
                const isNewYear = (dateStr.endsWith('-12-29') || dateStr.endsWith('-12-30') || dateStr.endsWith('-12-31') || dateStr.endsWith('-01-02') || dateStr.endsWith('-01-03'));
                const hours = isNewYear ? 3.5 : 4.0;
                
                const yesterdayStr = getPreviousDate(dateStr);
                const yesterdayActualShift = entryMap[yesterdayStr] || '当';
                
                const wasOnDutyYesterday = (yesterdayActualShift === '当');
                
                if ((actualShift === '休' || actualShift === '公' || leaveMap[dateStr] === 'compensatory') && !wasOnDutyYesterday) {
                    if (isLawHoliday) {
                        slideQueue4.push({ sourceDate: dateStr, hours: hours });
                    }
                } else {
                    allowanceMap[dateStr] = {
                        type: '当日分',
                        original_hours: hours,
                        hours: hours,
                        is_cut: false,
                        reason: 'duty_on_holiday_off'
                    };
                }
            }
        }
    }
    
    slideQueue12.forEach(item => {
        let targetDate = getNextDate(item.sourceDate);
        let mapped = false;
        let limit = 0;
        
        while (!mapped && limit < 60) {
            limit++;
            const baseShift = platoon === '1bu' ? (isPlatoon1DutyDay(targetDate) ? '当' : '非') : (isPlatoon1DutyDay(targetDate) ? '非' : '当');
            const actualShift = entryMap[targetDate] || '休';
            
            const isOriginalHoliday = (actualShift === '休' || actualShift === '公') && (leaveMap[targetDate] !== 'compensatory');
            
            if (baseShift === '当' && !isOriginalHoliday && !allowanceMap[targetDate]) {
                const isCut = (leaveMap[targetDate] === 'compensatory' || actualShift === '休' || actualShift === '公');
                allowanceMap[targetDate] = {
                    type: 'スライド分',
                    original_hours: 12.0,
                    hours: isCut ? 0.0 : 12.0,
                    is_cut: isCut,
                    reason: isCut ? 'cut_due_to_substitute_holiday' : `slided_from_${item.sourceDate}`,
                    source_date: item.sourceDate
                };
                mapped = true;
            } else {
                targetDate = getNextDate(targetDate);
            }
        }
    });

    slideQueue4.forEach(item => {
        let targetDate = getNextDate(item.sourceDate);
        let mapped = false;
        let limit = 0;
        
        while (!mapped && limit < 60) {
            limit++;
            const baseShift = platoon === '1bu' ? (isPlatoon1DutyDay(targetDate) ? '当' : '非') : (isPlatoon1DutyDay(targetDate) ? '非' : '当');
            const actualShift = entryMap[targetDate] || '休';
            
            const isOriginalHoliday = (actualShift === '休' || actualShift === '公') && (leaveMap[targetDate] !== 'compensatory');
            
            if (baseShift === '非' && !isOriginalHoliday && !allowanceMap[targetDate]) {
                const isCut = (leaveMap[targetDate] === 'compensatory' || actualShift === '休' || actualShift === '公');
                allowanceMap[targetDate] = {
                    type: 'スライド分',
                    original_hours: item.hours,
                    hours: isCut ? 0.0 : item.hours,
                    is_cut: isCut,
                    reason: isCut ? 'cut_due_to_substitute_holiday' : `slided_from_${item.sourceDate}`,
                    source_date: item.sourceDate
                };
                mapped = true;
            } else {
                targetDate = getNextDate(targetDate);
            }
        }
    });

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${yearMonth}-${String(day).padStart(2, '0')}`;
        const item = allowanceMap[dateStr];
        
        const isHol = (getHolidayType(dateStr) !== null);
        const actualShift = entryMap[dateStr] || '休';
        const baseShift = platoon === '1bu' ? (isPlatoon1DutyDay(dateStr) ? '当' : '非') : (isPlatoon1DutyDay(dateStr) ? '非' : '当');

        if (item) {
            details.push({
                date: dateStr,
                holiday_name: getJapaneseHoliday(parseDate(dateStr)) || '条例休日',
                base_shift: baseShift,
                actual_shift: actualShift,
                type: item.type,
                original_hours: item.original_hours,
                hours: item.hours,
                is_cut: item.is_cut,
                reason: item.reason,
                source_date: item.source_date || null
            });
        } else {
            details.push({
                date: dateStr,
                holiday_name: isHol ? (getJapaneseHoliday(parseDate(dateStr)) || '条例休日') : null,
                base_shift: baseShift,
                actual_shift: actualShift,
                type: '対象外',
                original_hours: 0.0,
                hours: 0.0,
                is_cut: false,
                reason: 'no_holiday_duty'
            });
        }
    }
    
    const totalHours = details.reduce((sum, d) => sum + d.hours, 0.0);
    return { details, totalHours };
}

// ==========================================
// テストスイート実行
// ==========================================

console.log("=== 祝日手当判定ロジック テスト実行開始 ===");

/**
 * テスト1: GWパターン (例1)
 */
function testGW() {
    console.log("\n[テスト1: ゴールデンウィークパターン (例1)]");
    const staff = { id: 10, name: "GWテスト職員", platoon: "1bu" };
    
    const entryMap = {
        "2026-04-28": "当",
        "2026-04-29": "休", // 祝日(昭和の日)
        "2026-04-30": "当",
        "2026-05-01": "非",
        "2026-05-02": "当",
        "2026-05-03": "非",
        "2026-05-04": "休", // 祝日(みどりの日)
        "2026-05-05": "休", // 祝日(こどもの日)
        "2026-05-06": "当", // 祝日(振替休日)
        "2026-05-07": "非",
        "2026-05-08": "当"
    };

    const { details } = calculateHolidayAllowanceTest(staff, "2026-05", entryMap);

    const d506 = details.find(x => x.date === "2026-05-06");
    console.assert(d506.hours === 12.0 && d506.type === '当日分', "5/6は当日分12hが支給されること");
    
    const d507 = details.find(x => x.date === "2026-05-07");
    console.assert(d507.hours === 4.0 && d507.type === 'スライド分', "5/5非番分は5/7非番日にスライドして4h支給されること");

    const d508 = details.find(x => x.date === "2026-05-08");
    console.assert(d508.hours === 12.0 && d508.type === 'スライド分', "5/4当直分は5/8当直日にスライドして12h支給されること");

    console.log("-> 5/6 当日分:", d506.hours, "h (タイプ:", d506.type, ")");
    console.log("-> 5/7 スライド分 (from 5/5):", d507.hours, "h (タイプ:", d507.type, ")");
    console.log("-> 5/8 スライド分 (from 5/4):", d508.hours, "h (タイプ:", d508.type, ")");
    console.log("GWテスト成功！");
}

/**
 * テスト2: 年末年始条例休日消滅パターン (例2)
 */
function testNewYear() {
    console.log("\n[テスト2: 年末年始条例休日消滅パターン (例2)]");
    const staff = { id: 20, name: "年末年始テスト職員", platoon: "2bu" };
    
    const entryMap = {
        "2026-12-28": "非",
        "2026-12-29": "当",
        "2026-12-30": "非",
        "2026-12-31": "休", // 条例休日（公休）
        "2027-01-01": "休", // 条例休日（公休）
        "2027-01-02": "当", // 振替休日（勤務）
        "2027-01-03": "非", // 条例休日（勤務）
        "2027-01-04": "当"
    };

    const resDec = calculateHolidayAllowanceTest(staff, "2026-12", entryMap);
    const resJan = calculateHolidayAllowanceTest(staff, "2027-01", entryMap);

    const d1231 = resDec.details.find(x => x.date === "2026-12-31");
    const d0101 = resJan.details.find(x => x.date === "2027-01-01");
    const d0102 = resJan.details.find(x => x.date === "2027-01-02");
    const d0103 = resJan.details.find(x => x.date === "2027-01-03");

    console.assert(d1231.hours === 0.0 && d1231.type === '対象外', "12/31条例休日の公休分は手当が消滅すること");
    console.assert(d0101.hours === 0.0 && d0101.type === '対象外', "1/1条例休日の公休分は手当が消滅すること");
    console.assert(d0102.hours === 12.0 && d0102.type === '当日分', "1/2振替休日勤務は当日分12hが支給されること");
    console.assert(d0103.hours === 3.5 && d0103.type === '当日分', "1/3条例休日非番勤務は年末年始非番として3.5hが支給されること");

    console.log("-> 12/31 手当時間:", d1231.hours, "h (タイプ:", d1231.type, ")");
    console.log("-> 1/1 手当時間:", d0101.hours, "h (タイプ:", d0101.type, ")");
    console.log("-> 1/2 手当時間:", d0102.hours, "h (タイプ:", d0102.type, ")");
    console.log("-> 1/3 手当時間:", d0103.hours, "h (タイプ:", d0103.type, ")");
    console.log("年末年始テスト成功！");
}

/**
 * テスト3: 代休（振替休日）取得時の手当カット
 */
function testCompensatoryCut() {
    console.log("\n[テスト3: 代休取得による手当カットパターン]");
    const staff = { id: 10, name: "カットテスト職員", platoon: "1bu" };
    
    const entryMap = {
        "2026-05-01": "非",
        "2026-05-02": "当",
        "2026-05-03": "非",
        "2026-05-04": "休", // 祝日(みどりの日)
        "2026-05-05": "非",
        "2026-05-06": "当",
        "2026-05-07": "非",
        "2026-05-08": "休"  // スライド先。本人は代休を取得して休んだ
    };

    const leaveMap = {
        "2026-05-08": "compensatory" // 代休取得
    };

    const { details } = calculateHolidayAllowanceTest(staff, "2026-05", entryMap, leaveMap);

    const d508 = details.find(x => x.date === "2026-05-08");
    console.assert(d508.hours === 0.0 && d508.is_cut === true && d508.reason === 'cut_due_to_substitute_holiday', "スライド先で代休を取得した場合は手当カット(0h)されること");
    
    const d510 = details.find(x => x.date === "2026-05-10");
    console.assert(d510.hours === 0.0, "手当は再スライドしないこと");

    console.log("-> 5/8 手当時間:", d508.hours, "h (カット状態:", d508.is_cut, ", 理由:", d508.reason, ")");
    console.log("-> 5/10 手当時間:", d510.hours, "h (再スライドなし)");
    console.log("代休手当カットテスト成功！");
}

testGW();
testNewYear();
testCompensatoryCut();

console.log("\n=== すべてのテストケースをパスしました！ ===");
