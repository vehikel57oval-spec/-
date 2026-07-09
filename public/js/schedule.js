/**
 * 消防ポータルシステム 勤務スケジュール・自動作成モジュール (Schedule)
 */
const Schedule = (function() {

/**
 * 隔日勤務（24時間2交代）勤務表アプリ コントローラー
 */

// アプリケーション状態
const state = {
    vehicleSpecs: [],
    userRole: null,
    startDate: null,
    activeCycle: 1,
    station: "指宿消防署",
    stationId: 1,
    shifts: [],
    staffList: [],
    hopeShifts: {},
    roster: {},
    hourlyLeaves: {},
    warnings: [],
    activeTab: 'tab-list',
    activePlatoon: 1,
    platoonSize: 19,
    minStaffing: 11,
    minSubOfficer: 1,
    minLarge: 1,
    minParamedic: 1,
    minRescue: null,
    vehicleAssignments: {},
    deployedVehicles: [],
    isConfirmed: false,
    priorRoster: {}, // staffId -> array of 7 prior shifts
    viewPlatoon: 'both' // 表示する小隊 ('both', '1', '2')
};

const DEFAULT_VEHICLE_SPECS = [
    { name: "指揮車", roles: ["隊長", "隊員"], requiresLarge: false },
    { name: "タンク車", roles: ["隊長", "機関員", "隊員1", "隊員2"], requiresLarge: true },
    { name: "救急車1", roles: ["隊長", "機関員", "隊員"], requiresLarge: false },
    { name: "救急車2", roles: ["隊長", "機関員", "隊員"], requiresLarge: false },
    { name: "救助工作車", roles: ["隊長", "機関員", "隊員1", "隊員2"], requiresLarge: true },
    { name: "はしご車", roles: ["隊長", "機関員", "隊員"], requiresLarge: true },
    { name: "拠点機能車", roles: ["隊長", "機関員", "隊員"], requiresLarge: true },
    { name: "予備車", roles: ["隊長", "機関員", "隊員"], requiresLarge: false },
    { name: "卓上通信", roles: ["隊員"], requiresLarge: false },
    { name: "通信", roles: ["隊員1", "隊員2", "隊員3", "隊員4"], requiresLarge: false }
];

function loadVehicleSpecs() {
    const saved = localStorage.getItem('fire_dept_vehicle_specs');
    if (saved) {
        try {
            state.vehicleSpecs = JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse vehicle specs, resetting to default:', e);
            state.vehicleSpecs = JSON.parse(JSON.stringify(DEFAULT_VEHICLE_SPECS));
        }
    } else {
        state.vehicleSpecs = JSON.parse(JSON.stringify(DEFAULT_VEHICLE_SPECS));
    }
}

function saveVehicleSpecs() {
    localStorage.setItem('fire_dept_vehicle_specs', JSON.stringify(state.vehicleSpecs));
}

function getVehicleColor(name) {
    if (name.includes("指揮")) return "#4f46e5";
    if (name.includes("タンク") || name.includes("ポンプ")) return "#0284c7";
    if (name.includes("救急")) return "#db2777";
    if (name.includes("救助")) return "#ea580c";
    if (name.includes("はしご")) return "#dc2626";
    if (name.includes("拠点")) return "#0d9488";
    if (name.includes("予備")) return "#4b5563";
    if (name.includes("通信")) return "#7c3aed";
    return "#5b21b6";
}

function renderVehicleCheckboxes() {
    const container = document.getElementById('vehicle-checkboxes-container');
    if (!container) return;
    container.innerHTML = '';
    
    state.vehicleSpecs.forEach(spec => {
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '6px';
        label.style.cursor = 'pointer';
        label.style.fontWeight = '500';
        
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'vehicle-deploy-checkbox';
        chk.dataset.vehicle = spec.name;
        
        chk.addEventListener('change', () => {
            updateDeployedVehiclesStateFromDOM();
            
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
        
        label.appendChild(chk);
        label.appendChild(document.createTextNode(` ${spec.name}`));
        container.appendChild(label);
    });
}

function updateDeployedVehiclesStateFromDOM() {
    state.deployedVehicles = [];
    document.querySelectorAll('.vehicle-deploy-checkbox').forEach(chk => {
        if (chk.checked) {
            state.deployedVehicles.push(chk.dataset.vehicle);
        }
    });
}

function initVehicleConfigModal() {
    const btnSettings = document.getElementById('btn-vehicle-settings');
    const modal = document.getElementById('vehicle-config-modal');
    const btnCloseX = document.getElementById('btn-vehicle-modal-x');
    const btnCancel = document.getElementById('btn-vehicle-modal-cancel');
    const btnSave = document.getElementById('btn-vehicle-modal-save');
    const btnAddSpec = document.getElementById('btn-add-vehicle-spec');
    
    if (!modal) return;
    
    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            loadVehicleSpecs();
            renderVehicleConfigTable();
            modal.style.display = 'flex';
        });
    }
    
    if (btnCloseX) {
        btnCloseX.addEventListener('click', () => { modal.style.display = 'none'; });
    }
    if (btnCancel) {
        btnCancel.addEventListener('click', () => { modal.style.display = 'none'; });
    }
    
    if (btnAddSpec) {
        btnAddSpec.addEventListener('click', () => {
            const nameEl = document.getElementById('new-vehicle-name');
            const rolesEl = document.getElementById('new-vehicle-roles');
            const largeEl = document.getElementById('new-vehicle-large');
            
            const name = nameEl.value.trim();
            const rolesStr = rolesEl.value.trim();
            const requiresLarge = largeEl.checked;
            
            if (!name) {
                showCustomAlert("車両名を入力してください。");
                return;
            }
            if (state.vehicleSpecs.some(v => v.name === name)) {
                showCustomAlert("同名の車両が既に存在します。");
                return;
            }
            if (!rolesStr) {
                showCustomAlert("乗車役割をカンマ区切りで入力してください。");
                return;
            }
            
            const roles = rolesStr.split(',').map(r => r.trim()).filter(r => r.length > 0);
            if (roles.length === 0) {
                showCustomAlert("有効な乗車役割がありません。");
                return;
            }
            
            state.vehicleSpecs.push({ name, roles, requiresLarge });
            nameEl.value = '';
            rolesEl.value = '';
            largeEl.checked = false;
            renderVehicleConfigTable();
        });
    }
    
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            saveVehicleSpecs();
            modal.style.display = 'none';
            renderVehicleCheckboxes();
            
            const specNames = state.vehicleSpecs.map(s => s.name);
            state.deployedVehicles = state.deployedVehicles.filter(v => specNames.includes(v));
            syncDeployedVehiclesCheckboxes();
            renderVehicleView();
        });
    }
}

function initMemberConfigModal() {
    const modal = document.getElementById('member-config-modal');
    const btnCloseX = document.getElementById('btn-member-modal-x');
    const btnClose = document.getElementById('btn-member-modal-close');
    const tab1 = document.getElementById('modal-btn-platoon-1');
    const tab2 = document.getElementById('modal-btn-platoon-2');
    
    if (!modal) return;
    
    const trigger = document.getElementById('btn-open-member-modal');
    if (trigger) {
        trigger.addEventListener('click', () => {
            state.modalActivePlatoon = 1;
            if (tab1) tab1.classList.add('active');
            if (tab2) tab2.classList.remove('active');
            renderModalStaffTable(1);
            modal.style.display = 'flex';
        });
    }
    
    if (btnCloseX) {
        btnCloseX.addEventListener('click', () => { modal.style.display = 'none'; });
    }
    if (btnClose) {
        btnClose.addEventListener('click', () => { modal.style.display = 'none'; });
    }
    
    if (tab1) {
        tab1.addEventListener('click', () => {
            state.modalActivePlatoon = 1;
            tab1.classList.add('active');
            if (tab2) tab2.classList.remove('active');
            renderModalStaffTable(1);
        });
    }
    if (tab2) {
        tab2.addEventListener('click', () => {
            state.modalActivePlatoon = 2;
            tab2.classList.add('active');
            if (tab1) tab1.classList.remove('active');
            renderModalStaffTable(2);
        });
    }
}

function renderVehicleConfigTable() {
    const tbody = document.getElementById('vehicle-config-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    state.vehicleSpecs.forEach((spec, idx) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        
        const tdName = document.createElement('td');
        tdName.style.padding = '8px';
        tdName.style.fontWeight = '600';
        tdName.textContent = spec.name;
        tr.appendChild(tdName);
        
        const tdLarge = document.createElement('td');
        tdLarge.style.padding = '8px';
        tdLarge.style.textAlign = 'center';
        const chkLarge = document.createElement('input');
        chkLarge.type = 'checkbox';
        chkLarge.checked = spec.requiresLarge;
        chkLarge.addEventListener('change', (e) => {
            spec.requiresLarge = e.target.checked;
        });
        tdLarge.appendChild(chkLarge);
        tr.appendChild(tdLarge);
        
        const tdRoles = document.createElement('td');
        tdRoles.style.padding = '8px';
        tdRoles.style.color = 'var(--text-secondary)';
        tdRoles.textContent = spec.roles.join(', ');
        tr.appendChild(tdRoles);
        
        const tdAction = document.createElement('td');
        tdAction.style.padding = '8px';
        tdAction.style.textAlign = 'center';
        const btnDel = document.createElement('button');
        btnDel.className = 'btn btn-secondary';
        btnDel.style.padding = '2px 8px';
        btnDel.style.fontSize = '11px';
        btnDel.style.color = '#ef4444';
        btnDel.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        btnDel.style.backgroundColor = 'rgba(239, 68, 68, 0.02)';
        btnDel.textContent = '削除';
        btnDel.addEventListener('click', () => {
            state.vehicleSpecs.splice(idx, 1);
            renderVehicleConfigTable();
        });
        tdAction.appendChild(btnDel);
        tr.appendChild(tdAction);
        
        tbody.appendChild(tr);
    });
}

// ログイン・ログアウト処理
function loginAs(role) {
    state.userRole = role;
    
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app-layout');
    
    if (loginScreen) loginScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    
    if (role === 'viewer') {
        document.body.classList.add('role-viewer');
        // 閲覧モードの場合、事前指定や補充管理タブが開かれていたら勤務一覧に強制遷移
        if (state.activeTab === 'tab-hope' || state.activeTab === 'tab-support') {
            state.activeTab = 'tab-list';
            document.querySelectorAll('.view-tab-btn').forEach(btn => {
                if (btn.dataset.tab === 'tab-list') {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    } else {
        document.body.classList.remove('role-viewer');
    }
    
    refreshUI();
}

function logout() {
    state.userRole = null;
    
    // 残存するカスタムダイアログを全て除去
    document.querySelectorAll('.custom-dialog-overlay').forEach(el => el.remove());
    
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const errorMsg = document.getElementById('login-error-msg');
    
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (errorMsg) {
        errorMsg.style.display = 'none';
        errorMsg.textContent = '';
    }
    
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app-layout');
    
    // メインアプリを先に非表示にしてからログイン画面を表示
    if (mainApp) mainApp.style.display = 'none';
    if (loginScreen) {
        loginScreen.style.display = 'flex';
        // z-indexを確実に最前面にする
        loginScreen.style.zIndex = '9999';
    }
    
    document.body.classList.remove('role-viewer');
}

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
            let resolved = false;
            overlay.classList.remove('active');
            const finish = () => {
                if (resolved) return;
                resolved = true;
                overlay.remove();
                resolve();
            };
            overlay.addEventListener('transitionend', finish, { once: true });
            // transitionendが発火しない場合のフォールバック
            setTimeout(finish, 300);
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
        
        const closeDialog = (result) => {
            let resolved = false;
            overlay.classList.remove('active');
            const finish = () => {
                if (resolved) return;
                resolved = true;
                overlay.remove();
                resolve(result);
            };
            overlay.addEventListener('transitionend', finish, { once: true });
            // transitionendが発火しない場合のフォールバック
            setTimeout(finish, 300);
        };
        
        btnCancel.addEventListener('click', () => closeDialog(false));
        btnOk.addEventListener('click', () => closeDialog(true));
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
        
        const closePrompt = (result) => {
            let resolved = false;
            overlay.classList.remove('active');
            const finish = () => {
                if (resolved) return;
                resolved = true;
                overlay.remove();
                resolve(result);
            };
            overlay.addEventListener('transitionend', finish, { once: true });
            setTimeout(finish, 300);
        };
        
        btnCancel.addEventListener('click', () => closePrompt(null));
        
        btnOk.addEventListener('click', () => {
            closePrompt(input.value);
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

// 日付オブジェクトをローカルの YYYY-MM-DD 文字列に変換するヘルパー
function formatDateLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

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


// API経由での勤務データ読み込み
async function loadDataFromAPI() {
    try {
        const url = `/api/schedule/roster?station_id=${state.stationId}&start_date=${state.startDate}&cycle_number=${state.activeCycle}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${Auth.token}` }
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'データのロードに失敗しました。');
        }

        // 職員リスト
        state.staffList = (data.staff || []).map(s => {
            s.isRescue = ["救助隊", "救助副", "救助隊長", "小隊長", "主幹"].includes(s.position);
            return s;
        });
        state.deployedVehicles = data.deployedVehicles || [];
        state.vehicleAssignments = data.vehicleAssignments || {};
        
        state.roster = {};
        state.hopeShifts = data.hopeShifts || {};
        state.hourlyLeaves = {};
        state.isConfirmed = false;

        // 空データの初期化
        state.staffList.forEach(s => {
            const key = `${state.activeCycle}_${s.id}`;
            state.roster[key] = new Array(28).fill('-');
            if (!state.hopeShifts[key]) {
                state.hopeShifts[key] = {};
            }
        });

        // DBから取得したスケジュールエントリーの割り当て
        if (data.scheduleEntries && data.scheduleEntries.length > 0) {
            data.scheduleEntries.forEach(entry => {
                const staffId = entry.staff_id.toString();
                const { cycle, dayIndex } = getCycleAndDayFromDate(entry.work_date);
                
                if (cycle === state.activeCycle) {
                    const rosterKey = `${state.activeCycle}_${staffId}`;
                    if (state.roster[rosterKey]) {
                        state.roster[rosterKey][dayIndex] = entry.shift_key;
                        
                        if (entry.is_confirmed) {
                            state.isConfirmed = true;
                        }

                        if (entry.start_time && entry.end_time) {
                            const hourlyKey = `${state.activeCycle}_${staffId}_${dayIndex}`;
                            const staffMember = state.staffList.find(x => x.id === staffId);
                            const isDayWorker = staffMember ? !!staffMember.isDayWorker : false;
                            state.hourlyLeaves[hourlyKey] = {
                                startTime: entry.start_time,
                                endTime: entry.end_time,
                                hours: calculateHourlyLeaveHours(entry.start_time, entry.end_time, isDayWorker)
                            };
                        }
                    }
                }
            });
        } else {
            // 初期データがない場合は当務・日勤を交互に仮生成
            state.staffList.forEach(s => {
                const schedule = new Array(28);
                for (let d = 0; d < 28; d++) {
                    if (s.platoon === 1) {
                        schedule[d] = (d % 2 === 0) ? '当' : '明';
                    } else if (s.platoon === 2) {
                        schedule[d] = (d % 2 === 1) ? '当' : '明';
                    } else {
                        schedule[d] = '日';
                    }
                }
                state.roster[`${state.activeCycle}_${s.id}`] = schedule;
            });
        }

        // 稼働車両チェックボックスの同期
        syncDeployedVehiclesCheckboxes();

    } catch (err) {
        console.error('Error loading schedule roster:', err);
        Portal.showToast('勤務データの取得に失敗しました。', 'error');
    }
}

// 下書き保存APIの呼び出し
async function saveDraft() {
    const currentRoster = {};
    state.staffList.forEach(s => {
        const k = `${state.activeCycle}_${s.id}`;
        if (state.roster[k]) {
            currentRoster[s.id] = state.roster[k];
        }
    });

    const payload = {
        station_id: state.stationId,
        start_date: state.startDate,
        cycle_number: state.activeCycle,
        roster: currentRoster,
        deployedVehicles: state.deployedVehicles,
        vehicleAssignments: state.vehicleAssignments,
        hourlyLeaves: state.hourlyLeaves,
        staffList: state.staffList
    };

    try {
        const response = await fetch('/api/schedule/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Auth.token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('fire_dept_start_date', state.startDate);
            localStorage.setItem('fire_dept_cycle', state.activeCycle);
            Portal.showToast(data.message, 'success');
        } else {
            Portal.showToast(data.error, 'error');
        }
    } catch (err) {
        console.error('Save error:', err);
        Portal.showToast('通信エラーが発生しました。', 'error');
    }
}

// 名前付き下書き保存APIの呼び出し
async function saveDraftWithName(draftName) {
    const currentRoster = {};
    state.staffList.forEach(s => {
        const k = `${state.activeCycle}_${s.id}`;
        if (state.roster[k]) {
            currentRoster[s.id] = state.roster[k];
        }
    });

    const payload = {
        station_id: state.stationId,
        start_date: state.startDate,
        cycle_number: state.activeCycle,
        draft_name: draftName,
        roster: currentRoster,
        deployedVehicles: state.deployedVehicles,
        vehicleAssignments: state.vehicleAssignments,
        hourlyLeaves: state.hourlyLeaves,
        staffList: state.staffList,
        hopeShifts: state.hopeShifts
    };

    try {
        const response = await fetch('/api/schedule/drafts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Auth.token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok) {
            // 一時保存用データも自動更新して同期
            saveDraft();
            Portal.showToast(data.message, 'success');
        } else {
            Portal.showToast(data.error, 'error');
        }
    } catch (err) {
        console.error('Save draft error:', err);
        Portal.showToast('通信エラーが発生しました。', 'error');
    }
}

// 下書き履歴モーダルを開く
async function openDraftHistoryModal() {
    const modal = document.getElementById('modal-draft-history');
    if (!modal) return;

    const tbody = document.getElementById('draft-history-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-secondary);">読み込み中...</td></tr>';
    modal.style.display = 'flex';

    try {
        const url = `/api/schedule/drafts?station_id=${state.stationId}&start_date=${state.startDate}&cycle_number=${state.activeCycle}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${Auth.token}` }
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || '下書き一覧の取得に失敗しました。');
        }

        tbody.innerHTML = '';
        if (!data.drafts || data.drafts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-secondary);">保存された下書きはありません。</td></tr>';
            return;
        }

        data.drafts.forEach(draft => {
            const tr = document.createElement('tr');
            
            // 確定履歴であるかの判定
            const isConfirmed = draft.draft_name.startsWith('[確定履歴]');
            
            // 履歴名 / 分割バッジ
            const tdName = document.createElement('td');
            tdName.style.padding = '8px 12px';
            tdName.style.border = '1px solid var(--border-color)';
            tdName.style.textAlign = 'left';
            tdName.style.fontWeight = '500';
            
            let displayName = draft.draft_name;
            let badgeHTML = '';
            
            if (isConfirmed) {
                displayName = draft.draft_name.replace('[確定履歴]', '').trim();
                badgeHTML = `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:10px; padding:3px 8px; border-radius:4px; font-weight:600; margin-left:8px; vertical-align:middle; width:auto; height:auto; display:inline-flex; white-space:nowrap; box-shadow:none;">確定版</span>`;
            } else {
                badgeHTML = `<span class="badge badge-off" style="font-size:10px; padding:3px 8px; border-radius:4px; font-weight:600; margin-left:8px; vertical-align:middle; width:auto; height:auto; display:inline-flex; white-space:nowrap; box-shadow:none;">下書き</span>`;
            }
            
            tdName.innerHTML = `<span style="vertical-align:middle;">${displayName}</span>${badgeHTML}`;
            tr.appendChild(tdName);

            // 保存日時
            const tdTime = document.createElement('td');
            tdTime.style.padding = '8px 4px';
            tdTime.style.border = '1px solid var(--border-color)';
            tdTime.textContent = new Date(draft.created_at).toLocaleString('ja-JP');
            tr.appendChild(tdTime);

            // 保存者
            const tdUser = document.createElement('td');
            tdUser.style.padding = '8px 4px';
            tdUser.style.border = '1px solid var(--border-color)';
            tdUser.textContent = draft.created_by_name;
            tr.appendChild(tdUser);

            // 操作
            const tdAction = document.createElement('td');
            tdAction.style.padding = '8px 4px';
            tdAction.style.border = '1px solid var(--border-color)';
            tdAction.style.display = 'flex';
            tdAction.style.justifyContent = 'center';
            tdAction.style.gap = '8px';

            const btnLoad = document.createElement('button');
            btnLoad.className = 'btn btn-primary';
            btnLoad.style.padding = '4px 10px';
            btnLoad.style.fontSize = '11px';
            btnLoad.textContent = '適用';
            btnLoad.addEventListener('click', () => {
                loadDraftData(draft.id, isConfirmed);
            });

            const btnDelete = document.createElement('button');
            btnDelete.className = 'btn btn-secondary';
            btnDelete.style.padding = '4px 10px';
            btnDelete.style.fontSize = '11px';
            btnDelete.style.color = 'var(--color-wday-sun)';
            btnDelete.style.borderColor = 'var(--border-color)';
            btnDelete.textContent = '削除';
            btnDelete.addEventListener('click', () => {
                deleteDraftData(draft.id, tr, isConfirmed);
            });

            tdAction.appendChild(btnLoad);
            tdAction.appendChild(btnDelete);
            tr.appendChild(tdAction);

            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--color-wday-sun);">エラー: ${err.message}</td></tr>`;
    }
}

// モーダルを閉じる
function closeDraftHistoryModal() {
    const modal = document.getElementById('modal-draft-history');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 特定の下書きをロードして適用
async function loadDraftData(draftId, isConfirmedHistory = false) {
    const msg = isConfirmedHistory
        ? '選択した確定履歴データを適用しますか？\n現在編集中のスケジュール・配置は上書きされます。'
        : '選択した下書きを読み込みますか？\n現在編集中のスケジュール・配置は上書きされます。';
    const confirmed = await showCustomConfirm(msg);
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/schedule/drafts/${draftId}`, {
            headers: { 'Authorization': `Bearer ${Auth.token}` }
        });
        const data = await response.json();

        if (!response.ok || !data.success || !data.draft) {
            throw new Error(data.error || '下書きデータの取得に失敗しました。');
        }

        const draft = data.draft;

        // データの適用
        state.staffList = (draft.staffList || []).map(s => {
            s.isRescue = ["救助隊", "救助副", "救助隊長", "小隊長", "主幹"].includes(s.position);
            return s;
        });
        state.deployedVehicles = draft.deployedVehicles || [];
        state.vehicleAssignments = draft.vehicleAssignments || {};
        state.hourlyLeaves = draft.hourlyLeaves || {};
        state.hopeShifts = draft.hopeShifts || {};
        
        // rosterのマッピング
        state.roster = {};
        if (draft.roster) {
            state.staffList.forEach(s => {
                const key = `${state.activeCycle}_${s.id}`;
                if (draft.roster[s.id]) {
                    state.roster[key] = draft.roster[s.id];
                } else {
                    state.roster[key] = new Array(28).fill('-');
                }
            });
        }

        // 画面の更新
        closeDraftHistoryModal();
        refreshUI();
        syncDeployedVehiclesCheckboxes();
        Portal.showToast(`下書き「${draft.draft_name}」を正常に適用しました。`, 'success');

    } catch (err) {
        console.error(err);
        await showCustomAlert(`下書きの適用に失敗しました: ${err.message}`);
    }
}

// 下書き・確定履歴の削除
async function deleteDraftData(draftId, rowElement, isConfirmedHistory = false) {
    const msg = isConfirmedHistory
        ? 'この確定履歴（自動バックアップ）データを削除してもよろしいですか？\n※過去に適用された本番確定版の履歴が失われます。'
        : 'この下書きを削除してもよろしいですか？';
    const confirmed = await showCustomConfirm(msg);
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/schedule/drafts/${draftId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${Auth.token}` }
        });
        const data = await response.json();

        if (response.ok) {
            rowElement.remove();
            Portal.showToast(data.message, 'success');
            
            // 下書きが一件もなくなったかチェック
            const tbody = document.getElementById('draft-history-table-body');
            if (tbody && tbody.children.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-secondary);">保存された下書きはありません。</td></tr>';
            }
        } else {
            Portal.showToast(data.error, 'error');
        }
    } catch (err) {
        console.error(err);
        Portal.showToast('通信エラーが発生しました。', 'error');
    }
}

// 勤務表確定APIの呼び出し
async function confirmSchedule() {
    const confirmed = await showCustomConfirm('このサイクルの勤務表を確定しますか？\n確定すると、各職員の出退勤予定レコードが自動的に生成されます。');
    if (!confirmed) return;

    const currentRoster = {};
    state.staffList.forEach(s => {
        const k = `${state.activeCycle}_${s.id}`;
        if (state.roster[k]) {
            currentRoster[s.id] = state.roster[k];
        }
    });

    const payload = {
        station_id: state.stationId,
        start_date: state.startDate,
        cycle_number: state.activeCycle,
        roster: currentRoster,
        deployedVehicles: state.deployedVehicles,
        vehicleAssignments: state.vehicleAssignments,
        hourlyLeaves: state.hourlyLeaves,
        staffList: state.staffList
    };

    try {
        const response = await fetch('/api/schedule/confirm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Auth.token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('fire_dept_start_date', state.startDate);
            localStorage.setItem('fire_dept_cycle', state.activeCycle);
            Portal.showToast(data.message, 'success');
            state.isConfirmed = true;
            refreshUI();
        } else {
            Portal.showToast(data.error, 'error');
        }
    } catch (err) {
        console.error('Confirm error:', err);
        Portal.showToast('通信エラーが発生しました。', 'error');
    }
}

// 勤務スケジュール確定解除 (再編集可能にする)
async function unconfirmSchedule() {
    const isConfirmed = await showCustomConfirm('確定を解除して編集可能に戻しますか？\n（未打刻の自動生成勤怠データは削除されます）');
    if (!isConfirmed) return;

    try {
        const payload = {
            station_id: state.stationId,
            start_date: state.startDate,
            cycle_number: state.activeCycle
        };

        const response = await fetch('/api/schedule/unconfirm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Auth.token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok) {
            Portal.showToast(data.message, 'success');
            state.isConfirmed = false;
            refreshUI();
        } else {
            Portal.showToast(data.error, 'error');
        }
    } catch (err) {
        console.error('Unconfirm error:', err);
        Portal.showToast('通信エラーが発生しました。', 'error');
    }
}

// DOMの初期化と起動

async function render(container) {
    this.container = container;
    
    // HTMLの構築 (ヘッダー等を除き、メインのコンテナと時間休モーダルのみを挿入)
    container.innerHTML = `
        <div class="scheduler-toolbar no-print" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding:12px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md);">
            <div style="font-weight:600; font-size:16px; display:flex; align-items:center; gap:8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:20px; height:20px; color:var(--primary-color);">
                    <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke-linejoin="round"/>
                    <path d="M16 2V6M8 2V6M3 10H21" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M8 14H12V18H8V14Z" fill="currentColor"/>
                </svg>
                勤務スケジュール管理 (隔日勤務 2交代)
            </div>
            <div style="display:flex; gap:12px; align-items:center;">
                <button id="btn-toggle-settings" class="btn btn-secondary" style="font-size:13px; padding:6px 16px;">⚙️ 設定非表示</button>
                <button id="btn-history-drafts" class="btn btn-secondary admin-only" style="font-size:13px; padding:6px 16px;">📂 下書き・確定履歴</button>
                <button id="btn-save-draft" class="btn btn-secondary admin-only" style="font-size:13px; padding:6px 16px;">下書き保存</button>
                <button id="btn-confirm-schedule" class="btn btn-primary admin-only" style="font-size:13px; padding:6px 16px;">勤務表を確定</button>
            </div>
        </div>
        
        <div id="confirm-alert-banner" class="no-print" style="display:none; align-items:center; justify-content:space-between; padding:12px 16px; background:rgba(224, 242, 254, 0.9); border:1px solid #bae6fd; border-radius:var(--radius-md); margin-bottom:16px; color:#0369a1; font-size:13px; font-weight:500;">
            <div style="display:flex; align-items:center; gap:8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px; height:18px;">
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke-linejoin="round"/>
                    <path d="M12 8V12M12 16H12.01" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>このサイクルの勤務表は確定済み（本番反映中）です。勤務を変更・再編集するには確定を解除してください。</span>
            </div>
            <button id="btn-unconfirm-schedule" class="btn btn-danger admin-only" style="font-size:12px; padding:4px 12px; height:28px;">確定を解除して変更する</button>
        </div>
        
        <main class="app-container" style="margin-top:0; padding:0; display:flex; gap:20px; width:100%;">
            <!-- 設定パネル (サイドバー) -->
            <aside class="settings-sidebar no-print" style="flex: 0 0 280px; width: 280px; display:flex; flex-direction:column; gap:16px;">
                <section class="card settings-card" style="padding: 16px; display:flex; flex-direction:column; gap:12px; margin-bottom: 0;">
                    <h2 style="font-size:14px; border-bottom:1px solid var(--border-color); padding-bottom:6px; margin-bottom:0;">1. 基本設定</h2>
                    <div class="form-group">
                        <label class="form-label" style="font-size:11px; margin-bottom:4px;">所属署所</label>
                        <input type="text" class="form-control" id="input-station" value="" disabled style="font-size:12px; padding:4px 8px; height:28px; background:rgba(255,255,255,0.03);">
                    </div>
                    <div class="form-group">
                        <label class="form-label" style="font-size:11px; margin-bottom:4px;">小隊選択</label>
                        <select class="form-control" id="select-view-platoon" style="font-size:12px; padding:2px 8px; height:28px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">
                            <option value="both">両小隊 (すべて)</option>
                            <option value="1">${window.safeStorage.getItem('master_platoon_names') ? window.safeStorage.getItem('master_platoon_names').split(',')[0].trim() : '第 1 小隊'}</option>
                            <option value="2">${window.safeStorage.getItem('master_platoon_names') ? window.safeStorage.getItem('master_platoon_names').split(',')[1].trim() : '第 2 小隊'}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" style="font-size:11px; margin-bottom:4px;">起算日 (開始日)</label>
                        <input type="date" class="form-control" id="input-start-date" style="font-size:12px; padding:4px 8px; height:28px;">
                    </div>
                    <div class="form-group">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <label class="form-label" style="font-size:11px; margin-bottom:0;">表示サイクル</label>
                            <span id="label-cycle-range" style="font-size:11px; color:var(--text-secondary); font-weight:normal;"></span>
                        </div>
                        <select class="form-control" id="select-cycle" style="font-size:12px; padding:2px 8px; height:28px;">
                            ${[...Array(13)].map((_, i) => `<option value="${i+1}">第 ${i+1} サイクル</option>`).join('')}
                        </select>
                    </div>
                    <button id="btn-open-prior-roster" class="btn btn-secondary btn-block admin-only" style="margin-top: 4px; font-size: 11px; padding: 6px 12px; font-weight: 600; width: 100%; display: flex; justify-content: center; align-items: center; gap: 6px; margin-bottom: 8px;">
                        <span>📊 前月最終週の勤務入力</span>
                    </button>
                    <div class="form-group admin-only">
                        <label class="form-label" style="font-size:11px; margin-bottom:4px;">小隊定員数</label>
                        <input type="number" class="form-control" id="input-platoon-size" min="1" max="40" style="font-size:12px; padding:4px 8px; height:28px;">
                    </div>
                    <div class="form-group admin-only">
                        <label class="form-label" style="font-size:11px; margin-bottom:4px;">最低確保人員数</label>
                        <input type="number" class="form-control" id="input-min-staffing" min="1" max="40" style="font-size:12px; padding:4px 8px; height:28px;">
                    </div>
                    <div class="form-group admin-only">
                        <label class="form-label" style="font-size:11px; margin-bottom:4px;">最低確保 司令・補数</label>
                        <input type="number" class="form-control" id="input-min-subofficer" min="0" max="10" style="font-size:12px; padding:4px 8px; height:28px;">
                    </div>
                    <div class="form-group admin-only">
                        <label class="form-label" style="font-size:11px; margin-bottom:4px;">最低確保 大型免許数</label>
                        <input type="number" class="form-control" id="input-min-large" min="0" max="10" style="font-size:12px; padding:4px 8px; height:28px;">
                    </div>
                    <div class="form-group admin-only">
                        <label class="form-label" style="font-size:11px; margin-bottom:4px;">最低確保 救命士数</label>
                        <input type="number" class="form-control" id="input-min-paramedic" min="0" max="10" style="font-size:12px; padding:4px 8px; height:28px;">
                    </div>
                    <div class="form-group admin-only">
                        <label class="form-label" style="font-size:11px; margin-bottom:4px;">最低確保 救助隊員数</label>
                        <input type="number" class="form-control" id="input-min-rescue" min="0" max="10" placeholder="指定なし" style="font-size:12px; padding:4px 8px; height:28px;">
                    </div>
                    <div class="form-group admin-only" style="display: flex; align-items: center; gap: 8px; margin-top:4px; margin-bottom:0;">
                        <input type="checkbox" id="chk-auto-leave" style="width: 16px; height: 16px; cursor: pointer;">
                        <label class="form-label" for="chk-auto-leave" style="margin-bottom: 0; cursor: pointer; font-size:11px;">余剰日に年休を自動挿入（祝日・年末年始除く）</label>
                    </div>
                </section>

                <section class="card settings-card admin-only" style="padding: 16px; display:flex; flex-direction:column; gap:12px; margin-bottom:0;">
                    <h2 style="font-size:14px; border-bottom:1px solid var(--border-color); padding-bottom:6px; margin-bottom:0;">2. メンバー管理</h2>
                    <p style="font-size: 11px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 0;">小隊メンバーの資格・階級設定は、専用ダイアログから行います。</p>
                    <button id="btn-open-member-modal" class="btn btn-secondary btn-block" style="font-size: 12px; padding: 8px; font-weight: 600; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 6px;">
                        <span>👥 メンバー設定を開く</span>
                    </button>
                </section>

                <div class="action-buttons" style="display:flex; flex-direction:column; gap:10px;">
                    <button id="btn-generate" class="btn btn-primary btn-block admin-only" style="font-size:13px; padding:8px 12px; display:flex; justify-content:center; align-items:center; gap:8px;">
                        <span class="btn-text">勤務表を自動生成</span>
                        <span class="spinner" style="display: none; width:14px; height:14px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:spin 1s infinite linear;"></span>
                    </button>
                    <button id="btn-csv" class="btn btn-secondary btn-block" style="font-size:13px; padding:8px 12px;">CSVエクスポート</button>
                    <button id="btn-print" class="btn btn-secondary btn-block" style="font-size:13px; padding:8px 12px;">印刷プレビュー</button>
                </div>
            </aside>

            <!-- メイン表示領域 -->
            <div class="content-area" style="flex:1; display:flex; flex-direction:column; gap:16px; overflow-x:auto;">
                <div id="alert-container" class="alert-container no-print" style="display: none; border-radius:var(--radius-md); margin-bottom:0;">
                    <div class="alert-header">
                        <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <h3>勤務ルールの警告があります</h3>
                    </div>
                    <ul id="alert-list" class="alert-list"></ul>
                </div>

                <div class="view-tabs no-print" style="margin-bottom:0; display:flex; border-bottom:1px solid var(--border-color); padding-bottom:2px;">
                    <button class="view-tab-btn active" data-tab="tab-list">勤務一覧（編集・統計）</button>
                    <button class="view-tab-btn" data-tab="tab-calendar">カレンダー表示</button>
                    <button class="view-tab-btn admin-only" data-tab="tab-hope">事前指定（希望シフト）</button>
                    <button class="view-tab-btn admin-only" data-tab="tab-support">補充勤務</button>
                    <button class="view-tab-btn" data-tab="tab-vehicle">車両配置</button>
                    <button class="view-tab-btn admin-only" data-tab="tab-shifts">勤務形態設定</button>
                </div>

                <!-- タブ1: 勤務一覧表 -->
                <section id="tab-list" class="tab-content card active-tab" style="margin-bottom:0;">
                    <div class="tab-header">
                        <h2>勤務一覧（スプレッドシート型）</h2>
                        <p class="tab-description no-print">セルをクリックするとシフトを手動で変更できます。右端に各スタッフの勤務統計が表示されます。</p>
                    </div>
                    <div id="roster-tables-container" style="overflow-x:auto;"></div>
                    <div id="roster-legend" class="legend no-print" style="margin-top:16px;"></div>
                </section>

                <!-- タブ2: カレンダー表示 -->
                <section id="tab-calendar" class="tab-content card" style="margin-bottom:0;">
                    <div class="tab-header">
                        <h2>カレンダー表示</h2>
                        <p class="tab-description">28日サイクルのカレンダー表示です。</p>
                    </div>
                    <div id="calendar-view-container" style="overflow-x:auto;">
                        <div id="calendar-grid-container" class="calendar-layout"></div>
                    </div>
                </section>

                <!-- タブ3: 希望シフト -->
                <section id="tab-hope" class="tab-content card" style="margin-bottom:0;">
                    <div class="tab-header">
                        <h2>事前指定（希望シフト）</h2>
                        <p class="tab-description">自動生成前に優先させたい休みや勤務を指定します。</p>
                    </div>
                    <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
                        <button id="btn-clear-hope" class="btn btn-secondary" style="font-size:12px; padding:6px 12px;">希望指定を全クリア</button>
                    </div>
                    <div id="hope-tables-container" style="overflow-x:auto;"></div>
                </section>

                <!-- タブ4: 補充勤務 -->
                <section id="tab-support" class="tab-content card" style="margin-bottom:0;">
                    <div class="tab-header">
                        <h2>補充勤務管理</h2>
                        <p class="tab-description">他署からの応援職員や、交代制ではない日勤者を追加して勤務表に反映させます。</p>
                    </div>
                    <div class="support-layout" style="display:grid; grid-template-columns: 1fr 2.5fr; gap:20px;">
                        <div class="card-sub" style="padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                            <h3 style="font-size:14px; margin-bottom:12px;">応援職員の追加登録</h3>
                            <form id="form-add-support" style="display:flex; flex-direction:column; gap:12px;">
                                <div class="form-group">
                                    <label class="form-label" style="font-size:11px; margin-bottom:4px;">応援元所属</label>
                                    <input type="text" class="form-control" id="support-origin" placeholder="例: 頴娃分遣所" required style="font-size:12px; padding:4px 8px; height:28px;">
                                </div>
                                <div class="form-group">
                                    <label class="form-label" style="font-size:11px; margin-bottom:4px;">氏名</label>
                                    <input type="text" class="form-control" id="support-name" placeholder="例: 指宿 応太" required style="font-size:12px; padding:4px 8px; height:28px;">
                                </div>
                                <div class="form-group">
                                    <label class="form-label" style="font-size:11px; margin-bottom:4px;">所属小隊</label>
                                    <select class="form-control" id="support-platoon" style="font-size:12px; padding:2px 8px; height:28px;">
                                        <option value="1">${window.safeStorage.getItem('master_platoon_names') ? window.safeStorage.getItem('master_platoon_names').split(',')[0].trim() : '第1小隊'}</option>
                                        <option value="2">${window.safeStorage.getItem('master_platoon_names') ? window.safeStorage.getItem('master_platoon_names').split(',')[1].trim() : '第2小隊'}</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" style="font-size:11px; margin-bottom:4px;">階級</label>
                                    <select class="form-control" id="support-rank" style="font-size:12px; padding:2px 8px; height:28px;">
                                        <option value="消防士">消防士</option>
                                        <option value="消防副士長">消防副士長</option>
                                        <option value="消防士長">消防士長</option>
                                        <option value="消防司令補">消防司令補</option>
                                        <option value="消防司令">消防司令</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" style="font-size:11px; margin-bottom:4px;">隊</label>
                                    <select class="form-control" id="support-position" style="font-size:12px; padding:2px 8px; height:28px;">
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" style="font-size:11px; margin-bottom:4px;">資格設定</label>
                                    <div style="display:flex; flex-wrap:wrap; gap:8px;">
                                        <label style="display:flex; align-items:center; gap:4px; font-size:11px; cursor:pointer;"><input type="checkbox" id="support-large"> 大型</label>
                                        <label style="display:flex; align-items:center; gap:4px; font-size:11px; cursor:pointer;"><input type="checkbox" id="support-paramedic"> 救命士</label>
                                        <label style="display:flex; align-items:center; gap:4px; font-size:11px; cursor:pointer;"><input type="checkbox" id="support-kikan"> 機関員</label>
                                    </div>
                                </div>
                                <div style="display:flex; gap:8px;">
                                    <div class="form-group" style="flex:1;">
                                        <label class="form-label" style="font-size:11px; margin-bottom:4px;">応援開始日</label>
                                        <input type="date" class="form-control" id="support-start" required style="font-size:12px; padding:4px 8px; height:28px;">
                                    </div>
                                    <div class="form-group" style="flex:1;">
                                        <label class="form-label" style="font-size:11px; margin-bottom:4px;">応援終了日</label>
                                        <input type="date" class="form-control" id="support-end" required style="font-size:12px; padding:4px 8px; height:28px;">
                                    </div>
                                </div>
                                <button type="submit" class="btn btn-primary" style="margin-top:8px; font-size:12px; padding:6px;">登録</button>
                              </form>
                        </div>
                        <div class="card-sub" style="padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                            <h3 style="font-size:14px; margin-bottom:12px;">現在登録中の応援・補充リスト</h3>
                            <div class="table-responsive" style="overflow-x:auto;">
                                <table class="table" style="font-size:12px; width:100%; border-collapse:collapse;">
                                    <thead>
                                        <tr style="border-bottom:2px solid var(--border-color);">
                                            <th style="padding:8px; text-align:left;">元所属</th>
                                            <th style="padding:8px; text-align:left;">氏名</th>
                                            <th style="padding:8px; text-align:left;">補充先</th>
                                            <th style="padding:8px; text-align:left;">階級</th>
                                            <th style="padding:8px; text-align:left;">隊</th>
                                            <th style="padding:8px; text-align:left;">資格</th>
                                            <th style="padding:8px; text-align:left;">期間</th>
                                            <th style="padding:8px; text-align:center;">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody id="support-list-tbody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- タブ5: 車両配置 -->
                <section id="tab-vehicle" class="tab-content card" style="margin-bottom:0;">
                    <div class="tab-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 16px; flex-wrap:wrap; gap:12px;">
                        <div>
                            <h2>車両配置設定</h2>
                            <p class="tab-description" style="margin-bottom: 0;">日付ごとの各運用車両への乗車割り当てを行います。</p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap:wrap;">
                            <label class="form-label" style="margin-bottom: 0; font-size: 13px; font-weight: 600;">日付選択:</label>
                            <button id="btn-vehicle-prev-day" class="btn btn-secondary" style="padding: 4px 12px; font-size: 13px; height: 32px; cursor:pointer;">&lt; 前日</button>
                            <input type="date" class="form-control" id="vehicle-date-select" style="width: auto; padding: 4px 12px; height: 32px; font-size: 13px;">
                            <button id="btn-vehicle-next-day" class="btn btn-secondary" style="padding: 4px 12px; font-size: 13px; height: 32px; cursor:pointer;">翌日 &gt;</button>
                            <button id="btn-vehicle-copy-prev" class="btn btn-secondary admin-only" style="padding: 4px 12px; font-size: 13px; height: 32px; cursor:pointer;">前日の配置をコピー</button>
                            <button id="btn-vehicle-settings" class="btn btn-secondary admin-only" style="padding: 4px 12px; font-size: 13px; height: 32px; cursor:pointer;">⚙️ 車両設定</button>
                            <button id="btn-vehicle-suggest" class="btn btn-secondary admin-only" style="padding: 4px 12px; font-size: 13px; height: 32px; background-color: var(--primary-light); color: var(--primary-color); border-color: var(--primary-color); cursor:pointer;">自動配置提案</button>
                            <button id="btn-vehicle-clear" class="btn btn-secondary admin-only" style="padding: 4px 12px; font-size: 13px; height: 32px; color: var(--color-wday-sun); border-color: rgba(220, 38, 38, 0.2); background-color: rgba(220, 38, 38, 0.02); cursor:pointer;">配置初期化</button>
                        </div>
                    </div>

                    <div class="vehicle-view-layout" style="display: grid; grid-template-columns: 1.2fr 2fr; gap: 20px;">
                        <div class="card-sub" style="padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                            <h3 style="font-size: 14px; margin-bottom: 12px;">1. 運用車両の選択</h3>
                            <div class="vehicle-checkboxes" id="vehicle-checkboxes-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px;">
                                <!-- 動的に生成 -->
                            </div>

                            <h3 style="font-size: 14px; margin-top: 20px; margin-bottom: 12px;">2. 本日の出勤メンバー (<span id="vehicle-duty-count">0</span>名)</h3>
                            <div id="vehicle-duty-staff-list" class="duty-staff-list-box" style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 4px;"></div>
                        </div>

                        <div class="card-sub" style="padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                            <h3 style="font-size: 14px; margin-bottom: 12px;">3. 乗車割り当て</h3>
                            <div id="vehicle-cards-grid" class="vehicle-slots-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;">
                                <!-- 動的に生成 -->
                            </div>
                        </div>
                    </div>
                </section>

                <!-- タブ6: 勤務形態（シフト）の設定 -->
                <section id="tab-shifts" class="tab-content card" style="margin-bottom:0;">
                    <div class="tab-header">
                        <h2>勤務形態（シフト）の設定</h2>
                        <p class="tab-description">独自の勤務形態（シフト・休暇）を追加・編集・削除できます。</p>
                    </div>

                    <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 16px;">
                        <!-- 新規追加カード -->
                        <div class="card-sub" style="flex: 1; min-width: 300px; padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); background: var(--bg-card);">
                            <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; font-weight: 600;">＋ 新規勤務形態の追加</h3>
                            <div class="form-group" style="margin-bottom: 10px;">
                                <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">略称コード (1〜3文字)</label>
                                <input type="text" id="new-shift-key" class="form-control" placeholder="例: 夏" style="height: 32px; font-size: 12px; width: 100%;">
                            </div>
                            <div class="form-group" style="margin-bottom: 10px;">
                                <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">表示一文字 (1文字)</label>
                                <input type="text" id="new-shift-char" class="form-control" placeholder="例: 夏" style="height: 32px; font-size: 12px; width: 100%;">
                            </div>
                            <div class="form-group" style="margin-bottom: 10px;">
                                <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">正式名称 (説明)</label>
                                <input type="text" id="new-shift-name" class="form-control" placeholder="例: 夏季休暇" style="height: 32px; font-size: 12px; width: 100%;">
                            </div>
                            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                <div class="form-group" style="flex: 1;">
                                    <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">背景色</label>
                                    <input type="color" id="new-shift-color" value="#3b82f6" style="width: 100%; height: 32px; border: 1px solid var(--border-color); padding: 2px; border-radius: 4px; cursor: pointer;">
                                </div>
                                <div class="form-group" style="flex: 1;">
                                    <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">文字色</label>
                                    <input type="color" id="new-shift-textcolor" value="#ffffff" style="width: 100%; height: 32px; border: 1px solid var(--border-color); padding: 2px; border-radius: 4px; cursor: pointer;">
                                </div>
                            </div>
                            <div class="form-group" style="margin-bottom: 16px;">
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; font-weight: 600; user-select: none;">
                                    <input type="checkbox" id="new-shift-special" style="width: 16px; height: 16px; cursor: pointer; margin: 0;">
                                    特別休暇として扱う（年休とは別に集計）
                                </label>
                            </div>
                            <button id="btn-add-custom-shift" class="btn btn-primary btn-block" style="font-size: 12px; padding: 8px;">追加する</button>
                        </div>

                        <!-- 一覧リストカード -->
                        <div class="card-sub" style="flex: 2; min-width: 400px; padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); background: var(--bg-card);">
                            <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; font-weight: 600;">勤務形態一覧</h3>
                            <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px;">※システム定義 of 基本シフト（当・非・週・休）は削除・名前変更できません。</p>

                            <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                                <table class="roster-grid" style="width: max-content; min-width: 100%; font-size: 12px; border-collapse: collapse;">
                                    <thead>
                                        <tr>
                                            <th style="padding: 6px; font-size: 11px; text-align: left;">コード</th>
                                            <th style="padding: 6px; font-size: 11px; text-align: center; width: 60px;">表示</th>
                                            <th style="padding: 6px; font-size: 11px; text-align: left;">名称</th>
                                            <th style="padding: 6px; font-size: 11px; width: 60px; text-align: center;">背景色</th>
                                            <th style="padding: 6px; font-size: 11px; width: 60px; text-align: center;">文字色</th>
                                            <th style="padding: 6px; font-size: 11px; width: 90px; text-align: center;">特別休暇</th>
                                            <th style="padding: 6px; font-size: 11px; width: 60px; text-align: center;">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody id="shift-config-table-body">
                                        <!-- 動的に生成 -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    `;

    // 既存の時間休モーダルがあれば削除して再追加
    document.getElementById('shift-modal')?.remove();
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = `
        <div id="shift-modal" class="modal no-print" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 10000;">
            <div class="modal-content" style="background: var(--bg-card); padding: 24px; border-radius: var(--radius-lg); border: 1px solid var(--border-color); max-width: 440px; width: 100%; text-align: center; box-shadow: var(--shadow-lg);">
                <h4 id="modal-title" style="margin-top: 0; margin-bottom: 16px; font-size: 16px; font-weight: 600;">シフト変更</h4>
                
                <div class="modal-range-selector" style="display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 12px; flex-wrap: wrap;">
                    <span>適用期間:</span>
                    <span id="modal-start-day-label" style="font-weight: 600;">-</span>
                    <span>〜</span>
                    <select id="modal-end-day-select" class="form-input" style="width: auto; padding: 2px 4px; height: 26px; font-size: 12px; border-radius: 4px; border: 1px solid var(--border-color);"></select>
                    <label style="display: flex; align-items: center; gap: 4px; font-weight: 500; cursor: pointer; margin-left: 8px; user-select: none;">
                        <input type="checkbox" id="modal-all-cycle-check"> サイクル全期間
                    </label>
                </div>

                <div id="modal-shift-buttons" class="modal-buttons" style="margin-bottom: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                    <!-- 動的生成 -->
                </div>
                
                <div id="modal-hourly-config" style="display: none; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 12px; margin-bottom: 16px; font-size: 12px; text-align: left;">
                    <label style="display: flex; align-items: center; gap: 6px; font-weight: 600; margin-bottom: 8px; cursor: pointer;">
                        <input type="checkbox" id="check-hourly-leave"> 時間休を指定する
                    </label>
                    <div id="hourly-leave-inputs" style="display: none; flex-direction: column; gap: 8px; padding-left: 18px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span>開始:</span>
                            <input type="time" id="modal-hourly-start" value="08:30" class="form-control" style="width: auto; padding: 4px 8px; height: 26px; font-size: 12px;">
                            <span>終了:</span>
                            <input type="time" id="modal-hourly-end" value="17:15" class="form-control" style="width: auto; padding: 4px 8px; height: 26px; font-size: 12px;">
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                            実休止時間: <span id="label-hourly-hours" style="font-weight: bold; color: #dc2626;">0</span> 時間 
                            (年休消化: <span id="label-hourly-days" style="font-weight: bold; color: #dc2626;">0.00</span> 日)
                        </div>
                    </div>
                </div>

                <div class="modal-buttons" style="display: flex; flex-direction: column; gap: 8px;">
                    <button id="btn-modal-save" class="btn btn-primary" style="width: 100%; padding: 8px; font-size:13px;">保存</button>
                    <button id="btn-modal-clear" class="btn btn-modal" style="background-color: var(--secondary-bg); color: var(--color-wday-sun); border-color: var(--border-color); display: none; width: 100%; padding: 8px; font-size:13px;"><span class="badge" style="background-color: transparent; color: var(--color-wday-sun);">×</span> 指定を解除 (クリア)</button>
                    <button id="btn-modal-cancel" class="btn btn-secondary" style="width: 100%; padding: 8px; font-size:13px;">キャンセル</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv.firstElementChild);

    // 既存の車両設定モーダルがあれば削除して再追加
    document.getElementById('vehicle-config-modal')?.remove();
    const vehicleModalDiv = document.createElement('div');
    vehicleModalDiv.innerHTML = `
        <div id="vehicle-config-modal" class="modal no-print" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 9999;">
            <div class="modal-content" style="background: var(--bg-card); padding: 24px; border-radius: var(--radius-lg); border: 1px solid var(--border-color); max-width: 650px; width: 95%; max-height: 85%; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; box-shadow: var(--shadow-lg);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                    <h4 style="margin: 0; font-size: 16px; font-weight: 600;">車両・乗車要件設定</h4>
                    <button id="btn-vehicle-modal-x" style="background: transparent; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); line-height: 1;">&times;</button>
                </div>
                
                <div style="overflow-y: auto; flex: 1; min-height: 250px; display: flex; flex-direction: column; gap: 15px;">
                    <!-- 新規車両登録フォーム -->
                    <div style="background-color: var(--secondary-bg); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                        <h5 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600;">新規車両の追加</h5>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end;">
                            <div style="flex: 1; min-width: 150px;">
                                <label style="font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">車両名</label>
                                <input type="text" id="new-vehicle-name" class="form-control" placeholder="例: 指揮連絡車" style="width: 100%; height: 32px; padding: 4px 8px; font-size: 12px; border-radius: 4px; border: 1px solid var(--border-color);">
                            </div>
                            <div style="flex: 1.5; min-width: 200px;">
                                <label style="font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">乗車役割 (カンマ区切り)</label>
                                <input type="text" id="new-vehicle-roles" class="form-control" placeholder="例: 隊長,機関員,隊員" style="width: 100%; height: 32px; padding: 4px 8px; font-size: 12px; border-radius: 4px; border: 1px solid var(--border-color);">
                            </div>
                            <div style="display: flex; align-items: center; height: 32px; gap: 4px;">
                                <label style="font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; margin: 0; user-select: none;">
                                    <input type="checkbox" id="new-vehicle-large"> 大型免許必要
                                </label>
                            </div>
                            <button id="btn-add-vehicle-spec" class="btn btn-primary" style="height: 32px; padding: 0 12px; font-size: 12px;">追加</button>
                        </div>
                    </div>
                    
                    <!-- 車両設定一覧テーブル -->
                    <table class="roster-grid" style="width: max-content; min-width: 100%; font-size: 12px; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="text-align: left; padding: 8px;">車両名</th>
                                <th style="width: 100px; padding: 8px;">大型免許</th>
                                <th style="text-align: left; padding: 8px;">乗車役割 (編集不可)</th>
                                <th style="width: 70px; padding: 8px;">操作</th>
                            </tr>
                        </thead>
                        <tbody id="vehicle-config-table-body">
                            <!-- JSで動的に一覧を生成 -->
                        </tbody>
                    </table>
                </div>
                
                <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 8px;">
                    <button id="btn-vehicle-modal-cancel" class="btn btn-secondary" style="padding: 8px 20px; font-size: 13px;">キャンセル</button>
                    <button id="btn-vehicle-modal-save" class="btn btn-primary" style="padding: 8px 20px; font-size: 13px;">設定を保存・適用</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(vehicleModalDiv.firstElementChild);

    // 小隊メンバー資格・階級設定用モーダルの動的追加
    document.getElementById('member-config-modal')?.remove();
    const memberModalDiv = document.createElement('div');
    memberModalDiv.innerHTML = `
        <div id="member-config-modal" class="modal no-print" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 9999;">
            <div class="modal-content" style="background: var(--bg-card); padding: 24px; border-radius: var(--radius-lg); border: 1px solid var(--border-color); max-width: 760px; width: 95%; max-height: 85%; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; box-shadow: var(--shadow-lg);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                    <h4 style="margin: 0; font-size: 16px; font-weight: 600;">小隊メンバー資格・階級設定</h4>
                    <button id="btn-member-modal-x" style="background: transparent; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); line-height: 1;">&times;</button>
                </div>
                
                <div class="modal-platoon-tabs" style="display: flex; gap: 8px; background-color: var(--secondary-bg); padding: 4px; border-radius: var(--radius-sm);">
                    <button id="modal-btn-platoon-1" class="platoon-tab-btn active" style="flex: 1; border: none; background: transparent; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer; border-radius: 4px;">A日 (${window.safeStorage.getItem('master_platoon_names') ? window.safeStorage.getItem('master_platoon_names').split(',')[0].trim() : '第1小隊'})</button>
                    <button id="modal-btn-platoon-2" class="platoon-tab-btn" style="flex: 1; border: none; background: transparent; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer; border-radius: 4px;">B日 (${window.safeStorage.getItem('master_platoon_names') ? window.safeStorage.getItem('master_platoon_names').split(',')[1].trim() : '第2小隊'})</button>
                </div>
                
                <div style="overflow-y: auto; flex: 1; min-height: 250px;">
                    <table class="roster-grid" style="width: max-content; min-width: 100%; font-size: 12px; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="text-align: left; padding: 4px 6px; width: 110px;">氏名</th>
                                <th style="width: 110px; padding: 4px 6px;">階級</th>
                                <th style="width: 110px; padding: 4px 6px;">隊</th>
                                <th style="width: 70px; padding: 4px 6px; text-align: center;">大型</th>
                                <th style="width: 70px; padding: 4px 6px; text-align: center;">救命士</th>
                                <th style="width: 70px; padding: 4px 6px; text-align: center;">機関員</th>
                                <th style="width: 70px; padding: 4px 6px; text-align: center;">日勤</th>
                            </tr>
                        </thead>
                        <tbody id="modal-member-table-body">
                            <!-- JavaScriptで動的生成 -->
                        </tbody>
                    </table>
                </div>
                
                <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 8px;">
                    <button id="btn-member-modal-close" class="btn btn-primary" style="padding: 8px 20px; font-size: 13px;">閉じる</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(memberModalDiv.firstElementChild);

    // 移行期（前月最終週）の勤務実績入力用モーダルの動的追加
    document.getElementById('modal-prior-roster')?.remove();
    const priorModalDiv = document.createElement('div');
    priorModalDiv.innerHTML = `
        <div id="modal-prior-roster" class="modal no-print" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 9999;">
            <div class="modal-content" style="background: var(--bg-card); padding: 24px; border-radius: var(--radius-lg); border: 1px solid var(--border-color); max-width: 800px; width: 95%; max-height: 85%; display: flex; flex-direction: column; gap: 16px; box-shadow: var(--shadow-lg);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                    <h4 style="margin: 0; font-size: 16px; font-weight: 600;">📊 移行期（前月最終週）の勤務実績入力</h4>
                    <button id="btn-prior-modal-x" style="background: transparent; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); line-height: 1;">&times;</button>
                </div>
                <p style="margin: 0; font-size: 11px; color: var(--text-secondary); line-height: 1.4;">
                    起算日（開始日）の直近7日間における各メンバーの勤務状況を手入力してください。ここで設定した当番・非番・週休は、自動生成時の「連勤回数の上限（最長3日）」などの計算に反映されます。空欄の場合は通常の交代パターンで引き継がれます。
                </p>
                <div style="overflow-y: auto; flex: 1; min-height: 250px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                    <table class="roster-grid" style="width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed;">
                        <thead>
                            <tr style="background-color: var(--secondary-bg); position: sticky; top: 0; z-index: 10;">
                                <th style="text-align: left; padding: 8px 12px; width: 140px; position: sticky; left: 0; background-color: var(--secondary-bg); z-index: 11;">名前</th>
                                <th style="width: 60px; padding: 8px 4px; text-align: center;">小隊</th>
                                <th class="prior-date-header" style="width: 60px; padding: 8px 4px; text-align: center;">-</th>
                                <th class="prior-date-header" style="width: 60px; padding: 8px 4px; text-align: center;">-</th>
                                <th class="prior-date-header" style="width: 60px; padding: 8px 4px; text-align: center;">-</th>
                                <th class="prior-date-header" style="width: 60px; padding: 8px 4px; text-align: center;">-</th>
                                <th class="prior-date-header" style="width: 60px; padding: 8px 4px; text-align: center;">-</th>
                                <th class="prior-date-header" style="width: 60px; padding: 8px 4px; text-align: center;">-</th>
                                <th class="prior-date-header" style="width: 60px; padding: 8px 4px; text-align: center;">-</th>
                            </tr>
                        </thead>
                        <tbody id="prior-roster-table-body">
                            <!-- JavaScriptで動的生成 -->
                        </tbody>
                    </table>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 8px;">
                    <button id="btn-prior-modal-cancel" class="btn btn-secondary" style="padding: 8px 20px; font-size: 13px;">キャンセル</button>
                    <button id="btn-prior-modal-save" class="btn btn-primary" style="padding: 8px 20px; font-size: 13px;">設定を保存・適用</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(priorModalDiv.firstElementChild);

    // 下書き履歴用モーダルの動的追加
    document.getElementById('modal-draft-history')?.remove();
    const draftModalDiv = document.createElement('div');
    draftModalDiv.innerHTML = `
        <div id="modal-draft-history" class="modal no-print" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 9999;">
            <div class="modal-content" style="background: var(--bg-card); padding: 24px; border-radius: var(--radius-lg); border: 1px solid var(--border-color); max-width: 800px; width: 95%; max-height: 85%; display: flex; flex-direction: column; gap: 16px; box-shadow: var(--shadow-lg);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                    <h4 style="margin: 0; font-size: 16px; font-weight: 600;">📂 下書き・確定履歴一覧</h4>
                    <button id="btn-draft-modal-x" style="background: transparent; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); line-height: 1;">&times;</button>
                </div>
                <p style="margin: 0; font-size: 11px; color: var(--text-secondary); line-height: 1.4;">
                   一時保存された下書き、および確定完了時の自動バックアップ履歴の一覧です。「適用」をクリックすると、現在の勤務スケジュール・車両配置・事前指定等へデータを反映します。（現在編集中の内容は上書きされます）
                </p>
                <div style="overflow-y: auto; flex: 1; min-height: 250px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                    <table class="roster-grid" style="width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed;">
                        <thead>
                            <tr style="background-color: var(--secondary-bg); position: sticky; top: 0; z-index: 10;">
                                <th style="text-align: left; padding: 8px 12px; width: 220px;">履歴名 / 分類</th>
                                <th style="width: 140px; padding: 8px 4px; text-align: center;">保存日時</th>
                                <th style="width: 100px; padding: 8px 4px; text-align: center;">保存者</th>
                                <th style="width: 140px; padding: 8px 4px; text-align: center;">操作</th>
                            </tr>
                        </thead>
                        <tbody id="draft-history-table-body">
                            <!-- 動的生成 -->
                        </tbody>
                    </table>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 8px;">
                    <button id="btn-draft-modal-close" class="btn btn-secondary" style="padding: 8px 20px; font-size: 13px;">閉じる</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(draftModalDiv.firstElementChild);

    // 設定初期化
    initSettings();
    loadVehicleSpecs();
    renderVehicleCheckboxes();
    initVehicleConfigModal();
    initMemberConfigModal();
    
    // Authからユーザー情報を反映
    state.station = Auth.user.station_name;
    state.stationId = Auth.user.station_id;
    state.userRole = Auth.hasRole('chief', 'admin', 'sysadmin') ? 'admin' : 'viewer';

    // 起算日とサイクルの初期値 (保存された下書きの選択状態を復元)
    const savedStartDate = localStorage.getItem('fire_dept_start_date');
    const savedCycle = localStorage.getItem('fire_dept_cycle');
    
    state.startDate = savedStartDate || formatDateLocal(new Date());
    state.activeCycle = savedCycle ? parseInt(savedCycle, 10) : 1;

    document.getElementById('input-start-date').value = state.startDate;
    document.getElementById('select-cycle').value = state.activeCycle;
    document.getElementById('input-station').value = state.station;
    document.getElementById('select-view-platoon').value = state.viewPlatoon;

    // APIからデータロード
    await loadDataFromAPI();

    // イベントバインディング
    bindEvents();
    bindVehicleEvents();
    bindVehicleCheckboxEvents();

    // 閲覧モードの場合は入力欄などを無効化
    if (state.userRole !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        const setElDisabled = (id) => {
            const el = document.getElementById(id);
            if (el) el.disabled = true;
        };
        setElDisabled('input-start-date');
        setElDisabled('select-cycle');
        setElDisabled('chk-auto-leave');
    }

    // 初回描画
    refreshUI();
    handleDateChange(true);
}

// テーマ（ライト/ダーク）の初期化
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    const sunIcon = document.querySelector('#btn-theme-toggle .sun-icon');
    const moonIcon = document.querySelector('#btn-theme-toggle .moon-icon');
    if (!sunIcon || !moonIcon) return;
    if (theme === 'dark') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    }
}

function saveShiftsToStorage() {
    localStorage.setItem('fire_dept_shifts', JSON.stringify(state.shifts));
}

// 設定の初期化
function initSettings() {
    state.startDate = formatDateLocal(new Date());
    state.station = "指宿消防署";
    
    const saved = localStorage.getItem('fire_dept_shifts');
    if (saved) {
        try {
            state.shifts = JSON.parse(saved);
            // Migration: Add "日" (日勤) if missing
            if (!state.shifts.some(s => s.key === "日")) {
                const idx = state.shifts.findIndex(s => s.key === "明");
                const newShift = { key: "日", name: "日勤", char: "日", color: "#ccfbf1", textColor: "#0f766e", isSystem: true };
                if (idx !== -1) {
                    state.shifts.splice(idx + 1, 0, newShift);
                } else {
                    state.shifts.push(newShift);
                }
                saveShiftsToStorage();
            }
            return;
        } catch (e) {
            console.error('Failed to parse saved shifts:', e);
        }
    }

    state.shifts = [
        { key: "当", name: "勤務", char: "当", color: "#e0f2fe", textColor: "#0369a1", isSystem: true },
        { key: "明", name: "非番", char: "非", color: "#f3f4f6", textColor: "#4b5563", isSystem: true },
        { key: "日", name: "日勤", char: "日", color: "#ccfbf1", textColor: "#0f766e", isSystem: true },
        { key: "週", name: "週休", char: "週", color: "#fef3c7", textColor: "#d97706", isSystem: true },
        { key: "休", name: "休日", char: "休", color: "#fee2e2", textColor: "#dc2626", isSystem: true },
        { key: "有", name: "年休", char: "年", color: "#dcfce7", textColor: "#15803d" },
        { key: "公", name: "公休", char: "公", color: "#f3e8ff", textColor: "#6b21a8" },
        { key: "張", name: "出張", char: "張", color: "#e2f0fd", textColor: "#2563eb" },
        { key: "特", name: "特休", char: "特", color: "#fee2e2", textColor: "#dc2626", isSpecialLeave: true },
        { key: "病", name: "病休", char: "病", color: "#ffedd5", textColor: "#ea580c", isSpecialLeave: true }
    ];
    saveShiftsToStorage();
}

// デフォルトスタッフのロード
function loadDefaultStaff() {
    state.staffList = [];
    const stationName = state.station || "";
    
    if (stationName === "指宿消防署" || stationName === "山川開聞分遣所" || stationName === "頴娃分遣所") {
        let lastName = "指宿";
        if (stationName === "山川開聞分遣所") lastName = "山川";
        else if (stationName === "頴娃分遣所") lastName = "頴娃";
        
        const ranks = ["消防司令", "消防司令補", "消防士長", "消防副士長", "消防副士長", "消防士", "消防士", "消防士", "消防士", "消防士"];
        
        for (let i = 0; i < state.platoonSize; i++) {
            // 第1小隊
            let rank1 = ranks[i % ranks.length];
            if (i === 0) rank1 = "消防司令";
            else if (i === 1) rank1 = "消防司令補";
            else if (i === 2) rank1 = "消防士長";
            
            const isParamedic1 = (i === 1 || i === 3 || i === 6);
            const isRescue1 = (i === 2 || i === 4 || i === 7);
            const hasLargeLicense1 = (i === 0 || i === 1 || i === 2 || i === 5 || i === 8);
            
            state.staffList.push({
                id: `p1-${i+1}`,
                name: `${lastName} A太${i+1}`,
                platoon: 1,
                rank: rank1,
                hasLargeLicense: hasLargeLicense1,
                isParamedic: isParamedic1,
                isRescue: isRescue1,
                isKikan: hasLargeLicense1,
                isDayWorker: false
            });
            
            // 第2小隊
            let rank2 = ranks[i % ranks.length];
            if (i === 0) rank2 = "消防司令";
            else if (i === 1) rank2 = "消防司令補";
            else if (i === 2) rank2 = "消防士長";
            
            const isParamedic2 = (i === 2 || i === 4 || i === 6);
            const isRescue2 = (i === 1 || i === 3 || i === 7);
            const hasLargeLicense2 = (i === 0 || i === 1 || i === 3 || i === 5 || i === 8);
            
            state.staffList.push({
                id: `p2-${i+1}`,
                name: `${lastName} B介${i+1}`,
                platoon: 2,
                rank: rank2,
                hasLargeLicense: hasLargeLicense2,
                isParamedic: isParamedic2,
                isRescue: isRescue2,
                isKikan: hasLargeLicense2,
                isDayWorker: false
            });
        }
    } else {
        // 元のデフォルト名を使用
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

// ===================================================
// 年間（暦年）の累積年休取得日数を全サイクルから集計
// ===================================================
function getYearlyAnnualLeaveCounts(targetYear) {
    const counts = {};
    state.staffList.forEach(s => { counts[s.id] = 0; });

    Object.keys(state.roster).forEach(key => {
        // キー形式: "サイクル番号_職員ID"
        const underscoreIdx = key.indexOf('_');
        if (underscoreIdx === -1) return;
        const cycleNum = parseInt(key.slice(0, underscoreIdx));
        const staffId = key.slice(underscoreIdx + 1); // 文字列IDとして扱うため parseInt を削除
        if (isNaN(cycleNum)) return;

        // そのサイクルの開始日が対象年（暦年）に含まれるか確認
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

    return counts; // { staffId: 年間年休日数合計, ... }
}

// 余剰人員日への年休（有）自動割当ロジック
function adjustSurplusLeaves(cycleNum, platoonNum) {
    console.log(`=== adjustSurplusLeaves START (cycle: ${cycleNum}, platoon: ${platoonNum}) ===`);
    const minStaff = state.minStaffing;
    const minSub = state.minSubOfficer;
    const minLarge = state.minLarge;
    const minPara = state.minParamedic;
    const YEARLY_TARGET = 20; // 年間年休目標日数（上限）
    console.log(`Settings - minStaff: ${minStaff}, YEARLY_TARGET: ${YEARLY_TARGET}`);

    // このサイクルが属する暦年を取得
    const cycleStartDate = new Date(state.startDate);
    cycleStartDate.setDate(cycleStartDate.getDate() + (cycleNum - 1) * 28);
    const targetYear = cycleStartDate.getFullYear();

    // 年間累積年休カウント（全サイクル横断）を取得
    // ※ 現在処理中のサイクルはまだ確定していないため、state.rosterから取得する
    const yearlyCounts = getYearlyAnnualLeaveCounts(targetYear);
    console.log('Yearly annual leave counts:', yearlyCounts);

    // 祝日または年末年始かどうかの判定
    function isHolidayOrNewYear(dayIndex) {
        const activeStartDate = new Date(state.startDate);
        activeStartDate.setDate(activeStartDate.getDate() + (cycleNum - 1) * 28);
        
        const date = new Date(activeStartDate);
        date.setDate(activeStartDate.getDate() + dayIndex);
        
        // 祝日の判定
        const holidayName = getJapaneseHoliday(date);
        if (holidayName) return true;
        
        // 年末年始の判定 (12/29 〜 1/3)
        const month = date.getMonth() + 1;
        const day = date.getDate();
        if ((month === 12 && day >= 29) || (month === 1 && day <= 3)) {
            return true;
        }
        
        return false;
    }
    
    // 対象の正規職員リスト
    // ・応援職員を除く
    // ・指定小隊の職員
    // ・このサイクルで当番日「当」が1日以上ある職員
    // ・年間年休累積が年間目標（20日）に達していない職員のみ
    const targetStaff = state.staffList.filter(staff => {
        if (staff.isSupport) return false;
        if (staff.platoon !== platoonNum) return false;
        const key = `${cycleNum}_${staff.id}`;
        const schedule = state.roster[key] || [];
        if (!schedule.includes('当')) return false;
        // 年間上限チェック
        const currentYearly = yearlyCounts[staff.id] || 0;
        if (currentYearly >= YEARLY_TARGET) {
            console.log(`[Skip] ${staff.name}: Already reached yearly target (${currentYearly}/${YEARLY_TARGET} days)`);
            return false;
        }
        return true;
    });
    if (targetStaff.length === 0) {
        console.log(`No active staff for surplus leaves adjustment in platoon ${platoonNum}.`);
        return;
    }

    // 資格制約チェック関数
    function canTakeLeave(rosterState, staff, day) {
        const key = `${cycleNum}_${staff.id}`;
        if ((rosterState[key] && rosterState[key][day]) !== '当') {
            return false;
        }

        // 対象小隊のみカウント（全小隊合算では誤った余剰判定になるため）
        let onDuty = [];
        state.staffList.forEach(s => {
            if (s.platoon !== platoonNum) return; // 対象小隊以外を除外
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

    // 連休（週休・休暇隣接）回避チェック
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

    // 各日の余剰人員数計算
    function getDaySurplus(rosterState) {
        const surplus = [];
        for (let d = 0; d < 28; d++) {
            let onDutyCount = 0;
            state.staffList.forEach(s => {
                if (s.platoon !== platoonNum) return; // 対象小隊のみカウント
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

    // ================================================================
    // グリーディ割当ループ
    // 「全員取得できなければロールバック」方式を廃止。
    // 取得できる職員から順次割り当て、取得できない職員は
    // 次サイクルで年間累積が少ない分だけ自動的に優先される。
    // ================================================================
    const localYearlyCounts = { ...yearlyCounts }; // ループ内での更新用ローカルコピー
    const cycleAssignedCounts = {};
    state.staffList.forEach(s => { cycleAssignedCounts[s.id] = 0; });

    let workingRoster = JSON.parse(JSON.stringify(state.roster));
    let totalAssigned = 0;

    // 段階的キャップ (まずは全員1日を目指し、段階的に上限を引き上げていく)
    for (let limit = 1; limit <= 5; limit++) {
        let madeChangeInLimit = true;

        while (madeChangeInLimit) {
            madeChangeInLimit = false;

            // 現在の余剰人員を再計算
            const daySurplus = getDaySurplus(workingRoster);

            // 全候補ペア（職員×日）を収集
            const allCandidates = [];

            targetStaff.forEach(staff => {
                const currentYearly = localYearlyCounts[staff.id] || 0;
                if (currentYearly >= YEARLY_TARGET) return; // 年間上限到達はスキップ

                const currentCycleAssigned = cycleAssignedCounts[staff.id] || 0;
                if (currentCycleAssigned >= limit) return; // 今回の限界値に達している場合はスキップ

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
                        hasConsec // 連休フラグ（ソフト制約）
                    });
                }
            });

            if (allCandidates.length === 0) break;

            // 優先順位:
            // 1. 連休にならない日を優先（ソフト制約）
            // 2. このサイクルでの割当数が少ない職員を優先（均等化）
            // 3. 年間累積が少ない職員を優先（均等化）
            // 4. 余剰人員が多い日を優先（安全性）
            const nonConsec = allCandidates.filter(c => !c.hasConsec);
            const pool = nonConsec.length > 0 ? nonConsec : allCandidates;

            pool.sort((a, b) => {
                if (a.cycleAssigned !== b.cycleAssigned) return a.cycleAssigned - b.cycleAssigned;
                if (a.yearlyCount !== b.yearlyCount) return a.yearlyCount - b.yearlyCount;
                if (a.surplus !== b.surplus) return b.surplus - a.surplus;
                return Math.random() - 0.5; // タイブレーク
            });

            // 最優先候補を割り当て
            const best = pool[0];
            const key = `${cycleNum}_${best.staff.id}`;
            workingRoster[key][best.day] = '有';
            localYearlyCounts[best.staff.id] = (localYearlyCounts[best.staff.id] || 0) + (best.staff.isDayWorker ? 1.0 : 2.0);
            cycleAssignedCounts[best.staff.id] = (cycleAssignedCounts[best.staff.id] || 0) + 1;
            totalAssigned++;
            madeChangeInLimit = true;
            console.log(`Assigned '有' to ${best.staff.name} on Day ${best.day + 1} (cycle count: ${cycleAssignedCounts[best.staff.id]}, yearly total: ${localYearlyCounts[best.staff.id]}, limit: ${limit}, consecutive: ${best.hasConsec})`);
        }
    }

    console.log(`Total annual leaves assigned: ${totalAssigned}`);
    state.roster = workingRoster;
    console.log(`=== adjustSurplusLeaves END ===`);}

// 階級・資格の短縮名取得
function getRankAbbr(rank) {
    if (rank === "消防司令") return "司令";
    if (rank === "消防司令補") return "司補";
    if (rank === "消防士長") return "士長";
    if (rank === "消防副士長") return "副士";
    return "消防士";
}

function getPositionAbbr(pos) {
    if (pos === "小隊長") return "小隊";
    if (pos === "消防隊長") return "消隊";
    if (pos === "救急隊長") return "救隊";
    if (pos === "救助隊長") return "助隊";
    if (pos === "庶務経理") return "庶務";
    if (pos === "主幹") return "主幹";
    if (pos === "消防副") return "消副";
    if (pos === "救助副") return "助副";
    if (pos === "救急副") return "救副";
    if (pos === "消防隊") return "消隊";
    if (pos === "救急隊") return "救隊";
    if (pos === "救助隊") return "助隊";
    return pos || "";
}

function getPositionClass(pos) {
    if (["小隊長", "消防隊長", "消防副", "消防隊"].includes(pos)) return "pos-fire";
    if (["救急隊長", "救急副", "救急隊"].includes(pos)) return "pos-ambulance";
    if (["救助隊長", "救助副", "救助隊"].includes(pos)) return "pos-rescue";
    return "pos-general";
}

function getPositionOptions(rank) {
    if (rank === "消防司令" || rank === "消防司令補") {
        return ["", "小隊長", "消防隊長", "救急隊長", "救助隊長", "庶務経理", "主幹"];
    } else {
        return ["", "消防隊", "救急隊", "救助隊"];
    }
}

// モーダル用メンバー資格・階級テーブルの動的生成
function renderModalStaffTable(platoonNum) {
    const tbody = document.getElementById('modal-member-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filteredStaff = state.staffList.filter(s => !s.isSupport && s.platoon === platoonNum);

    filteredStaff.forEach(staff => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        
        // 1. 名前入力セル (職員管理から設定されるため読取専用)
        const tdName = document.createElement('td');
        tdName.style.padding = '6px 8px';
        const inputName = document.createElement('input');
        inputName.type = 'text';
        inputName.className = 'form-control';
        inputName.style.height = '28px';
        inputName.style.fontSize = '12px';
        inputName.style.padding = '2px 6px';
        inputName.style.width = '100%';
        inputName.value = staff.name;
        inputName.disabled = true;
        inputName.style.background = 'rgba(255,255,255,0.03)';
        inputName.style.cursor = 'default';
        tdName.appendChild(inputName);
        tr.appendChild(tdName);

        // 2. 階級選択セル
        const tdRank = document.createElement('td');
        tdRank.style.padding = '6px 8px';
        const selectRank = document.createElement('select');
        selectRank.className = 'form-control select-rank';
        selectRank.style.height = '28px';
        selectRank.style.fontSize = '12px';
        selectRank.style.padding = '2px 6px';
        selectRank.style.width = '100%';
        const ranks = ["消防司令", "消防司令補", "消防士長", "消防副士長", "消防士"];
        ranks.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            if (staff.rank === r) opt.selected = true;
            selectRank.appendChild(opt);
        });
        tdRank.appendChild(selectRank);
        tr.appendChild(tdRank);

        // 3. 役職・隊選択セル
        const tdPosition = document.createElement('td');
        tdPosition.style.padding = '6px 8px';
        const selectPosition = document.createElement('select');
        selectPosition.className = 'form-control select-position';
        selectPosition.style.height = '28px';
        selectPosition.style.fontSize = '12px';
        selectPosition.style.padding = '2px 6px';
        selectPosition.style.width = '100%';
        
        const updatePositionOptions = (selectedRank) => {
            selectPosition.innerHTML = '';
            const opts = getPositionOptions(selectedRank);
            opts.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p === "" ? "未選択" : p;
                if (staff.position === p) opt.selected = true;
                selectPosition.appendChild(opt);
            });
            if (!opts.includes(staff.position)) {
                staff.position = opts[0];
                selectPosition.value = opts[0];
            }
        };

        updatePositionOptions(staff.rank);

        selectRank.addEventListener('change', (e) => {
            staff.rank = e.target.value;
            updatePositionOptions(staff.rank);
            staff.isRescue = ["救助隊", "救助副", "救助隊長", "小隊長", "主幹"].includes(staff.position);
            refreshUI();
        });

        selectPosition.addEventListener('change', (e) => {
            staff.position = e.target.value;
            staff.isRescue = ["救助隊", "救助副", "救助隊長", "小隊長", "主幹"].includes(staff.position);
            refreshUI();
        });

        tdPosition.appendChild(selectPosition);
        tr.appendChild(tdPosition);

        // トグルボタン作成ヘルパー
        const createToggleBtnCell = (isActive, activeClass, text, title, toggleProp) => {
            const td = document.createElement('td');
            td.style.padding = '6px 8px';
            td.style.textAlign = 'center';
            const btn = document.createElement('span');
            const baseClass = activeClass.replace('active-', 'qual-');
            btn.className = `qual-btn ${baseClass} ${isActive ? activeClass : ''}`;
            btn.textContent = text;
            btn.title = title;
            btn.style.width = '28px';
            btn.style.height = '28px';
            btn.style.fontSize = '11px';
            btn.style.display = 'inline-flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', () => {
                staff[toggleProp] = !staff[toggleProp];
                btn.className = `qual-btn ${baseClass} ${staff[toggleProp] ? activeClass : ''}`;
                refreshUI();
            });
            td.appendChild(btn);
            return td;
        };

        // 4. 大型免許 (hasLargeLicense)
        tr.appendChild(createToggleBtnCell(staff.hasLargeLicense, 'active-large', '大', '大型免許', 'hasLargeLicense'));

        // 5. 救命士 (isParamedic)
        tr.appendChild(createToggleBtnCell(staff.isParamedic, 'active-paramedic', '救', '救急救命士', 'isParamedic'));

        // 6. 機関員 (isKikan)
        tr.appendChild(createToggleBtnCell(staff.isKikan, 'active-kikan', '機', '機関員', 'isKikan'));

        // 7. 日勤者 (isDayWorker)
        tr.appendChild(createToggleBtnCell(staff.isDayWorker, 'active-dayworker', '日', '日勤者', 'isDayWorker'));

        tbody.appendChild(tr);
    });
}

// スタッフ名・階級・資格入力欄の動的生成
function renderStaffInputs() {
    state.modalActivePlatoon = state.modalActivePlatoon || 1;
    renderModalStaffTable(state.modalActivePlatoon);
}

// 日付変更時の処理
async function handleDateChange(skipFetch = false) {
    const val = document.getElementById('input-start-date').value;
    if (!val) return;
    
    state.startDate = val;
    localStorage.setItem('fire_dept_start_date', val);
    
    if (skipFetch !== true) {
        await loadDataFromAPI();
    }
    
    // アクティブなサイクルの開始日と終了日を計算
    const activeStartDate = new Date(state.startDate);
    activeStartDate.setDate(activeStartDate.getDate() + (state.activeCycle - 1) * 28);
    
    const activeEndDate = new Date(activeStartDate);
    activeEndDate.setDate(activeStartDate.getDate() + 27);
    
    // UI表示更新
    const format = (d) => `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
    const rangeText = `${format(activeStartDate)} 〜 ${format(activeEndDate)}`;
    const labelRange = document.getElementById('label-cycle-range');
    if (labelRange) labelRange.textContent = rangeText;
    const printRange = document.getElementById('print-date-range');
    if (printRange) printRange.textContent = rangeText;
    
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
            opt.textContent = dateStr;
            regenSelect.appendChild(opt);
        }
        if (currentVal !== "" && parseInt(currentVal) < 28) {
            regenSelect.value = currentVal;
        } else {
            regenSelect.value = "0";
        }
    }
    updateGenerateButtonText();
    loadPriorRoster();
    
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
        const activeStartDate = new Date(state.startDate);
        activeStartDate.setDate(activeStartDate.getDate() + (state.activeCycle - 1) * 28);
        const regenDate = new Date(activeStartDate);
        regenDate.setDate(activeStartDate.getDate() + val);
        const dateLabel = `${regenDate.getMonth() + 1}/${regenDate.getDate()}`;
        btnText.textContent = `${dateLabel} 以降を再編成 (部分的再生成)`;
    }
}


// イベントリスナーの紐付け
function bindEvents() {
    // 小隊選択の変更
    const elSelectViewPlatoon = document.getElementById('select-view-platoon');
    if (elSelectViewPlatoon) {
        elSelectViewPlatoon.addEventListener('change', (e) => {
            state.viewPlatoon = e.target.value;
            refreshUI();
        });
    }

    // 署所名変更
    const elInputStation = document.getElementById('input-station');
    if (elInputStation) {
        elInputStation.addEventListener('change', (e) => {
            const stationName = e.target.value.trim() || "指宿消防署";
            state.station = stationName;
            updateStationTitle();
            applyStationVehiclePreset(stationName);
            
            // ユーザー指定のダミーデータ自動切替
            if (stationName === "指宿消防署") {
                state.platoonSize = 19;
                const elInputPlatoonSize = document.getElementById('input-platoon-size');
                if (elInputPlatoonSize) elInputPlatoonSize.value = 19;
                loadDefaultStaff();
                renderStaffInputs();
                generateEmptyRoster();
                refreshUI();
            } else if (stationName === "山川開聞分遣所" || stationName === "頴娃分遣所") {
                state.platoonSize = 9;
                const elInputPlatoonSize = document.getElementById('input-platoon-size');
                if (elInputPlatoonSize) elInputPlatoonSize.value = 9;
                loadDefaultStaff();
                renderStaffInputs();
                generateEmptyRoster();
                refreshUI();
            }
        });
    }

    // 新規シフト追加
    const elBtnAddCustomShift = document.getElementById('btn-add-custom-shift');
    if (elBtnAddCustomShift) {
        elBtnAddCustomShift.addEventListener('click', async () => {
            const keyInput = document.getElementById('new-shift-key');
            const charInput = document.getElementById('new-shift-char');
            const nameInput = document.getElementById('new-shift-name');
            const colorInput = document.getElementById('new-shift-color');
            const textColorInput = document.getElementById('new-shift-textcolor');
            const specialInput = document.getElementById('new-shift-special');
            
            if (!keyInput || !charInput || !nameInput) return;
            
            const key = keyInput.value.trim();
            const char = charInput.value.trim();
            const name = nameInput.value.trim();
            const color = colorInput ? colorInput.value : "#3b82f6";
            const textColor = textColorInput ? textColorInput.value : "#ffffff";
            const isSpecialLeave = specialInput ? specialInput.checked : false;
            
            if (key.length === 0 || char.length === 0 || name.length === 0) {
                await showCustomAlert("コード、表示文字、名称をすべて入力してください。");
                return;
            }
            if (char.length !== 1) {
                await showCustomAlert("表示文字は1文字で指定してください。");
                return;
            }
            if (key.length > 3) {
                await showCustomAlert("略称コードは3文字以内で指定してください。");
                return;
            }
            
            // 重複チェック
            if (state.shifts.some(s => s.key === key || s.char === char)) {
                await showCustomAlert("既に存在するコードまたは表示文字です。別のものを指定してください。");
                return;
            }
            
            state.shifts.push({
                key: key,
                name: name,
                char: char,
                color: color,
                textColor: textColor,
                isSpecialLeave: isSpecialLeave
            });
            
            saveShiftsToStorage();
            
            // 入力の初期化
            keyInput.value = '';
            charInput.value = '';
            nameInput.value = '';
            if (specialInput) specialInput.checked = false;
            
            // 再描画
            renderShiftConfigTable();
            renderLegend();
            refreshUI();
            
            if (typeof Portal !== 'undefined' && Portal.showToast) {
                Portal.showToast(`勤務形態「${name}」を追加しました。`, 'success');
            } else {
                await showCustomAlert(`勤務形態「${name}」を追加しました。`);
            }
        });
    }

    // テーマ切り替え
    const elBtnThemeToggle = document.getElementById('btn-theme-toggle');
    if (elBtnThemeToggle) {
        elBtnThemeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }
    
    // 起算日変更
    const elInputStartDate = document.getElementById('input-start-date');
    if (elInputStartDate) {
        elInputStartDate.addEventListener('change', handleDateChange);
    }

    // 応援職員の階級・隊連動
    const supportRank = document.getElementById('support-rank');
    const supportPosition = document.getElementById('support-position');
    if (supportRank && supportPosition) {
        const updateSupportPositionOptions = () => {
            const selectedRank = supportRank.value;
            supportPosition.innerHTML = '';
            const opts = getPositionOptions(selectedRank);
            opts.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p === "" ? "未選択" : p;
                supportPosition.appendChild(opt);
            });
        };
        supportRank.addEventListener('change', updateSupportPositionOptions);
        updateSupportPositionOptions();
    }

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
    
    // 最低確保 救助隊員数の変更
    document.getElementById('input-min-rescue').addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (e.target.value === '' || isNaN(val)) {
            state.minRescue = null;
            e.target.value = '';
        } else {
            if (val < 0) val = 0;
            if (val > 50) val = 50;
            e.target.value = val;
            state.minRescue = val;
        }
        refreshUI();
    });
    
    // 部分的自動生成の基準日変更時の文言更新
    const regenSelectElement = document.getElementById('select-regen-start-day');
    if (regenSelectElement) {
        regenSelectElement.addEventListener('change', updateGenerateButtonText);
    }
    

    
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
    const formSupport = document.getElementById('form-add-support');
    if (formSupport) {
        formSupport.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const origin = document.getElementById('support-origin').value.trim();
            const name = document.getElementById('support-name').value.trim();
            const platoon = parseInt(document.getElementById('support-platoon').value);
            const rank = document.getElementById('support-rank').value;
            const position = document.getElementById('support-position').value;
            const hasLarge = document.getElementById('support-large').checked;
            const isParamedic = document.getElementById('support-paramedic').checked;
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
            const isRescue = ["救助隊", "救助副", "救助隊長", "小隊長", "主幹"].includes(position);
            const newSupport = {
                id: supportStaffId,
                name: name,
                platoon: platoon,
                rank: rank,
                position: position,
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
                cycleStart.setDate(cycleStart.getDate() + (c - 1) * 28);
                
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
                            schedule[d] = '週';
                            state.hopeShifts[key][d] = '週';
                        }
                    } else {
                        // 期間外：すべて休み
                        schedule[d] = '週';
                        state.hopeShifts[key][d] = '週';
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

    // 設定パネル表示/非表示切り替え
    const elBtnToggleSettings = document.getElementById('btn-toggle-settings');
    if (elBtnToggleSettings) {
        // 初期状態の反映
        const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
        if (isCollapsed) {
            const container = document.querySelector('.app-container');
            if (container) container.classList.add('sidebar-collapsed');
            elBtnToggleSettings.textContent = '⚙️ 設定表示';
        }
        
        elBtnToggleSettings.addEventListener('click', () => {
            const container = document.querySelector('.app-container');
            if (container) {
                const collapsed = container.classList.toggle('sidebar-collapsed');
                localStorage.setItem('sidebar-collapsed', collapsed ? 'true' : 'false');
                elBtnToggleSettings.textContent = collapsed ? '⚙️ 設定表示' : '⚙️ 設定非表示';
            }
        });
    }

    // サイクル変更
    document.getElementById('select-cycle').addEventListener('change', async (e) => {
        state.activeCycle = parseInt(e.target.value);
        localStorage.setItem('fire_dept_cycle', state.activeCycle);
        await handleDateChange();
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
                activeStartDate.setDate(activeStartDate.getDate() + (state.activeCycle - 1) * 28);

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
                    } else if (state.priorRoster && state.priorRoster[s.id]) {
                        const prior = state.priorRoster[s.id];
                        if (s.platoon === 1) {
                            const checkIndices = [5, 3, 1];
                            for (let idx of checkIndices) {
                                if (prior[idx] === '当') {
                                    prevConsecutive++;
                                } else {
                                    break;
                                }
                            }
                        } else {
                            const checkIndices = [6, 4, 2, 0];
                            for (let idx of checkIndices) {
                                if (prior[idx] === '当') {
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

                const res = generateRoster(activeStartDate, staffListWithPrev, activeHopeShifts, state.minStaffing, state.minSubOfficer, state.minLarge, state.minParamedic, state.minRescue);
                if (res.success) {
                    // 生成結果をアクティブサイクルに格納
                    state.staffList.forEach(s => {
                        const key = `${state.activeCycle}_${s.id}`;
                        state.roster[key] = res.roster[s.id];
                    });
                    
                    // 余剰人員への休暇自動割り当てが有効な場合
                    const chkAutoLeave = document.getElementById('chk-auto-leave');
                    if (chkAutoLeave && chkAutoLeave.checked) {
                        adjustSurplusLeaves(state.activeCycle, 1);
                        adjustSurplusLeaves(state.activeCycle, 2);
                    }
                    
                    let msg = res.profileMessage;
                    if (regenStartDay > 0) {
                        const activeStartDate = new Date(state.startDate);
                        activeStartDate.setDate(activeStartDate.getDate() + (state.activeCycle - 1) * 28);
                        const regenStartValDate = new Date(activeStartDate);
                        regenStartValDate.setDate(activeStartDate.getDate() + regenStartDay);
                        const regenPrevValDate = new Date(activeStartDate);
                        regenPrevValDate.setDate(activeStartDate.getDate() + regenStartDay - 1);
                        const startLabel = `${activeStartDate.getMonth() + 1}/${activeStartDate.getDate()}`;
                        const prevLabel = `${regenPrevValDate.getMonth() + 1}/${regenPrevValDate.getDate()}`;
                        const regenLabel = `${regenStartValDate.getMonth() + 1}/${regenStartValDate.getDate()}`;
                        msg = `【部分的再生成完了】${regenLabel}以降を再編成しました（${startLabel}〜${prevLabel}は固定）。\n\n` + msg;
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
            activeStartDate.setDate(activeStartDate.getDate() + (state.activeCycle - 1) * 28);

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
    const elBtnExportJson = document.getElementById('btn-export-json');
    if (elBtnExportJson) {
        elBtnExportJson.addEventListener('click', () => {
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
                minRescue: state.minRescue,
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
    }

    // 設定読込 (全サイクル読込、古いフォーマットとの互換性マッピング付き)
    const elBtnImportJson = document.getElementById('btn-import-json');
    if (elBtnImportJson) {
        elBtnImportJson.addEventListener('click', () => {
            const elFileLoader = document.getElementById('file-loader');
            if (elFileLoader) elFileLoader.click();
        });
    }

    // 下書き保存 (データベースへの保存)
    const elBtnSaveDraft = document.getElementById('btn-save-draft');
    if (elBtnSaveDraft) {
        elBtnSaveDraft.addEventListener('click', async () => {
            const defaultName = `下書き (${new Date().toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })})`;
            const name = await showCustomPrompt("下書きの名称を入力してください:", defaultName);
            if (name === null) return; // キャンセル時
            const finalName = name.trim() || defaultName;
            saveDraftWithName(finalName);
        });
    }

    // 下書き履歴の呼び出し
    const elBtnHistoryDrafts = document.getElementById('btn-history-drafts');
    if (elBtnHistoryDrafts) {
        elBtnHistoryDrafts.addEventListener('click', openDraftHistoryModal);
    }
    const elBtnDraftX = document.getElementById('btn-draft-modal-x');
    if (elBtnDraftX) {
        elBtnDraftX.addEventListener('click', closeDraftHistoryModal);
    }
    const elBtnDraftClose = document.getElementById('btn-draft-modal-close');
    if (elBtnDraftClose) {
        elBtnDraftClose.addEventListener('click', closeDraftHistoryModal);
    }

    // 勤務表の確定
    const elBtnConfirmSchedule = document.getElementById('btn-confirm-schedule');
    if (elBtnConfirmSchedule) {
        elBtnConfirmSchedule.addEventListener('click', () => {
            confirmSchedule();
        });
    }
    
    const elBtnUnconfirmSchedule = document.getElementById('btn-unconfirm-schedule');
    if (elBtnUnconfirmSchedule) {
        elBtnUnconfirmSchedule.addEventListener('click', () => {
            unconfirmSchedule();
        });
    }
    
    const elFileLoader = document.getElementById('file-loader');
    if (elFileLoader) {
        elFileLoader.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async function(evt) {
                try {
                    const data = JSON.parse(evt.target.result);
                    if (data.startDate) {
                        const elInputStartDate = document.getElementById('input-start-date');
                        if (elInputStartDate) elInputStartDate.value = data.startDate;
                        state.startDate = data.startDate;
                    }
                    if (data.activeCycle) {
                        state.activeCycle = data.activeCycle;
                        const elSelectCycle = document.getElementById('select-cycle');
                        if (elSelectCycle) elSelectCycle.value = data.activeCycle;
                    } else {
                        state.activeCycle = 1;
                        const elSelectCycle = document.getElementById('select-cycle');
                        if (elSelectCycle) elSelectCycle.value = 1;
                    }
                    if (data.station) {
                        state.station = data.station;
                    } else {
                        state.station = "本署";
                    }
                    const elInputStation = document.getElementById('input-station');
                    if (elInputStation) elInputStation.value = state.station;
                    updateStationTitle();

                    if (data.shifts) {
                        state.shifts = data.shifts;
                    } else {
                        state.shifts = [
                            { key: "当", name: "勤務", char: "当", color: "#e0f2fe", textColor: "#0369a1", isSystem: true },
                            { key: "明", name: "非番", char: "非", color: "#f3f4f6", textColor: "#4b5563", isSystem: true },
                            { key: "日", name: "日勤", char: "日", color: "#ccfbf1", textColor: "#0f766e", isSystem: true },
                            { key: "週", name: "週休", char: "週", color: "#fef3c7", textColor: "#d97706", isSystem: true },
                            { key: "休", name: "休日", char: "休", color: "#fee2e2", textColor: "#dc2626", isSystem: true },
                            { key: "有", name: "年休", char: "年", color: "#dcfce7", textColor: "#15803d" },
                            { key: "公", name: "公休", char: "公", color: "#f3e8ff", textColor: "#6b21a8" },
                            { key: "張", name: "出張", char: "張", color: "#e2f0fd", textColor: "#2563eb" },
                            { key: "特", name: "特休", char: "特", color: "#fee2e2", textColor: "#dc2626", isSpecialLeave: true },
                            { key: "病", name: "病休", char: "病", color: "#ffedd5", textColor: "#ea580c", isSpecialLeave: true }
                        ];
                    }
                    saveShiftsToStorage();
                    renderShiftConfigTable();
                    renderLegend();

                    if (data.platoonSize) {
                        state.platoonSize = data.platoonSize;
                        const elInputPlatoonSize = document.getElementById('input-platoon-size');
                        if (elInputPlatoonSize) elInputPlatoonSize.value = data.platoonSize;
                    }
                    if (data.minStaffing) {
                        state.minStaffing = data.minStaffing;
                        const elInputMinStaffing = document.getElementById('input-min-staffing');
                        if (elInputMinStaffing) elInputMinStaffing.value = data.minStaffing;
                    }
                    
                    state.minSubOfficer = data.minSubOfficer !== undefined ? data.minSubOfficer : 1;
                    const elInputMinSubofficer = document.getElementById('input-min-subofficer');
                    if (elInputMinSubofficer) elInputMinSubofficer.value = state.minSubOfficer;
                    
                    state.minLarge = data.minLarge !== undefined ? data.minLarge : 1;
                    const elInputMinLarge = document.getElementById('input-min-large');
                    if (elInputMinLarge) elInputMinLarge.value = state.minLarge;
                    
                    state.minParamedic = data.minParamedic !== undefined ? data.minParamedic : 1;
                    const elInputMinParamedic = document.getElementById('input-min-paramedic');
                    if (elInputMinParamedic) elInputMinParamedic.value = state.minParamedic;
                    
                    state.minRescue = data.minRescue !== undefined ? data.minRescue : null;
                    const elInputMinRescue = document.getElementById('input-min-rescue');
                    if (elInputMinRescue) elInputMinRescue.value = state.minRescue !== null ? state.minRescue : '';
                    
                    state.hourlyLeaves = data.hourlyLeaves || {};
                    
                    // 後方互換
                    let loadedAssignments = data.vehicleAssignments || {};
                    for (const dateStr in loadedAssignments) {
                        if (loadedAssignments[dateStr]) {
                            if (loadedAssignments[dateStr]["救急車"]) {
                                loadedAssignments[dateStr]["救急車1"] = loadedAssignments[dateStr]["救急車"];
                                delete loadedAssignments[dateStr]["救急車"];
                            }
                            if (loadedAssignments[dateStr]["ポンプ車"]) {
                                loadedAssignments[dateStr]["タンク車"] = loadedAssignments[dateStr]["ポンプ車"];
                                delete loadedAssignments[dateStr]["ポンプ車"];
                            }
                            if (loadedAssignments[dateStr]["通信車"]) {
                                loadedAssignments[dateStr]["卓上通信"] = loadedAssignments[dateStr]["通信車"];
                                delete loadedAssignments[dateStr]["通信車"];
                            }
                        }
                    }
                    state.vehicleAssignments = loadedAssignments;
                    
                    if (data.deployedVehicles) {
                        let loadedVehicles = [...data.deployedVehicles];
                        if (loadedVehicles.includes("救急車")) {
                            loadedVehicles = loadedVehicles.filter(v => v !== "救急車");
                            if (!loadedVehicles.includes("救急車1")) loadedVehicles.push("救急車1");
                            if (!loadedVehicles.includes("救急車2")) loadedVehicles.push("救急車2");
                        }
                        if (loadedVehicles.includes("ポンプ車")) {
                            loadedVehicles = loadedVehicles.filter(v => v !== "ポンプ車");
                            if (!loadedVehicles.includes("タンク車")) loadedVehicles.push("タンク車");
                        }
                        if (loadedVehicles.includes("通信車")) {
                            loadedVehicles = loadedVehicles.filter(v => v !== "通信車");
                            if (!loadedVehicles.includes("卓上通信")) loadedVehicles.push("卓上通信");
                        }
                        state.deployedVehicles = loadedVehicles;
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
                    
                    state.hopeShifts = {};
                    if (data.hopeShifts) {
                        const firstKey = Object.keys(data.hopeShifts)[0];
                        if (firstKey && !firstKey.includes('_')) {
                            for (let staffId in data.hopeShifts) {
                                state.hopeShifts[`1_${staffId}`] = data.hopeShifts[staffId];
                            }
                        } else {
                            state.hopeShifts = data.hopeShifts;
                        }
                    }
                    for (let c = 1; c <= 13; c++) {
                        state.staffList.forEach(s => {
                            const key = `${c}_${s.id}`;
                            if (!state.hopeShifts[key]) {
                                state.hopeShifts[key] = {};
                            }
                        });
                    }

                    state.roster = {};
                    if (data.roster) {
                        const firstKey = Object.keys(data.roster)[0];
                        if (firstKey && !firstKey.includes('_')) {
                            for (let staffId in data.roster) {
                                state.roster[`1_${staffId}`] = data.roster[staffId];
                            }
                        } else {
                            state.roster = data.roster;
                        }
                    }
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
                    
                    handleDateChange(true);
                    await showCustomAlert("設定データを読み込みました。");
                } catch (err) {
                    await showCustomAlert(`ファイルのパースに失敗しました: ${err.message}`);
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        });
    }

    // モーダルキャンセル
    const elBtnModalCancel = document.getElementById('btn-modal-cancel');
    if (elBtnModalCancel) {
        elBtnModalCancel.addEventListener('click', hideShiftModal);
    }

    // ログイン・ログアウトのイベントバインド
    const elBtnLoginViewer = document.getElementById('btn-login-viewer');
    if (elBtnLoginViewer) {
        elBtnLoginViewer.addEventListener('click', () => {
            loginAs('viewer');
        });
    }

    const elLoginAdminForm = document.getElementById('login-admin-form');
    if (elLoginAdminForm) {
        elLoginAdminForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('login-username');
            const passwordInput = document.getElementById('login-password');
            const errorMsg = document.getElementById('login-error-msg');
            
            const username = usernameInput ? usernameInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            
            if (username === 'admin' && (password === '119' || password === 'admin')) {
                if (errorMsg) errorMsg.style.display = 'none';
                loginAs('admin');
            } else {
                if (errorMsg) {
                    errorMsg.textContent = 'IDまたはパスワードが正しくありません。';
                    errorMsg.style.display = 'block';
                }
                
                const card = document.querySelector('.login-card');
                if (card) {
                    card.classList.remove('login-error-msg');
                    void card.offsetWidth;
                    card.classList.add('login-error-msg');
                }
            }
        });
    }

    const elBtnLogout = document.getElementById('btn-logout');
    if (elBtnLogout) {
        elBtnLogout.addEventListener('click', async () => {
            const confirmLogout = await showCustomConfirm('ログアウトしてもよろしいですか？');
            if (confirmLogout) {
                logout();
            }
        });
    }

    // 車両配置イベントのバインド
    bindVehicleEvents();
}

// UIの全体更新
function refreshUI() {
    // 閲覧専用モードなら各種設定の入力を無効化
    const isAdmin = ['admin', 'sysadmin', 'chief'].includes(state.userRole);
    const setDisabled = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.disabled = val;
    };

    // 確定警告バナーの表示切り替え
    const elConfirmAlert = document.getElementById('confirm-alert-banner');
    if (elConfirmAlert) {
        if (state.isConfirmed) {
            elConfirmAlert.style.display = 'flex';
        } else {
            elConfirmAlert.style.display = 'none';
        }
    }
    setDisabled('input-station', !isAdmin);
    setDisabled('input-start-date', !isAdmin);
    setDisabled('input-platoon-size', !isAdmin);
    setDisabled('input-min-staffing', !isAdmin);
    setDisabled('input-min-subofficer', !isAdmin);
    setDisabled('input-min-large', !isAdmin);
    setDisabled('input-min-paramedic', !isAdmin);
    setDisabled('input-min-rescue', !isAdmin);
    setDisabled('select-regen-start-day', !isAdmin);
    const chkAutoLeave = document.getElementById('chk-auto-leave');
    if (chkAutoLeave) chkAutoLeave.disabled = !isAdmin;
    
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
    } else if (state.priorRoster) {
        prevRoster = {};
        state.staffList.forEach(s => {
            const prior = state.priorRoster[s.id];
            if (prior) {
                const dummySched = new Array(28).fill('-');
                if (s.platoon === 1) {
                    dummySched[26] = prior[5] || '-';
                    dummySched[24] = prior[3] || '-';
                    dummySched[22] = prior[1] || '-';
                } else {
                    dummySched[27] = prior[6] || '-';
                    dummySched[25] = prior[4] || '-';
                    dummySched[23] = prior[2] || '-';
                    dummySched[21] = prior[0] || '-';
                }
                prevRoster[s.id] = dummySched;
            }
        });
    }

    const activeStartDate = new Date(state.startDate);
    activeStartDate.setDate(activeStartDate.getDate() + (state.activeCycle - 1) * 28);
    state.warnings = validateRoster(activeRoster, state.staffList, state.minStaffing, prevRoster, state.minSubOfficer, state.minLarge, state.minParamedic, activeStartDate, state.minRescue);
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
    } else if (state.activeTab === 'tab-shifts') {
        renderShiftConfigTable();
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
    thName1.classList.add('name-column');
    headerDays.appendChild(thName1);
    
    // アクティブサイクルの開始日を計算
    const activeStartDate = new Date(state.startDate);
    activeStartDate.setDate(activeStartDate.getDate() + (state.activeCycle - 1) * 28);
    
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

        const thSpecial = document.createElement('th');
        thSpecial.textContent = '特休';
        thSpecial.className = 'stats-header-col';
        thSpecial.rowSpan = 2;
        headerDays.appendChild(thSpecial);

        // 年間年休累積列（クロスサイクル）
        const thYearlyAnnual = document.createElement('th');
        thYearlyAnnual.innerHTML = '年休<br>（年）';
        thYearlyAnnual.className = 'stats-header-col';
        thYearlyAnnual.rowSpan = 2;
        thYearlyAnnual.title = '年間累積年休日数（暑年） / 残日数（目標8:山切に対する残り）';
        headerDays.appendChild(thYearlyAnnual);
    }
}

// 勤務一覧表（スプレッドシート型）の描画
function renderRosterTable() {
    const container = document.getElementById('roster-tables-container');
    container.innerHTML = '';
    
    const activeStartDate = new Date(state.startDate);
    activeStartDate.setDate(activeStartDate.getDate() + (state.activeCycle - 1) * 28);
    
    const platoonsToRender = state.viewPlatoon === 'both' ? [1, 2] : [parseInt(state.viewPlatoon)];
    platoonsToRender.forEach(platoonNum => {
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
            tdName.className = 'name-column';
            tdName.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px; line-height: 1.2;">
                    <div style="font-weight: 600; font-size:12px;">
                        ${staff.name}${staff.isSupport ? `<span class="badge-support">応援：${staff.origin}</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 2px; align-items: center;">
                        <span class="staff-rank-badge">${getRankAbbr(staff.rank)}</span>
                        ${staff.hasLargeLicense ? '<span class="qual-badge qual-badge-large" title="大型免許">大</span>' : ''}
                        ${staff.isParamedic ? '<span class="qual-badge qual-badge-paramedic" title="救急救命士">救</span>' : ''}
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
            let specialLeaveCount = 0;
            
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
                if (shift === '週') holidayCount++;
                if (shift === '有') {
                    const hourlyKey = `${state.activeCycle}_${staff.id}_${d}`;
                    if (state.hourlyLeaves[hourlyKey]) {
                        annualLeaveCount += state.hourlyLeaves[hourlyKey].hours / 8.0;
                    } else {
                        annualLeaveCount += staff.isDayWorker ? 1.0 : 2.0;
                    }
                }
                const shiftObj = state.shifts.find(s => s.key === shift);
                if (shiftObj && shiftObj.isSpecialLeave) {
                    specialLeaveCount += staff.isDayWorker ? 1.0 : 2.0;
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

            // 特休日数統計
            const tdSpecialStat = document.createElement('td');
            tdSpecialStat.className = 'stats-cell';
            tdSpecialStat.textContent = Number.isInteger(specialLeaveCount) ? specialLeaveCount.toString() : specialLeaveCount.toFixed(2);
            tr.appendChild(tdSpecialStat);

            // 年間累積年休統計（対象暦年の全サイクル分）
            if (!staff.isSupport && !staff.isDayWorker) {
                const YEARLY_TARGET = 20;
                const cycleStartDate = new Date(state.startDate);
                cycleStartDate.setDate(cycleStartDate.getDate() + (state.activeCycle - 1) * 28);
                const targetYear = cycleStartDate.getFullYear();
                const yearlyCounts = getYearlyAnnualLeaveCounts(targetYear);
                const yearlyUsed = yearlyCounts[staff.id] || 0;
                const yearlyRemaining = YEARLY_TARGET - yearlyUsed;

                const tdYearlyStat = document.createElement('td');
                tdYearlyStat.className = 'stats-cell';

                // 表示: 使用日数 / 残日数
                const usedSpan = document.createElement('span');
                usedSpan.style.fontWeight = '700';
                usedSpan.style.fontSize = '12px';
                usedSpan.textContent = yearlyUsed;

                const slashSpan = document.createElement('span');
                slashSpan.style.color = '#999';
                slashSpan.textContent = '/';

                const remainSpan = document.createElement('span');
                remainSpan.style.fontSize = '10px';
                remainSpan.style.fontWeight = '600';

                if (yearlyRemaining <= 0) {
                    // 上限到達: 赤
                    usedSpan.style.color = '#dc2626';
                    remainSpan.style.color = '#dc2626';
                    remainSpan.textContent = '満';
                    tdYearlyStat.title = `年間年休: ${yearlyUsed}日使用（上限に達しました）`;
                    tdYearlyStat.style.backgroundColor = 'rgba(220,38,38,0.08)';
                } else if (yearlyRemaining <= 5) {
                    // 残5日以下: オレンジ警告
                    usedSpan.style.color = '#ea580c';
                    remainSpan.style.color = '#ea580c';
                    remainSpan.textContent = `残${yearlyRemaining}`;
                    tdYearlyStat.title = `年間年休: ${yearlyUsed}日使用 / 残${yearlyRemaining}日`;
                } else {
                    // 通常: 緑
                    usedSpan.style.color = '#16a34a';
                    remainSpan.style.color = '#6b7280';
                    remainSpan.textContent = `残${yearlyRemaining}`;
                    tdYearlyStat.title = `年間年休: ${yearlyUsed}日使用 / 残${yearlyRemaining}日`;
                }

                tdYearlyStat.appendChild(usedSpan);
                tdYearlyStat.appendChild(slashSpan);
                tdYearlyStat.appendChild(remainSpan);
                tr.appendChild(tdYearlyStat);
            } else {
                // 応援職員・日勤者は空セル
                const tdYearlyStat = document.createElement('td');
                tdYearlyStat.className = 'stats-cell';
                tdYearlyStat.textContent = '-';
                tr.appendChild(tdYearlyStat);
            }
            
            tbody.appendChild(tr);
        });
        
        // 1. 小隊全体の出勤合計
        const trTotal = document.createElement('tr');
        trTotal.className = 'daily-staff-row';
        
        const tdTotalLabel = document.createElement('td');
        tdTotalLabel.className = 'name-column';
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
        trTotal.appendChild(document.createElement('td')); // 特休用空セル
        trTotal.appendChild(document.createElement('td')); // 年間年休用空セル
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
            tdLabel.className = 'name-column';
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
            trSum.appendChild(document.createElement('td')); // 特休用空セル
            trSum.appendChild(document.createElement('td')); // 年間年休用空セル
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
// 勤務形態（シフト）設定の管理テーブルの描画
function renderShiftConfigTable() {
    const tbody = document.getElementById('shift-config-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    state.shifts.forEach(shift => {
        const tr = document.createElement('tr');
        
        // 1. コード (key) - 読み取り専用
        const tdKey = document.createElement('td');
        tdKey.style.padding = '6px';
        tdKey.style.fontWeight = '600';
        tdKey.textContent = shift.key;
        tr.appendChild(tdKey);
        
        // 2. 表示一文字 (char)
        const tdChar = document.createElement('td');
        tdChar.style.padding = '6px';
        tdChar.style.textAlign = 'center';
        const inputChar = document.createElement('input');
        inputChar.type = 'text';
        inputChar.value = shift.char;
        inputChar.maxLength = 1;
        inputChar.style.width = '36px';
        inputChar.style.textAlign = 'center';
        inputChar.className = 'form-control';
        inputChar.style.height = '28px';
        inputChar.style.padding = '2px';
        if (shift.isSystem) {
            inputChar.disabled = true;
        } else {
            inputChar.addEventListener('change', (e) => {
                shift.char = e.target.value.trim() || shift.key;
                saveShiftsToStorage();
                renderLegend();
                refreshUI();
            });
        }
        tdChar.appendChild(inputChar);
        tr.appendChild(tdChar);
        
        // 3. 正式名称 (name)
        const tdName = document.createElement('td');
        tdName.style.padding = '6px';
        const inputName = document.createElement('input');
        inputName.type = 'text';
        inputName.value = shift.name;
        inputName.className = 'form-control';
        inputName.style.height = '28px';
        inputName.style.padding = '4px 8px';
        inputName.style.width = '100%';
        if (shift.isSystem) {
            inputName.disabled = true;
        } else {
            inputName.addEventListener('change', (e) => {
                shift.name = e.target.value.trim() || shift.key;
                saveShiftsToStorage();
                renderLegend();
                refreshUI();
            });
        }
        tdName.appendChild(inputName);
        tr.appendChild(tdName);
        
        // 4. 背景色 (color)
        const tdColor = document.createElement('td');
        tdColor.style.padding = '6px';
        tdColor.style.textAlign = 'center';
        const inputColor = document.createElement('input');
        inputColor.type = 'color';
        inputColor.value = shift.color;
        inputColor.style.width = '40px';
        inputColor.style.height = '28px';
        inputColor.style.padding = '2px';
        inputColor.style.border = '1px solid var(--border-color)';
        inputColor.style.borderRadius = '4px';
        inputColor.style.cursor = 'pointer';
        inputColor.addEventListener('input', (e) => {
            shift.color = e.target.value;
            saveShiftsToStorage();
            renderLegend();
            refreshUI();
        });
        tdColor.appendChild(inputColor);
        tr.appendChild(tdColor);
        
        // 5. 文字色 (textColor)
        const tdTextColor = document.createElement('td');
        tdTextColor.style.padding = '6px';
        tdTextColor.style.textAlign = 'center';
        const inputTextColor = document.createElement('input');
        inputTextColor.type = 'color';
        inputTextColor.value = shift.textColor;
        inputTextColor.style.width = '40px';
        inputTextColor.style.height = '28px';
        inputTextColor.style.padding = '2px';
        inputTextColor.style.border = '1px solid var(--border-color)';
        inputTextColor.style.borderRadius = '4px';
        inputTextColor.style.cursor = 'pointer';
        inputTextColor.addEventListener('input', (e) => {
            shift.textColor = e.target.value;
            saveShiftsToStorage();
            renderLegend();
            refreshUI();
        });
        tdTextColor.appendChild(inputTextColor);
        tr.appendChild(tdTextColor);
        
        // 6. 特別休暇 (isSpecialLeave)
        const tdSpecial = document.createElement('td');
        tdSpecial.style.padding = '6px';
        tdSpecial.style.textAlign = 'center';
        const inputSpecial = document.createElement('input');
        inputSpecial.type = 'checkbox';
        inputSpecial.checked = !!shift.isSpecialLeave;
        inputSpecial.style.width = '16px';
        inputSpecial.style.height = '16px';
        inputSpecial.style.cursor = 'pointer';
        if (shift.isSystem) {
            inputSpecial.disabled = true;
        } else {
            inputSpecial.addEventListener('change', (e) => {
                shift.isSpecialLeave = e.target.checked;
                saveShiftsToStorage();
                refreshUI();
            });
        }
        tdSpecial.appendChild(inputSpecial);
        tr.appendChild(tdSpecial);
        
        // 7. 操作 (削除)
        const tdAction = document.createElement('td');
        tdAction.style.padding = '6px';
        tdAction.style.textAlign = 'center';
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn btn-secondary';
        btnDelete.style.padding = '2px 8px';
        btnDelete.style.fontSize = '11px';
        btnDelete.style.height = 'auto';
        if (shift.isSystem) {
            btnDelete.textContent = '固定';
            btnDelete.disabled = true;
            btnDelete.style.opacity = '0.5';
            btnDelete.style.cursor = 'not-allowed';
        } else {
            btnDelete.textContent = '削除';
            btnDelete.style.color = 'var(--color-wday-sun)';
            btnDelete.style.borderColor = 'rgba(220, 38, 38, 0.2)';
            btnDelete.style.backgroundColor = 'rgba(220, 38, 38, 0.02)';
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
                    saveShiftsToStorage();
                    renderShiftConfigTable();
                    renderLegend();
                    refreshUI();
                }
            });
        }
        tdAction.appendChild(btnDelete);
        tr.appendChild(tdAction);
        
        tbody.appendChild(tr);
    });
}

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
    activeStartDate.setDate(activeStartDate.getDate() + (state.activeCycle - 1) * 28);
    
    const platoonsToRender = state.viewPlatoon === 'both' ? [1, 2] : [parseInt(state.viewPlatoon)];
    platoonsToRender.forEach(platoonNum => {
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
        
        // 各日の週休希望の人数を集計
        const dailyOffCount = new Array(28).fill(0);
        platoonStaff.forEach(staff => {
            const key = `${state.activeCycle}_${staff.id}`;
            const staffHopes = state.hopeShifts[key] || {};
            for (let d = 0; d < 28; d++) {
                if (staffHopes[d] === '週') {
                    dailyOffCount[d]++;
                }
            }
        });
            
        platoonStaff.forEach(staff => {
            const tr = document.createElement('tr');
            
            const tdName = document.createElement('td');
            tdName.className = 'name-column';
            tdName.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px; line-height: 1.2;">
                    <div style="font-weight: 600; font-size:12px;">
                        ${staff.name}${staff.isSupport ? `<span class="badge-support">応援：${staff.origin}</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 2px; align-items: center;">
                        <span class="staff-rank-badge">${getRankAbbr(staff.rank)}</span>
                        ${staff.hasLargeLicense ? '<span class="qual-badge qual-badge-large" title="大型免許">大</span>' : ''}
                        ${staff.isParamedic ? '<span class="qual-badge qual-badge-paramedic" title="救急救命士">救</span>' : ''}
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
                    
                    // 週休希望が重複（2名以上）している場合のハイライト警告
                    if (shift === '週' && dailyOffCount[d] > 1) {
                        td.style.background = 'rgba(239, 68, 68, 0.12)';
                        td.style.border = '1px solid var(--accent-fire)';
                        td.title = `週休希望重複: 同一小隊で同日に ${dailyOffCount[d]} 名が希望しています`;
                        
                        const conflictBadge = document.createElement('span');
                        conflictBadge.style.fontSize = '8px';
                        conflictBadge.style.background = 'var(--accent-fire)';
                        conflictBadge.style.color = 'white';
                        conflictBadge.style.padding = '1px 3px';
                        conflictBadge.style.borderRadius = '3px';
                        conflictBadge.style.position = 'absolute';
                        conflictBadge.style.top = '1px';
                        conflictBadge.style.right = '1px';
                        conflictBadge.style.lineHeight = '1';
                        conflictBadge.textContent = `${dailyOffCount[d]}`;
                        
                        td.style.position = 'relative';
                        td.appendChild(conflictBadge);
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
    activeStartDate.setDate(activeStartDate.getDate() + (state.activeCycle - 1) * 28);
    
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
    if (state.userRole !== 'admin') return;
    currentEditCell = { staffId, dayIndex, isPreScheduling };
    
    const activeStartDate = new Date(state.startDate);
    activeStartDate.setDate(activeStartDate.getDate() + (state.activeCycle - 1) * 28);
    
    const date = new Date(activeStartDate);
    date.setDate(activeStartDate.getDate() + dayIndex);
    const holidayName = getJapaneseHoliday(date);
    const dateStr = `${date.getMonth()+1}/${date.getDate()}(${WEEKDAYS_JP[date.getDay()]})${holidayName ? '・' + holidayName : ''}`;
    
    const titlePrefix = isPreScheduling ? "事前指定シフトの設定" : "シフト変更";
    document.getElementById('modal-title').textContent = `${staffName} の${titlePrefix} - ${dateStr}`;
    
    // 開始日のラベル設定 (月日で表示)
    const startDayStr = `${date.getMonth()+1}/${date.getDate()}(${WEEKDAYS_JP[date.getDay()]})`;
    document.getElementById('modal-start-day-label').textContent = startDayStr;
    
    // 終了日選択肢を動的に生成
    const endSelect = document.getElementById('modal-end-day-select');
    endSelect.innerHTML = '';
    for (let d = dayIndex; d < 28; d++) {
        const endDayDate = new Date(activeStartDate);
        endDayDate.setDate(activeStartDate.getDate() + d);
        const endHolidayName = getJapaneseHoliday(endDayDate);
        const endDayStr = `${endDayDate.getMonth()+1}/${endDayDate.getDate()}(${WEEKDAYS_JP[endDayDate.getDay()]})${endHolidayName ? '・' + endHolidayName : ''}`;
        
        const opt = document.createElement('option');
        opt.value = d + 1; // 1-indexed for compatibility
        opt.textContent = endDayStr;
        endSelect.appendChild(opt);
    }
    // デフォルトは当日 (dayIndex + 1)
    endSelect.value = dayIndex + 1;
    
    // サイクル全期間のトグル動作
    const checkAllCycle = document.getElementById('modal-all-cycle-check');
    let newCheckAllCycle = null;
    if (checkAllCycle) {
        newCheckAllCycle = checkAllCycle.cloneNode(true);
        checkAllCycle.parentNode.replaceChild(newCheckAllCycle, checkAllCycle);
        newCheckAllCycle.checked = false;
        const startLabel = document.getElementById('modal-start-day-label');
        if (endSelect) endSelect.disabled = false;
        if (startLabel) startLabel.style.opacity = '1';
        
        newCheckAllCycle.addEventListener('change', () => {
            if (newCheckAllCycle.checked) {
                if (endSelect) endSelect.disabled = true;
                if (startLabel) startLabel.style.opacity = '0.5';
            } else {
                if (endSelect) endSelect.disabled = false;
                if (startLabel) startLabel.style.opacity = '1';
            }
        });
    }
    
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
        if (newCheckAllCycle && newCheckAllCycle.checked) {
            return { startDay: 0, endDay: 27 };
        }
        const startDay = dayIndex;
        let endDay = parseInt(document.getElementById('modal-end-day-select').value) - 1;
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
        
        // 隊
        const tdPos = document.createElement('td');
        tdPos.textContent = s.position || '未選択';
        row.appendChild(tdPos);
        
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
    const spec = state.vehicleSpecs.find(v => v.name === vehicleName);
    if (!spec) return { status: "OK", warnings: [] };
    
    const roles = spec.roles;
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
            if (spec.requiresLarge && !staff.hasLargeLicense) {
                warnings.push(`${role}の${staff.name}は大型免許がありません`);
            }
            if (!staff.isKikan) {
                warnings.push(`${role}の${staff.name}は機関員指定がありません`);
            }
        }
        
        if (vehicleName === "救助工作車" && (role === "隊員1" || role === "隊員2")) {
            const isRescuePos = ["救助隊", "救助副", "救助隊長", "小隊長", "主幹"].includes(staff.position);
            const isUnselected = !staff.position || staff.position === "";
            if (!isRescuePos && !isUnselected) {
                warnings.push(`${role}の${staff.name}は救助隊員資格がありません`);
            }
        }

        // 隊長の階級チェック（基本的に司令補以上 > 士長）
        if (role === "隊長") {
            const rankVal = RANK_ORDER[staff.rank] || 5;
            if (rankVal > 3) {
                warnings.push(`隊長の${staff.name}は司令補以上または士長の階級が必要です（現在の階級：${staff.rank}）`);
            }
        }
    });
    
    // 救急車の救命士要件判定 (隊長か隊員の誰かが救命士資格を持つこと、機関員は除外)
    if (vehicleName.includes("救急車")) {
        let hasParamedic = false;
        roles.forEach(role => {
            if (role === "機関員") return; // 機関員は除外
            const staffId = assignments[role];
            if (!staffId) return;
            const staff = state.staffList.find(s => s.id === staffId);
            if (staff && staff.isParamedic) {
                hasParamedic = true;
            }
        });
        if (!hasParamedic) {
            warnings.push(`救急車には救命士が1名以上乗車する必要があります`);
        }
    }
    
    let status = "OK";
    if (warnings.length > 0) {
        status = "警告";
    } else if (hasEmpty) {
        if (assignments['completed']) {
            status = "OK";
        } else {
            status = "未完了";
        }
    }
    
    return { status, warnings };
}

// 車両配置画面のレンダリング
function renderVehicleView() {
    let dateStr = document.getElementById('vehicle-date-select').value;
    if (!dateStr) {
        const activeStartDate = new Date(state.startDate);
        activeStartDate.setDate(activeStartDate.getDate() + (state.activeCycle - 1) * 28);
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
            if (role === 'completed') continue;
            const staffId = currentAssignment[vehicle][role];
            if (staffId) {
                assignedStaffIds.add(staffId);
            }
        }
    }
    
    // 左側: 出勤メンバー一覧の描画
    const staffListEl = document.getElementById('vehicle-duty-staff-list');
    if (staffListEl) {
        staffListEl.innerHTML = '';
        
        // 階級グループの定義（上から順に表示）
        const rankGroups = [
            { title: "消防司令", ranks: ["消防司令"] },
            { title: "消防司令補", ranks: ["消防司令補"] },
            { title: "消防士長", ranks: ["消防士長"] },
            { title: "消防副士長", ranks: ["消防副士長"] },
            { title: "消防士", ranks: ["消防士"] }
        ];

        let isFirstGroup = true;
        rankGroups.forEach(group => {
            const membersInGroup = onDutyStaff.filter(staff => group.ranks.includes(staff.rank));
            if (membersInGroup.length === 0) return; // この階級の職員がいない場合は表示しない
            
            // グループヘッダーの作成
            const groupHeader = document.createElement('div');
            groupHeader.className = 'vehicle-staff-group-header';
            groupHeader.style.fontSize = '11px';
            groupHeader.style.fontWeight = '700';
            groupHeader.style.color = 'var(--text-secondary)';
            groupHeader.style.marginTop = isFirstGroup ? '0px' : '16px';
            groupHeader.style.marginBottom = '6px';
            groupHeader.style.padding = '3px 8px';
            groupHeader.style.borderLeft = '3px solid var(--primary-color)';
            groupHeader.style.backgroundColor = 'var(--secondary-bg)';
            groupHeader.style.borderRadius = '3px';
            groupHeader.style.display = 'flex';
            groupHeader.style.justifyContent = 'space-between';
            groupHeader.style.alignItems = 'center';
            
            const groupTitle = document.createElement('span');
            groupTitle.textContent = group.title;
            const groupCount = document.createElement('span');
            groupCount.style.fontSize = '10px';
            groupCount.style.opacity = '0.8';
            groupCount.textContent = `${membersInGroup.length}名`;
            
            groupHeader.appendChild(groupTitle);
            groupHeader.appendChild(groupCount);
            staffListEl.appendChild(groupHeader);
            
            isFirstGroup = false;

            // メンバーリスト用コンテナ
            const groupContainer = document.createElement('div');
            groupContainer.style.display = 'flex';
            groupContainer.style.flexDirection = 'column';
            groupContainer.style.gap = '6px';
            staffListEl.appendChild(groupContainer);
            
            membersInGroup.forEach(staff => {
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
                
                // 名前と隊
                const nameArea = document.createElement('div');
                nameArea.style.display = 'flex';
                nameArea.style.alignItems = 'center';
                nameArea.style.gap = '8px';
                
                // 隊名の丸アイコン (消防隊: 赤丸, 救急隊: 青丸, 救助隊: オレンジ丸, 選択なし: 灰色丸)
                const teamCircle = document.createElement('span');
                teamCircle.className = 'staff-team-circle-marker';
                teamCircle.style.width = '10px';
                teamCircle.style.height = '10px';
                teamCircle.style.borderRadius = '50%';
                teamCircle.style.display = 'inline-block';
                teamCircle.style.flexShrink = '0';
                
                let circleColor = '#9ca3af'; // 選択なし/その他 (灰色)
                const pos = staff.position;
                if (pos) {
                    if (["小隊長", "消防隊長", "消防副", "消防隊"].includes(pos)) {
                        circleColor = '#ef4444'; // 消防隊 (赤)
                    } else if (["救急隊長", "救急副", "救急隊"].includes(pos)) {
                        circleColor = '#3b82f6'; // 救急隊 (青)
                    } else if (["救助隊長", "救助副", "救助隊"].includes(pos)) {
                        circleColor = '#f97316'; // 救助隊 (オレンジ)
                    }
                }
                teamCircle.style.backgroundColor = circleColor;
                teamCircle.style.border = `1px solid ${circleColor === '#9ca3af' ? '#cbd5e1' : 'rgba(0,0,0,0.1)'}`;
                nameArea.appendChild(teamCircle);
                
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
                groupContainer.appendChild(item);
            });
        });
    }
    
    // 1. 車両カードの動的描画
    const cardsGrid = document.getElementById('vehicle-cards-grid');
    const activeVehicles = (state.deployedVehicles && state.deployedVehicles.length > 0) 
        ? state.deployedVehicles 
        : state.vehicleSpecs.map(v => v.name);
        
    if (cardsGrid) {
        cardsGrid.innerHTML = '';
        state.vehicleSpecs.forEach(spec => {
            if (!activeVehicles.includes(spec.name)) return;
            
            const isCompleted = currentAssignment[spec.name] && currentAssignment[spec.name]['completed'];
            
            const card = document.createElement('div');
            card.className = 'vehicle-card';
            card.dataset.vehicle = spec.name;
            card.style.background = 'var(--bg-card)';
            card.style.border = isCompleted ? '2px solid var(--success)' : '1px solid var(--border-color)';
            card.style.borderRadius = 'var(--radius-md)';
            card.style.overflow = 'hidden';
            card.style.boxShadow = isCompleted ? '0 0 12px rgba(16,185,129,0.15)' : 'var(--shadow-sm)';
            card.style.transition = 'all 0.2s ease';
            
            const header = document.createElement('div');
            header.className = 'vehicle-card-header';
            header.style.background = getVehicleColor(spec.name);
            header.style.color = '#ffffff';
            header.style.padding = '8px 12px';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.gap = '8px';
            
            const titleArea = document.createElement('div');
            titleArea.style.display = 'flex';
            titleArea.style.alignItems = 'center';
            titleArea.style.gap = '8px';
            
            const h4 = document.createElement('h4');
            h4.style.margin = '0';
            h4.style.fontSize = '13px';
            h4.style.fontWeight = '600';
            h4.style.letterSpacing = '0.5px';
            h4.textContent = spec.name;
            titleArea.appendChild(h4);
            
            // 決定・変更ボタンの作成
            if (state.userRole === 'admin') {
                const actionBtn = document.createElement('button');
                actionBtn.style.padding = '2px 8px';
                actionBtn.style.fontSize = '11px';
                actionBtn.style.borderRadius = '4px';
                actionBtn.style.border = '1px solid rgba(255,255,255,0.4)';
                actionBtn.style.cursor = 'pointer';
                actionBtn.style.marginLeft = '8px';
                actionBtn.style.fontWeight = '600';
                actionBtn.style.transition = 'all 0.15s';

                if (isCompleted) {
                    actionBtn.textContent = '変更';
                    actionBtn.style.background = 'rgba(255,255,255,0.15)';
                    actionBtn.style.color = '#ffffff';
                    actionBtn.title = '配置を再編集可能にする';
                    actionBtn.addEventListener('click', () => {
                        if (state.vehicleAssignments[dateStr] && state.vehicleAssignments[dateStr][spec.name]) {
                            delete state.vehicleAssignments[dateStr][spec.name]['completed'];
                        }
                        renderVehicleView();
                    });
                } else {
                    actionBtn.textContent = '決定';
                    actionBtn.style.background = '#ffffff';
                    actionBtn.style.color = getVehicleColor(spec.name);
                    actionBtn.title = 'この配置で決定し、ロックします';
                    actionBtn.addEventListener('click', () => {
                        if (!state.vehicleAssignments[dateStr]) {
                            state.vehicleAssignments[dateStr] = {};
                        }
                        if (!state.vehicleAssignments[dateStr][spec.name]) {
                            state.vehicleAssignments[dateStr][spec.name] = {};
                        }
                        const dummyStaffId = onDutyStaff.length > 0 ? onDutyStaff[0].id : "999999";
                        state.vehicleAssignments[dateStr][spec.name]['completed'] = dummyStaffId;
                        renderVehicleView();
                    });
                }
                titleArea.appendChild(actionBtn);
            } else {
                if (isCompleted) {
                    const statusText = document.createElement('span');
                    statusText.textContent = '【決定】';
                    statusText.style.fontSize = '11px';
                    statusText.style.fontWeight = '600';
                    statusText.style.color = 'rgba(255,255,255,0.9)';
                    statusText.style.background = 'rgba(255,255,255,0.15)';
                    statusText.style.padding = '1px 5px';
                    statusText.style.borderRadius = '3px';
                    statusText.style.marginLeft = '8px';
                    titleArea.appendChild(statusText);
                }
            }
            
            header.appendChild(titleArea);
            
            const statusBadge = document.createElement('span');
            statusBadge.className = 'vehicle-status-badge';
            statusBadge.dataset.vehicle = spec.name;
            statusBadge.style.fontSize = '10px';
            statusBadge.style.fontWeight = 'bold';
            statusBadge.style.background = 'rgba(255,255,255,0.2)';
            statusBadge.style.padding = '1px 6px';
            statusBadge.style.borderRadius = '10px';
            statusBadge.textContent = 'OK';
            header.appendChild(statusBadge);
            
            card.appendChild(header);
            
            const slotsDiv = document.createElement('div');
            slotsDiv.className = 'vehicle-slots';
            slotsDiv.style.padding = '12px';
            slotsDiv.style.display = 'flex';
            slotsDiv.style.flexDirection = 'column';
            slotsDiv.style.gap = '8px';
            
            spec.roles.forEach(role => {
                const isKikan = (role === '機関員');
                const labelColor = isKikan && spec.requiresLarge ? 'color: #dc2626;' : '';
                
                const row = document.createElement('div');
                row.className = 'slot-row';
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.justifyContent = 'space-between';
                row.style.gap = '8px';
                
                const label = document.createElement('label');
                label.style.fontSize = '12px';
                label.style.fontWeight = '600';
                label.style.width = '80px';
                label.style.margin = '0';
                if (labelColor) label.style.color = '#dc2626';
                label.textContent = `${role}${isKikan && spec.requiresLarge ? ' (機/大)' : ''}`;
                row.appendChild(label);
                
                const select = document.createElement('select');
                select.className = 'form-control vehicle-slot-select';
                select.dataset.vehicle = spec.name;
                select.dataset.role = role;
                select.style.flex = '1';
                select.style.height = '28px';
                select.style.padding = '2px 6px';
                select.style.fontSize = '12px';
                select.style.borderRadius = '4px';
                select.style.border = '1px solid var(--border-color)';
                select.innerHTML = '<option value="">-- 未指定 --</option>';
                
                row.appendChild(select);
                slotsDiv.appendChild(row);
            });
            
            card.appendChild(slotsDiv);
            cardsGrid.appendChild(card);
        });
    }

    // 各スロット（ドロップダウン）の選択肢を更新
    const selects = document.querySelectorAll('.vehicle-slot-select');
    selects.forEach(select => {
        const vehicle = select.dataset.vehicle;
        const role = select.dataset.role;
        
        const isCompleted = currentAssignment[vehicle] && currentAssignment[vehicle]['completed'];
        select.disabled = (state.userRole !== 'admin' || !!isCompleted);
        select.innerHTML = '<option value="">-- 未指定 --</option>';
        
        onDutyStaff.forEach(staff => {
            const opt = document.createElement('option');
            opt.value = staff.id;
            opt.textContent = `[${getRankAbbr(staff.rank)}] ${staff.name}`;
            
            const quals = [];
            if (staff.isKikan) quals.push('機');
            if (staff.hasLargeLicense) quals.push('大');
            if (staff.isParamedic) quals.push('救');
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
    vehicleCards.forEach(card => {
        const vehicleName = card.dataset.vehicle;
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



    // 移行期モーダル関連のイベントバインド
    const elBtnOpenPrior = document.getElementById('btn-open-prior-roster');
    if (elBtnOpenPrior) {
        elBtnOpenPrior.addEventListener('click', openPriorRosterModal);
    }
    const elBtnPriorX = document.getElementById('btn-prior-modal-x');
    if (elBtnPriorX) {
        elBtnPriorX.addEventListener('click', closePriorRosterModal);
    }
    const elBtnPriorCancel = document.getElementById('btn-prior-modal-cancel');
    if (elBtnPriorCancel) {
        elBtnPriorCancel.addEventListener('click', closePriorRosterModal);
    }
    const elBtnPriorSave = document.getElementById('btn-prior-modal-save');
    if (elBtnPriorSave) {
        elBtnPriorSave.addEventListener('click', savePriorRosterFromModal);
    }
}

// 車両配置イベントのバインド
function bindVehicleEvents() {
    const cardsGrid = document.getElementById('vehicle-cards-grid');
    if (cardsGrid) {
        cardsGrid.addEventListener('change', (e) => {
            if (e.target.classList.contains('vehicle-slot-select')) {
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
                            if (r !== 'completed' && dayAssignments[v][r] === val && (v !== vehicle || r !== role)) {
                                dayAssignments[v][r] = "";
                            }
                        }
                    }
                }
                
                state.vehicleAssignments[dateStr][vehicle][role] = val;
                renderVehicleView();
            }
        });
    }
    
    // 日付選択の変更
    const dateSelect = document.getElementById('vehicle-date-select');
    if (dateSelect) {
        dateSelect.addEventListener('change', async (e) => {
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
                await handleDateChange();
            }
            renderVehicleView();
        });
    }
    
    // 前日ボタン
    const btnPrev = document.getElementById('btn-vehicle-prev-day');
    if (btnPrev) {
        btnPrev.addEventListener('click', async () => {
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
                await handleDateChange();
            }
            renderVehicleView();
        });
    }
    
    // 翌日ボタン
    const btnNext = document.getElementById('btn-vehicle-next-day');
    if (btnNext) {
        btnNext.addEventListener('click', async () => {
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
                await handleDateChange();
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
    const btnPropose = document.getElementById('btn-vehicle-suggest');
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
                if (role === 'completed') continue;
                const staffId = dayAssign[vehicle][role];
                if (!staffId) continue;
                
                if (!historyCounts[staffId]) historyCounts[staffId] = {};
                if (!historyCounts[staffId][vehicle]) historyCounts[staffId][vehicle] = {};
                if (!historyCounts[staffId][vehicle][role]) historyCounts[staffId][vehicle][role] = 0;
                
                historyCounts[staffId][vehicle][role]++;
            }
        }
    }
    
    const activeVehicles = (state.deployedVehicles && state.deployedVehicles.length > 0) 
        ? state.deployedVehicles 
        : state.vehicleSpecs.map(s => s.name);
        
    const prioritySlots = [];
    
    // 1. 救急車の機関員
    state.vehicleSpecs.forEach(v => {
        if (activeVehicles.includes(v.name) && v.name.includes("救急車") && v.roles.includes("機関員")) {
            prioritySlots.push({ vehicle: v.name, role: "機関員" });
        }
    });
    
    // 2. その他の車両の機関員
    state.vehicleSpecs.forEach(v => {
        if (activeVehicles.includes(v.name) && !v.name.includes("救急車") && v.roles.includes("機関員")) {
            prioritySlots.push({ vehicle: v.name, role: "機関員" });
        }
    });
    
    // 3. 救助工作車の隊員 (隊員1, 隊員2)
    state.vehicleSpecs.forEach(v => {
        if (activeVehicles.includes(v.name) && v.name === "救助工作車") {
            v.roles.forEach(r => {
                if (r.startsWith("隊員")) {
                    prioritySlots.push({ vehicle: v.name, role: r });
                }
            });
        }
    });
    
    // 4. 各車両の隊長
    state.vehicleSpecs.forEach(v => {
        if (activeVehicles.includes(v.name)) {
            v.roles.forEach(r => {
                if (r === "隊長") {
                    prioritySlots.push({ vehicle: v.name, role: r });
                }
            });
        }
    });
    
    // 5. 残りの隊員
    state.vehicleSpecs.forEach(v => {
        if (activeVehicles.includes(v.name) && v.name !== "救助工作車") {
            v.roles.forEach(r => {
                if (r !== "機関員" && r !== "隊長") {
                    prioritySlots.push({ vehicle: v.name, role: r });
                }
            });
        }
    });
    
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
            const spec = state.vehicleSpecs.find(v => v.name === vehicle);
            
            if (role === "機関員") {
                if (spec && spec.requiresLarge && !staff.hasLargeLicense) return;
                
                // 救命士は救急車の機関員に配置されるのを防ぐ
                if (vehicle.includes("救急車") && staff.isParamedic) {
                    score -= 2000;
                }
                
                score += 500;
                if (staff.isKikan) {
                    score += 500;
                }
            }
            
            if (vehicle === "救助工作車" && (role === "隊員1" || role === "隊員2")) {
                if (staff.isRescue) {
                    score += 1000;
                } else {
                    return;
                }
            }
            
            if (role === "隊長") {
                const rankVal = getRankVal(staff.rank);
                if (rankVal <= 2) {
                    score += 2000; // 司令補以上
                } else if (rankVal === 3) {
                    score += 1000; // 士長
                }
                score += (6 - rankVal) * 100;
                
                if (vehicle === "救助工作車" && staff.isRescue) {
                    score += 300;
                }
                
                if (vehicle.includes("救急車") && staff.isParamedic) {
                    score += 1500;
                }
            }
            
            if (role.startsWith("隊員")) {
                const rankVal = getRankVal(staff.rank);
                score += rankVal * 10;
                
                if (vehicle.includes("救急車")) {
                    const currentAssigned = assigned[vehicle] || {};
                    let alreadyHasParamedic = false;
                    for (const r in currentAssigned) {
                        const sId = currentAssigned[r];
                        if (sId) {
                            const sObj = onDutyStaff.find(s => s.id === sId);
                            if (sObj && sObj.isParamedic) {
                                alreadyHasParamedic = true;
                            }
                        }
                    }
                    if (!alreadyHasParamedic && staff.isParamedic) {
                        score += 1500;
                    }
                }
            }
            
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
    const name = stationName.trim();
    let presetVehicles = [];
    if (name === "南署" || name === "南分署") {
        presetVehicles = ["タンク車", "救急車1", "救急車2"];
    } else if (name === "北署" || name === "北分署") {
        presetVehicles = ["タンク車", "救助工作車", "はしご車"];
    } else {
        // 本署またはその他は全車両
        presetVehicles = state.vehicleSpecs.map(s => s.name);
    }
    
    document.querySelectorAll('.vehicle-deploy-checkbox').forEach(chk => {
        chk.checked = presetVehicles.includes(chk.dataset.vehicle);
    });
    updateDeployedVehiclesState();
}

// チェックボックスの選択状態から配備車両リストを更新する
function updateDeployedVehiclesState() {
    state.deployedVehicles = [];
    document.querySelectorAll('.vehicle-deploy-checkbox').forEach(chk => {
        if (chk.checked) {
            state.deployedVehicles.push(chk.dataset.vehicle);
        }
    });
}

// 配備車両リストからチェックボックスの選択状態を同期する
function syncDeployedVehiclesCheckboxes() {
    const list = (state.deployedVehicles && state.deployedVehicles.length > 0) 
        ? state.deployedVehicles 
        : state.vehicleSpecs.map(s => s.name);
    
    document.querySelectorAll('.vehicle-deploy-checkbox').forEach(chk => {
        chk.checked = list.includes(chk.dataset.vehicle);
    });
}

// 運用車両チェックボックスの変更イベントを監視する (動的に生成されるためイベントリスナー側で処理済み)
function bindVehicleCheckboxEvents() {
    // 互換性のために定義のみ残します
}

// 移行期（前月最終週）の勤務実績データの保存・読込
function loadPriorRoster() {
    const dateStr = state.startDate ? state.startDate : '';
    const key = `fire_dept_prior_roster_${state.station}_${dateStr}`;
    const saved = localStorage.getItem(key);
    if (saved) {
        try {
            state.priorRoster = JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse prior roster:', e);
            state.priorRoster = {};
        }
    } else {
        state.priorRoster = {};
    }
}

function savePriorRoster() {
    const dateStr = state.startDate ? state.startDate : '';
    const key = `fire_dept_prior_roster_${state.station}_${dateStr}`;
    localStorage.setItem(key, JSON.stringify(state.priorRoster));
}

function openPriorRosterModal() {
    const modal = document.getElementById('modal-prior-roster');
    if (!modal) return;
    
    const activeStartDate = new Date(state.startDate);
    activeStartDate.setDate(activeStartDate.getDate() + (state.activeCycle - 1) * 28);
    
    // 直前7日間の日付を計算
    const priorDates = [];
    const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
    for (let i = 7; i >= 1; i--) {
        const d = new Date(activeStartDate);
        d.setDate(activeStartDate.getDate() - i);
        priorDates.push(d);
    }
    
    // ヘッダーの日付表示を更新
    const headers = modal.querySelectorAll('.prior-date-header');
    priorDates.forEach((date, idx) => {
        if (headers[idx]) {
            headers[idx].textContent = `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})`;
        }
    });
    
    // テーブル行の動的生成
    const tbody = document.getElementById('prior-roster-table-body');
    if (tbody) {
        tbody.innerHTML = '';
        
        // 正規職員のみ対象
        const regularStaff = state.staffList.filter(s => !s.isSupport);
        
        regularStaff.forEach(staff => {
            const tr = document.createElement('tr');
            
            // 名前
            const tdName = document.createElement('td');
            tdName.style.padding = '8px 12px';
            tdName.style.border = '1px solid var(--border-color)';
            tdName.style.textAlign = 'left';
            tdName.style.position = 'sticky';
            tdName.style.left = '0';
            tdName.style.backgroundColor = 'var(--bg-card)';
            tdName.textContent = staff.name;
            tr.appendChild(tdName);
            
            // 小隊
            const tdPlatoon = document.createElement('td');
            tdPlatoon.style.padding = '8px 4px';
            tdPlatoon.style.border = '1px solid var(--border-color)';
            tdPlatoon.textContent = `${staff.platoon}小隊`;
            tr.appendChild(tdPlatoon);
            
            // 7日間のセレクトボックス
            const savedVals = state.priorRoster[staff.id] || [];
            for (let idx = 0; idx < 7; idx++) {
                const tdSelect = document.createElement('td');
                tdSelect.style.padding = '4px';
                tdSelect.style.border = '1px solid var(--border-color)';
                
                const select = document.createElement('select');
                select.className = 'form-control';
                select.style.padding = '2px 4px';
                select.style.fontSize = '12px';
                select.style.height = '24px';
                select.style.width = '100%';
                select.setAttribute('data-staff-id', staff.id);
                select.setAttribute('data-day-idx', idx);
                
                const shiftsOptions = [
                    { value: "", text: "通常交代" },
                    { value: "当", text: "当番" },
                    { value: "明", text: "非番" },
                    { value: "週", text: "週休" },
                    { value: "休", text: "休日" },
                    { value: "有", text: "年休" },
                    { value: "公", text: "公休" },
                    { value: "張", text: "出張" },
                    { value: "病", text: "病休" }
                ];
                
                shiftsOptions.forEach(opt => {
                    const elOpt = document.createElement('option');
                    elOpt.value = opt.value;
                    elOpt.textContent = opt.text;
                    if (savedVals[idx] === opt.value) {
                        elOpt.selected = true;
                    }
                    select.appendChild(elOpt);
                });
                
                tdSelect.appendChild(select);
                tr.appendChild(tdSelect);
            }
            tbody.appendChild(tr);
        });
    }
    
    modal.style.display = 'flex';
}

function closePriorRosterModal() {
    const modal = document.getElementById('modal-prior-roster');
    if (modal) {
        modal.style.display = 'none';
    }
}

function savePriorRosterFromModal() {
    const modal = document.getElementById('modal-prior-roster');
    if (!modal) return;
    
    const selects = modal.querySelectorAll('select[data-staff-id]');
    const newPriorRoster = {};
    
    selects.forEach(select => {
        const staffId = select.getAttribute('data-staff-id');
        const dayIdx = parseInt(select.getAttribute('data-day-idx'), 10);
        const val = select.value;
        
        if (!newPriorRoster[staffId]) {
            newPriorRoster[staffId] = new Array(7).fill('');
        }
        newPriorRoster[staffId][dayIdx] = val;
    });
    
    state.priorRoster = newPriorRoster;
    savePriorRoster();
    closePriorRosterModal();
    
    // 警告を再計算して画面更新
    refreshUI();
    
    if (typeof Portal !== 'undefined' && Portal.showToast) {
        Portal.showToast('前月最終週の勤務実績を保存しました。自動生成と警告チェックに反映されます。', 'success');
    }
}


// Expose state and render
return {
    state,
    render
};

})();

window.Schedule = Schedule;
