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
                <td><span class="staff-position-badge ${Portal.getPositionClass(member.position)}">${member.position || '-'}</span></td>
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
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
                    <div>
                        <h3>職員名簿管理</h3>
                        <p style="color:var(--text-secondary)">消防職員の所属、部区分、階級、隊、システム権限等のマスタ情報を管理します。</p>
                    </div>
                    ${Auth.hasRole('admin', 'sysadmin') ? `
                        <div style="display:flex; gap:8px; margin-left:auto; align-items:center;">
                            <div style="display:flex; align-items:center; gap:4px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:4px 8px; border-radius:6px; font-size:12px;">
                                <label style="font-weight:600; cursor:pointer;" for="csv-file-input">CSVインポート:</label>
                                <input type="file" id="csv-file-input" accept=".csv" style="display:none;" onchange="Portal.handleCSVImport(event)">
                                <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="document.getElementById('csv-file-input').click()">ファイル選択</button>
                                <select id="csv-encoding" style="font-size:11px; padding:2px; background:transparent; border:1px solid var(--border-color); color:var(--text-primary); border-radius:4px;">
                                    <option value="shift-jis">Shift_JIS (Excel)</option>
                                    <option value="utf-8">UTF-8</option>
                                </select>
                            </div>
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

    async handleCSVImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const encoding = document.getElementById('csv-encoding').value;
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            const text = e.target.result;
            try {
                const staffList = Portal.parseCSV(text);
                if (staffList.length === 0) {
                    Portal.showToast('CSVデータが空か、解析に失敗しました。', 'error');
                    return;
                }
                
                const confirmed = confirm(`CSVから ${staffList.length} 件の職員データをインポートしますか？\n（既存の職員番号は上書き更新されます）`);
                if (!confirmed) {
                    event.target.value = '';
                    return;
                }
                
                const response = await fetch('/api/admin/staff/import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${Auth.token}`
                    },
                    body: JSON.stringify({ staffList })
                });
                
                const data = await response.json();
                if (response.ok) {
                    Portal.showToast(data.message, 'success');
                    Portal.navigate('staff_admin');
                } else {
                    Portal.showToast(data.error || 'インポートに失敗しました。', 'error');
                }
            } catch (err) {
                console.error(err);
                Portal.showToast(err.message || 'CSVの解析に失敗しました。', 'error');
            }
            event.target.value = '';
        };
        
        reader.onerror = () => {
            Portal.showToast('ファイルの読み込みに失敗しました。', 'error');
            event.target.value = '';
        };
        
        if (encoding === 'shift-jis') {
            reader.readAsText(file, 'Shift_JIS');
        } else {
            reader.readAsText(file, 'UTF-8');
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

            if (values.length < headers.length) {
                continue;
            }

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

            if (platoon === '1部' || platoon === '第1小隊') platoon = '1bu';
            else if (platoon === '2部' || platoon === '第2小隊') platoon = '2bu';
            else if (platoon === '3部' || platoon === '第3小隊') platoon = '3bu';
            else if (platoon === '日勤者') platoon = 'nikkin';

            if (role === '一般職員' || role === '一般') role = 'staff';
            else if (role === '当直頭' || role === '署長') role = 'chief';
            else if (role === '本部管理者' || role === '管理者') role = 'admin';
            else if (role === 'システム管理者') role = 'sysadmin';

            staffList.push({
                employee_number,
                name,
                platoon,
                rank,
                position,
                has_large_license,
                is_paramedic,
                is_rescue,
                is_kikan,
                is_day_worker,
                role,
                annual_leave_balance,
                station_id
            });
        }
        return staffList;
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
    }
};

window.Portal = Portal;

// 起動開始
window.addEventListener('DOMContentLoaded', () => {
    Portal.init();
});
