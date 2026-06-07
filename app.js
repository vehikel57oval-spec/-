/**
 * 隔日勤務（24時間2交代）勤務表アプリ コントローラー
 */

// アプリケーション状態
const state = {
    startDate: null,
    activeCycle: 1,
    station: "本署",
    shifts: [],
    staffList: [],
    hopeShifts: {}, // cycle_staffId -> dayIndex -> '休' or '当' or null
    roster: {},      // cycle_staffId -> array of 28 shifts
    warnings: [],
    activeTab: 'tab-list',
    activePlatoon: 1,
    platoonSize: 19,
    minStaffing: 11
};

// デフォルトのスタッフ名と属性（小隊別各19名）
const DEFAULT_STAFF_PLATOON_1 = [
    { name: "佐藤 茂", rank: "消防司令", large: true, paramedic: false, rescue: false },
    { name: "鈴木 健", rank: "消防司令補", large: true, paramedic: true, rescue: false },
    { name: "高橋 浩", rank: "消防士長", large: true, paramedic: false, rescue: true },
    { name: "田中 正", rank: "消防副士長", large: false, paramedic: true, rescue: false },
    { name: "渡辺 隆", rank: "消防副士長", large: false, paramedic: false, rescue: true },
    { name: "伊藤 淳", rank: "消防士", large: true, paramedic: false, rescue: false },
    { name: "山本 哲", rank: "消防士", large: false, paramedic: true, rescue: false },
    { name: "中村 昭", rank: "消防士", large: false, paramedic: false, rescue: true },
    { name: "小林 誠", rank: "消防士", large: true, paramedic: false, rescue: false },
    { name: "加藤 勉", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "吉田 宏", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "山田 毅", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "佐々木 順", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "山口 弘", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "斉藤 剛", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "松本 裕", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "井上 昭", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "木村 俊", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "林 智", rank: "消防士", large: false, paramedic: false, rescue: false }
];

const DEFAULT_STAFF_PLATOON_2 = [
    { name: "清水 健一", rank: "消防司令", large: true, paramedic: false, rescue: false },
    { name: "山崎 貴志", rank: "消防司令補", large: true, paramedic: false, rescue: true },
    { name: "森 拓也", rank: "消防士長", large: true, paramedic: true, rescue: false },
    { name: "池田 哲也", rank: "消防副士長", large: false, paramedic: true, rescue: false },
    { name: "橋本 裕介", rank: "消防副士長", large: false, paramedic: false, rescue: true },
    { name: "阿部 大輔", rank: "消防士", large: true, paramedic: false, rescue: false },
    { name: "石川 雅人", rank: "消防士", large: false, paramedic: true, rescue: false },
    { name: "山下 慎二", rank: "消防士", large: false, paramedic: false, rescue: true },
    { name: "中島 康介", rank: "消防士", large: true, paramedic: false, rescue: false },
    { name: "前田 直樹", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "小川 拓郎", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "藤田 裕二", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "岡田 竜也", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "後藤 英樹", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "長谷川 達也", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "村上 直人", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "近藤 大介", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "石井 浩二", rank: "消防士", large: false, paramedic: false, rescue: false },
    { name: "坂本 健太郎", rank: "消防士", large: false, paramedic: false, rescue: false }
];

// 曜日の日本語表記
const WEEKDAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

// 階級の序列順定義
const RANK_ORDER = {
    "消防司令": 1,
    "消防司令補": 2,
    "消防士長": 3,
    "消防副士長": 4,
    "消防士": 5
};

function sortStaffByRank(staffArray) {
    const getRankVal = (rank) => RANK_ORDER[rank] || 99;
    return [...staffArray].sort((a, b) => {
        const valA = getRankVal(a.rank);
        const valB = getRankVal(b.rank);
        if (valA !== valB) {
            return valA - valB;
        }
        return a.id.localeCompare(b.id);
    });
}

// 署所名の印刷用タイトル更新
function updateStationTitle() {
    const station = state.station || "本署";
    const headerTitle = document.getElementById('print-header-title');
    if (headerTitle) {
        headerTitle.textContent = `${station} 勤務表（隔日勤務 2交代）`;
    }
}

// DOMの初期化と起動
document.addEventListener('DOMContentLoaded', () => {
    initSettings();
    initTheme();
    bindEvents();
    
    // 初期表示として自動的に今日の日付を設定して描画
    const today = new Date();
    document.getElementById('input-start-date').value = today.toISOString().split('T')[0];
    handleDateChange();
    
    // 署所名のデフォルト表示
    document.getElementById('input-station').value = state.station;
    updateStationTitle();
    
    // 初期スタッフリストを設定して描画
    loadDefaultStaff();
    renderStaffInputs();
    
    // 初期の空カレンダー/テーブルを描画
    generateEmptyRoster();
    
    // 勤務シフト設定の初期描画
    renderShiftConfigList();
    renderLegend();
    
    refreshUI();
});

// テーマ（ライト/ダーク）の初期化
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    const sunIcon = document.querySelector('#btn-theme-toggle .sun-icon');
    const moonIcon = document.querySelector('#btn-theme-toggle .moon-icon');
    if (theme === 'dark') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    }
}

// 設定の初期化
function initSettings() {
    state.startDate = new Date();
    state.station = "本署";
    state.shifts = [
        { key: "当", name: "勤務", char: "当", color: "#e0f2fe", textColor: "#0369a1", isSystem: true },
        { key: "明", name: "非番", char: "非", color: "#f3f4f6", textColor: "#4b5563", isSystem: true },
        { key: "休", name: "週休", char: "休", color: "#fef3c7", textColor: "#d97706", isSystem: true },
        { key: "有", name: "年休", char: "年", color: "#dcfce7", textColor: "#15803d" },
        { key: "公", name: "公休", char: "公", color: "#f3e8ff", textColor: "#6b21a8" },
        { key: "張", name: "出張", char: "張", color: "#e2f0fd", textColor: "#2563eb" },
        { key: "特", name: "特休", char: "特", color: "#fee2e2", textColor: "#dc2626" },
        { key: "病", name: "病休", char: "病", color: "#ffedd5", textColor: "#ea580c" }
    ];
}

// デフォルトスタッフのロード
function loadDefaultStaff() {
    state.staffList = [];
    for (let i = 0; i < state.platoonSize; i++) {
        const def1 = DEFAULT_STAFF_PLATOON_1[i] || { name: `第1小隊 隊員${i+1}`, rank: "消防士", large: false, paramedic: false, rescue: false };
        state.staffList.push({
            id: `p1-${i+1}`,
            name: def1.name,
            platoon: 1,
            rank: def1.rank,
            hasLargeLicense: def1.large,
            isParamedic: def1.paramedic,
            isRescue: def1.rescue
        });
        
        const def2 = DEFAULT_STAFF_PLATOON_2[i] || { name: `第2小隊 隊員${i+1}`, rank: "消防士", large: false, paramedic: false, rescue: false };
        state.staffList.push({
            id: `p2-${i+1}`,
            name: def2.name,
            platoon: 2,
            rank: def2.rank,
            hasLargeLicense: def2.large,
            isParamedic: def2.paramedic,
            isRescue: def2.rescue
        });
    }
    
    // 希望休オブジェクトの初期化 (全13サイクル)
    for (let c = 1; c <= 13; c++) {
        state.staffList.forEach(s => {
            const key = `${c}_${s.id}`;
            if (!state.hopeShifts[key]) {
                state.hopeShifts[key] = {};
            }
        });
    }
}

// 空の勤務表を初期生成 (当・明のデフォルト交互を当てはめておく、起算日からの絶対通算日数で偶奇判定)
function generateEmptyRoster() {
    state.roster = {};
    for (let c = 1; c <= 13; c++) {
        state.staffList.forEach(staff => {
            const key = `${c}_${staff.id}`;
            const schedule = new Array(28);
            for (let d = 0; d < 28; d++) {
                const absoluteDay = (c - 1) * 28 + d;
                if (staff.platoon === 1) {
                    schedule[d] = (absoluteDay % 2 === 0) ? '当' : '明';
                } else {
                    schedule[d] = (absoluteDay % 2 === 1) ? '当' : '明';
                }
            }
            state.roster[key] = schedule;
        });
    }
}

// 階級・資格の短縮名取得
function getRankAbbr(rank) {
    if (rank === "消防司令") return "司令";
    if (rank === "消防司令補") return "司補";
    if (rank === "消防士長") return "士長";
    if (rank === "消防副士長") return "副士";
    return "消防士";
}

// スタッフ名・階級・資格入力欄の動的生成
function renderStaffInputs() {
    const p1Container = document.getElementById('platoon-1-members');
    const p2Container = document.getElementById('platoon-2-members');
    
    p1Container.innerHTML = '';
    p2Container.innerHTML = '';
    
    state.staffList.forEach(staff => {
        const row = document.createElement('div');
        row.className = 'staff-input-row';
        
        // 1. 名前入力
        const inputName = document.createElement('input');
        inputName.type = 'text';
        inputName.className = 'form-control';
        inputName.value = staff.name;
        inputName.placeholder = "名前";
        inputName.addEventListener('change', (e) => {
            staff.name = e.target.value.trim() || `小隊員 ${staff.id}`;
            refreshUI();
        });
        row.appendChild(inputName);
        
        // 2. 階級選択
        const selectRank = document.createElement('select');
        selectRank.className = 'form-control select-rank';
        const ranks = ["消防司令", "消防司令補", "消防士長", "消防副士長", "消防士"];
        ranks.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            if (staff.rank === r) opt.selected = true;
            selectRank.appendChild(opt);
        });
        selectRank.addEventListener('change', (e) => {
            staff.rank = e.target.value;
            refreshUI();
        });
        row.appendChild(selectRank);
        
        // 3. 資格トグルボタン
        const togglesDiv = document.createElement('div');
        togglesDiv.className = 'qual-toggles';
        
        // 大型免許 (大)
        const btnLarge = document.createElement('span');
        btnLarge.className = `qual-btn ${staff.hasLargeLicense ? 'active-large' : ''}`;
        btnLarge.textContent = '大';
        btnLarge.title = '大型免許';
        btnLarge.addEventListener('click', () => {
            staff.hasLargeLicense = !staff.hasLargeLicense;
            btnLarge.className = `qual-btn ${staff.hasLargeLicense ? 'active-large' : ''}`;
            refreshUI();
        });
        togglesDiv.appendChild(btnLarge);
        
        // 救命士 (命)
        const btnPara = document.createElement('span');
        btnPara.className = `qual-btn ${staff.isParamedic ? 'active-paramedic' : ''}`;
        btnPara.textContent = '命';
        btnPara.title = '救命士';
        btnPara.addEventListener('click', () => {
            staff.isParamedic = !staff.isParamedic;
            btnPara.className = `qual-btn ${staff.isParamedic ? 'active-paramedic' : ''}`;
            refreshUI();
        });
        togglesDiv.appendChild(btnPara);
        
        // 救助 (助)
        const btnRescue = document.createElement('span');
        btnRescue.className = `qual-btn ${staff.isRescue ? 'active-rescue' : ''}`;
        btnRescue.textContent = '助';
        btnRescue.title = '救助';
        btnRescue.addEventListener('click', () => {
            staff.isRescue = !staff.isRescue;
            btnRescue.className = `qual-btn ${staff.isRescue ? 'active-rescue' : ''}`;
            refreshUI();
        });
        togglesDiv.appendChild(btnRescue);
        
        row.appendChild(togglesDiv);
        
        if (staff.platoon === 1) {
            p1Container.appendChild(row);
        } else {
            p2Container.appendChild(row);
        }
    });
}

// 日付変更時の処理
function handleDateChange() {
    const val = document.getElementById('input-start-date').value;
    if (!val) return;
    
    state.startDate = new Date(val);
    
    // アクティブなサイクルの開始日と終了日を計算
    const activeStartDate = new Date(state.startDate);
    activeStartDate.setDate(state.startDate.getDate() + (state.activeCycle - 1) * 28);
    
    const activeEndDate = new Date(activeStartDate);
    activeEndDate.setDate(activeStartDate.getDate() + 27);
    
    // UI表示更新
    const format = (d) => `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
    const rangeText = `${format(activeStartDate)} 〜 ${format(activeEndDate)}`;
    document.getElementById('label-cycle-range').textContent = rangeText;
    document.getElementById('print-date-range').textContent = rangeText;
    
    refreshUI();
}

// イベントリスナーの紐付け
function bindEvents() {
    // 署所名変更
    document.getElementById('input-station').addEventListener('change', (e) => {
        state.station = e.target.value.trim() || "本署";
        updateStationTitle();
    });

    // 新規シフト追加
    document.getElementById('btn-add-shift').addEventListener('click', () => {
        const char = prompt("追加するシフトの記号（1文字）を入力してください：\n（例：公、特、病、など）");
        if (!char) return;
        const trimmedChar = char.trim().slice(0, 1);
        if (trimmedChar.length === 0) return;
        
        // 重複チェック
        if (state.shifts.some(s => s.key === trimmedChar || s.char === trimmedChar)) {
            alert("既に存在するシフト記号です。別の文字を指定してください。");
            return;
        }
        
        const name = prompt(`シフト「${trimmedChar}」の正式名称（説明）を入力してください：\n（例：公休、特別休暇、など）`);
        if (!name) return;
        const trimmedName = name.trim();
        
        // ランダムな配色
        const randomColor = "#" + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
        
        state.shifts.push({
            key: trimmedChar,
            name: trimmedName,
            char: trimmedChar,
            color: randomColor,
            textColor: "#ffffff"
        });
        
        renderShiftConfigList();
        renderLegend();
        refreshUI();
    });

    // テーマ切り替え
    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
    
    // 起算日変更
    document.getElementById('input-start-date').addEventListener('change', handleDateChange);

    // 小隊人数の変更
    document.getElementById('input-platoon-size').addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > 50) val = 50;
        e.target.value = val;
        
        state.platoonSize = val;
        
        // スタッフリストを再構築して画面を更新
        adjustStaffList();
        renderStaffInputs();
        generateEmptyRoster();
        refreshUI();
    });

    // 最低確保人員の変更
    document.getElementById('input-min-staffing').addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > 100) val = 100;
        e.target.value = val;
        
        state.minStaffing = val;
        refreshUI();
    });
    
    // 小隊タブ切り替え (サイドバー内)
    document.querySelectorAll('.platoon-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.platoon-tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const platoon = parseInt(e.target.dataset.platoon);
            state.activePlatoon = platoon;
            
            if (platoon === 1) {
                document.getElementById('platoon-1-members').style.display = 'flex';
                document.getElementById('platoon-2-members').style.display = 'none';
            } else {
                document.getElementById('platoon-1-members').style.display = 'none';
                document.getElementById('platoon-2-members').style.display = 'flex';
            }
        });
    });
    
    // 表示切替タブ (メインエリア)
    document.querySelectorAll('.view-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.view-tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const tabId = e.target.dataset.tab;
            state.activeTab = tabId;
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active-tab');
            });
            document.getElementById(tabId).classList.add('active-tab');
            
            refreshUI();
        });
    });

    // サイクル変更
    document.getElementById('select-cycle').addEventListener('change', (e) => {
        state.activeCycle = parseInt(e.target.value);
        handleDateChange();
    });

    // 希望休クリア (アクティブサイクルのみ)
    document.getElementById('btn-clear-hope').addEventListener('click', () => {
        state.staffList.forEach(s => {
            const key = `${state.activeCycle}_${s.id}`;
            state.hopeShifts[key] = {};
        });
        refreshUI();
    });

    // 自動生成の実行 (アクティブサイクルのみ)
    document.getElementById('btn-generate').addEventListener('click', () => {
        const btn = document.getElementById('btn-generate');
        const textSpan = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner');
        
        // ローディング状態
        textSpan.textContent = "生成中...";
        spinner.style.display = 'inline-block';
        btn.disabled = true;
        
        // 計算を非同期にしてブラウザフリーズを防ぐ
        setTimeout(() => {
            try {
                // アクティブサイクルの希望休のみを抽出
                const activeHopeShifts = {};
                state.staffList.forEach(s => {
                    const key = `${state.activeCycle}_${s.id}`;
                    activeHopeShifts[s.id] = state.hopeShifts[key] || {};
                });

                const activeStartDate = new Date(state.startDate);
                activeStartDate.setDate(state.startDate.getDate() + (state.activeCycle - 1) * 28);

                // 前サイクル末尾からの連続勤務ブロック数を計算し、staffListのコピーに付与する
                const staffListWithPrev = state.staffList.map(s => {
                    let prevConsecutive = 0;
                    if (state.activeCycle > 1) {
                        const prevKey = `${state.activeCycle - 1}_${s.id}`;
                        const prevSched = state.roster[prevKey];
                        if (prevSched) {
                            for (let b = 13; b >= 0; b--) {
                                let isWorkBlock = false;
                                if (s.platoon === 1) {
                                    isWorkBlock = (prevSched[2 * b] === '当');
                                } else {
                                    isWorkBlock = (prevSched[2 * b + 1] === '当');
                                }
                                if (isWorkBlock) {
                                    prevConsecutive++;
                                } else {
                                    break;
                                }
                            }
                        }
                    }
                    return {
                        ...s,
                        prevConsecutive: prevConsecutive
                    };
                });

                const res = generateRoster(activeStartDate, staffListWithPrev, activeHopeShifts, state.minStaffing);
                if (res.success) {
                    // 生成結果をアクティブサイクルに格納
                    state.staffList.forEach(s => {
                        const key = `${state.activeCycle}_${s.id}`;
                        state.roster[key] = res.roster[s.id];
                    });
                    alert(res.profileMessage);
                } else {
                    alert(res.error);
                }
            } catch (err) {
                alert(`エラーが発生しました: ${err.message}`);
                console.error(err);
            } finally {
                textSpan.textContent = "勤務表を自動生成";
                spinner.style.display = 'none';
                btn.disabled = false;
                refreshUI();
            }
        }, 50);
    });

    // CSVエクスポート (アクティブサイクルのみ)
    document.getElementById('btn-csv').addEventListener('click', () => {
        try {
            const activeStartDate = new Date(state.startDate);
            activeStartDate.setDate(state.startDate.getDate() + (state.activeCycle - 1) * 28);

            // アクティブサイクルの roster を抽出
            const activeRoster = {};
            state.staffList.forEach(s => {
                const key = `${state.activeCycle}_${s.id}`;
                activeRoster[s.id] = state.roster[key] || new Array(28).fill('-');
            });

            const csv = exportToCSV(activeRoster, activeStartDate, sortStaffByRank(state.staffList));
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            const dateStr = document.getElementById('input-start-date').value.replace(/-/g, '');
            link.setAttribute('href', url);
            link.setAttribute('download', `勤務表_第${state.activeCycle}サイクル_${dateStr}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            alert(`CSVエクスポートに失敗しました: ${err.message}`);
        }
    });

    // 印刷プレビュー
    document.getElementById('btn-print').addEventListener('click', () => {
        window.print();
    });

    // 設定保存 (JSONファイルダウンロード) (全サイクル保存)
    document.getElementById('btn-save').addEventListener('click', () => {
        const saveData = {
            startDate: document.getElementById('input-start-date').value,
            activeCycle: state.activeCycle,
            station: state.station,
            shifts: state.shifts,
            platoonSize: state.platoonSize,
            minStaffing: state.minStaffing,
            staffList: state.staffList,
            hopeShifts: state.hopeShifts,
            roster: state.roster
        };
        const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'シフト設定データ.json');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 設定読込 (全サイクル読込、古いフォーマットとの互換性マッピング付き)
    document.getElementById('btn-load').addEventListener('click', () => {
        document.getElementById('file-loader').click();
    });
    
    document.getElementById('file-loader').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const data = JSON.parse(evt.target.result);
                if (data.startDate) {
                    document.getElementById('input-start-date').value = data.startDate;
                    state.startDate = new Date(data.startDate);
                }
                if (data.activeCycle) {
                    state.activeCycle = data.activeCycle;
                    document.getElementById('select-cycle').value = data.activeCycle;
                } else {
                    state.activeCycle = 1;
                    document.getElementById('select-cycle').value = 1;
                }
                if (data.station) {
                    state.station = data.station;
                } else {
                    state.station = "本署";
                }
                document.getElementById('input-station').value = state.station;
                updateStationTitle();

                if (data.shifts) {
                    state.shifts = data.shifts;
                } else {
                    state.shifts = [
                        { key: "当", name: "勤務", char: "当", color: "#e0f2fe", textColor: "#0369a1", isSystem: true },
                        { key: "明", name: "非番", char: "非", color: "#f3f4f6", textColor: "#4b5563", isSystem: true },
                        { key: "休", name: "週休", char: "休", color: "#fef3c7", textColor: "#d97706", isSystem: true },
                        { key: "有", name: "年休", char: "年", color: "#dcfce7", textColor: "#15803d" },
                        { key: "公", name: "公休", char: "公", color: "#f3e8ff", textColor: "#6b21a8" },
                        { key: "張", name: "出張", char: "張", color: "#e2f0fd", textColor: "#2563eb" },
                        { key: "特", name: "特休", char: "特", color: "#fee2e2", textColor: "#dc2626" },
                        { key: "病", name: "病休", char: "病", color: "#ffedd5", textColor: "#ea580c" }
                    ];
                }
                renderShiftConfigList();
                renderLegend();

                if (data.platoonSize) {
                    state.platoonSize = data.platoonSize;
                    document.getElementById('input-platoon-size').value = data.platoonSize;
                }
                if (data.minStaffing) {
                    state.minStaffing = data.minStaffing;
                    document.getElementById('input-min-staffing').value = data.minStaffing;
                }
                if (data.staffList) {
                    state.staffList = data.staffList.map(s => ({
                        id: s.id,
                        name: s.name,
                        platoon: s.platoon,
                        rank: s.rank || "消防士",
                        hasLargeLicense: s.hasLargeLicense || false,
                        isParamedic: s.isParamedic || false,
                        isRescue: s.isRescue || false
                    }));
                    renderStaffInputs();
                }
                
                // 後方互換マッピング処理: hopeShifts
                state.hopeShifts = {};
                if (data.hopeShifts) {
                    const firstKey = Object.keys(data.hopeShifts)[0];
                    if (firstKey && !firstKey.includes('_')) {
                        // 古い形式：単一サイクルを第1サイクルにマッピング
                        for (let staffId in data.hopeShifts) {
                            state.hopeShifts[`1_${staffId}`] = data.hopeShifts[staffId];
                        }
                    } else {
                        state.hopeShifts = data.hopeShifts;
                    }
                }
                // 不足している希望休の初期化
                for (let c = 1; c <= 13; c++) {
                    state.staffList.forEach(s => {
                        const key = `${c}_${s.id}`;
                        if (!state.hopeShifts[key]) {
                            state.hopeShifts[key] = {};
                        }
                    });
                }

                // 後方互換マッピング処理: roster
                state.roster = {};
                if (data.roster) {
                    const firstKey = Object.keys(data.roster)[0];
                    if (firstKey && !firstKey.includes('_')) {
                        // 古い形式：単一サイクルを第1サイクルにマッピング
                        for (let staffId in data.roster) {
                            state.roster[`1_${staffId}`] = data.roster[staffId];
                        }
                    } else {
                        state.roster = data.roster;
                    }
                }
                // 不足しているサイクルの初期化 (絶対日数ベースで交互に)
                for (let c = 1; c <= 13; c++) {
                    state.staffList.forEach(staff => {
                        const key = `${c}_${staff.id}`;
                        if (!state.roster[key]) {
                            const schedule = new Array(28);
                            for (let d = 0; d < 28; d++) {
                                const absoluteDay = (c - 1) * 28 + d;
                                if (staff.platoon === 1) {
                                    schedule[d] = (absoluteDay % 2 === 0) ? '当' : '明';
                                } else {
                                    schedule[d] = (absoluteDay % 2 === 1) ? '当' : '明';
                                }
                            }
                            state.roster[key] = schedule;
                        }
                    });
                }
                
                handleDateChange();
                alert("設定データを読み込みました。");
            } catch (err) {
                alert(`ファイルのパースに失敗しました: ${err.message}`);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // モーダルキャンセル
    document.getElementById('btn-modal-cancel').addEventListener('click', hideShiftModal);
}

// UIの全体更新
function refreshUI() {
    if (!state.startDate) return;
    
    renderLegend();
    
    // アクティブサイクルの roster を抽出してバリデーション実行
    const activeRoster = {};
    state.staffList.forEach(s => {
        const key = `${state.activeCycle}_${s.id}`;
        activeRoster[s.id] = state.roster[key] || new Array(28).fill('-');
    });

    // 前サイクルの roster を抽出
    let prevRoster = null;
    if (state.activeCycle > 1) {
        prevRoster = {};
        state.staffList.forEach(s => {
            const key = `${state.activeCycle - 1}_${s.id}`;
            prevRoster[s.id] = state.roster[key] || new Array(28).fill('-');
        });
    }

    state.warnings = validateRoster(activeRoster, state.staffList, state.minStaffing, prevRoster);
    renderWarnings();
    
    // アクティブなタブに合わせて描画
    if (state.activeTab === 'tab-list') {
        renderRosterTable();
    } else if (state.activeTab === 'tab-calendar') {
        renderCalendarView();
    } else if (state.activeTab === 'tab-hope') {
        renderHopeTable();
    }
}

// 警告のレンダリング
function renderWarnings() {
    const alertContainer = document.getElementById('alert-container');
    const alertList = document.getElementById('alert-list');
    alertList.innerHTML = '';
    
    if (state.warnings.length === 0) {
        alertContainer.style.display = 'none';
        return;
    }
    
    state.warnings.forEach(warn => {
        const li = document.createElement('li');
        li.textContent = warn.message;
        alertList.appendChild(li);
    });
    alertContainer.style.display = 'block';
}

// テーブル共通のヘッダー日付曜日セル生成
function createTableHeader(thead, isRosterTable) {
    const headerDays = document.createElement('tr');
    const headerWdays = document.createElement('tr');
    thead.appendChild(headerDays);
    thead.appendChild(headerWdays);
    
    // 左端固定列のプレースホルダー
    const thName1 = document.createElement('th');
    thName1.textContent = '氏名';
    thName1.rowSpan = 2;
    headerDays.appendChild(thName1);
    
    // アクティブサイクルの開始日を計算
    const activeStartDate = new Date(state.startDate);
    activeStartDate.setDate(state.startDate.getDate() + (state.activeCycle - 1) * 28);
    
    for (let d = 0; d < 28; d++) {
        const date = new Date(activeStartDate);
        date.setDate(activeStartDate.getDate() + d);
        
        const wday = date.getDay();
        const wdayStr = WEEKDAYS_JP[wday];
        
        const thDay = document.createElement('th');
        thDay.innerHTML = `${d + 1}<br><span style="font-size:10px; opacity:0.7;">${date.getMonth()+1}/${date.getDate()}</span>`;
        
        const thWday = document.createElement('th');
        thWday.textContent = wdayStr;
        
        // 週末スタイリング
        if (wday === 6) {
            thDay.classList.add('sat-day');
            thWday.classList.add('sat-day');
        } else if (wday === 0) {
            thDay.classList.add('sat-day'); // 赤くするためにクラス名は共通でスタイルあてる
            thDay.classList.add('sun-day');
            thWday.classList.add('sun-day');
        }
        
        headerDays.appendChild(thDay);
        headerWdays.appendChild(thWday);
    }
    
    // Roster Table用の統計ヘッダー
    if (isRosterTable) {
        const thDuty = document.createElement('th');
        thDuty.textContent = '当番';
        thDuty.className = 'stats-header-col';
        thDuty.rowSpan = 2;
        headerDays.appendChild(thDuty);
        
        const thHoliday = document.createElement('th');
        thHoliday.textContent = '週休';
        thHoliday.className = 'stats-header-col';
        thHoliday.rowSpan = 2;
        headerDays.appendChild(thHoliday);
    }
}

// 勤務一覧表（スプレッドシート型）の描画
function renderRosterTable() {
    const container = document.getElementById('roster-tables-container');
    container.innerHTML = '';
    
    const activeStartDate = new Date(state.startDate);
    activeStartDate.setDate(state.startDate.getDate() + (state.activeCycle - 1) * 28);
    
    [1, 2].forEach(platoonNum => {
        // セクションタイトル
        const sectionTitle = document.createElement('div');
        sectionTitle.className = 'platoon-section-title';
        sectionTitle.textContent = `第 ${platoonNum} 小隊`;
        container.appendChild(sectionTitle);
        
        // テーブルスクロールコンテナ
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'table-scroll-container';
        
        const table = document.createElement('table');
        table.className = 'roster-grid';
        
        const thead = document.createElement('thead');
        createTableHeader(thead, true);
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        
        // この小隊のメンバーをフィルタリングして階級順にソート
        const platoonStaff = sortStaffByRank(state.staffList.filter(s => s.platoon === platoonNum));
            
        platoonStaff.forEach(staff => {
            const tr = document.createElement('tr');
            
            // 氏名・資格列
            const tdName = document.createElement('td');
            tdName.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px; line-height: 1.2;">
                    <div style="font-weight: 600; font-size:12px;">${staff.name}</div>
                    <div style="display: flex; gap: 2px; align-items: center;">
                        <span class="staff-rank-badge">${getRankAbbr(staff.rank)}</span>
                        ${staff.hasLargeLicense ? '<span class="qual-badge qual-badge-large" title="大型免許">大</span>' : ''}
                        ${staff.isParamedic ? '<span class="qual-badge qual-badge-paramedic" title="救命士">命</span>' : ''}
                        ${staff.isRescue ? '<span class="qual-badge qual-badge-rescue" title="救助">助</span>' : ''}
                    </div>
                </div>
            `;
            tr.appendChild(tdName);
            
            const key = `${state.activeCycle}_${staff.id}`;
            const schedule = state.roster[key] || new Array(28).fill('-');
            
            let dutyCount = 0;
            let holidayCount = 0;
            
            for (let d = 0; d < 28; d++) {
                const shift = schedule[d];
                const td = document.createElement('td');
                td.className = 'editable-cell';
                td.dataset.staffId = staff.id;
                td.dataset.dayIndex = d;
                
                if (shift) {
                    td.appendChild(renderBadge(shift));
                }
                
                // カレンダーセルクリックで手動編集モーダルを開く
                td.addEventListener('click', () => {
                    showShiftModal(staff.id, staff.name, d);
                });
                
                // 週末の背景色設定
                const date = new Date(activeStartDate);
                date.setDate(activeStartDate.getDate() + d);
                if (date.getDay() === 6) td.classList.add('sat-day');
                if (date.getDay() === 0) td.classList.add('sun-day');
                
                tr.appendChild(td);
                
                if (shift === '当') dutyCount++;
                if (shift === '休') holidayCount++;
            }
            
            // 当番日数統計
            const tdDutyStat = document.createElement('td');
            tdDutyStat.className = 'stats-cell';
            tdDutyStat.textContent = dutyCount;
            tr.appendChild(tdDutyStat);
            
            // 週休日数統計（8日でない場合は警告カラー）
            const tdHolidayStat = document.createElement('td');
            tdHolidayStat.className = 'stats-cell';
            tdHolidayStat.textContent = holidayCount;
            if (holidayCount !== 8) {
                tdHolidayStat.style.color = 'var(--color-wday-sun)';
            }
            tr.appendChild(tdHolidayStat);
            
            tbody.appendChild(tr);
        });
        
        // 1. 小隊全体の出勤合計
        const trTotal = document.createElement('tr');
        trTotal.className = 'daily-staff-row';
        
        const tdTotalLabel = document.createElement('td');
        tdTotalLabel.textContent = `出勤合計 (当番)`;
        trTotal.appendChild(tdTotalLabel);
        
        for (let d = 0; d < 28; d++) {
            let dailyCount = 0;
            platoonStaff.forEach(s => {
                const key = `${state.activeCycle}_${s.id}`;
                if (state.roster[key] && state.roster[key][d] === '当') {
                    dailyCount++;
                }
            });
            
            const tdTotal = document.createElement('td');
            tdTotal.textContent = dailyCount;
            
            // 最低確保人員5名未満（かつこの小隊の当番日である場合）は警告
            const isMyActiveDay = (platoonNum === 1 && d % 2 === 0) || (platoonNum === 2 && d % 2 === 1);
            if (isMyActiveDay && dailyCount < state.minStaffing) {
                tdTotal.classList.add('staff-warning');
            }
            
            // 週末背景
            const date = new Date(activeStartDate);
            date.setDate(activeStartDate.getDate() + d);
            if (date.getDay() === 6) tdTotal.classList.add('sat-day');
            if (date.getDay() === 0) tdTotal.classList.add('sun-day');
            
            trTotal.appendChild(tdTotal);
        }
        trTotal.appendChild(document.createElement('td'));
        trTotal.appendChild(document.createElement('td'));
        tbody.appendChild(trTotal);
 
        // 階級・資格別集計の設定
        const totalOfficers = platoonStaff.filter(s => ["消防司令", "消防司令補", "消防士長"].includes(s.rank)).length;
        const totalLarge = platoonStaff.filter(s => s.hasLargeLicense).length;
        const totalParamedics = platoonStaff.filter(s => s.isParamedic).length;
        const totalRescue = platoonStaff.filter(s => s.isRescue).length;
 
        const summarySpecs = [
            {
                label: " (うち 司令・士長以上)",
                filterFn: s => ["消防司令", "消防司令補", "消防士長"].includes(s.rank),
                min: Math.min(2, totalOfficers)
            },
            {
                label: " (うち 大型免許)",
                filterFn: s => s.hasLargeLicense,
                min: Math.min(2, totalLarge)
            },
            {
                label: " (うち 救命士)",
                filterFn: s => s.isParamedic,
                min: Math.min(2, totalParamedics)
            },
            {
                label: " (うち 救助)",
                filterFn: s => s.isRescue,
                min: Math.min(2, totalRescue)
            }
        ];
 
        // 階級・資格別の集計行を描画
        summarySpecs.forEach(spec => {
            const trSum = document.createElement('tr');
            trSum.className = 'daily-staff-row-sub';
            trSum.style.fontSize = '10px';
            trSum.style.color = 'var(--text-secondary)';
            trSum.style.backgroundColor = 'rgba(0,0,0,0.01)';
            
            const tdLabel = document.createElement('td');
            tdLabel.textContent = spec.label;
            tdLabel.style.paddingLeft = '20px';
            trSum.appendChild(tdLabel);
            
            for (let d = 0; d < 28; d++) {
                let count = 0;
                platoonStaff.forEach(s => {
                    const key = `${state.activeCycle}_${s.id}`;
                    if (state.roster[key] && state.roster[key][d] === '当' && spec.filterFn(s)) {
                        count++;
                    }
                });
                
                const tdVal = document.createElement('td');
                tdVal.textContent = count;
                
                const isMyActiveDay = (platoonNum === 1 && d % 2 === 0) || (platoonNum === 2 && d % 2 === 1);
                if (isMyActiveDay && count < spec.min) {
                    tdVal.style.color = 'var(--color-wday-sun)';
                    tdVal.style.fontWeight = '700';
                }
                
                // 週末背景
                const date = new Date(activeStartDate);
                date.setDate(activeStartDate.getDate() + d);
                if (date.getDay() === 6) tdVal.classList.add('sat-day');
                if (date.getDay() === 0) tdVal.classList.add('sun-day');
                
                trSum.appendChild(tdVal);
            }
            trSum.appendChild(document.createElement('td'));
            trSum.appendChild(document.createElement('td'));
            tbody.appendChild(trSum);
        });
        
        table.appendChild(tbody);
        scrollContainer.appendChild(table);
        container.appendChild(scrollContainer);
    });
}

// 動的なバッジ生成
function renderBadge(shiftKey) {
    const shift = state.shifts.find(s => s.key === shiftKey) || { char: shiftKey, color: "#e5e7eb", textColor: "#374151" };
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.backgroundColor = shift.color;
    badge.style.color = shift.textColor;
    badge.textContent = shift.char;
    return badge;
}

// 凡例の動的描画
function renderLegend() {
    const legendContainer = document.getElementById('roster-legend');
    if (!legendContainer) return;
    legendContainer.innerHTML = '';
    
    state.shifts.forEach(shift => {
        const item = document.createElement('span');
        item.className = 'legend-item';
        
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.style.backgroundColor = shift.color;
        badge.style.color = shift.textColor;
        badge.textContent = shift.char;
        
        item.appendChild(badge);
        item.appendChild(document.createTextNode(` ${shift.name}`));
        legendContainer.appendChild(item);
    });
}

// 勤務シフト設定の管理エリアの描画
function renderShiftConfigList() {
    const listContainer = document.getElementById('shift-config-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    
    state.shifts.forEach(shift => {
        const item = document.createElement('div');
        item.className = 'shift-config-item';
        
        // 1. 表示文字 (char)
        const inputChar = document.createElement('input');
        inputChar.type = 'text';
        inputChar.value = shift.char;
        inputChar.maxLength = 1;
        inputChar.style.width = '100%';
        inputChar.style.textAlign = 'center';
        if (shift.isSystem) {
            inputChar.disabled = true;
        } else {
            inputChar.addEventListener('change', (e) => {
                shift.char = e.target.value.trim() || shift.key;
                refreshUI();
                renderLegend();
            });
        }
        item.appendChild(inputChar);
        
        // 2. 正式名 (name)
        const inputName = document.createElement('input');
        inputName.type = 'text';
        inputName.value = shift.name;
        inputName.style.width = '100%';
        if (shift.isSystem) {
            inputName.disabled = true;
        } else {
            inputName.addEventListener('change', (e) => {
                shift.name = e.target.value.trim() || shift.key;
                refreshUI();
                renderLegend();
            });
        }
        item.appendChild(inputName);
        
        // 3. 背景色 (color)
        const inputColor = document.createElement('input');
        inputColor.type = 'color';
        inputColor.value = shift.color;
        inputColor.addEventListener('input', (e) => {
            shift.color = e.target.value;
            refreshUI();
            renderLegend();
        });
        item.appendChild(inputColor);
        
        // 4. 文字色 (textColor)
        const inputTextColor = document.createElement('input');
        inputTextColor.type = 'color';
        inputTextColor.value = shift.textColor;
        inputTextColor.addEventListener('input', (e) => {
            shift.textColor = e.target.value;
            refreshUI();
            renderLegend();
        });
        item.appendChild(inputTextColor);
        
        // 5. 削除ボタン (isSystemではない場合のみ)
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn-delete-shift';
        if (shift.isSystem) {
            btnDelete.innerHTML = '-';
            btnDelete.disabled = true;
            btnDelete.style.opacity = '0.3';
            btnDelete.style.cursor = 'not-allowed';
        } else {
            btnDelete.innerHTML = '×';
            btnDelete.title = 'このシフトを削除';
            btnDelete.addEventListener('click', () => {
                if (confirm(`シフト「${shift.name}」を削除しますか？\n（勤務表内のこのシフトは「-」に変更されます）`)) {
                    // 全サイクルの勤務表と希望休から、削除されたシフトをクリア
                    for (let key in state.roster) {
                        state.roster[key] = state.roster[key].map(val => val === shift.key ? '-' : val);
                    }
                    for (let key in state.hopeShifts) {
                        for (let day in state.hopeShifts[key]) {
                            if (state.hopeShifts[key][day] === shift.key) {
                                delete state.hopeShifts[key][day];
                            }
                        }
                    }
                    state.shifts = state.shifts.filter(s => s.key !== shift.key);
                    renderShiftConfigList();
                    renderLegend();
                    refreshUI();
                }
            });
        }
        item.appendChild(btnDelete);
        
        listContainer.appendChild(item);
    });
}

// 事前指定（希望シフト）テーブルの描画
function renderHopeTable() {
    const container = document.getElementById('hope-tables-container');
    container.innerHTML = '';
    
    const activeStartDate = new Date(state.startDate);
    activeStartDate.setDate(state.startDate.getDate() + (state.activeCycle - 1) * 28);
    
    [1, 2].forEach(platoonNum => {
        const sectionTitle = document.createElement('div');
        sectionTitle.className = 'platoon-section-title';
        sectionTitle.textContent = `第 ${platoonNum} 小隊`;
        container.appendChild(sectionTitle);
        
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'table-scroll-container';
        
        const table = document.createElement('table');
        table.className = 'roster-grid';
        
        const thead = document.createElement('thead');
        createTableHeader(thead, false);
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        
        const platoonStaff = sortStaffByRank(state.staffList.filter(s => s.platoon === platoonNum));
            
        platoonStaff.forEach(staff => {
            const tr = document.createElement('tr');
            
            const tdName = document.createElement('td');
            tdName.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px; line-height: 1.2;">
                    <div style="font-weight: 600; font-size:12px;">${staff.name}</div>
                    <div style="display: flex; gap: 2px; align-items: center;">
                        <span class="staff-rank-badge">${getRankAbbr(staff.rank)}</span>
                        ${staff.hasLargeLicense ? '<span class="qual-badge qual-badge-large" title="大型免許">大</span>' : ''}
                        ${staff.isParamedic ? '<span class="qual-badge qual-badge-paramedic" title="救命士">命</span>' : ''}
                        ${staff.isRescue ? '<span class="qual-badge qual-badge-rescue" title="救助">助</span>' : ''}
                    </div>
                </div>
            `;
            tr.appendChild(tdName);
            
            const key = `${state.activeCycle}_${staff.id}`;
            const staffHopes = state.hopeShifts[key] || {};
            
            for (let d = 0; d < 28; d++) {
                const td = document.createElement('td');
                td.className = 'editable-cell';
                td.dataset.staffId = staff.id;
                td.dataset.dayIndex = d;
                
                const shift = staffHopes[d];
                if (shift) {
                    td.appendChild(renderBadge(shift));
                }
                
                td.addEventListener('click', () => {
                    showShiftModal(staff.id, staff.name, d, true);
                });
                
                const date = new Date(activeStartDate);
                date.setDate(activeStartDate.getDate() + d);
                if (date.getDay() === 6) td.classList.add('sat-day');
                if (date.getDay() === 0) td.classList.add('sun-day');
                
                tr.appendChild(td);
            }
            
            tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        scrollContainer.appendChild(table);
        container.appendChild(scrollContainer);
    });
}

// カレンダー表示のレンダリング
function renderCalendarView() {
    const container = document.getElementById('calendar-grid-container');
    container.innerHTML = '';
    
    WEEKDAYS_JP.forEach(wday => {
        const headerCell = document.createElement('div');
        headerCell.className = 'calendar-header-day';
        headerCell.textContent = wday;
        if (wday === '土') headerCell.classList.add('sat-day');
        if (wday === '日') { headerCell.classList.add('sat-day'); headerCell.classList.add('sun-day'); }
        container.appendChild(headerCell);
    });
    
    const activeStartDate = new Date(state.startDate);
    activeStartDate.setDate(state.startDate.getDate() + (state.activeCycle - 1) * 28);
    
    const startWday = activeStartDate.getDay();
    for (let p = 0; p < startWday; p++) {
        const emptyCard = document.createElement('div');
        emptyCard.className = 'calendar-card other-month';
        container.appendChild(emptyCard);
    }
    
    for (let d = 0; d < 28; d++) {
        const date = new Date(activeStartDate);
        date.setDate(activeStartDate.getDate() + d);
        
        const wday = date.getDay();
        const activePlatoon = (d % 2 === 0) ? 1 : 2;
        
        const card = document.createElement('div');
        card.className = 'calendar-card';
        if (wday === 6) card.classList.add('sat-day');
        if (wday === 0) { card.classList.add('sat-day'); card.classList.add('sun-day'); }
        
        const header = document.createElement('div');
        header.className = 'calendar-card-header';
        
        const dateNum = document.createElement('span');
        dateNum.className = 'calendar-date-num';
        dateNum.textContent = `${date.getMonth()+1}/${date.getDate()}`;
        
        const platoonBadge = document.createElement('span');
        platoonBadge.className = 'calendar-active-platoon';
        platoonBadge.textContent = `${activePlatoon}小隊`;
        
        header.appendChild(dateNum);
        header.appendChild(platoonBadge);
        card.appendChild(header);
        
        const staffListDiv = document.createElement('div');
        staffListDiv.className = 'calendar-staff-list';
        
        let onDutyCount = 0;
        sortStaffByRank(state.staffList).forEach(staff => {
            const key = `${state.activeCycle}_${staff.id}`;
            const shift = (state.roster[key] && state.roster[key][d]) || '-';
            if (shift === '当') {
                onDutyCount++;
                const item = document.createElement('div');
                item.className = 'calendar-staff-item';
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'calendar-staff-item-name';
                nameSpan.innerHTML = `
                    ${staff.name} 
                    <span style="font-size: 8px; opacity: 0.7;">(${getRankAbbr(staff.rank)})</span>
                    ${staff.hasLargeLicense ? '<span class="qual-badge qual-badge-large" style="width:10px; height:10px; font-size:7px; margin-left:1px;">大</span>' : ''}
                    ${staff.isParamedic ? '<span class="qual-badge qual-badge-paramedic" style="width:10px; height:10px; font-size:7px; margin-left:1px;">命</span>' : ''}
                    ${staff.isRescue ? '<span class="qual-badge qual-badge-rescue" style="width:10px; height:10px; font-size:7px; margin-left:1px;">助</span>' : ''}
                `;
                
                const badge = renderBadge(shift);
                badge.classList.add('calendar-staff-badge');
                
                item.appendChild(nameSpan);
                item.appendChild(badge);
                staffListDiv.appendChild(item);
            }
        });
        
        const footerInfo = document.createElement('div');
        footerInfo.style.fontSize = '10px';
        footerInfo.style.marginTop = 'auto';
        footerInfo.style.textAlign = 'right';
        footerInfo.style.fontWeight = '600';
        footerInfo.innerHTML = `出勤: <span style="font-size:12px; color:${onDutyCount < state.minStaffing ? 'var(--color-wday-sun)' : 'inherit'};">${onDutyCount}</span> 名`;
        
        card.appendChild(staffListDiv);
        card.appendChild(footerInfo);
        container.appendChild(card);
    }
    
    const totalCells = startWday + 28;
    const finalPadding = (7 - (totalCells % 7)) % 7;
    for (let p = 0; p < finalPadding; p++) {
        const emptyCard = document.createElement('div');
        emptyCard.className = 'calendar-card other-month';
        container.appendChild(emptyCard);
    }
}

// シフト手動編集・事前指定用のポップアップ表示
let currentEditCell = { staffId: null, dayIndex: null, isPreScheduling: false };

function showShiftModal(staffId, staffName, dayIndex, isPreScheduling = false) {
    currentEditCell = { staffId, dayIndex, isPreScheduling };
    
    const activeStartDate = new Date(state.startDate);
    activeStartDate.setDate(state.startDate.getDate() + (state.activeCycle - 1) * 28);
    
    const date = new Date(activeStartDate);
    date.setDate(activeStartDate.getDate() + dayIndex);
    const dateStr = `${date.getMonth()+1}/${date.getDate()}(${WEEKDAYS_JP[date.getDay()]})`;
    
    const titlePrefix = isPreScheduling ? "事前指定シフトの設定" : "シフト変更";
    document.getElementById('modal-title').textContent = `${staffName} の${titlePrefix} - ${dateStr}`;
    
    // 開始日のラベル設定と、終了日入力欄のリセット
    document.getElementById('modal-start-day-label').textContent = dayIndex + 1;
    document.getElementById('modal-end-day-input').value = '';
    
    const modal = document.getElementById('shift-modal');
    modal.style.display = 'flex';
    
    // クリアボタンの表示・非表示制御
    const clearBtn = document.getElementById('btn-modal-clear');
    if (isPreScheduling) {
        clearBtn.style.display = 'block';
    } else {
        clearBtn.style.display = 'none';
    }
    
    // 期間計算ヘルパー関数
    function getTargetRange() {
        const startDay = dayIndex;
        let endDay = parseInt(document.getElementById('modal-end-day-input').value) - 1;
        if (isNaN(endDay) || endDay < startDay) {
            endDay = startDay;
        }
        if (endDay > 27) {
            endDay = 27;
        }
        return { startDay, endDay };
    }

    // 通常のシフトボタンの動的生成と紐付け
    const btnContainer = document.getElementById('modal-shift-buttons');
    btnContainer.innerHTML = '';
    
    state.shifts.forEach(shift => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-modal';
        btn.dataset.shift = shift.key;
        
        // バッジ部分の追加
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.style.backgroundColor = shift.color;
        badge.style.color = shift.textColor;
        badge.textContent = shift.char;
        
        btn.appendChild(badge);
        btn.appendChild(document.createTextNode(` ${shift.name}`));
        
        btn.addEventListener('click', (e) => {
            const selectedShift = shift.key;
            const { startDay, endDay } = getTargetRange();
            const key = `${state.activeCycle}_${staffId}`;
            
            for (let d = startDay; d <= endDay; d++) {
                if (isPreScheduling) {
                    if (!state.hopeShifts[key]) {
                        state.hopeShifts[key] = {};
                    }
                    state.hopeShifts[key][d] = selectedShift;
                } else {
                    if (state.roster[key]) {
                        state.roster[key][d] = selectedShift;
                    }
                }
            }
            refreshUI();
            hideShiftModal();
        });
        
        btnContainer.appendChild(btn);
    });

    // クリアボタンの紐付け
    const newClearBtn = clearBtn.cloneNode(true);
    clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
    newClearBtn.addEventListener('click', () => {
        const { startDay, endDay } = getTargetRange();
        const key = `${state.activeCycle}_${staffId}`;
        
        for (let d = startDay; d <= endDay; d++) {
            if (isPreScheduling) {
                if (state.hopeShifts[key]) {
                    delete state.hopeShifts[key][d];
                }
            } else {
                if (state.roster[key]) {
                    state.roster[key][d] = '-';
                }
            }
        }
        refreshUI();
        hideShiftModal();
    });
}

function hideShiftModal() {
    document.getElementById('shift-modal').style.display = 'none';
}

function adjustStaffList() {
    const currentP1 = state.staffList.filter(s => s.platoon === 1);
    const currentP2 = state.staffList.filter(s => s.platoon === 2);
    
    const newStaffList = [];
    
    // 第1小隊
    for (let i = 0; i < state.platoonSize; i++) {
        if (i < currentP1.length) {
            newStaffList.push(currentP1[i]);
        } else {
            const def = DEFAULT_STAFF_PLATOON_1[i] || { name: `第1小隊 隊員${i+1}`, rank: "消防士", large: false, paramedic: false, rescue: false };
            newStaffList.push({
                id: `p1-${i+1}`,
                name: def.name,
                platoon: 1,
                rank: def.rank,
                hasLargeLicense: def.large,
                isParamedic: def.paramedic,
                isRescue: def.rescue
            });
        }
    }
    
    // 第2小隊
    for (let i = 0; i < state.platoonSize; i++) {
        if (i < currentP2.length) {
            newStaffList.push(currentP2[i]);
        } else {
            const def = DEFAULT_STAFF_PLATOON_2[i] || { name: `第2小隊 隊員${i+1}`, rank: "消防士", large: false, paramedic: false, rescue: false };
            newStaffList.push({
                id: `p2-${i+1}`,
                name: def.name,
                platoon: 2,
                rank: def.rank,
                hasLargeLicense: def.large,
                isParamedic: def.paramedic,
                isRescue: def.rescue
            });
        }
    }
    
    state.staffList = newStaffList;
    
    // 希望休オブジェクトの初期化 (全13サイクル)
    for (let c = 1; c <= 13; c++) {
        state.staffList.forEach(s => {
            const key = `${c}_${s.id}`;
            if (!state.hopeShifts[key]) {
                state.hopeShifts[key] = {};
            }
        });
    }
}
