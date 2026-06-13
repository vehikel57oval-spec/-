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
            // 消防本部リストをロード
            try {
                this.departments = await Auth.getDepartments();
            } catch (err) {
                console.error('Failed to load departments:', err);
                this.departments = [];
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
        app.innerHTML = `
            <div class="login-wrapper">
                <div class="login-card">
                    <div class="login-header">
                        <div class="login-logo">
                            <i data-lucide="flame"></i>
                        </div>
                        <h1 class="login-title">消防職場ポータル</h1>
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
        app.innerHTML = `
            <div class="portal-layout">
                <!-- サイドバー -->
                <aside class="sidebar" id="sidebar">
                    <div class="sidebar-brand">
                        <div class="brand-icon">F</div>
                        <span class="brand-text">消防本部ポータル</span>
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
                case 'leave':
                    breadcrumb.textContent = '休暇申請';
                    this.renderLeavePlaceholder(contentBody);
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
    showModal(title, contentHtml) {
        const modal = document.getElementById('modal-container');
        const body = document.getElementById('modal-body');
        if (!modal || !body) return;
        
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
    },

    /* ==========================================================================
       その他のページプレースホルダー・レンダリング
       ========================================================================== */
    
    renderSchedulePlaceholder(container) {
        container.innerHTML = `
            <div class="card" style="display:flex; flex-direction:column; gap:20px;">
                <h3>勤務スケジュール表 (本カレンダー機能)</h3>
                <p style="color:var(--text-secondary)">既存の自動勤務作成表システムと連動予定です。現在、職員マスタ情報をベースにした当務および日勤のシフトパターンが同期されます。</p>
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:40px; text-align:center; color:var(--text-muted);">
                    <i data-lucide="calendar" style="width:48px; height:48px; margin-bottom:12px;"></i>
                    <p>カレンダー連動機能開発中</p>
                </div>
            </div>
        `;
    },

    renderLeavePlaceholder(container) {
        container.innerHTML = `
            <div class="card" style="display:flex; flex-direction:column; gap:20px;">
                <h3>各種休暇の申請</h3>
                <p style="color:var(--text-secondary)">年次有給休暇や特別休暇の申請を行います。申請された休暇は上司（署長・本部管理者）による承認後にスケジュールへ反映されます。</p>
                <p>現在の年休残日数: <strong>${Auth.user.annual_leave_balance || 20}日</strong></p>
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:40px; text-align:center; color:var(--text-muted);">
                    <i data-lucide="file-plus" style="width:48px; height:48px; margin-bottom:12px;"></i>
                    <p>休暇申請フォーム開発中</p>
                </div>
            </div>
        `;
    },

    // 修正承認画面
    async renderApprovalsPage(container) {
        const response = await fetch('/api/attendance/pending', {
            headers: { 'Authorization': `Bearer ${Auth.token}` }
        });
        const data = await response.json();
        
        let rowsHtml = '';
        if (data.pending.length === 0) {
            rowsHtml = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">未処理の修正申請はありません。</td></tr>`;
        } else {
            rowsHtml = data.pending.map(item => `
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
        
        container.innerHTML = `
            <div class="card">
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
                            ${rowsHtml}
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

    // 職員管理画面 (一覧 & 新規・更新)
    async renderStaffAdminPage(container) {
        const response = await fetch('/api/admin/staff', {
            headers: { 'Authorization': `Bearer ${Auth.token}` }
        });
        const data = await response.json();
        
        const rowsHtml = data.staff.map(member => `
            <tr>
                <td>${member.employee_number}</td>
                <td>${member.name}</td>
                <td>${member.rank || '-'}</td>
                <td>${member.station_name}</td>
                <td>${member.platoon === '1bu' ? 'A日 (1部)' : member.platoon === '2bu' ? 'B日 (2部)' : member.platoon === '3bu' ? 'C日 (3部)' : '日勤'}</td>
                <td>${member.role === 'sysadmin' ? 'システム管理者' : member.role === 'admin' ? '本部管理者' : member.role === 'chief' ? '当直頭/署長' : '一般職員'}</td>
                <td>${member.annual_leave_balance}日</td>
                <td>
                    ${Auth.hasRole('admin', 'sysadmin') ? `
                        <button class="btn btn-primary" style="padding:6px 12px; font-size:12px; border-radius:6px;" onclick="Portal.openStaffEditModal(${JSON.stringify(member).replace(/"/g, '&quot;')})">編集</button>
                    ` : '<span style="color:var(--text-muted)">閲覧のみ</span>'}
                </td>
            </tr>
        `).join('');
        
        container.innerHTML = `
            <div class="card">
                <div style="display:flex; justify-content:between; align-items:center; margin-bottom:16px;">
                    <div>
                        <h3>職員名簿管理</h3>
                        <p style="color:var(--text-secondary)">消防職員の所属、部区分、階級、システム権限等のマスタ情報を管理します。</p>
                    </div>
                    ${Auth.hasRole('admin', 'sysadmin') ? `
                        <button class="btn btn-primary" onclick="Portal.openStaffAddModal()" style="margin-left:auto;">新規職員登録</button>
                    ` : ''}
                </div>
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>職員番号</th>
                                <th>氏名</th>
                                <th>階級</th>
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

    openStaffAddModal() {
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
                        <option value="1">指宿消防署（本署）</option>
                        <option value="2">山川分遣所（北署）</option>
                        <option value="3">開聞分遣所（南署）</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">部区分 (サイクル判定)</label>
                    <select class="form-input" style="padding-left:12px;" id="member-platoon" required>
                        <option value="1bu">1部 (A日)</option>
                        <option value="2bu">2部 (B日)</option>
                        <option value="3bu">3部 (C日)</option>
                        <option value="nikkin">日勤</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">階級</label>
                    <input class="form-input" style="padding-left:12px;" type="text" id="member-rank" placeholder="例: 消防士長">
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
    },

    openStaffEditModal(member) {
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
                        <option value="1" ${member.station_id === 1 ? 'selected' : ''}>指宿消防署（本署）</option>
                        <option value="2" ${member.station_id === 2 ? 'selected' : ''}>山川分遣所（北署）</option>
                        <option value="3" ${member.station_id === 3 ? 'selected' : ''}>開聞分遣所（南署）</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">部区分</label>
                    <select class="form-input" style="padding-left:12px;" id="member-platoon" required>
                        <option value="1bu" ${member.platoon === '1bu' ? 'selected' : ''}>1部 (A日)</option>
                        <option value="2bu" ${member.platoon === '2bu' ? 'selected' : ''}>2部 (B日)</option>
                        <option value="3bu" ${member.platoon === '3bu' ? 'selected' : ''}>3部 (C日)</option>
                        <option value="nikkin" ${member.platoon === 'nikkin' ? 'selected' : ''}>日勤</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">階級</label>
                    <input class="form-input" style="padding-left:12px;" type="text" id="member-rank" value="${member.rank || ''}">
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
    },

    async handleStaffSubmit(event, action, staffId = null) {
        event.preventDefault();
        
        const payload = {
            name: document.getElementById('member-name').value.trim(),
            station_id: parseInt(document.getElementById('member-station_id').value),
            platoon: document.getElementById('member-platoon').value,
            rank: document.getElementById('member-rank').value.trim(),
            role: document.getElementById('member-role').value,
            annual_leave_balance: parseFloat(document.getElementById('member-annual_leave_balance').value)
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
    }
};

window.Portal = Portal;

// 起動開始
window.addEventListener('DOMContentLoaded', () => {
    Portal.init();
});
