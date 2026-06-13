const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'server', 'db', 'db.json');
const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const staffList = dbData.staff || [];

// CSV ヘッダーの定義
const headers = [
    'ID',
    '職員番号',
    '氏名',
    '勤務区分(platoon)',
    '階級',
    'システム役割(role)',
    '年休残日数',
    '所属署所ID(station_id)'
];

// CSV行の構築
const csvLines = [headers.join(',')];

staffList.forEach(member => {
    const row = [
        member.id,
        `"${member.employee_number}"`, // 文字列として扱うためのダブルクォーテーション囲み
        `"${member.name}"`,
        `"${member.platoon}"`,
        `"${member.rank || ''}"`,
        `"${member.role}"`,
        member.annual_leave_balance,
        member.station_id
    ];
    csvLines.push(row.join(','));
});

// ファイル出力
const outPath = path.join(__dirname, 'staff_data.csv');
fs.writeFileSync(outPath, csvLines.join('\n'), 'utf8');
console.log(`CSV exported successfully to: ${outPath}`);
console.log(`Total staff records exported: ${staffList.length}`);
