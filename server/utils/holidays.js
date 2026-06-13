/**
 * 祝日・休日判定ユーティリティ (サーバーサイド版)
 */

function parseDate(dateStr) {
    // YYYY-MM-DD 文字列からタイムゾーンに依存せず安全に Date オブジェクトを作成
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const date = parseInt(parts[2], 10);
    return new Date(year, month - 1, date);
}

function getJapaneseHolidayWithoutSub(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();

    function getNthMonday(year, month, n) {
        const firstDay = new Date(year, month - 1, 1);
        let dayOfWeek = firstDay.getDay();
        return 1 + ((8 - dayOfWeek) % 7) + (n - 1) * 7;
    }

    function getSpringEquinox(year) {
        if (year < 1980 || year > 2099) return 20;
        return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    }

    // 春分の日/秋分の日の簡易天文計算
    function getAutumnEquinox(year) {
        if (year < 1980 || year > 2099) return 23;
        return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    }

    if (m === 1 && d === 1) return "元日";
    if (m === 1 && d === getNthMonday(y, 1, 2)) return "成人の日";
    if (m === 2 && d === 11) return "建国記念の日";
    if (m === 2 && d === 23 && y >= 2020) return "天皇誕生日";
    if (m === 3 && d === getSpringEquinox(y)) return "春分の日";
    if (m === 4 && d === 29) return "昭和の日";
    if (m === 5 && d === 3) return "憲法記念日";
    if (m === 5 && d === 4) return "みどりの日";
    if (m === 5 && d === 5) return "こどもの日";
    
    if (m === 7) {
        if (y === 2020 && d === 23) return "海の日";
        if (y === 2021 && d === 22) return "海の日";
        if (y !== 2020 && y !== 2021 && d === getNthMonday(y, 7, 3)) return "海の日";
    }
    
    if (m === 8) {
        if (y === 2020 && d === 10) return "山の日";
        if (y === 2021 && d === 8) return "山の日";
        if (y !== 2020 && y !== 2021 && d === 11 && y >= 2016) return "山の日";
    }
    
    if (m === 9 && d === getNthMonday(y, 9, 3)) return "敬老の日";
    if (m === 9 && d === getAutumnEquinox(y)) return "秋分の日";
    
    if (m === 10) {
        if (y === 2020 && d === 24) return "スポーツの日";
        if (y === 2021 && d === 23) return "スポーツの日";
        if (y !== 2020 && y !== 2021 && d === getNthMonday(y, 10, 2)) return "スポーツの日";
    }
    
    if (m === 11 && d === 3) return "文化の日";
    if (m === 11 && d === 23) return "勤労感謝の日";

    return null;
}

function getJapaneseHoliday(date) {
    const name = getJapaneseHolidayWithoutSub(date);
    if (name) return name;

    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();

    // 振替休日チェック
    let checkDate = new Date(y, m - 1, d);
    let daysBack = 0;
    while (true) {
        checkDate.setDate(checkDate.getDate() - 1);
        daysBack++;
        if (daysBack > 10) break;
        
        const namePrev = getJapaneseHolidayWithoutSub(checkDate);
        if (namePrev) {
            if (checkDate.getDay() === 0) {
                return "振替休日";
            }
        } else {
            break;
        }
    }

    // 国民の休日チェック (祝日に挟まれた平日)
    const yesterday = new Date(y, m - 1, d - 1);
    const tomorrow = new Date(y, m - 1, d + 1);
    if (getJapaneseHolidayWithoutSub(yesterday) && getJapaneseHolidayWithoutSub(tomorrow) && date.getDay() !== 0) {
        return "国民の休日";
    }

    return null;
}

/**
 * 日付文字列 (YYYY-MM-DD) に対し、祝日・休日区分を返す
 * @param {string} dateStr YYYY-MM-DD
 * @returns {string|null} 'national' (祝日法上の休日), 'ordinance' (条例上の休日), null (平日)
 */
function getHolidayType(dateStr) {
    const date = parseDate(dateStr);
    const m = date.getMonth() + 1;
    const d = date.getDate();
    
    // 12/29〜1/3 は年末年始 (条例休日または元日/振替休日)
    const isNewYearPeriod = (m === 12 && d >= 29) || (m === 1 && d <= 3);
    
    const holidayName = getJapaneseHoliday(date);
    
    if (holidayName) {
        // 祝日法による休日 (元日や、振替休日など)
        return 'national';
    }
    
    if (isNewYearPeriod) {
        // 条例による年末年始の休日
        return 'ordinance';
    }
    
    return null; // 平日
}

module.exports = {
    parseDate,
    getJapaneseHoliday,
    getHolidayType
};
