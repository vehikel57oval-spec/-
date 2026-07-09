/**
 * 消防ポータルシステム 統合SPAコントローラー (Portal)
 */
const portalStorage = window.safeStorage || window.localStorage || {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
};

const Portal = {
    currentPage: null,
    clockInterval: null,

    /**
     * アプリ初期化
     */
    async init() {
        // ファイル直接起動警告
        if (window.location.protocol === 'file:') {
            alert('🚨 警告: HTMLファイルを直接ダブルクリックして開いているため、システム（ログイン等）が動作しません。ブラウザのURL欄に「 http://localhost:3000 」と入力してアクセスしてください。');
        }

        // 初期ローダーを非表示にし、レンダリング準備
        document.getElementById('initial-loader')?.remove();
        
        // モーダル閉じるボタンのイベントバインド
        const modalCloseBtn = document.getElementById('modal-close-btn');
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', () => Portal.closeModal());
        }
        
        let isAuthenticated = false;
        try {
            // 認証チェック
            isAuthenticated = await Auth.checkAuth();
        } catch (err) {
            console.error('Portal init auth check error:', err);
            isAuthenticated = false;
        }
        
        if (isAuthenticated) {
            this.renderPortalLayout();
            // ダッシュボードへ遷移
            this.navigate('dashboard');
        } else {
            // 安全ストレージからマスタ署所リストを読み込み、this.departments を構築
            const stationsStr = window.safeStorage.getItem('master_stations');
            let stations = [];
            if (stationsStr) {
                try { stations = JSON.parse(stationsStr); } catch (e) { stations = []; }
            }

            if (stations.length > 0) {
                this.departments = [];
                stations.forEach((st, sIdx) => {
                    const code = `st_${sIdx + 1}`;
                    this.departments.push({ code: code, name: st.name });
                    if (st.sub_stations && Array.isArray(st.sub_stations)) {
                        st.sub_stations.forEach((sub, subIdx) => {
                            const subCode = `${code}_sub_${subIdx + 1}`;
                            this.departments.push({ code: subCode, name: sub });
                        });
                    }
                });
            } else {
                // 消防本部リストをロード
                try {
                    this.departments = await Auth.getDepartments();
                } catch (err) {
                    console.error('Failed to load departments:', err);
                    this.departments = [];
                }
            }
            this.renderLoginPage();
        }
        
        // テーマ初期設定
        try {
            const storedTheme = portalStorage.getItem('theme') || 'light';
            document.body.setAttribute('data-theme', storedTheme);
        } catch (err) {
            console.warn('Failed to load theme:', err);
            document.body.setAttribute('data-theme', 'light');
        }
    },

    /**
     * ログイン画面のレンダリング
     */
    renderLoginPage() {
        const app = document.getElementById('app');
        const hqName = window.safeStorage.getItem('master_hq_name') || '消防職場ポータル';
        const systemIcon = window.safeStorage.getItem('master_system_icon') || '';

        app.innerHTML = `
            <div class="login-wrapper">
                <div class="login-card">
                    <div class="login-header">
                        <div class="login-logo" style="${systemIcon ? 'background:none;' : ''}">
                            ${systemIcon ? `<img src="${systemIcon}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">` : `<i data-lucide="flame"></i>`}
                        </div>
                        <h1 class="login-title">${hqName}</h1>
                        <p class="login-subtitle">職員番号と4桁の暗証番号でログイン</p>
                    </div>
                    
                    <form id="login-form">
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label class="form-label" for="department-code">消防本部</label>
                            <div class="input-with-icon">
                                <i data-lucide="building" class="input-icon"></i>
                                <select class="form-input" id="department-code" required style="padding-left:48px; -webkit-appearance:none; -moz-appearance:none; appearance:none;">
                                    ${(this.departments || []).map(d => `<option value="${d.code}">${d.name}</option>`).join('')}
                                </select>
                                <i data-lucide="chevron-down" style="position:absolute; right:16px; pointer-events:none; width:16px; height:16px; color:var(--text-muted);"></i>
                            </div>
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label class="form-label" for="employee-number">職員番号</label>
                            <div class="input-with-icon">
                                <i data-lucide="user" class="input-icon"></i>
                                <input class="form-input" type="text" id="employee-number" required placeholder="例: 1001" autocomplete="username">
                            </div>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 28px;">
                            <label class="form-label" for="pin">暗証番号 (4桁)</label>
                            <div class="input-with-icon">
                                <i data-lucide="lock" class="input-icon"></i>
                                <input class="form-input" type="password" id="pin" pattern="[0-9]{4}" maxlength="4" required placeholder="••••" autocomplete="current-password">
                            </div>
                        </div>
                        
                        <button class="btn btn-primary" style="width: 100%;" type="submit">
                            ログイン <i data-lucide="log-in" style="width: 18px; height: 18px;"></i>
                        </button>
                        
                        <div style="margin-top: 16px; text-align: center; border-top: 1px solid var(--border-color); padding-top: 16px;">
                            <button type="button" class="btn btn-secondary" style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 13px;" onclick="Portal.renderMasterAdminPage()">
                                <i data-lucide="settings-2" style="width: 16px; height: 16px;"></i> システムマスタ設定 (業者用)
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        // ログインフォームのイベントハンドラを動的バインド
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    /**
     * ログイン処理
     */
    async handleLogin(event) {
        event.preventDefault();
        const departmentCode = document.getElementById('department-code').value;
        const employeeNumber = document.getElementById('employee-number').value.trim();
        const pin = document.getElementById('pin').value.trim();
        
        try {
            await Auth.login(departmentCode, employeeNumber, pin);
            this.showToast('ログインしました。勤務開始です。', 'success');
            
            // レイアウトをレンダリングして権限に応じた画面へ遷移 (即打刻対応)
            this.renderPortalLayout();
            this.navigate('dashboard');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    /**
     * ポータル全体のレイアウトフレームのレンダリング
     */
    renderPortalLayout() {
        const app = document.getElementById('app');
        const hqName = window.safeStorage.getItem('master_hq_name') || '消防本部ポータル';
        const systemIcon = window.safeStorage.getItem('master_system_icon') || '';

        app.innerHTML = `
            <div class="portal-layout">
                <!-- サイドバー -->
                <aside class="sidebar" id="sidebar">
                    <div class="sidebar-brand" style="gap: 10px; align-items: center;">
                        <div class="brand-icon" style="${systemIcon ? 'background:none;' : ''}">
                            ${systemIcon ? `<img src="${systemIcon}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">` : 'F'}
                        </div>
                        <span class="brand-text" style="font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${hqName}</span>
                    </div>
                    
                    <nav class="sidebar-menu" id="sidebar-menu">
                        <!-- ロールに応じて動的に挿入されます -->
                    </nav>
                    
                    <div class="sidebar-footer">
                        <span>v1.0.0</span>
                        <span id="sidebar-dept-code">${Auth.user.department_name}</span>
                    </div>
                </aside>
                
                <!-- メインフレーム -->
                <div class="main-frame">
                    <!-- ヘッダー -->
                    <header class="header">
                        <div class="header-left">
                            <button class="hamburger-btn" onclick="Portal.toggleSidebar()">
                                <i data-lucide="menu"></i>
                            </button>
                            <div class="breadcrumb" id="breadcrumb">ダッシュボード</div>
                        </div>
                        
                        <div class="header-right">
                            <!-- リアルタイム時計 -->
                            <div class="header-clock">
                                <i data-lucide="clock" style="width: 18px; height: 18px;"></i>
                                <span id="header-time-string">00:00:00</span>
                            </div>
                            
                            <!-- テーマ切り替え -->
                            <button class="theme-toggle-btn" onclick="Portal.toggleTheme()" title="テーマ切替">
                                <i data-lucide="sun" class="sun-icon" style="display:none;"></i>
                                <i data-lucide="moon" class="moon-icon"></i>
                            </button>
                            
                            <!-- ユーザープロフィール -->
                            <div class="user-profile">
                                <div class="avatar">${Auth.user.name.charAt(0)}</div>
                                <div class="user-info">
                                    <span class="user-name">${Auth.user.name}</span>
                                    <span class="user-role">${Auth.user.rank || '一般員'} (${Auth.user.station_name})</span>
                                </div>
                            </div>
                            
                            <!-- ログアウト -->
                            <button class="logout-btn" onclick="Auth.logout()" title="ログアウト">
                                <i data-lucide="log-out" style="width: 20px; height: 20px;"></i>
                            </button>
                        </div>
                    </header>
                    
                    <!-- メインコンテンツ -->
                    <main class="content-body" id="content-body">
                        <!-- 各画面が動的にマウントされます -->
                    </main>
                </div>
            </div>
        `;
        
        this.renderSidebarMenu();
        this.startClock();
        this.updateThemeIcons();
    },

    /**
     * ロールに応じたサイドバーメニューの生成
     */
    renderSidebarMenu() {
        const menu = document.getElementById('sidebar-menu');
        if (!menu) return;
        
        let menuItems = [
            { id: 'dashboard', label: 'ダッシュボード', icon: 'layout-dashboard' },
            { id: 'schedule', label: '勤務スケジュール', icon: 'calendar-days' },
            { id: 'ledger', label: '出勤簿出力', icon: 'clipboard-list' },
            { id: 'leave', label: '休暇申請', icon: 'file-text' }
        ];
        
        // 署長(chief)や管理者の場合
        if (Auth.hasRole('chief', 'admin', 'sysadmin')) {
            menuItems.push({ id: 'approvals', label: '打刻修正承認', icon: 'check-square', badge: true });
            menuItems.push({ id: 'holiday_allowance', label: '祝日手当検証', icon: 'calculator' });
            menuItems.push({ id: 'staff_admin', label: '職員管理', icon: 'users' });
        }
        
        // システム管理者の場合
        if (Auth.hasRole('admin', 'sysadmin')) {
            menuItems.push({ id: 'settings', label: 'システム設定', icon: 'settings' });
        }
        
        menu.innerHTML = menuItems.map(item => `
            <a class="menu-item" id="nav-${item.id}" onclick="Portal.navigate('${item.id}')">
                <i data-lucide="${item.icon}"></i>
                <span>${item.label}</span>
                ${item.badge ? `<span class="badge badge-pending" id="badge-pending-count" style="margin-left: auto; display: none;">0</span>` : ''}
            </a>
        `).join('');
        
        this.updatePendingApprovalBadge();
    },

    /**
     * 承認待ちバッジ数の更新
     */
    async updatePendingApprovalBadge() {
        if (!Auth.hasRole('chief', 'admin', 'sysadmin')) return;
        
        try {
            const response = await fetch('/api/attendance/pending', {
                headers: { 'Authorization': `Bearer ${Auth.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const badge = document.getElementById('badge-pending-count');
                if (badge) {
                    if (data.pending.length > 0) {
                        badge.textContent = data.pending.length;
                        badge.style.display = 'inline-flex';
                    } else {
                        badge.style.display = 'none';
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching pending count:', err);
        }
    },

    /**
     * ルーティング/画面遷移制御
     */
    async navigate(page) {
        if (!Auth.isLoggedIn()) {
            this.renderLoginPage();
            return;
        }
        
        this.currentPage = page;
        
        // アクティブなナビゲーションマーク更新
        document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
        const activeNav = document.getElementById(`nav-${page}`);
        if (activeNav) activeNav.classList.add('active');
        
        // モバイルサイドバーを閉じる
        document.getElementById('sidebar')?.classList.remove('open');
        
        // ブレッドクラムとタイトル更新
        const breadcrumb = document.getElementById('breadcrumb');
        const contentBody = document.getElementById('content-body');
        
        if (!contentBody) return;
        
        // ローディング
        contentBody.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:60vh;"><div class="spinner"></div></div>`;
        
        try {
            switch (page) {
                case 'dashboard':
                    breadcrumb.textContent = 'ダッシュボード';
                    await Dashboard.render(contentBody);
                    break;
                case 'attendance':
                    // ダッシュボードへリダイレクト
                    this.navigate('dashboard');
                    return;
                case 'schedule':
                    breadcrumb.textContent = '勤務スケジュール';
                    await Schedule.render(contentBody);
                    break;
                case 'ledger':
                    breadcrumb.textContent = '出勤簿出力';
                    await Ledger.render(contentBody);
                    break;
                case 'leave':
                    breadcrumb.textContent = '休暇申請';
                    this.renderLeavePage(contentBody);
                    break;
                case 'approvals':
                    breadcrumb.textContent = '打刻修正承認';
                    await this.renderApprovalsPage(contentBody);
                    break;
                case 'staff_admin':
                    breadcrumb.textContent = '職員管理';
                    await this.renderStaffAdminPage(contentBody);
                    break;
                case 'holiday_allowance':
                    breadcrumb.textContent = '祝日手当検証';
                    await HolidayAllowance.render(contentBody);
                    break;
                case 'settings':
                    breadcrumb.textContent = 'システム設定';
                    await this.renderSettingsPage(contentBody);
                    break;
                default:
                    contentBody.innerHTML = `<h3>ページが見つかりません。</h3>`;
            }
        } catch (err) {
            console.error('Navigation error:', err);
            contentBody.innerHTML = `<div class="card" style="border-left: 4px solid var(--danger);">
                <h4>ページの読み込み中にエラーが発生しました</h4>
                <p style="color: var(--danger); margin-top: 8px;">${err.message}</p>
            </div>`;
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    /**
     * リアルタイム時計の開始
     */
    startClock() {
        if (this.clockInterval) clearInterval(this.clockInterval);
        
        const clockEl = document.getElementById('header-time-string');
        const updateTime = () => {
            const d = new Date();
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            const ss = String(d.getSeconds()).padStart(2, '0');
            if (clockEl) clockEl.textContent = `${hh}:${min}:${ss}`;
        };
        
        updateTime();
        this.clockInterval = setInterval(updateTime, 1000);
    },

    /**
     * テーマ切り替え
     */
    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        try {
            portalStorage.setItem('theme', newTheme);
        } catch (err) {
            console.warn('Failed to save theme preference:', err);
        }
        this.updateThemeIcons();
    },

    updateThemeIcons() {
        const currentTheme = document.body.getAttribute('data-theme');
        const sun = document.querySelector('.sun-icon');
        const moon = document.querySelector('.moon-icon');
        if (sun && moon) {
            if (currentTheme === 'light') {
                sun.style.display = 'none';
                moon.style.display = 'block';
            } else {
                sun.style.display = 'block';
                moon.style.display = 'none';
            }
        }
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar?.classList.toggle('open');
    },

    /**
     * トースト通知表示
     */
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'info';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'alert-triangle';
        if (type === 'warning') icon = 'alert-circle';
        
        toast.innerHTML = `
            <i data-lucide="${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { class: 'toast-icon' } });
        
        // 自動削除
        setTimeout(() => {
            toast.style.animation = 'fadeIn 0.3s reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    /**
     * モーダルオープン
     */
    showModal(title, contentHtml, options = {}) {
        const modal = document.getElementById('modal-container');
        const body = document.getElementById('modal-body');
        if (!modal || !body) return;
        
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.maxWidth = options.maxWidth || '';
            content.style.width = options.width || '';
        }
        
        body.innerHTML = `
            <h3 class="modal-title">${title}</h3>
            <div>${contentHtml}</div>
        `;
        
        modal.style.display = 'flex';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    closeModal() {
        const modal = document.getElementById('modal-container');
        if (modal) modal.style.display = 'none';
        const content = modal ? modal.querySelector('.modal-content') : null;
        if (content) {
            content.style.maxWidth = '';
            content.style.width = '';
        }
    },

    /**
     * 休暇申請ページのレンダリング (ステップ型ウィザード)
     */
    async renderLeavePage(container) {
        const leaveBalance = Auth.user.annual_leave_balance !== undefined && Auth.user.annual_leave_balance !== null
            ? parseFloat(Auth.user.annual_leave_balance)
            : 20.0;

        container.innerHTML = `
            <div class="card" style="display:flex; flex-direction:column; gap:24px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
                    <div>
                        <h3 style="margin:0; font-size:18px;">各種休暇の申請</h3>
                        <p style="color:var(--text-secondary); font-size:13px; margin:4px 0 0 0;">年次有給休暇や特別休暇の申請を行います。承認後、スケジュールに自動で同期されます。</p>
                    </div>
                    <div style="background:var(--primary-glow); padding:8px 16px; border-radius:8px; border:1px solid var(--primary-color);">
                        <span style="font-size:12px; color:var(--text-secondary);">年休残日数:</span>
                        <strong style="font-size:16px; color:var(--primary-color); margin-left:4px;">${leaveBalance.toFixed(2)}日</strong>
                    </div>
                </div>
                
                <!-- ウィザードプログレスバー -->
                <div class="wizard-steps-container">
                    <div class="wizard-step active" id="step-indicator-1">
                        <span class="step-num">1</span>
                        <span class="step-text">区分選択</span>
                    </div>
                    <div class="wizard-connector" id="connector-1"></div>
                    <div class="wizard-step" id="step-indicator-2">
                        <span class="step-num">2</span>
                        <span class="step-text">日時指定</span>
                    </div>
                    <div class="wizard-connector" id="connector-2"></div>
                    <div class="wizard-step" id="step-indicator-3">
                        <span class="step-num">3</span>
                        <span class="step-text">理由入力・確認</span>
                    </div>
                </div>
                
                <!-- フォームエリア -->
                <form id="leave-request-form" onsubmit="Portal.handleLeaveSubmit(event)">
                    <!-- ステップ1: 区分選択 -->
                    <div class="form-step-panel active" id="form-step-panel-1">
                        <h4 class="step-panel-title">1. 休暇区分を選択してください</h4>
                        <div class="leave-type-grid">
                            <label class="leave-type-card">
                                <input type="radio" name="leave_type" value="annual" checked onchange="Portal.toggleLeaveTypeUI()">
                                <div class="card-content">
                                    <div class="card-icon icon-annual">📅</div>
                                    <div class="card-title">年次有給休暇</div>
                                    <div class="card-desc">通常の有給休暇です（1日 / 半日 / 時間単位）</div>
                                </div>
                            </label>
                            <label class="leave-type-card">
                                <input type="radio" name="leave_type" value="special" onchange="Portal.toggleLeaveTypeUI()">
                                <div class="card-content">
                                    <div class="card-icon icon-special">🎗️</div>
                                    <div class="card-title">特別休暇</div>
                                    <div class="card-desc">慶弔、公務、夏季休暇など特定の理由による休暇</div>
                                </div>
                            </label>
                            <label class="leave-type-card">
                                <input type="radio" name="leave_type" value="sick" onchange="Portal.toggleLeaveTypeUI()">
                                <div class="card-content">
                                    <div class="card-icon icon-sick">🏥</div>
                                    <div class="card-title">病気休暇</div>
                                    <div class="card-desc">疾病や負傷等により療養するための休暇</div>
                                </div>
                            </label>
                            <label class="leave-type-card">
                                <input type="radio" name="leave_type" value="compensatory" onchange="Portal.toggleLeaveTypeUI()">
                                <div class="card-content">
                                    <div class="card-icon icon-compensatory">⏳</div>
                                    <div class="card-title">代休・振替休日</div>
                                    <div class="card-desc">休日出勤等の代わりに取得する休日</div>
                                </div>
                            </label>
                        </div>
                        
                        <div class="step-footer">
                            <button type="button" class="btn btn-primary" onclick="Portal.setLeaveFormStep(2)" style="padding:10px 24px;">次へ進む &rarr;</button>
                        </div>
                    </div>
                    
                    <!-- ステップ2: 日時指定 -->
                    <div class="form-step-panel" id="form-step-panel-2">
                        <h4 class="step-panel-title">2. 取得する日時を指定してください</h4>
                        
                        <div class="form-group" id="leave-unit-container" style="margin-bottom: 20px;">
                            <label class="form-label">取得単位</label>
                            <div style="display:flex; gap:16px; margin-top:8px;">
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                    <input type="radio" name="leave_unit" value="full" checked onchange="Portal.toggleLeaveUnit()"> 終日 (1日〜複数日)
                                </label>
                                <label id="leave-unit-hour-label" style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                    <input type="radio" name="leave_unit" value="hour" onchange="Portal.toggleLeaveUnit()"> 時間休 (時間単位)
                                </label>
                            </div>
                        </div>
                        
                        <!-- 終日時の日付指定 -->
                        <div id="leave-date-range-inputs" style="display:flex; gap:16px; margin-bottom:20px; flex-wrap:wrap;">
                            <div class="form-group" style="flex:1; min-width:200px;">
                                <label class="form-label" for="leave-start-date">開始日</label>
                                <input type="date" id="leave-start-date" class="form-input" required onchange="Portal.validateLeaveDates()">
                            </div>
                            <div class="form-group" style="flex:1; min-width:200px;">
                                <label class="form-label" for="leave-end-date">終了日</label>
                                <input type="date" id="leave-end-date" class="form-input" required onchange="Portal.validateLeaveDates()">
                            </div>
                        </div>
                        
                        <!-- 時間休時の指定 -->
                        <div id="leave-time-inputs" style="display:none; flex-direction:column; gap:16px; margin-bottom:20px;">
                            <div class="form-group" style="max-width:280px;">
                                <label class="form-label" for="leave-target-date">対象日</label>
                                <input type="date" id="leave-target-date" class="form-input" onchange="Portal.validateLeaveDates()">
                            </div>
                            <div style="display:flex; gap:16px; align-items:center;">
                                <div class="form-group" style="flex:1; max-width:140px;">
                                    <label class="form-label" for="leave-start-time">開始時刻</label>
                                    <input type="time" id="leave-start-time" class="form-input" value="08:30" onchange="Portal.calculateLeaveHoursPreview()">
                                </div>
                                <div class="form-group" style="flex:1; max-width:140px;">
                                    <label class="form-label" for="leave-end-time">終了時刻</label>
                                    <input type="time" id="leave-end-time" class="form-input" value="17:15" onchange="Portal.calculateLeaveHoursPreview()">
                                </div>
                                <div style="margin-top:24px; font-size:13px; color:var(--text-secondary);">
                                    申請時間数: <strong id="leave-hours-preview" style="color:var(--primary-color); font-size:16px;">-</strong> 時間
                                </div>
                            </div>
                        </div>
                        
                        <div class="step-footer">
                            <button type="button" class="btn btn-secondary" onclick="Portal.setLeaveFormStep(1)">&larr; 戻る</button>
                            <button type="button" class="btn btn-primary" onclick="Portal.setLeaveFormStep(3)" style="padding:10px 24px;">次へ進む &rarr;</button>
                        </div>
                    </div>
                    
                    <!-- ステップ3: 理由・確認 -->
                    <div class="form-step-panel" id="form-step-panel-3">
                        <h4 class="step-panel-title">3. 申請理由を入力し、内容を確認して送信してください</h4>
                        
                        <div class="form-group" style="margin-bottom:20px;">
                            <label class="form-label" for="leave-reason">申請理由・業務引き継ぎ内容</label>
                            <textarea id="leave-reason" class="form-input" style="height:100px; padding:10px;" placeholder="例: 私用のため、家族看護のため、等" required></textarea>
                        </div>
                        
                        <!-- 申請プレビューサマリー -->
                        <div class="leave-summary-card">
                            <h5 style="margin:0 0 10px 0; font-size:14px; font-weight:600; border-bottom:1px solid var(--border-color); padding-bottom:6px;">📋 申請内容の最終確認</h5>
                            <div class="summary-row">
                                <span class="summary-label">休暇区分:</span>
                                <strong class="summary-val" id="summary-leave-type">-</strong>
                            </div>
                            <div class="summary-row">
                                <span class="summary-label">申請日時:</span>
                                <strong class="summary-val" id="summary-leave-period">-</strong>
                            </div>
                            <div class="summary-row">
                                <span class="summary-label">残日数への影響:</span>
                                <strong class="summary-val" id="summary-leave-impact" style="color:var(--danger);">-</strong>
                            </div>
                        </div>
                        
                        <div class="step-footer">
                            <button type="button" class="btn btn-secondary" onclick="Portal.setLeaveFormStep(2)">&larr; 戻る</button>
                            <button type="submit" class="btn btn-primary" style="padding:10px 30px; background:var(--success);">この内容で申請を送信する</button>
                        </div>
                    </div>
                </form>
            </div>
            
            <!-- 休暇申請履歴リスト -->
            <div class="card" style="margin-top:24px;">
                <h3 style="margin-bottom:16px;">あなたの休暇申請履歴</h3>
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>申請日時</th>
                                <th>休暇区分</th>
                                <th>期間・時間</th>
                                <th>理由</th>
                                <th>ステータス</th>
                                <th>承認者</th>
                            </tr>
                        </thead>
                        <tbody id="leave-history-tbody">
                            <tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">履歴を読み込んでいます...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        // 日付初期設定 (今日)
        const todayStr = new Date().toISOString().split('T')[0];
        const startD = document.getElementById('leave-start-date');
        const endD = document.getElementById('leave-end-date');
        const targetD = document.getElementById('leave-target-date');
        if (startD) startD.value = todayStr;
        if (endD) endD.value = todayStr;
        if (targetD) targetD.value = todayStr;
        
        // 履歴のロード
        this.loadLeaveHistory();
    },

    async renderApprovalsPage(container) {
        // 1. 打刻修正申請の取得
        const resMod = await fetch('/api/attendance/pending', {
            headers: { 'Authorization': `Bearer ${Auth.token}` }
        });
        const dataMod = await resMod.json();
        
        // 2. 休暇申請の取得
        const resLeave = await fetch('/api/attendance/leaves/pending', {
            headers: { 'Authorization': `Bearer ${Auth.token}` }
        });
        const dataLeave = await resLeave.json();
        
        // 打刻修正の行生成
        let modRowsHtml = '';
        if (dataMod.pending.length === 0) {
            modRowsHtml = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">未処理の修正申請はありません。</td></tr>`;
        } else {
            modRowsHtml = dataMod.pending.map(item => `
                <tr>
                    <td>${item.work_date}</td>
                    <td>${item.staff_name} (${item.employee_number})</td>
                    <td>${item.station_name}</td>
                    <td>${item.field_name === 'actual_clock_in' ? '出勤' : '退勤'}</td>
                    <td><del style="color:var(--text-muted);">${item.old_value || '未打刻'}</del> &rarr; <strong style="color:var(--primary-color);">${item.new_value}</strong></td>
                    <td>${item.reason}</td>
                    <td>
                        <button class="btn btn-primary" style="padding:6px 12px; font-size:12px; background:var(--success); border-radius:6px;" onclick="Portal.processApproval(${item.id}, 'approved')">承認</button>
                        <button class="btn btn-primary" style="padding:6px 12px; font-size:12px; background:var(--danger); border-radius:6px;" onclick="Portal.processApproval(${item.id}, 'rejected')">却下</button>
                    </td>
                </tr>
            `).join('');
        }
        
        // 休暇申請の行生成
        let leaveRowsHtml = '';
        const typeLabels = {
            'annual': '年次有給休暇',
            'special': '特別休暇',
            'sick': '病気休暇',
            'compensatory': '代休・振替休日'
        };
        
        if (dataLeave.pending.length === 0) {
            leaveRowsHtml = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:30px;">未処理の休暇申請はありません。</td></tr>`;
        } else {
            leaveRowsHtml = dataLeave.pending.map(item => {
                let periodStr = '';
                if (item.start_time && item.end_time) {
                    periodStr = `${item.start_date} ${item.start_time}〜${item.end_time} (${item.hours}h)`;
                } else {
                    if (item.start_date === item.end_date) {
                        periodStr = item.start_date;
                    } else {
                        periodStr = `${item.start_date} 〜 ${item.end_date}`;
                    }
                }
                
                return `
                    <tr>
                        <td>${item.staff_name} (${item.employee_number})</td>
                        <td>${item.station_name}</td>
                        <td><span class="badge" style="background:var(--primary-glow); color:var(--primary-color); font-weight:600;">${typeLabels[item.leave_type] || item.leave_type}</span></td>
                        <td>${periodStr}</td>
                        <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${item.reason}">${item.reason}</td>
                        <td>
                            <button class="btn btn-primary" style="padding:6px 12px; font-size:12px; background:var(--success); border-radius:6px;" onclick="Portal.processLeaveApproval(${item.id}, 'approved')">承認</button>
                            <button class="btn btn-primary" style="padding:6px 12px; font-size:12px; background:var(--danger); border-radius:6px;" onclick="Portal.processLeaveApproval(${item.id}, 'rejected')">却下</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
        
        container.innerHTML = `
            <!-- 打刻修正申請 -->
            <div class="card" style="margin-bottom:24px;">
                <h3>打刻修正申請の承認処理</h3>
                <p style="color:var(--text-secondary); margin-bottom:16px;">一般職員より申請された、出勤・退勤時刻の修正を審査します。</p>
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>対象日</th>
                                <th>職員名</th>
                                <th>所属</th>
                                <th>項目</th>
                                <th>修正値</th>
                                <th>理由</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${modRowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- 休暇申請 -->
            <div class="card">
                <h3>休暇申請の承認処理</h3>
                <p style="color:var(--text-secondary); margin-bottom:16px;">一般職員より申請された、年休・特休・病休等の各種休暇を審査します。承認すると自動的にスケジュールに反映されます。</p>
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>職員名</th>
                                <th>所属</th>
                                <th>休暇区分</th>
                                <th>期間・時間</th>
                                <th>理由</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${leaveRowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async processApproval(id, status) {
        try {
            const response = await fetch(`/api/attendance/${id}/approve`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify({ status })
            });
            const data = await response.json();
            if (response.ok) {
                this.showToast(data.message, 'success');
                this.updatePendingApprovalBadge();
                this.navigate('approvals');
            } else {
                this.showToast(data.error, 'error');
            }
        } catch (err) {
            this.showToast('通信エラーが発生しました。', 'error');
        }
    },

    async processLeaveApproval(id, status) {
        try {
            const response = await fetch(`/api/attendance/leave/${id}/approve`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify({ status })
            });
            const data = await response.json();
            if (response.ok) {
                this.showToast(data.message, 'success');
                this.updatePendingApprovalBadge();
                this.navigate('approvals');
            } else {
                this.showToast(data.error, 'error');
            }
        } catch (err) {
            this.showToast('通信エラーが発生しました。', 'error');
        }
    },

    // 職員管理画面 (一覧 & 新規・更新)
    // 職員管理画面 (一覧 & 新規・更新)
    async renderStaffAdminPage(container) {
        const response = await fetch('/api/admin/staff', {
            headers: { 'Authorization': `Bearer ${Auth.token}` }
        });
        const data = await response.json();
        
        // 署所マスタのマップ化
        const stationsStr = window.safeStorage.getItem('master_stations');
        let flatStationsMap = {};
        if (stationsStr) {
            try {
                const stations = JSON.parse(stationsStr);
                const flatStations = [];
                stations.forEach((st, sIdx) => {
                    flatStations.push({ id: sIdx * 10 + 1, name: st.name });
                    if (st.sub_stations) {
                        st.sub_stations.forEach((sub, subIdx) => {
                            flatStations.push({ id: sIdx * 10 + 2 + subIdx, name: sub });
                        });
                    }
                });
                flatStations.forEach(fs => { flatStationsMap[fs.id] = fs.name; });
            } catch (e) {}
        }

        // 小隊マスタの取得
        const platoonsStr = window.safeStorage.getItem('master_platoon_names') || '第1小隊, 第2小隊';
        const platoons = platoonsStr.split(',').map(p => p.trim());
        
        const rowsHtml = data.staff.map(member => {
            const stationDisplayName = flatStationsMap[member.station_id] || member.station_name;
            let platoonDisplayName = '日勤';
            if (member.platoon === '1bu') platoonDisplayName = platoons[0] || '第1小隊';
            else if (member.platoon === '2bu') platoonDisplayName = platoons[1] || '第2小隊';
            else if (member.platoon === '3bu') platoonDisplayName = platoons[2] || '第3小隊';

            return `
                <tr>
                    <td>${member.employee_number}</td>
                    <td>${member.name}</td>
                    <td>${member.rank || '-'}</td>
                    <td><span class="staff-position-badge ${Portal.getPositionClass(member.position)}">${member.position || '-'}</span></td>
                    <td>${stationDisplayName}</td>
                    <td>${platoonDisplayName}</td>
                    <td>${member.role === 'sysadmin' ? 'システム管理者' : member.role === 'admin' ? '本部管理者' : member.role === 'chief' ? '当直頭/署長' : '一般職員'}</td>
                    <td>${member.annual_leave_balance}日</td>
                    <td>
                        ${Auth.hasRole('chief', 'admin', 'sysadmin') ? `
                            <button class="btn btn-primary" style="padding:6px 12px; font-size:12px; border-radius:6px;" onclick="Portal.openStaffEditModal(${JSON.stringify(member).replace(/"/g, '&quot;')})">編集</button>
                        ` : '<span style="color:var(--text-muted)">閲覧のみ</span>'}
                    </td>
                </tr>
            `;
        }).join('');
        
        container.innerHTML = `
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
                    <div>
                        <h3>職員名簿管理</h3>
                        <p style="color:var(--text-secondary)">消防職員の所属、部区分、階級、隊、システム権限等のマスタ情報を管理します。</p>
                    </div>
                    ${Auth.hasRole('chief', 'admin', 'sysadmin') ? `
                        <div style="display:flex; gap:8px; margin-left:auto; align-items:center;">
                            <button class="btn btn-secondary" onclick="Portal.openCSVImportModal()" style="display:flex; align-items:center; gap:6px;">
                                <i data-lucide="upload" style="width:16px;height:16px;"></i> CSV一括登録
                            </button>
                            <button class="btn btn-primary" onclick="Portal.openStaffAddModal()">新規職員登録</button>
                        </div>
                    ` : ''}
                </div>
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>職員番号</th>
                                <th>氏名</th>
                                <th>階級</th>
                                <th>隊</th>
                                <th>所属</th>
                                <th>勤務区分</th>
                                <th>システム役割</th>
                                <th>年休残数</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    getPositionClass(pos) {
        if (["小隊長", "消防隊長", "消防副", "消防隊"].includes(pos)) return "pos-fire";
        if (["救急隊長", "救急副", "救急隊"].includes(pos)) return "pos-ambulance";
        if (["救助隊長", "救助副", "救助隊"].includes(pos)) return "pos-rescue";
        return "pos-general";
    },

    getPositionOptions(rank) {
        if (rank === "消防司令" || rank === "消防司令補") {
            return ["", "小隊長", "消防隊長", "救急隊長", "救助隊長", "庶務経理", "主幹"];
        } else {
            return ["", "消防隊", "救急隊", "救助隊"];
        }
    },

    openCSVImportModal() {
        const content = `
            <div style="display:flex; flex-direction:column; gap:16px; margin-top:12px;">
                <div style="background:var(--primary-glow); padding:12px 16px; border-radius:var(--radius-sm); border:1px solid var(--primary-color); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div style="font-size:13px; color:var(--text-secondary); line-height:1.5;">
                        <strong>入力手順:</strong><br>
                        1. テンプレートCSVをダウンロードします。<br>
                        2. 項目に合わせて職員情報を入力し、CSVファイルとして保存します。<br>
                        3. 文字コードを選択し、作成したCSVファイルをアップロードしてください。
                    </div>
                    <button class="btn btn-primary" style="padding:8px 16px; font-size:12px;" onclick="Portal.downloadCSVTemplate()">
                        <i data-lucide="download" style="width:14px;height:14px;"></i> テンプレートを保存
                    </button>
                </div>
                
                <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    <div class="form-group" style="flex:1; min-width:200px;">
                        <label class="form-label" style="font-size:11px;">文字コード (Excelで編集した場合は Shift_JIS)</label>
                        <select id="csv-modal-encoding" class="form-input" style="padding-left:12px; height:36px; font-size:13px;">
                            <option value="shift-jis">Shift_JIS (Excel形式)</option>
                            <option value="utf-8">UTF-8 (標準テキスト形式)</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex:1.2; min-width:240px; justify-content:flex-end; display:flex;">
                        <input type="file" id="csv-modal-file-input" accept=".csv" style="display:none;" onchange="Portal.handleCSVModalFile(event)">
                        <button class="btn btn-secondary" style="width:100%; height:36px; display:flex; justify-content:center; align-items:center; gap:6px; font-size:13px;" onclick="document.getElementById('csv-modal-file-input').click()">
                            <i data-lucide="file-spreadsheet" style="width:16px;height:16px;"></i> CSVファイルを選択
                        </button>
                    </div>
                </div>

                <!-- プレビュー表エリア -->
                <div id="csv-preview-container" style="display:none; flex-direction:column; gap:10px;">
                    <h4 style="font-size:14px; border-bottom:1px solid var(--border-color); padding-bottom:6px; margin: 12px 0 0 0;">取り込みデータプレビュー</h4>
                    <div class="table-responsive" style="max-height:280px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px;">
                        <table class="table" style="font-size:12px; width:100%;">
                            <thead>
                                <tr>
                                    <th>状態</th>
                                    <th>職員番号</th>
                                    <th>氏名</th>
                                    <th>所属署所ID</th>
                                    <th>勤務区分</th>
                                    <th>階級</th>
                                    <th>システム役割</th>
                                    <th>エラー内容</th>
                                </tr>
                            </thead>
                            <tbody id="csv-preview-tbody"></tbody>
                        </table>
                    </div>
                    <div style="font-size:11px; color:var(--text-secondary); display:flex; gap:16px;" id="csv-preview-stats">
                        <span>新規登録: <strong id="csv-preview-stat-new" style="color:var(--success);">0</strong>件</span>
                        <span>更新・上書き: <strong id="csv-preview-stat-update" style="color:var(--warning);">0</strong>件</span>
                        <span>エラー: <strong id="csv-preview-stat-error" style="color:var(--danger);">0</strong>件</span>
                    </div>
                </div>

                <div style="display:flex; gap:12px; justify-content:flex-end; border-top:1px solid var(--border-color); padding-top:16px; margin-top:8px;">
                    <button id="btn-csv-import-submit" class="btn btn-primary" style="padding:8px 24px; font-size:13px;" disabled onclick="Portal.executeCSVImport()">
                        一括登録を実行する
                    </button>
                    <button class="btn btn-secondary" style="padding:8px 20px; font-size:13px;" onclick="Portal.closeModal()">
                        キャンセル
                    </button>
                </div>
            </div>
        `;
        Portal.showModal('CSV職員情報一括登録', content, { maxWidth: '780px' });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    downloadCSVTemplate() {
        const headers = '職員番号,氏名,勤務区分,階級,役職,大型免許,救命士,救助員,機関員,日勤,システム役割,年休残日数,所属署所ID\r\n';
        const sampleRow = '1001,消防 太郎,1bu,消防士長,消防隊,1,1,0,1,0,user,20.0,1\r\n';
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, headers + sampleRow], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.setAttribute('download', '消防職員インポートテンプレート.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    async handleCSVModalFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const encoding = document.getElementById('csv-modal-encoding').value;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            try {
                const staffList = Portal.parseCSV(text);
                if (staffList.length === 0) {
                    Portal.showToast('CSVデータが空か、解析に失敗しました。', 'error');
                    return;
                }
                const response = await fetch('/api/admin/staff', {
                    headers: { 'Authorization': `Bearer ${Auth.token}` }
                });
                const staffData = await response.json();
                const existingMap = {};
                if (staffData && staffData.staff) {
                    staffData.staff.forEach(s => {
                        existingMap[s.employee_number.toString()] = s;
                    });
                }
                Portal.renderCSVPreview(staffList, existingMap);
            } catch (err) {
                console.error(err);
                Portal.showToast(err.message || 'CSVの解析に失敗しました。', 'error');
            }
            event.target.value = '';
        };
        if (encoding === 'shift-jis') {
            reader.readAsText(file, 'Shift_JIS');
        } else {
            reader.readAsText(file, 'UTF-8');
        }
    },

    renderCSVPreview(staffList, existingMap) {
        const tbody = document.getElementById('csv-preview-tbody');
        const container = document.getElementById('csv-preview-container');
        const btnSubmit = document.getElementById('btn-csv-import-submit');
        if (!tbody || !container || !btnSubmit) return;
        
        tbody.innerHTML = '';
        let newCount = 0;
        let updateCount = 0;
        let errorCount = 0;
        const validPlatoons = ['1bu', '2bu', '3bu', 'nikkin'];
        const validRoles = ['staff', 'chief', 'admin', 'sysadmin', 'user'];

        Portal.parsedCSVList = staffList;
        
        staffList.forEach(s => {
            let rowClass = '';
            let statusBadge = '';
            let errors = [];
            
            if (!s.employee_number) errors.push('職員番号が未入力です');
            if (!s.name) errors.push('氏名が未入力です');
            if (!s.platoon) errors.push('勤務区分が未入力です');
            else if (!validPlatoons.includes(s.platoon)) errors.push(`無効な勤務区分: ${s.platoon} (1bu/2bu/3bu/nikkin)`);
            if (!s.role) errors.push('システム役割が未入力です');
            else if (!validRoles.includes(s.role)) errors.push(`無効な役割: ${s.role} (staff/chief/admin/sysadmin)`);
            if (isNaN(s.station_id) || s.station_id <= 0) errors.push('無効な所属署所ID');

            if (errors.length > 0) {
                rowClass = 'style="background:rgba(239,68,68,0.08); color:var(--danger);"';
                statusBadge = '<span class="badge" style="background:var(--danger); color:#fff; font-size:10px; padding:2px 6px;">エラー</span>';
                errorCount++;
            } else {
                const existing = existingMap[s.employee_number.toString()];
                if (existing) {
                    rowClass = 'style="background:rgba(245,158,11,0.05);"';
                    statusBadge = '<span class="badge" style="background:var(--warning); color:#fff; font-size:10px; padding:2px 6px;">更新</span>';
                    updateCount++;
                } else {
                    rowClass = 'style="background:rgba(16,185,129,0.05);"';
                    statusBadge = '<span class="badge" style="background:var(--success); color:#fff; font-size:10px; padding:2px 6px;">新規</span>';
                    newCount++;
                }
            }
            
            const platoonLabel = s.platoon === '1bu' ? 'A日(1部)' : s.platoon === '2bu' ? 'B日(2部)' : s.platoon === '3bu' ? 'C日(3部)' : '日勤';
            const roleLabel = s.role === 'sysadmin' ? '管理者(システム)' : s.role === 'admin' ? '管理者(本部)' : s.role === 'chief' ? '当直頭/署長' : '一般職員';
            
            tbody.innerHTML += `
                <tr ${rowClass}>
                    <td style="text-align:center; padding:6px 8px;">${statusBadge}</td>
                    <td style="padding:6px 8px;"><strong>${s.employee_number || '-'}</strong></td>
                    <td style="padding:6px 8px;">${s.name || '-'}</td>
                    <td style="padding:6px 8px; text-align:center;">${s.station_id || '-'}</td>
                    <td style="padding:6px 8px;">${platoonLabel}</td>
                    <td style="padding:6px 8px;">${s.rank || '-'}</td>
                    <td style="padding:6px 8px;">${roleLabel}</td>
                    <td style="padding:6px 8px; font-weight:600; color:var(--danger);">${errors.join(', ')}</td>
                </tr>
            `;
        });
        
        document.getElementById('csv-preview-stat-new').textContent = newCount;
        document.getElementById('csv-preview-stat-update').textContent = updateCount;
        document.getElementById('csv-preview-stat-error').textContent = errorCount;
        container.style.display = 'flex';
        btnSubmit.disabled = errorCount > 0 || staffList.length === 0;
    },

    async executeCSVImport() {
        if (!Portal.parsedCSVList || Portal.parsedCSVList.length === 0) return;
        const btnSubmit = document.getElementById('btn-csv-import-submit');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = '登録中...';
        }
        try {
            const response = await fetch('/api/admin/staff/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify({ staffList: Portal.parsedCSVList })
            });
            const data = await response.json();
            if (response.ok) {
                Portal.showToast(data.message, 'success');
                Portal.closeModal();
                Portal.navigate('staff_admin');
            } else {
                Portal.showToast(data.error || 'インポートに失敗しました。', 'error');
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = '一括登録を実行する';
                }
            }
        } catch (err) {
            console.error(err);
            Portal.showToast('通信エラーが発生しました。', 'error');
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = '一括登録を実行する';
            }
        }
    },

    parseCSV(text) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        const fieldMapping = {
            'employee_number': ['職員番号', 'employee_number'],
            'name': ['氏名', 'name'],
            'platoon': ['勤務区分(platoon)', '勤務区分', 'platoon'],
            'rank': ['階級', 'rank'],
            'position': ['隊(position)', '隊', '役職(position)', '役職', 'position'],
            'has_large_license': ['大型免許', 'has_large_license'],
            'is_paramedic': ['救命士', 'is_paramedic'],
            'is_rescue': ['救助員', 'is_rescue'],
            'is_kikan': ['機関員', 'is_kikan'],
            'is_day_worker': ['日勤', 'is_day_worker'],
            'role': ['システム役割(role)', 'システム役割', 'role'],
            'annual_leave_balance': ['年休残日数', 'annual_leave_balance'],
            'station_id': ['所属署所ID(station_id)', '所属署所ID', 'station_id']
        };

        const headerIndices = {};
        for (const key in fieldMapping) {
            const possibleNames = fieldMapping[key];
            const idx = headers.findIndex(h => possibleNames.some(pName => h === pName || h.toLowerCase() === pName.toLowerCase()));
            headerIndices[key] = idx;
        }

        const requiredKeys = ['employee_number', 'name', 'platoon', 'role', 'station_id'];
        const missingKeys = requiredKeys.filter(k => headerIndices[k] === -1);
        if (missingKeys.length > 0) {
            throw new Error(`CSVのヘッダーに必要な項目が不足しています。不足: ${missingKeys.map(k => fieldMapping[k][0]).join(', ')}`);
        }

        const staffList = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const values = [];
            let currentVal = '';
            let inQuotes = false;
            for (let c = 0; c < line.length; c++) {
                const char = line[c];
                if (char === '"' || char === "'") {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(currentVal.trim());
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim());
            if (values.length < headers.length) continue;

            const getVal = (key, defaultVal = '') => {
                const idx = headerIndices[key];
                if (idx === -1 || idx === undefined || values[idx] === undefined) return defaultVal;
                return values[idx].replace(/^["']|["']$/g, '');
            };

            const employee_number = getVal('employee_number');
            const name = getVal('name');
            let platoon = getVal('platoon');
            const rank = getVal('rank');
            const position = getVal('position');
            const has_large_license = parseInt(getVal('has_large_license', '0')) ? 1 : 0;
            const is_paramedic = parseInt(getVal('is_paramedic', '0')) ? 1 : 0;
            const is_rescue = parseInt(getVal('is_rescue', '0')) ? 1 : 0;
            const is_kikan = parseInt(getVal('is_kikan', '0')) ? 1 : 0;
            const is_day_worker = parseInt(getVal('is_day_worker', '0')) ? 1 : 0;
            let role = getVal('role');
            const annual_leave_balance = parseFloat(getVal('annual_leave_balance', '20.0'));
            const station_id = parseInt(getVal('station_id'));

            if (platoon === '1部' || platoon === '第1小隊' || platoon === '1bu') platoon = '1bu';
            else if (platoon === '2部' || platoon === '第2小隊' || platoon === '2bu') platoon = '2bu';
            else if (platoon === '3部' || platoon === '第3小隊' || platoon === '3bu') platoon = '3bu';
            else if (platoon === '日勤者' || platoon === '日勤' || platoon === 'nikkin') platoon = 'nikkin';

            if (role === '一般職員' || role === '一般' || role === 'staff') role = 'staff';
            else if (role === '当直頭' || role === '署長' || role === 'chief') role = 'chief';
            else if (role === '本部管理者' || role === '管理者' || role === 'admin') role = 'admin';
            else if (role === 'システム管理者' || role === 'sysadmin') role = 'sysadmin';
            else if (role === 'user') role = 'staff';

            staffList.push({
                employee_number, name, platoon, rank, position,
                has_large_license, is_paramedic, is_rescue, is_kikan,
                is_day_worker, role, annual_leave_balance, station_id
            });
        }
        return staffList;
    },

    openStaffAddModal() {
        // 署所マスタのロードと平坦化
        const stationsStr = window.safeStorage.getItem('master_stations');
        let stations = [];
        if (stationsStr) {
            try { stations = JSON.parse(stationsStr); } catch (e) { stations = []; }
        }
        if (stations.length === 0) {
            stations = [
                { name: "指宿消防署", sub_stations: ["山川分遣所", "開聞分遣所"] },
                { name: "南薩分署", sub_stations: ["喜入分遣所"] }
            ];
        }
        const flatStations = [];
        stations.forEach((st, sIdx) => {
            flatStations.push({ id: sIdx * 10 + 1, name: st.name });
            if (st.sub_stations) {
                st.sub_stations.forEach((sub, subIdx) => {
                    flatStations.push({ id: sIdx * 10 + 2 + subIdx, name: sub });
                });
            }
        });
        const stationOptions = flatStations.map(fs => `<option value="${fs.id}">${fs.name}</option>`).join('');

        // 小隊・勤務形態マスタのロード
        const platoonsStr = window.safeStorage.getItem('master_platoon_names') || '第1小隊, 第2小隊';
        const platoons = platoonsStr.split(',').map(p => p.trim());
        const shiftTypesStr = window.safeStorage.getItem('master_shift_types') || '日勤, 2部';
        const shiftTypes = shiftTypesStr.split(',').map(s => s.trim());

        let platoonOptions = '';
        if (platoons[0]) platoonOptions += `<option value="1bu">${platoons[0]} (A日)</option>`;
        if (platoons[1]) platoonOptions += `<option value="2bu">${platoons[1]} (B日)</option>`;
        if (shiftTypes.includes('3部')) {
            const label3 = platoons[2] || '第3小隊';
            platoonOptions += `<option value="3bu">${label3} (C日)</option>`;
        }
        if (shiftTypes.includes('日勤')) {
            platoonOptions += `<option value="nikkin">日勤</option>`;
        }

        const content = `
            <form id="staff-form" onsubmit="Portal.handleStaffSubmit(event, 'add')">
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">職員番号 (ユニーク)</label>
                    <input class="form-input" style="padding-left:12px;" type="text" id="member-employee_number" required>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">暗証番号 (4桁の数字)</label>
                    <input class="form-input" style="padding-left:12px;" type="password" id="member-pin" pattern="[0-9]{4}" maxlength="4" required>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">氏名</label>
                    <input class="form-input" style="padding-left:12px;" type="text" id="member-name" required>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">所属署所</label>
                    <select class="form-input" style="padding-left:12px;" id="member-station_id" required>
                        ${stationOptions}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">部区分 (サイクル判定)</label>
                    <select class="form-input" style="padding-left:12px;" id="member-platoon" required>
                        ${platoonOptions}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">階級</label>
                    <select class="form-input" style="padding-left:12px;" id="member-rank" required>
                        <option value="消防司令">消防司令</option>
                        <option value="消防司令補">消防司令補</option>
                        <option value="消防士長">消防士長</option>
                        <option value="消防副士長">消防副士長</option>
                        <option value="消防士" selected>消防士</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">隊</label>
                    <select class="form-input" style="padding-left:12px;" id="member-position" required>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">資格設定</label>
                    <div style="display:flex; flex-wrap:wrap; gap:8px;">
                        <label style="display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer;"><input type="checkbox" id="member-large"> 大型</label>
                        <label style="display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer;"><input type="checkbox" id="member-paramedic"> 救命士</label>
                        <label style="display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer;"><input type="checkbox" id="member-kikan"> 機関員</label>
                        <label style="display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer;"><input type="checkbox" id="member-day_worker"> 日勤</label>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">システム権限</label>
                    <select class="form-input" style="padding-left:12px;" id="member-role" required>
                        <option value="staff">一般職員</option>
                        <option value="chief">当直頭 / 署長</option>
                        <option value="admin">本部管理者</option>
                        <option value="sysadmin">システム管理者</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:20px;">
                    <label class="form-label">年休残日数</label>
                    <input class="form-input" style="padding-left:12px;" type="number" step="0.5" id="member-annual_leave_balance" value="20.0">
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%;">登録する</button>
            </form>
        `;
        this.showModal('新規職員登録', content);
        
        const rankSel = document.getElementById('member-rank');
        const posSel = document.getElementById('member-position');
        if (rankSel && posSel) {
            const updateOptions = () => {
                const selectedRank = rankSel.value;
                posSel.innerHTML = '';
                const opts = Portal.getPositionOptions(selectedRank);
                opts.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p;
                    opt.textContent = p === "" ? "未選択" : p;
                    posSel.appendChild(opt);
                });
            };
            rankSel.addEventListener('change', updateOptions);
            updateOptions();
        }
    },

    openStaffEditModal(member) {
        // 署所マスタのロードと平坦化
        const stationsStr = window.safeStorage.getItem('master_stations');
        let stations = [];
        if (stationsStr) {
            try { stations = JSON.parse(stationsStr); } catch (e) { stations = []; }
        }
        if (stations.length === 0) {
            stations = [
                { name: "指宿消防署", sub_stations: ["山川分遣所", "開聞分遣所"] },
                { name: "南薩分署", sub_stations: ["喜入分遣所"] }
            ];
        }
        const flatStations = [];
        stations.forEach((st, sIdx) => {
            flatStations.push({ id: sIdx * 10 + 1, name: st.name });
            if (st.sub_stations) {
                st.sub_stations.forEach((sub, subIdx) => {
                    flatStations.push({ id: sIdx * 10 + 2 + subIdx, name: sub });
                });
            }
        });
        const stationOptions = flatStations.map(fs => `<option value="${fs.id}" ${member.station_id === fs.id ? 'selected' : ''}>${fs.name}</option>`).join('');

        // 小隊・勤務形態マスタのロード
        const platoonsStr = window.safeStorage.getItem('master_platoon_names') || '第1小隊, 第2小隊';
        const platoons = platoonsStr.split(',').map(p => p.trim());
        const shiftTypesStr = window.safeStorage.getItem('master_shift_types') || '日勤, 2部';
        const shiftTypes = shiftTypesStr.split(',').map(s => s.trim());

        let platoonOptions = '';
        if (platoons[0]) platoonOptions += `<option value="1bu" ${member.platoon === '1bu' ? 'selected' : ''}>${platoons[0]} (A日)</option>`;
        if (platoons[1]) platoonOptions += `<option value="2bu" ${member.platoon === '2bu' ? 'selected' : ''}>${platoons[1]} (B日)</option>`;
        if (shiftTypes.includes('3部')) {
            const label3 = platoons[2] || '第3小隊';
            platoonOptions += `<option value="3bu" ${member.platoon === '3bu' ? 'selected' : ''}>${label3} (C日)</option>`;
        }
        if (shiftTypes.includes('日勤')) {
            platoonOptions += `<option value="nikkin" ${member.platoon === 'nikkin' ? 'selected' : ''}>日勤</option>`;
        }

        const content = `
            <form id="staff-form" onsubmit="Portal.handleStaffSubmit(event, 'edit', ${member.id})">
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">職員番号 (変更不可)</label>
                    <input class="form-input" style="padding-left:12px;" type="text" value="${member.employee_number}" disabled>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">暗証番号 (変更する場合のみ入力)</label>
                    <input class="form-input" style="padding-left:12px;" type="password" id="member-pin" pattern="[0-9]{4}" maxlength="4" placeholder="変更しない">
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">氏名</label>
                    <input class="form-input" style="padding-left:12px;" type="text" id="member-name" value="${member.name}" required>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">所属署所</label>
                    <select class="form-input" style="padding-left:12px;" id="member-station_id" required>
                        ${stationOptions}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">部区分</label>
                    <select class="form-input" style="padding-left:12px;" id="member-platoon" required>
                        ${platoonOptions}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">階級</label>
                    <select class="form-input" style="padding-left:12px;" id="member-rank" required>
                        <option value="消防司令" ${member.rank === '消防司令' ? 'selected' : ''}>消防司令</option>
                        <option value="消防司令補" ${member.rank === '消防司令補' ? 'selected' : ''}>消防司令補</option>
                        <option value="消防士長" ${member.rank === '消防士長' ? 'selected' : ''}>消防士長</option>
                        <option value="消防副士長" ${member.rank === '消防副士長' ? 'selected' : ''}>消防副士長</option>
                        <option value="消防士" ${member.rank === '消防士' ? 'selected' : ''}>消防士</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">隊</label>
                    <select class="form-input" style="padding-left:12px;" id="member-position" required>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">資格設定</label>
                    <div style="display:flex; flex-wrap:wrap; gap:8px;">
                        <label style="display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer;"><input type="checkbox" id="member-large" ${member.has_large_license ? 'checked' : ''}> 大型</label>
                        <label style="display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer;"><input type="checkbox" id="member-paramedic" ${member.is_paramedic ? 'checked' : ''}> 救命士</label>
                        <label style="display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer;"><input type="checkbox" id="member-kikan" ${member.is_kikan ? 'checked' : ''}> 機関員</label>
                        <label style="display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer;"><input type="checkbox" id="member-day_worker" ${member.is_day_worker ? 'checked' : ''}> 日勤</label>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">システム権限</label>
                    <select class="form-input" style="padding-left:12px;" id="member-role" required>
                        <option value="staff" ${member.role === 'staff' ? 'selected' : ''}>一般職員</option>
                        <option value="chief" ${member.role === 'chief' ? 'selected' : ''}>当直頭 / 署長</option>
                        <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>本部管理者</option>
                        <option value="sysadmin" ${member.role === 'sysadmin' ? 'selected' : ''}>システム管理者</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">年休残日数</label>
                    <input class="form-input" style="padding-left:12px;" type="number" step="0.5" id="member-annual_leave_balance" value="${member.annual_leave_balance}">
                </div>
                <div class="form-group" style="margin-bottom:20px;">
                    <label class="form-label">在籍状態</label>
                    <select class="form-input" style="padding-left:12px;" id="member-is_active" required>
                        <option value="1" ${member.is_active === 1 ? 'selected' : ''}>在籍・有効</option>
                        <option value="0" ${member.is_active === 0 ? 'selected' : ''}>退職・無効</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%;">更新する</button>
            </form>
        `;
        this.showModal('職員情報の編集', content);
        
        const rankSel = document.getElementById('member-rank');
        const posSel = document.getElementById('member-position');
        if (rankSel && posSel) {
            const updateOptions = () => {
                const selectedRank = rankSel.value;
                posSel.innerHTML = '';
                const opts = Portal.getPositionOptions(selectedRank);
                opts.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p;
                    opt.textContent = p === "" ? "未選択" : p;
                    if (p === member.position) opt.selected = true;
                    posSel.appendChild(opt);
                });
            };
            rankSel.addEventListener('change', updateOptions);
            updateOptions();
        }
    },

    async handleStaffSubmit(event, action, staffId = null) {
        event.preventDefault();
        
        const payload = {
            name: document.getElementById('member-name').value.trim(),
            station_id: parseInt(document.getElementById('member-station_id').value),
            platoon: document.getElementById('member-platoon').value,
            rank: document.getElementById('member-rank').value,
            position: document.getElementById('member-position').value,
            role: document.getElementById('member-role').value,
            annual_leave_balance: parseFloat(document.getElementById('member-annual_leave_balance').value),
            has_large_license: document.getElementById('member-large').checked ? 1 : 0,
            is_paramedic: document.getElementById('member-paramedic').checked ? 1 : 0,
            is_rescue: ["救助隊", "救助副", "救助隊長", "小隊長", "主幹"].includes(document.getElementById('member-position').value) ? 1 : 0,
            is_kikan: document.getElementById('member-kikan').checked ? 1 : 0,
            is_day_worker: document.getElementById('member-day_worker').checked ? 1 : 0
        };
        
        const pinEl = document.getElementById('member-pin');
        if (pinEl && pinEl.value.trim() !== '') {
            payload.pin = pinEl.value.trim();
        }
        
        if (action === 'add') {
            payload.employee_number = document.getElementById('member-employee_number').value.trim();
        } else {
            payload.is_active = parseInt(document.getElementById('member-is_active').value);
        }
        
        try {
            const url = action === 'add' ? '/api/admin/staff' : `/api/admin/staff/${staffId}`;
            const method = action === 'add' ? 'POST' : 'PUT';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            if (response.ok) {
                this.showToast(data.message, 'success');
                this.closeModal();
                this.navigate('staff_admin');
            } else {
                this.showToast(data.error, 'error');
            }
        } catch (err) {
            this.showToast('通信エラーが発生しました。', 'error');
        }
    },

    // システム設定画面
    async renderSettingsPage(container) {
        const response = await fetch('/api/admin/settings', {
            headers: { 'Authorization': `Bearer ${Auth.token}` }
        });
        const data = await response.json();
        
        container.innerHTML = `
            <div class="card" style="max-width: 600px; margin: 0 auto;">
                <h3>システム設定</h3>
                <p style="color:var(--text-secondary); margin-bottom: 24px;">消防本部の基本設定および打刻丸めルールのカスタマイズ。</p>
                
                <form id="settings-form" onsubmit="Portal.handleSettingsSubmit(event)">
                    <div class="form-group" style="margin-bottom:16px;">
                        <label class="form-label">消防本部名称</label>
                        <input class="form-input" style="padding-left:12px;" type="text" id="settings-name" value="${data.department.name}" required>
                    </div>
                    
                    <div class="form-group" style="margin-bottom:16px;">
                        <label class="form-label">勤務体制</label>
                        <select class="form-input" style="padding-left:12px;" id="settings-shift_system" required>
                            <option value="2bu" ${data.department.shift_system === '2bu' ? 'selected' : ''}>2部制 (当務・明番・週休・日勤)</option>
                            <option value="3bu" ${data.department.shift_system === '3bu' ? 'selected' : ''}>3部制 (当務・非番・明番・週休等)</option>
                        </select>
                    </div>
                    
                    <div class="form-group" style="margin-bottom:16px;">
                        <label class="form-label">サイクル日数 (勤務周期)</label>
                        <input class="form-input" style="padding-left:12px;" type="number" id="settings-cycle_days" value="${data.department.cycle_days}" required>
                    </div>
                    
                    <h4 style="margin:24px 0 12px 0; border-bottom:1px solid var(--border-color); padding-bottom:8px;">打刻の丸め設定</h4>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
                        <div class="form-group">
                            <label class="form-label">出勤時丸め単位 (分)</label>
                            <select class="form-input" style="padding-left:12px;" id="settings-clock_in_unit" required>
                                <option value="5" ${data.rounding.clock_in_unit === 5 ? 'selected' : ''}>5分</option>
                                <option value="10" ${data.rounding.clock_in_unit === 10 ? 'selected' : ''}>10分</option>
                                <option value="15" ${data.rounding.clock_in_unit === 15 ? 'selected' : ''}>15分</option>
                                <option value="30" ${data.rounding.clock_in_unit === 30 ? 'selected' : ''}>30分</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">出勤時丸め方向</label>
                            <select class="form-input" style="padding-left:12px;" id="settings-clock_in_direction" required>
                                <option value="up" ${data.rounding.clock_in_direction === 'up' ? 'selected' : ''}>切り上げ (例: 8:16 &rarr; 8:30)</option>
                                <option value="down" ${data.rounding.clock_in_direction === 'down' ? 'selected' : ''}>切り捨て (例: 8:16 &rarr; 8:15)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">退勤時丸め単位 (分)</label>
                            <select class="form-input" style="padding-left:12px;" id="settings-clock_out_unit" required>
                                <option value="5" ${data.rounding.clock_out_unit === 5 ? 'selected' : ''}>5分</option>
                                <option value="10" ${data.rounding.clock_out_unit === 10 ? 'selected' : ''}>10分</option>
                                <option value="15" ${data.rounding.clock_out_unit === 15 ? 'selected' : ''}>15分</option>
                                <option value="30" ${data.rounding.clock_out_unit === 30 ? 'selected' : ''}>30分</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">退勤時丸め方向</label>
                            <select class="form-input" style="padding-left:12px;" id="settings-clock_out_direction" required>
                                <option value="down" ${data.rounding.clock_out_direction === 'down' ? 'selected' : ''}>切り捨て (例: 17:29 &rarr; 17:15)</option>
                                <option value="up" ${data.rounding.clock_out_direction === 'up' ? 'selected' : ''}>切り上げ (例: 17:01 &rarr; 17:15)</option>
                            </select>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary" style="width:100%;">設定を保存する</button>
                </form>
            </div>
        `;
    },

    async handleSettingsSubmit(event) {
        event.preventDefault();
        
        const payload = {
            name: document.getElementById('settings-name').value.trim(),
            shift_system: document.getElementById('settings-shift_system').value,
            cycle_days: parseInt(document.getElementById('settings-cycle_days').value),
            clock_in_unit: parseInt(document.getElementById('settings-clock_in_unit').value),
            clock_in_direction: document.getElementById('settings-clock_in_direction').value,
            clock_out_unit: parseInt(document.getElementById('settings-clock_out_unit').value),
            clock_out_direction: document.getElementById('settings-clock_out_direction').value
        };
        
        try {
            const response = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            if (response.ok) {
                this.showToast(data.message, 'success');
                // ヘッダー名更新などのためリロード
                setTimeout(() => window.location.reload(), 1000);
            } else {
                this.showToast(data.error, 'error');
            }
        } catch (err) {
            this.showToast('通信エラーが発生しました。', 'error');
        }
    },

    /**
     * システムマスタ管理初期設定画面 (業者用) の描画
     */
    renderMasterAdminPage() {
        const app = document.getElementById('app');
        
        // 既存データの読み込み (localStorage / safeStorage)
        const hqName = window.safeStorage.getItem('master_hq_name') || '指宿消防署';
        const platoons = window.safeStorage.getItem('master_platoon_names') || '第1小隊, 第2小隊';
        const shiftTypesStr = window.safeStorage.getItem('master_shift_types') || '2部';
        const systemIcon = window.safeStorage.getItem('master_system_icon') || '';
        const stationsStr = window.safeStorage.getItem('master_stations');
        
        const shiftTypes = shiftTypesStr.split(',').map(s => s.trim());
        
        let stations = [];
        if (stationsStr) {
            try { stations = JSON.parse(stationsStr); } catch (e) { stations = []; }
        }
        if (stations.length === 0) {
            stations = [
                { name: "指宿消防署", sub_stations: ["山川分遣所", "開聞分遣所"] },
                { name: "南薩分署", sub_stations: ["喜入分遣所"] }
            ];
        }
        
        app.innerHTML = `
            <div class="login-wrapper" style="min-height: 100vh; padding: 40px 20px; display: flex; justify-content: center; align-items: center; background: radial-gradient(circle at 50% 50%, #1e293b 0%, #0f172a 100%);">
                <div class="login-card" style="max-width: 650px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.05); background: rgba(30, 41, 59, 0.8); backdrop-filter: blur(16px); border-radius: 16px; margin: 20px 0;">
                    <div class="login-header">
                        <div class="login-logo" style="background: linear-gradient(135deg, #f59e0b, #ef4444); margin: 0 auto 16px auto; width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white;">
                            <i data-lucide="settings" style="width: 32px; height: 32px;"></i>
                        </div>
                        <h1 class="login-title" style="color: #f8fafc; font-size: 24px; font-weight: 700;">システムマスタ管理初期設定</h1>
                        <p class="login-subtitle" style="color: #94a3b8; font-size: 13px;">本システムを導入する導入業者向けの初期パラメータ設定画面です</p>
                    </div>
                    
                    <form id="master-admin-form" style="display: flex; flex-direction: column; gap: 20px; text-align: left; margin-top: 24px;">
                        <div class="form-group">
                            <label class="form-label" style="font-weight: 600; color: #cbd5e1; font-size: 13px; margin-bottom: 8px; display: block;">① 消防本部名</label>
                            <input class="form-input" type="text" id="master-hq-name" required value="${hqName}" placeholder="例: 指宿消防署" style="background: rgba(15, 23, 42, 0.6); border-color: rgba(255, 255, 255, 0.1); color: #f1f5f9; padding: 10px 14px; border-radius: 8px;">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" style="font-weight: 600; color: #cbd5e1; font-size: 13px; margin-bottom: 8px; display: block;">② 小隊名 (カンマ区切りで入力)</label>
                            <input class="form-input" type="text" id="master-platoons" required value="${platoons}" placeholder="例: 第1小隊, 第2小隊, 日勤隊" style="background: rgba(15, 23, 42, 0.6); border-color: rgba(255, 255, 255, 0.1); color: #f1f5f9; padding: 10px 14px; border-radius: 8px;">
                            <span style="font-size: 11px; color: #94a3b8; margin-top: 6px; display: block; line-height: 1.4;">※ カンマ（,）で区切って複数登録できます。小隊別フィルタなどで利用されます。</span>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" style="font-weight: 600; color: #cbd5e1; font-size: 13px; margin-bottom: 8px; display: block;">③ 勤務形態 (複数選択可)</label>
                            <div style="display: flex; gap: 24px; margin-top: 8px; background: rgba(15, 23, 42, 0.4); padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05);">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #e2e8f0; font-size: 14px; font-weight: 500;">
                                    <input type="checkbox" name="master-shifts" value="日勤" ${shiftTypes.includes('日勤') ? 'checked' : ''} style="accent-color: #ef4444; width: 16px; height: 16px;"> 日勤
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #e2e8f0; font-size: 14px; font-weight: 500;">
                                    <input type="checkbox" name="master-shifts" value="2部" ${shiftTypes.includes('2部') ? 'checked' : ''} style="accent-color: #ef4444; width: 16px; height: 16px;"> 2部当直
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #e2e8f0; font-size: 14px; font-weight: 500;">
                                    <input type="checkbox" name="master-shifts" value="3部" ${shiftTypes.includes('3部') ? 'checked' : ''} style="accent-color: #ef4444; width: 16px; height: 16px;"> 3部当直
                                </label>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" style="font-weight: 600; color: #cbd5e1; font-size: 13px; margin-bottom: 8px; display: block;">⑤ 署所構成 (署の配下に所がある構成)</label>
                            <div id="master-stations-container" style="display: flex; flex-direction: column; gap: 16px; margin-top: 8px;">
                                <!-- 動的レンダリング -->
                            </div>
                            <button type="button" class="btn" id="add-hq-station-btn" style="margin-top: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; font-size: 12px; padding: 6px 12px; display: flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 6px;">
                                <i data-lucide="plus" style="width: 14px; height: 14px;"></i> 署を追加する
                            </button>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" style="font-weight: 600; color: #cbd5e1; font-size: 13px; margin-bottom: 8px; display: block;">④ システム用アイコン画像 (実装検証用)</label>
                            <div style="display: flex; align-items: center; gap: 20px; margin-top: 8px; background: rgba(15, 23, 42, 0.4); padding: 16px; border-radius: 8px; border: 1px dashed rgba(255, 255, 255, 0.15);">
                                <div id="icon-preview-container" style="width: 64px; height: 64px; border-radius: 12px; background: #334155; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px solid #ef4444; flex-shrink: 0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                                    ${systemIcon ? `<img src="${systemIcon}" id="master-icon-img" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="image" id="master-icon-placeholder" style="width: 28px; height: 28px; color: #94a3b8;"></i>`}
                                </div>
                                <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px;">
                                    <input type="file" id="master-icon-file" accept="image/*" style="font-size: 12px; color: #cbd5e1;">
                                    <span style="font-size: 11px; color: #94a3b8; display: block; line-height: 1.4;">※ 画像をアップロードするとリアルタイムでBase64データとして保存され、復元可能です。</span>
                                </div>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 12px; margin-top: 16px;">
                            <button type="button" class="btn btn-secondary" style="flex: 1; padding: 12px; border-radius: 8px; font-weight: 500; font-size: 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1;" onclick="Portal.renderLoginPage()">
                                ログイン画面に戻る
                            </button>
                            <button type="submit" class="btn btn-primary" style="flex: 1; padding: 12px; border-radius: 8px; font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, #f59e0b, #ef4444); border: none; color: white;">
                                <i data-lucide="save" style="width: 18px; height: 18px;"></i> 設定を保存
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        const renderStationsList = () => {
            const container = document.getElementById('master-stations-container');
            container.innerHTML = stations.map((st, sIdx) => `
                <div class="station-block" data-idx="${sIdx}" style="background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.08); padding: 16px; border-radius: 8px; position: relative;">
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px;">
                        <span style="font-size: 11px; background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 600;">署</span>
                        <input type="text" class="station-name-input form-input" value="${st.name}" placeholder="例: 指宿消防署" style="background: rgba(15, 23, 42, 0.6); border-color: rgba(255, 255, 255, 0.1); color: #f1f5f9; padding: 6px 10px; border-radius: 6px; font-size: 13px; font-weight: 600; flex-grow: 1;">
                        <button type="button" class="delete-station-btn" data-idx="${sIdx}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;" title="この署と配下の所を削除">
                            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                        </button>
                    </div>
                    <div class="sub-stations-list" style="margin-left: 24px; display: flex; flex-direction: column; gap: 8px; border-left: 2px dashed rgba(255,255,255,0.1); padding-left: 16px;">
                        ${st.sub_stations.map((sub, subIdx) => `
                            <div class="sub-station-item" data-sub-idx="${subIdx}" style="display: flex; gap: 10px; align-items: center;">
                                <span style="font-size: 10px; background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 600;">所</span>
                                <input type="text" class="sub-station-name-input form-input" value="${sub}" placeholder="例: 山川分遣所" style="background: rgba(15, 23, 42, 0.6); border-color: rgba(255, 255, 255, 0.1); color: #f1f5f9; padding: 4px 8px; border-radius: 6px; font-size: 12px; flex-grow: 1;">
                                <button type="button" class="delete-sub-station-btn" data-idx="${sIdx}" data-sub-idx="${subIdx}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;" title="この所を削除">
                                    <i data-lucide="x" style="width: 14px; height: 14px;"></i>
                                </button>
                            </div>
                        `).join('')}
                        <button type="button" class="add-sub-station-btn" data-idx="${sIdx}" style="background: none; border: 1px dashed rgba(255,255,255,0.15); color: #94a3b8; cursor: pointer; padding: 4px 8px; border-radius: 6px; font-size: 11px; display: flex; align-items: center; gap: 4px; align-self: flex-start; margin-top: 4px;">
                            <i data-lucide="plus" style="width: 12px; height: 12px;"></i> 所を追加
                        </button>
                    </div>
                </div>
            `).join('');
            
            if (typeof lucide !== 'undefined') lucide.createIcons();
            bindStationEvents();
        };

        const bindStationEvents = () => {
            document.querySelectorAll('.station-name-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.closest('.station-block').dataset.idx);
                    stations[idx].name = e.target.value.trim();
                });
            });

            document.querySelectorAll('.sub-station-name-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const block = e.target.closest('.station-block');
                    const item = e.target.closest('.sub-station-item');
                    const idx = parseInt(block.dataset.idx);
                    const subIdx = parseInt(item.dataset.subIdx);
                    stations[idx].sub_stations[subIdx] = e.target.value.trim();
                });
            });

            document.querySelectorAll('.delete-station-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(btn.dataset.idx);
                    stations.splice(idx, 1);
                    renderStationsList();
                });
            });

            document.querySelectorAll('.delete-sub-station-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(btn.dataset.idx);
                    const subIdx = parseInt(btn.dataset.subIdx);
                    stations[idx].sub_stations.splice(subIdx, 1);
                    renderStationsList();
                });
            });

            document.querySelectorAll('.add-sub-station-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(btn.dataset.idx);
                    stations[idx].sub_stations.push('');
                    renderStationsList();
                });
            });
        };

        // 署の追加
        document.getElementById('add-hq-station-btn').addEventListener('click', () => {
            stations.push({ name: '', sub_stations: [] });
            renderStationsList();
        });

        // 初回描画
        renderStationsList();
        
        // 画像アップロードのプレビュー＆Base64変換処理
        const fileInput = document.getElementById('master-icon-file');
        const previewContainer = document.getElementById('icon-preview-container');
        
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    previewContainer.innerHTML = `<img src="${event.target.result}" id="master-icon-img" style="width: 100%; height: 100%; object-fit: cover;">`;
                };
                reader.readAsDataURL(file);
            }
        });
        
        // フォーム保存処理
        const form = document.getElementById('master-admin-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const hqVal = document.getElementById('master-hq-name').value.trim();
            const platoonsVal = document.getElementById('master-platoons').value.trim();
            
            const checkedShifts = [];
            document.querySelectorAll('input[name="master-shifts"]:checked').forEach(cb => {
                checkedShifts.push(cb.value);
            });
            
            const imgEl = document.getElementById('master-icon-img');
            const iconVal = imgEl ? imgEl.src : '';
            
            // 署所データの最終同期・クリーンアップ
            const stationsData = [];
            document.querySelectorAll('.station-block').forEach(block => {
                const stationName = block.querySelector('.station-name-input').value.trim();
                if (!stationName) return;
                
                const subStations = [];
                block.querySelectorAll('.sub-station-name-input').forEach(subInput => {
                    const subName = subInput.value.trim();
                    if (subName) {
                        subStations.push(subName);
                    }
                });
                
                stationsData.push({
                    name: stationName,
                    sub_stations: subStations
                });
            });
            
            window.safeStorage.setItem('master_hq_name', hqVal);
            window.safeStorage.setItem('master_platoon_names', platoonsVal);
            window.safeStorage.setItem('master_shift_types', checkedShifts.join(','));
            window.safeStorage.setItem('master_stations', JSON.stringify(stationsData));
            if (iconVal) {
                window.safeStorage.setItem('master_system_icon', iconVal);
            }
            
            this.showToast('マスタ初期設定をローカルに保存しました。', 'success');
        });
    },

    setLeaveFormStep(step) {
        document.querySelectorAll('.wizard-step').forEach((el, idx) => {
            if (idx + 1 === step) {
                el.classList.add('active');
            } else if (idx + 1 < step) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });

        for (let i = 1; i <= 2; i++) {
            const conn = document.getElementById(`connector-${i}`);
            if (conn) {
                if (i < step) {
                    conn.classList.add('active');
                } else {
                    conn.classList.remove('active');
                }
            }
        }

        document.querySelectorAll('.form-step-panel').forEach((el, idx) => {
            if (idx + 1 === step) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });

        if (step === 3) {
            this.updateLeaveSummaryPreview();
        }
    },

    toggleLeaveTypeUI() {
        const leaveType = document.querySelector('input[name="leave_type"]:checked').value;
        const hourLabel = document.getElementById('leave-unit-hour-label');
        
        if (leaveType !== 'annual') {
            if (hourLabel) hourLabel.style.display = 'none';
            const fullUnit = document.querySelector('input[name="leave_unit"][value="full"]');
            if (fullUnit) fullUnit.checked = true;
            this.toggleLeaveUnit();
        } else {
            if (hourLabel) hourLabel.style.display = 'flex';
        }
    },

    toggleLeaveUnit() {
        const unit = document.querySelector('input[name="leave_unit"]:checked').value;
        const dateRangeEl = document.getElementById('leave-date-range-inputs');
        const timeEl = document.getElementById('leave-time-inputs');
        
        if (unit === 'full') {
            if (dateRangeEl) dateRangeEl.style.display = 'flex';
            if (timeEl) timeEl.style.display = 'none';
            const startD = document.getElementById('leave-start-date');
            const endD = document.getElementById('leave-end-date');
            const targetD = document.getElementById('leave-target-date');
            if (startD) startD.required = true;
            if (endD) endD.required = true;
            if (targetD) targetD.required = false;
        } else {
            if (dateRangeEl) dateRangeEl.style.display = 'none';
            if (timeEl) timeEl.style.display = 'flex';
            const startD = document.getElementById('leave-start-date');
            const endD = document.getElementById('leave-end-date');
            const targetD = document.getElementById('leave-target-date');
            if (startD) startD.required = false;
            if (endD) endD.required = false;
            if (targetD) targetD.required = true;
            this.calculateLeaveHoursPreview();
        }
    },

    validateLeaveDates() {
        const unit = document.querySelector('input[name="leave_unit"]:checked').value;
        
        if (unit === 'full') {
            const start = document.getElementById('leave-start-date').value;
            const end = document.getElementById('leave-end-date').value;
            if (start && end && start > end) {
                this.showToast('開始日は終了日より前の日付を指定してください。', 'warning');
                document.getElementById('leave-end-date').value = start;
            }
        }
    },

    calculateLeaveHoursPreview() {
        const start = document.getElementById('leave-start-time').value;
        const end = document.getElementById('leave-end-time').value;
        
        if (!start || !end) return;
        
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        
        let startMin = sh * 60 + sm;
        let endMin = eh * 60 + em;
        
        if (endMin < startMin) endMin += 24 * 60;
        
        let diffMin = endMin - startMin;
        
        let breakMin = 0;
        const breakStart = 12 * 60;
        const breakEnd = 13 * 60;
        
        for (let m = startMin; m < endMin; m++) {
            const cur = m % (24 * 60);
            if (cur >= breakStart && cur < breakEnd) {
                breakMin++;
            }
        }
        
        const actMin = diffMin - breakMin;
        const hours = Math.max(0, actMin / 60);
        
        const previewEl = document.getElementById('leave-hours-preview');
        if (previewEl) previewEl.textContent = hours.toFixed(2);
    },

    updateLeaveSummaryPreview() {
        const leaveType = document.querySelector('input[name="leave_type"]:checked').value;
        const unit = document.querySelector('input[name="leave_unit"]:checked').value;
        
        const typeLabels = {
            'annual': '年次有給休暇',
            'special': '特別休暇',
            'sick': '病気休暇',
            'compensatory': '代休・振替休日'
        };
        
        const typeEl = document.getElementById('summary-leave-type');
        if (typeEl) typeEl.textContent = typeLabels[leaveType];
        
        let periodStr = '';
        let impactStr = '';
        
        if (unit === 'full') {
            const start = document.getElementById('leave-start-date').value;
            const end = document.getElementById('leave-end-date').value;
            periodStr = `${start} 〜 ${end} (終日)`;
            
            const daysCount = Math.round((new Date(end.replace(/-/g, '/')) - new Date(start.replace(/-/g, '/'))) / (1000 * 60 * 60 * 24)) + 1;
            
            if (leaveType === 'annual') {
                const isDayWorker = !!Auth.user.is_day_worker;
                const cost = isDayWorker ? daysCount : daysCount * 2.0;
                impactStr = `年休残高より ${cost.toFixed(1)} 日 減算されます`;
            } else {
                impactStr = '年休残高への影響はありません';
            }
        } else {
            const date = document.getElementById('leave-target-date').value;
            const start = document.getElementById('leave-start-time').value;
            const end = document.getElementById('leave-end-time').value;
            const previewEl = document.getElementById('leave-hours-preview');
            const hrs = previewEl ? previewEl.textContent : '-';
            periodStr = `${date} の ${start} 〜 ${end} (${hrs}時間)`;
            
            if (leaveType === 'annual') {
                const days = parseFloat(hrs) / 8.0;
                impactStr = `年休残高より ${days.toFixed(2)} 日分 (時間休) 減算されます`;
            } else {
                impactStr = '年休残高への影響はありません';
            }
        }
        
        const periodEl = document.getElementById('summary-leave-period');
        const impactEl = document.getElementById('summary-leave-impact');
        if (periodEl) periodEl.textContent = periodStr;
        if (impactEl) impactEl.textContent = impactStr;
    },

    async handleLeaveSubmit(event) {
        event.preventDefault();
        
        const leaveType = document.querySelector('input[name="leave_type"]:checked').value;
        const unit = document.querySelector('input[name="leave_unit"]:checked').value;
        const reason = document.getElementById('leave-reason').value.trim();
        
        let start_date = '';
        let end_date = '';
        let start_time = '';
        let end_time = '';
        
        if (unit === 'full') {
            start_date = document.getElementById('leave-start-date').value;
            end_date = document.getElementById('leave-end-date').value;
        } else {
            start_date = document.getElementById('leave-target-date').value;
            end_date = start_date;
            start_time = document.getElementById('leave-start-time').value;
            end_time = document.getElementById('leave-end-time').value;
        }
        
        const btnSubmit = event.target.querySelector('button[type="submit"]');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = '申請送信中...';
        }
        
        try {
            const response = await fetch('/api/attendance/leave', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify({
                    leave_type: leaveType,
                    start_date,
                    end_date,
                    start_time,
                    end_time,
                    reason
                })
            });
            const data = await response.json();
            
            if (response.ok) {
                this.showToast(data.message, 'success');
                this.navigate('leave');
            } else {
                this.showToast(data.error || '申請の送信に失敗しました。', 'error');
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'この内容で申請を送信する';
                }
            }
        } catch (err) {
            this.showToast('通信エラーが発生しました。', 'error');
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'この内容で申請を送信する';
            }
        }
    },

    async loadLeaveHistory() {
        const tbody = document.getElementById('leave-history-tbody');
        if (!tbody) return;
        
        try {
            const response = await fetch('/api/attendance/leave', {
                headers: { 'Authorization': `Bearer ${Auth.token}` }
            });
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">履歴の取得に失敗しました。</td></tr>`;
                return;
            }
            
            if (data.list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">休暇申請履歴はありません。</td></tr>`;
                return;
            }
            
            const typeLabels = {
                'annual': '年有給',
                'special': '特別休',
                'sick': '病気休',
                'compensatory': '代休'
            };
            
            tbody.innerHTML = data.list.map(item => {
                const dateStr = new Date(item.created_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                
                let periodStr = '';
                if (item.start_time && item.end_time) {
                    periodStr = `${item.start_date} ${item.start_time}〜${item.end_time} (${item.hours}h)`;
                } else {
                    if (item.start_date === item.end_date) {
                        periodStr = item.start_date;
                    } else {
                        periodStr = `${item.start_date} 〜 ${item.end_date}`;
                    }
                }
                
                let statusBadge = '';
                if (item.status === 'pending') {
                    statusBadge = `<span class="badge badge-pending">承認待ち</span>`;
                } else if (item.status === 'approved') {
                    statusBadge = `<span class="badge badge-success" style="background:var(--success); color:#fff; font-size:12px; padding:2px 8px; border-radius:4px;">承認済</span>`;
                } else {
                    statusBadge = `<span class="badge badge-danger" style="background:var(--danger); color:#fff; font-size:12px; padding:2px 8px; border-radius:4px;">却下</span>`;
                }
                
                return `
                    <tr>
                        <td>${dateStr}</td>
                        <td><span class="badge" style="background:var(--primary-glow); color:var(--primary-color); font-weight:600;">${typeLabels[item.leave_type] || item.leave_type}</span></td>
                        <td>${periodStr}</td>
                        <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${item.reason}">${item.reason}</td>
                        <td>${statusBadge}</td>
                        <td>${item.approved_by_name || '-'}</td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">通信エラーにより履歴を読み込めませんでした。</td></tr>`;
        }
    }
};

window.Portal = Portal;

// 起動開始
window.addEventListener('DOMContentLoaded', () => {
    Portal.init();
});
