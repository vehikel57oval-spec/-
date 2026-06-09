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
    hourlyLeaves: {}, // cycle_staffId_dayIndex -> { startTime, endTime, hours }
    warnings: [],
    activeTab: 'tab-list',
    activePlatoon: 1,
    platoonSize: 19,
    minStaffing: 11,
    minSubOfficer: 1,
    minLarge: 1,
    minParamedic: 1,
    vehicleAssignments: {}, // dateStr -> vehicleObj
    deployedVehicles: [] // array of vehicleNames that are active
};

// カスタムダイアログ（システム風デザイン・画面中央）
function showCustomAlert(message) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-dialog-overlay';
        
        const box = document.createElement('div');
        box.className = 'custom-dialog-box';
        
        const text = document.createElement('div');
        text.className = 'custom-dialog-text';
        text.textContent = message;
        
        const btnArea = document.createElement('div');
        btnArea.className = 'custom-dialog-buttons';
        
        const btn = document.createElement('button');
        btn.className = 'custom-dialog-btn custom-dialog-btn-primary';
        btn.textContent = 'OK';
        
        btnArea.appendChild(btn);
        box.appendChild(text);
        box.appendChild(btnArea);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
        // アニメーション用のクラス適用
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
        
        btn.addEventListener('click', () => {
            overlay.classList.remove('active');
            overlay.addEventListener('transitionend', () => {
                overlay.remove();
                resolve();
            });
        });
    });
}

function showCustomConfirm(message) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-dialog-overlay';
        
        const box = document.createElement('div');
        box.className = 'custom-dialog-box';
        
        const text = document.createElement('div');
        text.className = 'custom-dialog-text';
        text.textContent = message;
        
        const btnArea = document.createElement('div');
        btnArea.className = 'custom-dialog-buttons';
        
        const btnCancel = document.createElement('button');
        btnCancel.className = 'custom-dialog-btn custom-dialog-btn-secondary';
        btnCancel.textContent = 'キャンセル';
        
        const btnOk = document.createElement('button');
        btnOk.className = 'custom-dialog-btn custom-dialog-btn-primary';
        btnOk.textContent = 'OK';
        
        btnArea.appendChild(btnCancel);
        btnArea.appendChild(btnOk);
        box.appendChild(text);
        box.appendChild(btnArea);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
        
        btnCancel.addEventListener('click', () => {
            overlay.classList.remove('active');
            overlay.addEventListener('transitionend', () => {
                overlay.remove();
                resolve(false);
            });
        });
        
        btnOk.addEventListener('click', () => {
            overlay.classList.remove('active');
            overlay.addEventListener('transitionend', () => {
                overlay.remove();
                resolve(true);
            });
        });
    });
}

function showCustomPrompt(message, defaultValue = "") {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-dialog-overlay';
        
        const box = document.createElement('div');
        box.className = 'custom-dialog-box';
        
        const text = document.createElement('div');
        text.className = 'custom-dialog-text';
        text.textContent = message;
        
        const input = document.createElement('input');
        input.className = 'custom-dialog-input';
        input.type = 'text';
        input.value = defaultValue;
        
        const btnArea = document.createElement('div');
        btnArea.className = 'custom-dialog-buttons';
        
        const btnCancel = document.createElement('button');
        btnCancel.className = 'custom-dialog-btn custom-dialog-btn-secondary';
        btnCancel.textContent = 'キャンセル';
        
        const btnOk = document.createElement('button');
        btnOk.className = 'custom-dialog-btn custom-dialog-btn-primary';
        btnOk.textContent = 'OK';
        
        btnArea.appendChild(btnCancel);
        btnArea.appendChild(btnOk);
        box.appendChild(text);
        box.appendChild(input);
        box.appendChild(btnArea);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
        requestAnimationFrame(() => {
            overlay.classList.add('active');
            input.focus();
            if (defaultValue) {
                input.select();
            }
        });
        
        btnCancel.addEventListener('click', () => {
            overlay.classList.remove('active');
            overlay.addEventListener('transitionend', () => {
                overlay.remove();
                resolve(null);
            });
        });
        
        btnOk.addEventListener('click', () => {
            const val = input.value;
            overlay.classList.remove('active');
            overlay.addEventListener('transitionend', () => {
                overlay.remove();
                resolve(val);
            });
        });
        
        // Enterキーで決定
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                btnOk.click();
            }
        });
    });
}

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

// 国民の祝日を判定する関数
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

    // 国民の休日チェック
    const yesterday = new Date(y, m - 1, d - 1);
    const tomorrow = new Date(y, m - 1, d + 1);
    if (getJapaneseHolidayWithoutSub(yesterday) && getJapaneseHolidayWithoutSub(tomorrow) && date.getDay() !== 0) {
        return "国民の休日";
    }

    return null;
}

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
    applyStationVehiclePreset(state.station);
    
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
            isRescue: def1.rescue,
            isKikan: def1.large || false,
            isDayWorker: false
        });
        
        const def2 = DEFAULT_STAFF_PLATOON_2[i] || { name: `第2小隊 隊員${i+1}`, rank: "消防士", large: false, paramedic: false, rescue: false };
        state.staffList.push({
            id: `p2-${i+1}`,
            name: def2.name,
            platoon: 2,
            rank: def2.rank,
            hasLargeLicense: def2.large,
            isParamedic: def2.paramedic,
            isRescue: def2.rescue,
            isKikan: def2.large || false,
            isDayWorker: false
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
    
    state.staffList.filter(s => !s.isSupport).forEach(staff => {
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
        
        // 救命士 (救)
        const btnPara = document.createElement('span');
        btnPara.className = `qual-btn ${staff.isParamedic ? 'active-paramedic' : ''}`;
        btnPara.textContent = '救';
        btnPara.title = '救急救命士';
        btnPara.addEventListener('click', () => {
            staff.isParamedic = !staff.isParamedic;
            btnPara.className = `qual-btn ${staff.isParamedic ? 'active-paramedic' : ''}`;
            refreshUI();
        });
        togglesDiv.appendChild(btnPara);
        
        // 救助 (R)
        const btnRescue = document.createElement('span');
        btnRescue.className = `qual-btn ${staff.isRescue ? 'active-rescue' : ''}`;
        btnRescue.textContent = 'R';
        btnRescue.title = '救助隊員';
        btnRescue.addEventListener('click', () => {
            staff.isRescue = !staff.isRescue;
            btnRescue.className = `qual-btn ${staff.isRescue ? 'active-rescue' : ''}`;
            refreshUI();
        });
        togglesDiv.appendChild(btnRescue);
        
        // 機関員 (機)
        const btnKikan = document.createElement('span');
        btnKikan.className = `qual-btn ${staff.isKikan ? 'active-kikan' : ''}`;
        btnKikan.textContent = '機';
        btnKikan.title = '機関員';
        btnKikan.addEventListener('click', () => {
            staff.isKikan = !staff.isKikan;
            btnKikan.className = `qual-btn ${staff.isKikan ? 'active-kikan' : ''}`;
            refreshUI();
        });
        togglesDiv.appendChild(btnKikan);
        
        // 日勤者 (日)
        const btnDay = document.createElement('span');
        btnDay.className = `qual-btn ${staff.isDayWorker ? 'active-dayworker' : ''}`;
        btnDay.textContent = '日';
        btnDay.title = '日勤者';
        btnDay.addEventListener('click', () => {
            staff.isDayWorker = !staff.isDayWorker;
            btnDay.className = `qual-btn ${staff.isDayWorker ? 'active-dayworker' : ''}`;
            refreshUI();
        });
        togglesDiv.appendChild(btnDay);
        
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
    
    // 再生成開始日の選択肢を動的に生成
    const regenSelect = document.getElementById('select-regen-start-day');
    if (regenSelect) {
        const currentVal = regenSelect.value;
        regenSelect.innerHTML = '';
        for (let d = 0; d < 28; d++) {
            const optDate = new Date(activeStartDate);
            optDate.setDate(activeStartDate.getDate() + d);
            const holidayName = getJapaneseHoliday(optDate);
            const dateStr = `${optDate.getMonth()+1}/${optDate.getDate()}(${WEEKDAYS_JP[optDate.getDay()]})${holidayName ? '・' + holidayName : ''}`;
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = `${d + 1}日目 (${dateStr})`;
            regenSelect.appendChild(opt);
        }
        if (currentVal !== "" && parseInt(currentVal) < 28) {
            regenSelect.value = currentVal;
        } else {
            regenSelect.value = "0";
        }
    }
    updateGenerateButtonText();
    
    refreshUI();
}

// 自動生成ボタンの文言更新
function updateGenerateButtonText() {
    const regenSelect = document.getElementById('select-regen-start-day');
    const btnText = document.querySelector('#btn-generate .btn-text');
    if (!regenSelect || !btnText) return;
    const val = parseInt(regenSelect.value);
    if (val === 0) {
        btnText.textContent = "勤務表を自動生成";
    } else {
        btnText.textContent = `${val + 1}日目以降を再編成 (部分的再生成)`;
    }
}


// イベントリスナーの紐付け
function bindEvents() {
    // 署所名変更
    document.getElementById('input-station').addEventListener('change', (e) => {
        state.station = e.target.value.trim() || "本署";
        updateStationTitle();
        applyStationVehiclePreset(state.station);
    });

    // 新規シフト追加
    document.getElementById('btn-add-shift').addEventListener('click', async () => {
        const char = await showCustomPrompt("追加するシフトの記号（1文字）を入力してください：\n（例：公、特、病、など）");
        if (!char) return;
        const trimmedChar = char.trim().slice(0, 1);
        if (trimmedChar.length === 0) return;
        
        // 重複チェック
        if (state.shifts.some(s => s.key === trimmedChar || s.char === trimmedChar)) {
            await showCustomAlert("既に存在するシフト記号です。別の文字を指定してください。");
            return;
        }
        
        const name = await showCustomPrompt(`シフト「${trimmedChar}」の正式名称（説明）を入力してください：\n（例：公休、特別休暇、など）`);
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
    
    // 最低確保 司令・司令補数の変更
    document.getElementById('input-min-subofficer').addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 0) val = 0;
        if (val > 50) val = 50;
        e.target.value = val;
        state.minSubOfficer = val;
        refreshUI();
    });
    
    // 最低確保 大型免許保有者数の変更
    document.getElementById('input-min-large').addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 0) val = 0;
        if (val > 50) val = 50;
        e.target.value = val;
        state.minLarge = val;
        refreshUI();
    });
    
    // 最低確保 救命士数の変更
    document.getElementById('input-min-paramedic').addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 0) val = 0;
        if (val > 50) val = 50;
        e.target.value = val;
        state.minParamedic = val;
        refreshUI();
    });
    
    // 部分的自動生成の基準日変更時の文言更新
    const regenSelectElement = document.getElementById('select-regen-start-day');
    if (regenSelectElement) {
        regenSelectElement.addEventListener('change', updateGenerateButtonText);
    }
    
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

    // 応援職員の登録フォーム送信
    const formSupport = document.getElementById('form-support-staff');
    if (formSupport) {
        formSupport.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const origin = document.getElementById('support-origin').value.trim();
            const name = document.getElementById('support-name').value.trim();
            const platoon = parseInt(document.getElementById('support-platoon').value);
            const rank = document.getElementById('support-rank').value;
            const hasLarge = document.getElementById('support-large').checked;
            const isParamedic = document.getElementById('support-paramedic').checked;
            const isRescue = document.getElementById('support-rescue').checked;
            const isKikan = document.getElementById('support-kikan').checked;
            const startStr = document.getElementById('support-start').value;
            const endStr = document.getElementById('support-end').value;
            
            if (!origin || !name || !startStr || !endStr) {
                await showCustomAlert("すべての項目を正しく入力してください。");
                return;
            }
            
            if (startStr > endStr) {
                await showCustomAlert("補充開始日は補充終了日より前の日付に設定してください。");
                return;
            }
            
            // 応援職員オブジェクトの作成
            const supportStaffId = `support-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const newSupport = {
                id: supportStaffId,
                name: name,
                platoon: platoon,
                rank: rank,
                hasLargeLicense: hasLarge,
                isParamedic: isParamedic,
                isRescue: isRescue,
                isKikan: isKikan,
                isDayWorker: false,
                isSupport: true,
                origin: origin,
                supportStart: startStr,
                supportEnd: endStr
            };
            
            state.staffList.push(newSupport);
            
            // 希望休と初期シフトの設定 (13サイクル分)
            const activeStartDate = new Date(state.startDate);
            for (let c = 1; c <= 13; c++) {
                const key = `${c}_${supportStaffId}`;
                
                // 希望休の初期化
                state.hopeShifts[key] = {};
                
                // シフトの初期化
                const schedule = new Array(28);
                const cycleStart = new Date(state.startDate);
                cycleStart.setDate(state.startDate.getDate() + (c - 1) * 28);
                
                for (let d = 0; d < 28; d++) {
                    const dayDate = new Date(cycleStart);
                    dayDate.setDate(cycleStart.getDate() + d);
                    
                    const y = dayDate.getFullYear();
                    const m = String(dayDate.getMonth() + 1).padStart(2, '0');
                    const dayVal = String(dayDate.getDate()).padStart(2, '0');
                    const dayStr = `${y}-${m}-${dayVal}`;
                    
                    if (dayStr >= startStr && dayStr <= endStr) {
                        // 期間内：当番日なら当/非、それ以外は休
                        const isDutyDay = (platoon === 1) ? (d % 2 === 0) : (d % 2 === 1);
                        const isAfterDutyDay = (platoon === 1) ? (d % 2 === 1) : (d % 2 === 0);
                        
                        if (isDutyDay) {
                            schedule[d] = '当';
                            state.hopeShifts[key][d] = '当';
                        } else if (isAfterDutyDay) {
                            schedule[d] = '明';
                            state.hopeShifts[key][d] = '明';
                        } else {
                            schedule[d] = '休';
                            state.hopeShifts[key][d] = '休';
                        }
                    } else {
                        // 期間外：すべて休み
                        schedule[d] = '休';
                        state.hopeShifts[key][d] = '休';
                    }
                }
                state.roster[key] = schedule;
            }
            
            // フォームのクリア
            formSupport.reset();
            
            // UIの更新
            refreshUI();
            await showCustomAlert(`応援職員「${name}」を登録しました。`);
        });
    }

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
        setTimeout(async () => {
            try {
                const regenSelect = document.getElementById('select-regen-start-day');
                const regenStartDay = regenSelect ? parseInt(regenSelect.value) : 0;

                // アクティブサイクルの希望休のみを抽出
                const activeHopeShifts = {};
                state.staffList.forEach(s => {
                    const key = `${state.activeCycle}_${s.id}`;
                    const hopes = { ...(state.hopeShifts[key] || {}) };
                    
                    // regenStartDay 未満の日については、既存の勤務表 (roster) を希望（固定値）として設定する
                    if (regenStartDay > 0) {
                        const rosterKey = `${state.activeCycle}_${s.id}`;
                        const currentRoster = state.roster[rosterKey] || [];
                        for (let d = 0; d < regenStartDay; d++) {
                            if (currentRoster[d] && currentRoster[d] !== '-') {
                                hopes[d] = currentRoster[d];
                            }
                        }
                    }
                    activeHopeShifts[s.id] = hopes;
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

                const res = generateRoster(activeStartDate, staffListWithPrev, activeHopeShifts, state.minStaffing, state.minSubOfficer, state.minLarge, state.minParamedic);
                if (res.success) {
                    // 生成結果をアクティブサイクルに格納
                    state.staffList.forEach(s => {
                        const key = `${state.activeCycle}_${s.id}`;
                        state.roster[key] = res.roster[s.id];
                    });
                    
                    let msg = res.profileMessage;
                    if (regenStartDay > 0) {
                        msg = `【部分的再生成完了】${regenStartDay + 1}日目以降を再編成しました（1〜${regenStartDay}日目は固定）。\n\n` + msg;
                    }
                    await showCustomAlert(msg);
                } else {
                    await showCustomAlert(res.error);
                }
            } catch (err) {
                await showCustomAlert(`エラーが発生しました: ${err.message}`);
                console.error(err);
            } finally {
                updateGenerateButtonText();
                spinner.style.display = 'none';
                btn.disabled = false;
                refreshUI();
            }
        }, 50);
    });

    // CSVエクスポート (アクティブサイクルのみ)
    document.getElementById('btn-csv').addEventListener('click', async () => {
        try {
            const activeStartDate = new Date(state.startDate);
            activeStartDate.setDate(state.startDate.getDate() + (state.activeCycle - 1) * 28);

            // アクティブサイクルの roster を抽出
            const activeRoster = {};
            state.staffList.forEach(s => {
                const key = `${state.activeCycle}_${s.id}`;
                activeRoster[s.id] = state.roster[key] || new Array(28).fill('-');
            });

            const csv = exportToCSV(activeRoster, activeStartDate, sortStaffByRank(state.staffList), state.hourlyLeaves, state.activeCycle);
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
            await showCustomAlert(`CSVエクスポートに失敗しました: ${err.message}`);
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
            minSubOfficer: state.minSubOfficer,
            minLarge: state.minLarge,
            minParamedic: state.minParamedic,
            staffList: state.staffList,
            hopeShifts: state.hopeShifts,
            roster: state.roster,
            hourlyLeaves: state.hourlyLeaves,
            vehicleAssignments: state.vehicleAssignments || {},
            deployedVehicles: state.deployedVehicles || []
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
        reader.onload = async function(evt) {
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
                
                state.minSubOfficer = data.minSubOfficer !== undefined ? data.minSubOfficer : 1;
                document.getElementById('input-min-subofficer').value = state.minSubOfficer;
                
                state.minLarge = data.minLarge !== undefined ? data.minLarge : 1;
                document.getElementById('input-min-large').value = state.minLarge;
                
                state.minParamedic = data.minParamedic !== undefined ? data.minParamedic : 1;
                document.getElementById('input-min-paramedic').value = state.minParamedic;
                
                state.hourlyLeaves = data.hourlyLeaves || {};
                state.vehicleAssignments = data.vehicleAssignments || {};
                
                // Load deployed vehicles if present, else apply preset
                if (data.deployedVehicles) {
                    state.deployedVehicles = data.deployedVehicles;
                    syncDeployedVehiclesCheckboxes();
                } else {
                    applyStationVehiclePreset(state.station);
                }

                if (data.staffList) {
                    state.staffList = data.staffList.map(s => ({
                        id: s.id,
                        name: s.name,
                        platoon: s.platoon,
                        rank: s.rank || "消防士",
                        hasLargeLicense: s.hasLargeLicense || false,
                        isParamedic: s.isParamedic || false,
                        isRescue: s.isRescue || false,
                        isKikan: s.isKikan || false,
                        isDayWorker: s.isDayWorker || false,
                        isSupport: s.isSupport || false,
                        origin: s.origin || "",
                        supportStart: s.supportStart || "",
                        supportEnd: s.supportEnd || ""
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
                await showCustomAlert("設定データを読み込みました。");
            } catch (err) {
                await showCustomAlert(`ファイルのパースに失敗しました: ${err.message}`);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // モーダルキャンセル
    document.getElementById('btn-modal-cancel').addEventListener('click', hideShiftModal);

    // 車両配置イベントのバインド
    bindVehicleEvents();
}

// UIの全体更新
function refreshUI() {
    
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
    } else if (state.activeTab === 'tab-support') {
        renderSupportTable();
    } else if (state.activeTab === 'tab-vehicle') {
        renderVehicleView();
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
        thDay.textContent = `${date.getMonth()+1}/${date.getDate()}`;
        
        const thWday = document.createElement('th');
        thWday.textContent = wdayStr;
        
        // 週末・祝日スタイリング
        const holidayName = getJapaneseHoliday(date);
        if (holidayName) {
            thDay.classList.add('sat-day'); // 赤くするためにクラス名は共通でスタイルあてる
            thDay.classList.add('sun-day');
            thWday.classList.add('sun-day');
            thDay.title = holidayName;
            thWday.title = holidayName;
        } else if (wday === 6) {
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
        
        const thAnnual = document.createElement('th');
        thAnnual.textContent = '年休';
        thAnnual.className = 'stats-header-col';
        thAnnual.rowSpan = 2;
        headerDays.appendChild(thAnnual);
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
                    <div style="font-weight: 600; font-size:12px;">
                        ${staff.name}${staff.isSupport ? `<span class="badge-support">応援：${staff.origin}</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 2px; align-items: center;">
                        <span class="staff-rank-badge">${getRankAbbr(staff.rank)}</span>
                        ${staff.hasLargeLicense ? '<span class="qual-badge qual-badge-large" title="大型免許">大</span>' : ''}
                        ${staff.isParamedic ? '<span class="qual-badge qual-badge-paramedic" title="救急救命士">救</span>' : ''}
                        ${staff.isRescue ? '<span class="qual-badge qual-badge-rescue" title="救助隊員">R</span>' : ''}
                        ${staff.isKikan ? '<span class="qual-badge qual-badge-kikan" title="機関員指定">機</span>' : ''}
                        ${staff.isDayWorker ? '<span class="qual-badge qual-badge-dayworker" title="日勤者">日</span>' : ''}
                    </div>
                </div>
            `;
            tr.appendChild(tdName);
            
            const key = `${state.activeCycle}_${staff.id}`;
            const schedule = state.roster[key] || new Array(28).fill('-');
            
            let dutyCount = 0;
            let holidayCount = 0;
            let annualLeaveCount = 0;
            
            for (let d = 0; d < 28; d++) {
                const shift = schedule[d];
                const td = document.createElement('td');
                td.className = 'editable-cell';
                td.dataset.staffId = staff.id;
                td.dataset.dayIndex = d;
                
                if (shift) {
                    td.appendChild(renderBadge(shift));
                    
                    if (shift === '有') {
                        const hourlyKey = `${state.activeCycle}_${staff.id}_${d}`;
                        const savedHourly = state.hourlyLeaves[hourlyKey];
                        if (savedHourly) {
                            const timeDiv = document.createElement('div');
                            timeDiv.style.fontSize = '9px';
                            timeDiv.style.color = '#dc2626';
                            timeDiv.style.fontWeight = 'bold';
                            timeDiv.style.marginTop = '2px';
                            timeDiv.textContent = `${savedHourly.hours}h`;
                            td.appendChild(timeDiv);
                        }
                    }
                }
                
                // カレンダーセルクリックで手動編集モーダルを開く
                td.addEventListener('click', () => {
                    showShiftModal(staff.id, staff.name, d);
                });
                
                // 週末・祝日の背景色設定
                const date = new Date(activeStartDate);
                date.setDate(activeStartDate.getDate() + d);
                if (date.getDay() === 6) td.classList.add('sat-day');
                if (date.getDay() === 0 || getJapaneseHoliday(date)) td.classList.add('sun-day');
                
                tr.appendChild(td);
                
                if (shift === '当') dutyCount++;
                if (shift === '休') holidayCount++;
                if (shift === '有') {
                    const hourlyKey = `${state.activeCycle}_${staff.id}_${d}`;
                    if (state.hourlyLeaves[hourlyKey]) {
                        annualLeaveCount += state.hourlyLeaves[hourlyKey].hours / 8.0;
                    } else {
                        annualLeaveCount += staff.isDayWorker ? 1.0 : 2.0;
                    }
                }
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
            if (!staff.isSupport && holidayCount !== 8) {
                tdHolidayStat.style.color = 'var(--color-wday-sun)';
            }
            tr.appendChild(tdHolidayStat);
            
            // 年休日数統計
            const tdAnnualStat = document.createElement('td');
            tdAnnualStat.className = 'stats-cell';
            tdAnnualStat.textContent = Number.isInteger(annualLeaveCount) ? annualLeaveCount.toString() : annualLeaveCount.toFixed(2);
            tr.appendChild(tdAnnualStat);
            
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
            
            // 週末・祝日背景
            const date = new Date(activeStartDate);
            date.setDate(activeStartDate.getDate() + d);
            if (date.getDay() === 6) tdTotal.classList.add('sat-day');
            if (date.getDay() === 0 || getJapaneseHoliday(date)) tdTotal.classList.add('sun-day');
            
            trTotal.appendChild(tdTotal);
        }
        trTotal.appendChild(document.createElement('td'));
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
                
                // 週末・祝日背景
                const date = new Date(activeStartDate);
                date.setDate(activeStartDate.getDate() + d);
                if (date.getDay() === 6) tdVal.classList.add('sat-day');
                if (date.getDay() === 0 || getJapaneseHoliday(date)) tdVal.classList.add('sun-day');
                
                trSum.appendChild(tdVal);
            }
            trSum.appendChild(document.createElement('td'));
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
            btnDelete.addEventListener('click', async () => {
                if (await showCustomConfirm(`シフト「${shift.name}」を削除しますか？\n（勤務表内のこのシフトは「-」に変更されます）`)) {
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
                    <div style="font-weight: 600; font-size:12px;">
                        ${staff.name}${staff.isSupport ? `<span class="badge-support">応援：${staff.origin}</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 2px; align-items: center;">
                        <span class="staff-rank-badge">${getRankAbbr(staff.rank)}</span>
                        ${staff.hasLargeLicense ? '<span class="qual-badge qual-badge-large" title="大型免許">大</span>' : ''}
                        ${staff.isParamedic ? '<span class="qual-badge qual-badge-paramedic" title="救急救命士">救</span>' : ''}
                        ${staff.isRescue ? '<span class="qual-badge qual-badge-rescue" title="救助隊員">R</span>' : ''}
                        ${staff.isKikan ? '<span class="qual-badge qual-badge-kikan" title="機関員指定">機</span>' : ''}
                        ${staff.isDayWorker ? '<span class="qual-badge qual-badge-dayworker" title="日勤者">日</span>' : ''}
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
                    
                    if (shift === '有') {
                        const hourlyKey = `${state.activeCycle}_${staff.id}_${d}`;
                        const savedHourly = state.hourlyLeaves[hourlyKey];
                        if (savedHourly) {
                            const timeDiv = document.createElement('div');
                            timeDiv.style.fontSize = '9px';
                            timeDiv.style.color = '#dc2626';
                            timeDiv.style.fontWeight = 'bold';
                            timeDiv.style.marginTop = '2px';
                            timeDiv.textContent = `${savedHourly.hours}h`;
                            td.appendChild(timeDiv);
                        }
                    }
                }
                
                td.addEventListener('click', () => {
                    showShiftModal(staff.id, staff.name, d, true);
                });
                
                const date = new Date(activeStartDate);
                date.setDate(activeStartDate.getDate() + d);
                if (date.getDay() === 6) td.classList.add('sat-day');
                if (date.getDay() === 0 || getJapaneseHoliday(date)) td.classList.add('sun-day');
                
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
        
        const holidayName = getJapaneseHoliday(date);
        if (wday === 6) card.classList.add('sat-day');
        if (wday === 0 || holidayName) {
            card.classList.add('sat-day');
            card.classList.add('sun-day');
            if (holidayName) {
                card.title = holidayName;
            }
        }
        
        const header = document.createElement('div');
        header.className = 'calendar-card-header';
        
        const dateNum = document.createElement('span');
        dateNum.className = 'calendar-date-num';
        dateNum.textContent = `${date.getMonth()+1}/${date.getDate()}`;
        
        const platoonBadge = document.createElement('span');
        platoonBadge.className = 'calendar-active-platoon';
        platoonBadge.textContent = `${activePlatoon}小隊`;
        
        header.appendChild(dateNum);
        if (holidayName) {
            const holidaySpan = document.createElement('span');
            holidaySpan.className = 'calendar-holiday-name';
            holidaySpan.style.fontSize = '9px';
            holidaySpan.style.color = 'var(--color-wday-sun)';
            holidaySpan.style.fontWeight = 'bold';
            holidaySpan.style.marginLeft = '4px';
            holidaySpan.textContent = holidayName;
            header.appendChild(holidaySpan);
        }
        header.appendChild(platoonBadge);
        card.appendChild(header);
        
        const staffListDiv = document.createElement('div');
        staffListDiv.className = 'calendar-staff-list';
        
        let onDutyCount = 0;
        
        // 分割グループの初期化
        const group1 = []; // 司令補以上
        const group2 = []; // 士長
        const group3 = []; // 副士長＋消防士
        
        // スタッフをランク別に振り分け
        sortStaffByRank(state.staffList).forEach(staff => {
            const key = `${state.activeCycle}_${staff.id}`;
            const shift = (state.roster[key] && state.roster[key][d]) || '-';
            if (shift === '当') {
                if (["消防司令", "消防司令補"].includes(staff.rank)) {
                    group1.push(staff);
                } else if (["消防士長"].includes(staff.rank)) {
                    group2.push(staff);
                } else {
                    group3.push(staff);
                }
            }
        });

        // グループごとの描画ヘルパー
        const appendGroup = (title, list) => {
            if (list.length === 0) return;
            
            // グループ見出し
            const gHeader = document.createElement('div');
            gHeader.className = 'calendar-group-header';
            gHeader.textContent = title;
            staffListDiv.appendChild(gHeader);
            
            list.forEach(staff => {
                onDutyCount++;
                const item = document.createElement('div');
                item.className = 'calendar-staff-item';
                
                // 左側: 名前と階級・所属情報
                const leftDiv = document.createElement('div');
                leftDiv.className = 'calendar-staff-left';
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'calendar-staff-item-name';
                nameSpan.textContent = staff.name;
                leftDiv.appendChild(nameSpan);
                
                if (staff.isSupport) {
                    const supportBadge = document.createElement('span');
                    supportBadge.className = 'badge-support';
                    supportBadge.style.fontSize = '7px';
                    supportBadge.style.padding = '1px 3px';
                    supportBadge.style.marginLeft = '2px';
                    supportBadge.textContent = `応援:${staff.origin}`;
                    leftDiv.appendChild(supportBadge);
                }
                
                item.appendChild(leftDiv);
                
                // 右側: 資格アイコン
                const qualsDiv = document.createElement('div');
                qualsDiv.className = 'calendar-staff-quals';
                
                if (staff.hasLargeLicense) {
                    const qBadge = document.createElement('span');
                    qBadge.className = 'qual-badge qual-badge-large';
                    qBadge.textContent = '大';
                    qBadge.title = '大型免許';
                    qualsDiv.appendChild(qBadge);
                }
                if (staff.isParamedic) {
                    const qBadge = document.createElement('span');
                    qBadge.className = 'qual-badge qual-badge-paramedic';
                    qBadge.textContent = '救';
                    qBadge.title = '救急救命士';
                    qualsDiv.appendChild(qBadge);
                }
                if (staff.isRescue) {
                    const qBadge = document.createElement('span');
                    qBadge.className = 'qual-badge qual-badge-rescue';
                    qBadge.textContent = 'R';
                    qBadge.title = '救助隊員';
                    qualsDiv.appendChild(qBadge);
                }
                if (staff.isKikan) {
                    const qBadge = document.createElement('span');
                    qBadge.className = 'qual-badge qual-badge-kikan';
                    qBadge.textContent = '機';
                    qBadge.title = '機関員指定';
                    qualsDiv.appendChild(qBadge);
                }
                
                item.appendChild(qualsDiv);
                staffListDiv.appendChild(item);
            });
        };
        
        appendGroup('司令補以上', group1);
        appendGroup('士長', group2);
        appendGroup('副士長・消防士', group3);
        
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

// 時間文字列 "HH:MM" を分（00:00からの通算）に変換する
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
}

// 時間休の純労働（休止）時間を計算する
function calculateHourlyLeaveHours(startTimeStr, endTimeStr, isDayWorker) {
    if (!isDayWorker) {
        if (startTimeStr === "08:30" && endTimeStr === "17:15") {
            return 8.0;
        }
        if (startTimeStr === "17:15" && endTimeStr === "08:30") {
            return 8.0; // 7.5時間（7時間30分）ですが、30分以上切り上げルールにより8.0時間とします
        }
    }
    let startMins = parseTimeToMinutes(startTimeStr);
    let endMins = parseTimeToMinutes(endTimeStr);
    
    if (!isDayWorker) {
        // 隔日勤務者の場合、勤務開始は 08:30。
        // 08:30 より前の時間は翌日とみなす
        if (startMins < 510) {
            startMins += 24 * 60;
        }
        if (endMins < 510 || endMins <= startMins) {
            endMins += 24 * 60;
        }
    }
    
    // 勤務時間範囲にクランプする
    const workStart = 510; // 08:30
    const workEnd = isDayWorker ? 1050 : 1950; // 日勤は 17:30 (1050), 隔日は 08:30の翌日 (1950)
    
    const sClamped = Math.max(startMins, workStart);
    const eClamped = Math.min(endMins, workEnd);
    
    if (sClamped >= eClamped) {
        return 0;
    }
    
    const duration = eClamped - sClamped;
    
    // 休憩時間との重なりを計算
    let breakOverlap = 0;
    if (isDayWorker) {
        // 休憩: 12:00〜13:00
        const bStart = 720;
        const bEnd = 780;
        breakOverlap += Math.max(0, Math.min(eClamped, bEnd) - Math.max(sClamped, bStart));
    } else {
        // 休憩1: 12:00〜13:00
        const b1Start = 720;
        const b1End = 780;
        breakOverlap += Math.max(0, Math.min(eClamped, b1End) - Math.max(sClamped, b1Start));
        
        // 休憩2: 17:15〜17:45
        const b2Start = 1035;
        const b2End = 1065;
        breakOverlap += Math.max(0, Math.min(eClamped, b2End) - Math.max(sClamped, b2Start));
        
        // 休憩3: 22:00〜翌05:00
        const b3Start = 1320;
        const b3End = 1740;
        breakOverlap += Math.max(0, Math.min(eClamped, b3End) - Math.max(sClamped, b3Start));
    }
    
    const netMinutes = duration - breakOverlap;
    // 30分以上は切り上げ、30分未満は切り捨て（四捨五入）
    return Math.max(0, Math.round(netMinutes / 60));
}

function showShiftModal(staffId, staffName, dayIndex, isPreScheduling = false) {
    currentEditCell = { staffId, dayIndex, isPreScheduling };
    
    const activeStartDate = new Date(state.startDate);
    activeStartDate.setDate(state.startDate.getDate() + (state.activeCycle - 1) * 28);
    
    const date = new Date(activeStartDate);
    date.setDate(activeStartDate.getDate() + dayIndex);
    const holidayName = getJapaneseHoliday(date);
    const dateStr = `${date.getMonth()+1}/${date.getDate()}(${WEEKDAYS_JP[date.getDay()]})${holidayName ? '・' + holidayName : ''}`;
    
    const titlePrefix = isPreScheduling ? "事前指定シフトの設定" : "シフト変更";
    document.getElementById('modal-title').textContent = `${staffName} の${titlePrefix} - ${dateStr}`;
    
    // 開始日のラベル設定と、終了日入力欄のリセット
    document.getElementById('modal-start-day-label').textContent = dayIndex + 1;
    document.getElementById('modal-end-day-input').value = '';
    
    const modal = document.getElementById('shift-modal');
    modal.style.display = 'flex';
    
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

    const staff = state.staffList.find(s => s.id === staffId);
    const isDayWorker = staff ? staff.isDayWorker : false;

    // 時間休設定用の要素の取得とクローンによるイベントリスナーの初期化
    const saveBtn = document.getElementById('btn-modal-save');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    const clearBtnOrig = document.getElementById('btn-modal-clear');
    const newClearBtn = clearBtnOrig.cloneNode(true);
    clearBtnOrig.parentNode.replaceChild(newClearBtn, clearBtnOrig);

    const checkHourly = document.getElementById('check-hourly-leave');
    const newCheckHourly = checkHourly.cloneNode(true);
    checkHourly.parentNode.replaceChild(newCheckHourly, checkHourly);
    
    const inputStart = document.getElementById('modal-hourly-start');
    const newInputStart = inputStart.cloneNode(true);
    inputStart.parentNode.replaceChild(newInputStart, inputStart);
    
    const inputEnd = document.getElementById('modal-hourly-end');
    const newInputEnd = inputEnd.cloneNode(true);
    inputEnd.parentNode.replaceChild(newInputEnd, inputEnd);

    const hourlyInputs = document.getElementById('hourly-leave-inputs');
    const labelHours = document.getElementById('label-hourly-hours');
    const labelDays = document.getElementById('label-hourly-days');

    function updateDurationDisplay() {
        if (newCheckHourly.checked) {
            const startVal = newInputStart.value;
            const endVal = newInputEnd.value;
            const hrs = calculateHourlyLeaveHours(startVal, endVal, isDayWorker);
            labelHours.textContent = hrs;
            labelDays.textContent = (hrs / 8.0).toFixed(2);
        } else {
            labelHours.textContent = "0";
            labelDays.textContent = "0.00";
        }
    }

    newCheckHourly.addEventListener('change', () => {
        if (newCheckHourly.checked) {
            hourlyInputs.style.display = 'flex';
        } else {
            hourlyInputs.style.display = 'none';
        }
        updateDurationDisplay();
    });
    
    newInputStart.addEventListener('input', updateDurationDisplay);
    newInputEnd.addEventListener('input', updateDurationDisplay);

    // 保存されている時間休データの読み込み
    const hourlyKey = `${state.activeCycle}_${staffId}_${dayIndex}`;
    const savedHourly = state.hourlyLeaves[hourlyKey];
    if (savedHourly) {
        newCheckHourly.checked = true;
        hourlyInputs.style.display = 'flex';
        newInputStart.value = savedHourly.startTime || "08:30";
        newInputEnd.value = savedHourly.endTime || "17:15";
    } else {
        newCheckHourly.checked = false;
        hourlyInputs.style.display = 'none';
        newInputStart.value = "08:30";
        newInputEnd.value = "17:15";
    }
    updateDurationDisplay();

    // 初期選択中のシフトを設定
    let selectedShiftKey = null;
    const rosterKey = `${state.activeCycle}_${staffId}`;
    if (isPreScheduling) {
        selectedShiftKey = (state.hopeShifts[rosterKey] && state.hopeShifts[rosterKey][dayIndex]) || null;
    } else {
        selectedShiftKey = (state.roster[rosterKey] && state.roster[rosterKey][dayIndex]) || null;
    }

    // 年休なら時間休パネルを表示
    const hourlyConfig = document.getElementById('modal-hourly-config');
    if (selectedShiftKey === '有') {
        hourlyConfig.style.display = 'block';
    } else {
        hourlyConfig.style.display = 'none';
    }

    // シフトボタンの動的生成と紐付け
    const btnContainer = document.getElementById('modal-shift-buttons');
    btnContainer.innerHTML = '';
    
    state.shifts.forEach(shift => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-modal';
        if (selectedShiftKey === shift.key) {
            btn.classList.add('active');
        }
        btn.dataset.shift = shift.key;
        
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.style.backgroundColor = shift.color;
        badge.style.color = shift.textColor;
        badge.textContent = shift.char;
        
        btn.appendChild(badge);
        btn.appendChild(document.createTextNode(` ${shift.name}`));
        
        btn.addEventListener('click', () => {
            selectedShiftKey = shift.key;
            btnContainer.querySelectorAll('.btn-modal').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (selectedShiftKey === '有') {
                hourlyConfig.style.display = 'block';
                updateDurationDisplay();
            } else {
                hourlyConfig.style.display = 'none';
            }
        });
        
        btnContainer.appendChild(btn);
    });

    // 保存ボタンの動作
    newSaveBtn.addEventListener('click', async () => {
        if (!selectedShiftKey) {
            await showCustomAlert("シフトを選択してください。");
            return;
        }
        const { startDay, endDay } = getTargetRange();
        
        // 国民の祝日に年休を入れようとした場合の警告
        if (selectedShiftKey === '有') {
            let hasHoliday = false;
            for (let d = startDay; d <= endDay; d++) {
                const checkDate = new Date(activeStartDate);
                checkDate.setDate(activeStartDate.getDate() + d);
                if (getJapaneseHoliday(checkDate)) {
                    hasHoliday = true;
                    break;
                }
            }
            if (hasHoliday) {
                if (!(await showCustomConfirm("祝日です。年休取得しますか？"))) {
                    return;
                }
            }
        }
        
        for (let d = startDay; d <= endDay; d++) {
            if (isPreScheduling) {
                if (!state.hopeShifts[rosterKey]) {
                    state.hopeShifts[rosterKey] = {};
                }
                state.hopeShifts[rosterKey][d] = selectedShiftKey;
            } else {
                if (state.roster[rosterKey]) {
                    state.roster[rosterKey][d] = selectedShiftKey;
                }
            }
            
            const targetHourlyKey = `${state.activeCycle}_${staffId}_${d}`;
            if (selectedShiftKey === '有' && newCheckHourly.checked) {
                const startTime = newInputStart.value;
                const endTime = newInputEnd.value;
                const hours = calculateHourlyLeaveHours(startTime, endTime, isDayWorker);
                state.hourlyLeaves[targetHourlyKey] = { startTime, endTime, hours };
            } else {
                delete state.hourlyLeaves[targetHourlyKey];
            }
        }
        refreshUI();
        hideShiftModal();
    });

    // クリアボタンの動作
    newClearBtn.addEventListener('click', () => {
        const { startDay, endDay } = getTargetRange();
        
        for (let d = startDay; d <= endDay; d++) {
            if (isPreScheduling) {
                if (state.hopeShifts[rosterKey]) {
                    delete state.hopeShifts[rosterKey][d];
                }
            } else {
                if (state.roster[rosterKey]) {
                    state.roster[rosterKey][d] = '-';
                }
            }
            
            const targetHourlyKey = `${state.activeCycle}_${staffId}_${d}`;
            delete state.hourlyLeaves[targetHourlyKey];
        }
        refreshUI();
        hideShiftModal();
    });
}

function hideShiftModal() {
    document.getElementById('shift-modal').style.display = 'none';
}

function adjustStaffList() {
    const regularStaff = state.staffList.filter(s => !s.isSupport);
    const supportStaff = state.staffList.filter(s => s.isSupport);
    
    const currentP1 = regularStaff.filter(s => s.platoon === 1);
    const currentP2 = regularStaff.filter(s => s.platoon === 2);
    
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
                isRescue: def.rescue,
                isKikan: def.large || false,
                isDayWorker: false
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
                isRescue: def.rescue,
                isKikan: def.large || false,
                isDayWorker: false
            });
        }
    }
    
    state.staffList = [...newStaffList, ...supportStaff];
    
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

// 登録済み応援職員一覧テーブルの描画
function renderSupportTable() {
    const tbody = document.getElementById('support-list-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const supportStaff = state.staffList.filter(s => s.isSupport);
    
    if (supportStaff.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 7;
        cell.style.textAlign = 'center';
        cell.style.color = 'var(--text-muted)';
        cell.textContent = '登録されている応援職員はいません。';
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }
    
    supportStaff.forEach(s => {
        const row = document.createElement('tr');
        
        // 元所属
        const tdOrigin = document.createElement('td');
        tdOrigin.textContent = s.origin;
        row.appendChild(tdOrigin);
        
        // 氏名
        const tdName = document.createElement('td');
        tdName.style.fontWeight = '600';
        tdName.textContent = s.name;
        row.appendChild(tdName);
        
        // 補充先小隊
        const tdPlatoon = document.createElement('td');
        tdPlatoon.textContent = `第${s.platoon}小隊`;
        row.appendChild(tdPlatoon);
        
        // 階級
        const tdRank = document.createElement('td');
        tdRank.textContent = s.rank;
        row.appendChild(tdRank);
        
        // 資格
        const tdQuals = document.createElement('td');
        const quals = [];
        if (s.isParamedic) quals.push('救命士');
        if (s.hasLargeLicense) quals.push('大型');
        if (s.isRescue) quals.push('救助');
        if (s.isKikan) quals.push('機関員');
        tdQuals.textContent = quals.length > 0 ? quals.join('、') : 'なし';
        row.appendChild(tdQuals);
        
        // 期間
        const tdPeriod = document.createElement('td');
        tdPeriod.textContent = `${s.supportStart} 〜 ${s.supportEnd}`;
        row.appendChild(tdPeriod);
        
        // 操作 (削除ボタン)
        const tdAction = document.createElement('td');
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn btn-secondary';
        btnDelete.style.padding = '4px 8px';
        btnDelete.style.fontSize = '12px';
        btnDelete.style.backgroundColor = '#fee2e2';
        btnDelete.style.color = '#dc2626';
        btnDelete.style.border = 'none';
        btnDelete.textContent = '削除';
        
        btnDelete.addEventListener('click', async () => {
            const confirmed = await showCustomConfirm(`応援職員「${s.name}」の登録を削除しますか？`);
            if (confirmed) {
                // リストから削除
                state.staffList = state.staffList.filter(staff => staff.id !== s.id);
                
                // 希望休とシフトからも削除
                for (let c = 1; c <= 13; c++) {
                    delete state.hopeShifts[`${c}_${s.id}`];
                    delete state.roster[`${c}_${s.id}`];
                }
                
                refreshUI();
                await showCustomAlert(`応援職員「${s.name}」を削除しました。`);
            }
        });
        
        tdAction.appendChild(btnDelete);
        row.appendChild(tdAction);
        
        tbody.appendChild(row);
    });
}

// ==========================================
// 車両配置（乗車割り当て）機能の実装
// ==========================================

// 日付の範囲制限
function clampDateToCycleRange(date) {
    if (!state.startDate) return date;
    const start = new Date(state.startDate);
    start.setHours(0,0,0,0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 13 * 28 - 1);
    
    if (date < start) return start;
    if (date > end) return end;
    return date;
}

// 日付からサイクルと日付インデックスを算出する
function getCycleAndDayFromDate(dateStr) {
    if (!state.startDate) return { cycle: 1, dayIndex: 0 };
    const date = new Date(dateStr);
    const start = new Date(state.startDate);
    start.setHours(0,0,0,0);
    date.setHours(0,0,0,0);
    
    const diffTime = date.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    let cycle = Math.floor(diffDays / 28) + 1;
    let dayIndex = diffDays % 28;
    if (dayIndex < 0) {
        dayIndex = (dayIndex + 28) % 28;
    }
    
    if (cycle < 1) cycle = 1;
    if (cycle > 13) cycle = 13;
    
    return { cycle, dayIndex };
}

// 車両の資格整合性チェック
function validateVehicle(vehicleName, assignments) {
    const warnings = [];
    const roles = {
        "指揮車": ["隊長", "隊員"],
        "ポンプ車": ["隊長", "機関員", "隊員1", "隊員2"],
        "救急車": ["隊長", "救命士", "機関員"],
        "救助工作車": ["隊長", "機関員", "隊員1", "隊員2"]
    }[vehicleName];
    
    if (!roles) return { status: "OK", warnings: [] };
    
    let hasEmpty = false;
    
    roles.forEach(role => {
        const staffId = assignments[role];
        if (!staffId) {
            hasEmpty = true;
        }
    });
    
    // 資格と機関員指定のチェック
    roles.forEach(role => {
        const staffId = assignments[role];
        if (!staffId) return;
        
        const staff = state.staffList.find(s => s.id === staffId);
        if (!staff) return;
        
        if (role === "機関員") {
            if (!staff.hasLargeLicense) {
                warnings.push(`${role}の${staff.name}は大型免許がありません`);
            }
            if (!staff.isKikan) {
                warnings.push(`${role}の${staff.name}は機関員指定がありません`);
            }
        }
        
        if (vehicleName === "救急車" && role === "救命士") {
            if (!staff.isParamedic) {
                warnings.push(`救命士の${staff.name}は救命士資格がありません`);
            }
        }
        
        if (vehicleName === "救助工作車" && (role === "隊員1" || role === "隊員2")) {
            if (!staff.isRescue) {
                warnings.push(`${role}の${staff.name}は救助隊員資格がありません`);
            }
        }
    });
    
    let status = "OK";
    if (warnings.length > 0) {
        status = "警告";
    } else if (hasEmpty) {
        status = "未完了";
    }
    
    return { status, warnings };
}

// 車両配置画面のレンダリング
function renderVehicleView() {
    let dateStr = document.getElementById('vehicle-date-select').value;
    if (!dateStr) {
        const activeStartDate = new Date(state.startDate);
        activeStartDate.setDate(state.startDate.getDate() + (state.activeCycle - 1) * 28);
        dateStr = activeStartDate.toISOString().split('T')[0];
        document.getElementById('vehicle-date-select').value = dateStr;
    }
    
    const { cycle, dayIndex } = getCycleAndDayFromDate(dateStr);
    const activePlatoon = (dayIndex % 2 === 0) ? 1 : 2;
    
    // 小隊ラベルの更新
    const platoonLabel = document.getElementById('vehicle-platoon-label');
    if (platoonLabel) {
        platoonLabel.textContent = `第${activePlatoon}小隊`;
    }
    
    // 出勤メンバーの抽出 (当日のシフトが「当」の職員)
    const onDutyStaff = [];
    sortStaffByRank(state.staffList).forEach(staff => {
        const key = `${cycle}_${staff.id}`;
        const shift = (state.roster[key] && state.roster[key][dayIndex]) || '-';
        if (shift === '当') {
            onDutyStaff.push(staff);
        }
    });
    
    // 出勤人数ラベルの更新
    const dutyCountEl = document.getElementById('vehicle-duty-count');
    if (dutyCountEl) {
        dutyCountEl.textContent = `${onDutyStaff.length}名`;
    }
    
    // すでに配置されている職員IDの収集
    const currentAssignment = state.vehicleAssignments[dateStr] || {};
    const assignedStaffIds = new Set();
    for (const vehicle in currentAssignment) {
        for (const role in currentAssignment[vehicle]) {
            const staffId = currentAssignment[vehicle][role];
            if (staffId) {
                assignedStaffIds.add(staffId);
            }
        }
    }
    
    // 左側: 出勤メンバー一覧の描画
    const staffListEl = document.getElementById('vehicle-staff-list');
    staffListEl.innerHTML = '';
    
    onDutyStaff.forEach(staff => {
        const item = document.createElement('div');
        item.className = 'vehicle-staff-item';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        item.style.padding = '8px 12px';
        item.style.border = '1px solid var(--border-color)';
        item.style.borderRadius = '6px';
        item.style.background = 'var(--bg-card)';
        item.style.fontSize = '13px';
        item.style.transition = 'all 0.2s';
        
        if (assignedStaffIds.has(staff.id)) {
            item.style.opacity = '0.4';
            item.style.background = 'var(--secondary-bg)';
        }
        
        // 名前と階級
        const nameArea = document.createElement('div');
        nameArea.style.display = 'flex';
        nameArea.style.alignItems = 'center';
        nameArea.style.gap = '8px';
        
        const rankBadge = document.createElement('span');
        rankBadge.className = 'staff-rank-badge';
        rankBadge.textContent = getRankAbbr(staff.rank);
        nameArea.appendChild(rankBadge);
        
        const nameSpan = document.createElement('span');
        nameSpan.style.fontWeight = '500';
        nameSpan.textContent = staff.name;
        nameArea.appendChild(nameSpan);
        
        if (staff.isSupport) {
            const supportBadge = document.createElement('span');
            supportBadge.className = 'badge-support';
            supportBadge.style.fontSize = '10px';
            supportBadge.style.padding = '1px 4px';
            supportBadge.textContent = `応援:${staff.origin}`;
            nameArea.appendChild(supportBadge);
        }
        
        item.appendChild(nameArea);
        
        // 資格バッジ
        const qualsArea = document.createElement('div');
        qualsArea.style.display = 'flex';
        qualsArea.style.gap = '4px';
        
        if (staff.hasLargeLicense) {
            const badge = document.createElement('span');
            badge.className = 'qual-badge qual-badge-large';
            badge.textContent = '大';
            badge.title = '大型免許';
            qualsArea.appendChild(badge);
        }
        if (staff.isParamedic) {
            const badge = document.createElement('span');
            badge.className = 'qual-badge qual-badge-paramedic';
            badge.textContent = '救';
            badge.title = '救急救命士';
            qualsArea.appendChild(badge);
        }
        if (staff.isRescue) {
            const badge = document.createElement('span');
            badge.className = 'qual-badge qual-badge-rescue';
            badge.textContent = 'R';
            badge.title = '救助隊員';
            qualsArea.appendChild(badge);
        }
        if (staff.isKikan) {
            const badge = document.createElement('span');
            badge.className = 'qual-badge qual-badge-kikan';
            badge.textContent = '機';
            badge.title = '機関員指定';
            qualsArea.appendChild(badge);
        }
        if (staff.isDayWorker) {
            const badge = document.createElement('span');
            badge.className = 'qual-badge qual-badge-dayworker';
            badge.textContent = '日';
            badge.title = '日勤者';
            qualsArea.appendChild(badge);
        }
        
        item.appendChild(qualsArea);
        staffListEl.appendChild(item);
    });
    
    // 各スロット（ドロップダウン）の選択肢を更新
    const selects = document.querySelectorAll('.vehicle-slot-select');
    selects.forEach(select => {
        const vehicle = select.dataset.vehicle;
        const role = select.dataset.role;
        
        select.innerHTML = '<option value="">-- 未指定 --</option>';
        
        onDutyStaff.forEach(staff => {
            const opt = document.createElement('option');
            opt.value = staff.id;
            opt.textContent = `[${getRankAbbr(staff.rank)}] ${staff.name}`;
            
            const quals = [];
            if (staff.isKikan) quals.push('機');
            if (staff.hasLargeLicense) quals.push('大');
            if (staff.isParamedic) quals.push('救');
            if (staff.isRescue) quals.push('R');
            if (quals.length > 0) {
                opt.textContent += ` (${quals.join(',')})`;
            }
            
            select.appendChild(opt);
        });
        
        let assignedId = (currentAssignment[vehicle] && currentAssignment[vehicle][role]) || "";
        
        // 出勤しているかチェックし、いなければアサインをクリアする
        const isOnDuty = onDutyStaff.some(s => s.id === assignedId);
        if (assignedId && !isOnDuty) {
            if (state.vehicleAssignments[dateStr] && state.vehicleAssignments[dateStr][vehicle]) {
                delete state.vehicleAssignments[dateStr][vehicle][role];
            }
            assignedId = "";
        }
        
        select.value = assignedId;
    });
    
    // 各車両カードのステータスバッジと警告文の更新
    const vehicleCards = document.querySelectorAll('.vehicle-card');
    const activeVehicles = state.deployedVehicles || ["指揮車", "ポンプ車", "救急車", "救助工作車"];
    
    vehicleCards.forEach(card => {
        const vehicleName = card.dataset.vehicle;
        const isDeployed = activeVehicles.includes(vehicleName);
        
        if (!isDeployed) {
            card.style.display = 'none';
            return;
        }
        card.style.display = 'block';
        
        const vehicleAssignments = currentAssignment[vehicleName] || {};
        
        const { status, warnings } = validateVehicle(vehicleName, vehicleAssignments);
        
        const statusBadge = card.querySelector('.vehicle-status-badge');
        if (statusBadge) {
            statusBadge.textContent = status;
            if (status === "OK") {
                statusBadge.style.background = '#10b981';
                statusBadge.style.color = '#ffffff';
            } else if (status === "未完了") {
                statusBadge.style.background = '#f59e0b';
                statusBadge.style.color = '#ffffff';
            } else {
                statusBadge.style.background = '#ef4444';
                statusBadge.style.color = '#ffffff';
            }
        }
        
        let warningsDiv = card.querySelector('.vehicle-warnings');
        if (!warningsDiv) {
            warningsDiv = document.createElement('div');
            warningsDiv.className = 'vehicle-warnings';
            warningsDiv.style.padding = '8px 12px';
            warningsDiv.style.fontSize = '11px';
            warningsDiv.style.color = '#ef4444';
            warningsDiv.style.borderTop = '1px solid var(--border-color)';
            warningsDiv.style.marginTop = '8px';
            warningsDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
            card.appendChild(warningsDiv);
        }
        
        if (warnings.length > 0) {
            warningsDiv.innerHTML = warnings.map(w => `⚠️ ${w}`).join('<br>');
            warningsDiv.style.display = 'block';
        } else {
            warningsDiv.innerHTML = '';
            warningsDiv.style.display = 'none';
        }
    });
}

// 車両配置イベントのバインド
function bindVehicleEvents() {
    // スロット（ドロップダウン）の変更
    document.querySelectorAll('.vehicle-slot-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const dateStr = document.getElementById('vehicle-date-select').value;
            if (!dateStr) return;
            
            const vehicle = e.target.dataset.vehicle;
            const role = e.target.dataset.role;
            const val = e.target.value;
            
            if (!state.vehicleAssignments[dateStr]) {
                state.vehicleAssignments[dateStr] = {};
            }
            if (!state.vehicleAssignments[dateStr][vehicle]) {
                state.vehicleAssignments[dateStr][vehicle] = {};
            }
            
            // 重複乗車を禁止する（同じ日に他の枠に登録されていればクリア）
            if (val) {
                const dayAssignments = state.vehicleAssignments[dateStr];
                for (const v in dayAssignments) {
                    for (const r in dayAssignments[v]) {
                        if (dayAssignments[v][r] === val && (v !== vehicle || r !== role)) {
                            dayAssignments[v][r] = "";
                        }
                    }
                }
            }
            
            state.vehicleAssignments[dateStr][vehicle][role] = val;
            renderVehicleView();
        });
    });
    
    // 日付選択の変更
    const dateSelect = document.getElementById('vehicle-date-select');
    if (dateSelect) {
        dateSelect.addEventListener('change', (e) => {
            let date = new Date(e.target.value);
            if (isNaN(date.getTime())) {
                date = new Date(state.startDate);
            }
            date = clampDateToCycleRange(date);
            const dateStr = date.toISOString().split('T')[0];
            e.target.value = dateStr;
            
            const { cycle, dayIndex } = getCycleAndDayFromDate(dateStr);
            if (state.activeCycle !== cycle) {
                state.activeCycle = cycle;
                document.getElementById('select-cycle').value = cycle;
                handleDateChange();
            }
            renderVehicleView();
        });
    }
    
    // 前日ボタン
    const btnPrev = document.getElementById('btn-vehicle-prev-day');
    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            const currentStr = document.getElementById('vehicle-date-select').value;
            if (!currentStr) return;
            let date = new Date(currentStr);
            date.setDate(date.getDate() - 1);
            date = clampDateToCycleRange(date);
            const dateStr = date.toISOString().split('T')[0];
            document.getElementById('vehicle-date-select').value = dateStr;
            
            const { cycle, dayIndex } = getCycleAndDayFromDate(dateStr);
            if (state.activeCycle !== cycle) {
                state.activeCycle = cycle;
                document.getElementById('select-cycle').value = cycle;
                handleDateChange();
            }
            renderVehicleView();
        });
    }
    
    // 翌日ボタン
    const btnNext = document.getElementById('btn-vehicle-next-day');
    if (btnNext) {
        btnNext.addEventListener('click', () => {
            const currentStr = document.getElementById('vehicle-date-select').value;
            if (!currentStr) return;
            let date = new Date(currentStr);
            date.setDate(date.getDate() + 1);
            date = clampDateToCycleRange(date);
            const dateStr = date.toISOString().split('T')[0];
            document.getElementById('vehicle-date-select').value = dateStr;
            
            const { cycle, dayIndex } = getCycleAndDayFromDate(dateStr);
            if (state.activeCycle !== cycle) {
                state.activeCycle = cycle;
                document.getElementById('select-cycle').value = cycle;
                handleDateChange();
            }
            renderVehicleView();
        });
    }
    
    // 配置初期化ボタン
    const btnClear = document.getElementById('btn-vehicle-clear');
    if (btnClear) {
        btnClear.addEventListener('click', async () => {
            const dateStr = document.getElementById('vehicle-date-select').value;
            if (!dateStr) return;
            
            const confirmed = await showCustomConfirm("本日の車両配置をすべて初期化しますか？");
            if (!confirmed) return;
            
            state.vehicleAssignments[dateStr] = {};
            renderVehicleView();
        });
    }
    
    // 前日コピーボタン
    const btnCopy = document.getElementById('btn-vehicle-copy-prev');
    if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
            const dateStr = document.getElementById('vehicle-date-select').value;
            if (!dateStr) return;
            
            let prevDate = new Date(dateStr);
            prevDate.setDate(prevDate.getDate() - 1);
            
            const start = new Date(state.startDate);
            start.setHours(0,0,0,0);
            if (prevDate < start) {
                await showCustomAlert("前日のデータが存在しません（開始日より前です）。");
                return;
            }
            
            const prevDateStr = prevDate.toISOString().split('T')[0];
            const prevAssignment = state.vehicleAssignments[prevDateStr];
            if (!prevAssignment || Object.keys(prevAssignment).length === 0) {
                await showCustomAlert("前日の車両配置データが存在しません。");
                return;
            }
            
            const { cycle, dayIndex } = getCycleAndDayFromDate(dateStr);
            const onDutyToday = new Set();
            state.staffList.forEach(staff => {
                const key = `${cycle}_${staff.id}`;
                const shift = (state.roster[key] && state.roster[key][dayIndex]) || '-';
                if (shift === '当') {
                    onDutyToday.add(staff.id);
                }
            });
            
            const newAssignment = {};
            let copyCount = 0;
            let skipCount = 0;
            
            for (const vehicle in prevAssignment) {
                newAssignment[vehicle] = {};
                for (const role in prevAssignment[vehicle]) {
                    const staffId = prevAssignment[vehicle][role];
                    if (staffId && onDutyToday.has(staffId)) {
                        newAssignment[vehicle][role] = staffId;
                        copyCount++;
                    } else if (staffId) {
                        newAssignment[vehicle][role] = "";
                        skipCount++;
                    }
                }
            }
            
            state.vehicleAssignments[dateStr] = newAssignment;
            renderVehicleView();
            
            if (skipCount > 0) {
                await showCustomAlert(`前日の配置をコピーしました。\n（本日は非番・休日の職員 ${skipCount} 名を除く ${copyCount} 名を配置しました）`);
            } else {
                await showCustomAlert("前日の配置をコピーしました。");
            }
        });
    }
    
    // AI提案ボタン
    const btnPropose = document.getElementById('btn-vehicle-ai-propose');
    if (btnPropose) {
        btnPropose.addEventListener('click', () => {
            const dateStr = document.getElementById('vehicle-date-select').value;
            if (!dateStr) return;
            suggestVehicleAssignments(dateStr);
        });
    }
    
    // 運用車両チェックボックスのイベントバインド
    bindVehicleCheckboxEvents();
}

// AI提案ロジックの実装
function suggestVehicleAssignments(dateStr) {
    const { cycle, dayIndex } = getCycleAndDayFromDate(dateStr);
    
    const onDutyStaff = [];
    state.staffList.forEach(staff => {
        const key = `${cycle}_${staff.id}`;
        const shift = (state.roster[key] && state.roster[key][dayIndex]) || '-';
        if (shift === '当') {
            onDutyStaff.push(staff);
        }
    });
    
    if (onDutyStaff.length === 0) {
        showCustomAlert("本日の出勤職員がいません。先に勤務表を自動生成してください。");
        return;
    }
    
    // 履歴データの集計（過去の全アサイン回数）
    const historyCounts = {}; // staffId -> vehicle -> role -> count
    for (const d in state.vehicleAssignments) {
        if (d === dateStr) continue; // 当日は集計から外す
        const dayAssign = state.vehicleAssignments[d];
        for (const vehicle in dayAssign) {
            for (const role in dayAssign[vehicle]) {
                const staffId = dayAssign[vehicle][role];
                if (!staffId) continue;
                
                if (!historyCounts[staffId]) historyCounts[staffId] = {};
                if (!historyCounts[staffId][vehicle]) historyCounts[staffId][vehicle] = {};
                if (!historyCounts[staffId][vehicle][role]) historyCounts[staffId][vehicle][role] = 0;
                
                historyCounts[staffId][vehicle][role]++;
            }
        }
    }
    
    // 配置スロットの優先順位リスト（厳しい制約・重要車両から順に貪欲配置）
    const activeVehicles = state.deployedVehicles || ["指揮車", "ポンプ車", "救急車", "救助工作車"];
    const prioritySlots = [
        { vehicle: "救急車", role: "救命士" },
        { vehicle: "救急車", role: "機関員" },
        { vehicle: "ポンプ車", role: "機関員" },
        { vehicle: "救助工作車", role: "機関員" },
        { vehicle: "救助工作車", role: "隊員1" },
        { vehicle: "救助工作車", role: "隊員2" },
        { vehicle: "指揮車", role: "隊長" },
        { vehicle: "ポンプ車", role: "隊長" },
        { vehicle: "救助工作車", role: "隊長" },
        { vehicle: "救急車", role: "隊長" },
        { vehicle: "指揮車", role: "隊員" },
        { vehicle: "ポンプ車", role: "隊員1" },
        { vehicle: "ポンプ車", role: "隊員2" }
    ].filter(slot => activeVehicles.includes(slot.vehicle));
    
    const assigned = {};
    const assignedStaffIds = new Set();
    
    const getRankVal = (rank) => RANK_ORDER[rank] || 5;
    
    prioritySlots.forEach(slot => {
        const { vehicle, role } = slot;
        
        let bestStaff = null;
        let maxScore = -999999;
        
        onDutyStaff.forEach(staff => {
            if (assignedStaffIds.has(staff.id)) return;
            
            let score = 0;
            
            // 資格・役割チェック (満たさない場合は候補から外す)
            if (role === "救命士") {
                if (!staff.isParamedic) return;
                score += 1000;
            }
            
            if (role === "機関員") {
                if (!staff.hasLargeLicense) return;
                score += 500;
                if (staff.isKikan) {
                    score += 500; // 機関員指定ありを優先
                }
            }
            
            if (vehicle === "救助工作車" && (role === "隊員1" || role === "隊員2")) {
                if (!staff.isRescue) return;
                score += 1000;
            }
            
            // 隊長スロット: 階級上位者を優先
            if (role === "隊長") {
                const rankVal = getRankVal(staff.rank);
                score += (6 - rankVal) * 100;
                
                if (vehicle === "指揮車") {
                    if (staff.rank === "消防司令") score += 200;
                    if (staff.rank === "消防司令補") score += 100;
                } else {
                    if (staff.rank === "消防司令補") score += 100;
                    if (staff.rank === "消防士長") score += 50;
                }
            }
            
            // 隊員スロット: 階級下位者を優先して上位者を隊長に残す
            if (role.startsWith("隊員")) {
                const rankVal = getRankVal(staff.rank);
                score += rankVal * 10;
            }
            
            // 過去の同一車両・同一役割のアサイン頻度をスコアに加算
            const histCount = (historyCounts[staff.id] && historyCounts[staff.id][vehicle] && historyCounts[staff.id][vehicle][role]) || 0;
            score += histCount * 50;
            
            if (score > maxScore) {
                maxScore = score;
                bestStaff = staff;
            }
        });
        
        if (bestStaff) {
            if (!assigned[vehicle]) assigned[vehicle] = {};
            assigned[vehicle][role] = bestStaff.id;
            assignedStaffIds.add(bestStaff.id);
        } else {
            if (!assigned[vehicle]) assigned[vehicle] = {};
            assigned[vehicle][role] = "";
        }
    });
    
    state.vehicleAssignments[dateStr] = assigned;
    renderVehicleView();
}

// ==========================================
// 署別配備車両カスタマイズ機能の追加ロジック
// ==========================================

// 署所名から配備車両のプリセットを設定する
function applyStationVehiclePreset(stationName) {
    const chkShiki = document.getElementById('chk-vehicle-shiki');
    const chkPump = document.getElementById('chk-vehicle-pump');
    const chkKyukyu = document.getElementById('chk-vehicle-kyukyu');
    const chkKyujo = document.getElementById('chk-vehicle-kyujo');
    
    if (!chkShiki || !chkPump || !chkKyukyu || !chkKyujo) return;
    
    const name = stationName.trim();
    if (name === "南署" || name === "南分署") {
        chkShiki.checked = false;
        chkPump.checked = true;
        chkKyukyu.checked = true;
        chkKyujo.checked = false;
    } else if (name === "北署" || name === "北分署") {
        chkShiki.checked = false;
        chkPump.checked = true;
        chkKyukyu.checked = false;
        chkKyujo.checked = true;
    } else {
        // 本署またはその他は全車両をチェック
        chkShiki.checked = true;
        chkPump.checked = true;
        chkKyukyu.checked = true;
        chkKyujo.checked = true;
    }
    updateDeployedVehiclesState();
}

// チェックボックスの選択状態から配備車両リストを更新する
function updateDeployedVehiclesState() {
    state.deployedVehicles = [];
    if (document.getElementById('chk-vehicle-shiki').checked) state.deployedVehicles.push("指揮車");
    if (document.getElementById('chk-vehicle-pump').checked) state.deployedVehicles.push("ポンプ車");
    if (document.getElementById('chk-vehicle-kyukyu').checked) state.deployedVehicles.push("救急車");
    if (document.getElementById('chk-vehicle-kyujo').checked) state.deployedVehicles.push("救助工作車");
}

// 配備車両リストからチェックボックスの選択状態を同期する
function syncDeployedVehiclesCheckboxes() {
    const list = state.deployedVehicles || ["指揮車", "ポンプ車", "救急車", "救助工作車"];
    const chkShiki = document.getElementById('chk-vehicle-shiki');
    const chkPump = document.getElementById('chk-vehicle-pump');
    const chkKyukyu = document.getElementById('chk-vehicle-kyukyu');
    const chkKyujo = document.getElementById('chk-vehicle-kyujo');
    
    if (chkShiki) chkShiki.checked = list.includes("指揮車");
    if (chkPump) chkPump.checked = list.includes("ポンプ車");
    if (chkKyukyu) chkKyukyu.checked = list.includes("救急車");
    if (chkKyujo) chkKyujo.checked = list.includes("救助工作車");
}

// 運用車両チェックボックスの変更イベントを監視する
function bindVehicleCheckboxEvents() {
    ['shiki', 'pump', 'kyukyu', 'kyujo'].forEach(id => {
        const chk = document.getElementById(`chk-vehicle-${id}`);
        if (chk) {
            chk.addEventListener('change', () => {
                updateDeployedVehiclesState();
                
                // 無効化された車両の割り当てをクリア
                const dateStr = document.getElementById('vehicle-date-select').value;
                if (dateStr && state.vehicleAssignments[dateStr]) {
                    const activeVehicles = state.deployedVehicles;
                    for (const vehicleName in state.vehicleAssignments[dateStr]) {
                        if (!activeVehicles.includes(vehicleName)) {
                            state.vehicleAssignments[dateStr][vehicleName] = {};
                        }
                    }
                }
                
                renderVehicleView();
            });
        }
    });
}
