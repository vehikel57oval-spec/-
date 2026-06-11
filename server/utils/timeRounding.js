/**
 * 時刻の丸め処理を行うユーティリティ
 * 
 * @param {string|Date} dateInput - 丸め対象の日時 (文字列またはDateオブジェクト)
 * @param {number} unit - 丸め単位 (5, 10, 15, 30 分)
 * @param {string} direction - 丸め方向 ('up' = 切り上げ, 'down' = 切り捨て)
 * @returns {string} - YYYY-MM-DD HH:MM:SS 形式の文字列
 */
function roundTime(dateInput, unit = 15, direction = 'down') {
    if (!dateInput) return null;
    
    // Dateオブジェクトに変換
    const date = new Date(typeof dateInput === 'string' ? dateInput.replace(/-/g, '/') : dateInput);
    if (isNaN(date.getTime())) return null;

    const unitMs = 1000 * 60 * unit; // ミリ秒単位
    let timeMs = date.getTime();

    if (direction === 'up') {
        timeMs = Math.ceil(timeMs / unitMs) * unitMs;
    } else {
        timeMs = Math.floor(timeMs / unitMs) * unitMs;
    }

    const roundedDate = new Date(timeMs);

    // YYYY-MM-DD HH:MM:SS 形式でフォーマット
    const yyyy = roundedDate.getFullYear();
    const mm = String(roundedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(roundedDate.getDate()).padStart(2, '0');
    const hh = String(roundedDate.getHours()).padStart(2, '0');
    const min = String(roundedDate.getMinutes()).padStart(2, '0');
    const ss = String(roundedDate.getSeconds()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

module.exports = {
    roundTime
};
