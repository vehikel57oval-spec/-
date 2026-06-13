/**
 * 祝日手当（休日給）検証・調整ダッシュボード (管理者用)
 */

const HolidayAllowance = {
    activeYearMonth: '',
    activeStationId: 'all',
    results: [],
    currentStaffDetail: null,

    /**
     * 画面レンダリングのメインエントリー
     */
    async render(container) {
        // 初期年月を設定 (現在日付の年月)
        if (!this.activeYearMonth) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            this.activeYearMonth = `${y}-${m}`;
        }

        // 所属の初期値 (chiefの場合は本人の署に固定、それ以外はall)
        if (Auth.user.role === 'chief') {
            this.activeStationId = Auth.user.station_id.toString();
        }

        container.innerHTML = `
            <div class="card" style="display:flex; flex-direction:column; gap:20px;">
                <div style="display:flex; justify-content:between; align-items:center; flex-wrap:wrap; gap:16px;">
                    <div>
                        <h3 style="font-size:18px; margin-bottom:4px;">交代勤務 祝日手当（休日給）実績台帳</h3>
                        <p style="color:var(--text-secondary); font-size:13px;">交代勤務者（1部・2部）の祝日当直・非番・スライド等の手当算出を検証し、確定ロックを行います。</p>
                    </div>
                    <div style="margin-left:auto; display:flex; gap:10px; flex-wrap:wrap;">
                        <button class="btn btn-primary" id="btn-allowance-bulk-lock" style="background:var(--success); font-size:13px; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="lock" style="width:16px; height:16px;"></i> この月のデータを一括確定
                        </button>
                        <button class="btn btn-secondary" id="btn-allowance-bulk-unlock" style="font-size:13px; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="unlock" style="width:16px; height:16px;"></i> 一括確定解除
                        </button>
                    </div>
                </div>

                <!-- 検索・フィルターエリア -->
                <div style="display:flex; gap:16px; align-items:flex-end; background:var(--bg-app); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border-color); flex-wrap:wrap;">
                    <div class="form-group" style="margin-bottom:0; width:160px;">
                        <label class="form-label" style="font-size:11px; margin-bottom:4px;">対象月度</label>
                        <input type="month" class="form-input" id="filter-allowance-month" value="${this.activeYearMonth}" style="padding:4px 10px; height:32px; font-size:13px;">
                    </div>
                    <div class="form-group" style="margin-bottom:0; width:200px;">
                        <label class="form-label" style="font-size:11px; margin-bottom:4px;">所属署所</label>
                        <select class="form-input" id="filter-allowance-station" style="padding:4px 10px; height:32px; font-size:13px;" ${Auth.user.role === 'chief' ? 'disabled' : ''}>
                            <option value="all" ${this.activeStationId === 'all' ? 'selected' : ''}>すべて</option>
                            <option value="1" ${this.activeStationId === '1' ? 'selected' : ''}>指宿消防署 (本署)</option>
                            <option value="2" ${this.activeStationId === '2' ? 'selected' : ''}>山川分遣所 (北署)</option>
                            <option value="3" ${this.activeStationId === '3' ? 'selected' : ''}>開聞分遣所 (南署)</option>
                        </select>
                    </div>
                    <button class="btn btn-primary" id="btn-allowance-load" style="height:32px; padding:0 16px; font-size:13px; display:flex; align-items:center; gap:6px;">
                        <i data-lucide="refresh-cw" style="width:16px; height:16px;"></i> 読み込み
                    </button>
                </div>

                <!-- 集計テーブル -->
                <div class="table-responsive" style="border:1px solid var(--border-color); border-radius:var(--radius-md); overflow:hidden;">
                    <table class="table" style="margin-bottom:0;">
                        <thead>
                            <tr style="background:var(--bg-app);">
                                <th>職員番号</th>
                                <th>氏名</th>
                                <th>所属</th>
                                <th>部区分</th>
                                <th style="text-align:center;">祝日当直(12h)</th>
                                <th style="text-align:center;">祝日非番(4h/3.5h)</th>
                                <th style="text-align:center;">スライド日数</th>
                                <th style="text-align:center;">支給合計時間</th>
                                <th style="text-align:center;">ステータス</th>
                                <th style="text-align:center;">操作</th>
                            </tr>
                        </thead>
                        <tbody id="allowance-table-body">
                            <tr>
                                <td colspan="10" style="text-align:center; padding:40px; color:var(--text-muted);">
                                    <div class="spinner" style="margin:0 auto 10px;"></div>
                                    データをロード中...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // イベントバインド
        document.getElementById('filter-allowance-month').addEventListener('change', (e) => {
            this.activeYearMonth = e.target.value;
        });
        document.getElementById('filter-allowance-station').addEventListener('change', (e) => {
            this.activeStationId = e.target.value;
        });
        document.getElementById('btn-allowance-load').addEventListener('click', () => this.loadData());
        
        document.getElementById('btn-allowance-bulk-lock').addEventListener('click', () => this.handleBulkLock());
        document.getElementById('btn-allowance-bulk-unlock').addEventListener('click', () => this.handleBulkUnlock());

        await this.loadData();
    },

    /**
     * バックエンドAPIから月次集計データを読み込み
     */
    async loadData() {
        const tbody = document.getElementById('allowance-table-body');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; padding:40px; color:var(--text-muted);">
                    <div class="spinner" style="margin:0 auto 10px;"></div>
                    データを取得中...
                </td>
            </tr>
        `;

        try {
            const response = await fetch(`/api/admin/holiday-allowance?year_month=${this.activeYearMonth}`, {
                headers: { 'Authorization': `Bearer ${Auth.token}` }
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'データの読み込みに失敗しました。');
            }

            const data = await response.json();
            this.results = data.results;
            this.renderTable();
        } catch (err) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center; padding:30px; color:var(--danger);">
                        <i data-lucide="alert-triangle" style="width:24px; height:24px; margin-bottom:8px;"></i>
                        <p>${err.message}</p>
                    </td>
                </tr>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    },

    /**
     * テーブルレコードの描画
     */
    renderTable() {
        const tbody = document.getElementById('allowance-table-body');
        if (!tbody) return;

        // 所属フィルター
        let filtered = this.results;
        if (this.activeStationId !== 'all') {
            const targetStationId = parseInt(this.activeStationId);
            filtered = this.results.filter(x => x.station_id === targetStationId);
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center; padding:30px; color:var(--text-muted);">
                        対象となる交代勤務職員はいません。
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(row => {
            let statusBadge = '';
            if (row.status === 'locked') {
                statusBadge = `<span class="badge" style="background:var(--success-light); color:var(--success); border:1px solid rgba(0,200,80,0.2); font-size:11px;">確定ロック済</span>`;
            } else if (row.status === 'draft') {
                statusBadge = `<span class="badge" style="background:var(--warning-light); color:var(--warning); border:1px solid rgba(255,160,0,0.2); font-size:11px;">手動調整中</span>`;
            } else {
                statusBadge = `<span class="badge" style="background:var(--primary-light); color:var(--primary-color); border:1px solid rgba(79,70,229,0.2); font-size:11px;">自動計算中</span>`;
            }

            const platoonName = row.platoon === '1bu' ? 'A日 (1部)' : (row.platoon === '2bu' ? 'B日 (2部)' : '日勤');

            return `
                <tr style="height:48px; vertical-align:middle;">
                    <td>${row.employee_number}</td>
                    <td style="font-weight:500;">${row.name}</td>
                    <td>${row.station_name}</td>
                    <td>${platoonName}</td>
                    <td style="text-align:center; font-weight:500;">${row.holiday_tou} 日</td>
                    <td style="text-align:center; font-weight:500;">${row.holiday_off} 日</td>
                    <td style="text-align:center; font-weight:500;">${row.slided_days} 日</td>
                    <td style="text-align:center; font-size:14px; font-weight:700; color:var(--primary-color);">${row.total_hours} h</td>
                    <td style="text-align:center;">${statusBadge}</td>
                    <td style="text-align:center;">
                        <button class="btn btn-primary" style="padding:6px 12px; font-size:12px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;" onclick="HolidayAllowance.openDetailModal(${row.staff_id})">
                            <i data-lucide="eye" style="width:14px; height:14px;"></i> 検証・調整
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    /**
     * 個別職員の詳細カレンダー検証モーダルの起動
     */
    async openDetailModal(staffId) {
        try {
            const response = await fetch(`/api/admin/holiday-allowance/staff/${staffId}?year_month=${this.activeYearMonth}`, {
                headers: { 'Authorization': `Bearer ${Auth.token}` }
            });
            if (!response.ok) throw new Error('詳細データの取得に失敗しました。');
            
            const data = await response.json();
            this.currentStaffDetail = data;

            const staff = data.staff;
            const details = data.details;
            
            const platoonName = staff.platoon === '1bu' ? 'A日 (1部)' : 'B日 (2部)';
            const title = `${staff.name} (${platoonName}) - ${this.activeYearMonth} 祝日手当詳細`;
            
            let statusBanner = '';
            if (data.status === 'locked') {
                statusBanner = `<div style="background:var(--success-light); color:var(--success); padding:10px 14px; border-radius:6px; border:1px solid rgba(0,200,80,0.2); font-size:13px; font-weight:500; margin-bottom:16px; display:flex; align-items:center; gap:6px;"><i data-lucide="lock" style="width:16px; height:16px;"></i> 確定ロック済（手動編集を行うには右上の「確定解除」を押してください）</div>`;
            } else if (data.status === 'draft') {
                statusBanner = `<div style="background:var(--warning-light); color:var(--warning); padding:10px 14px; border-radius:6px; border:1px solid rgba(255,160,0,0.2); font-size:13px; font-weight:500; margin-bottom:16px; display:flex; align-items:center; gap:6px;"><i data-lucide="edit" style="width:16px; height:16px;"></i> 手動調整中（一時保存状態です。確定させるには「確定ロック」を押してください）</div>`;
            } else {
                statusBanner = `<div style="background:var(--primary-light); color:var(--primary-color); padding:10px 14px; border-radius:6px; border:1px solid rgba(79,70,229,0.2); font-size:13px; font-weight:500; margin-bottom:16px; display:flex; align-items:center; gap:6px;"><i data-lucide="cpu" style="width:16px; height:16px;"></i> システム自動計算値が適用されています</div>`;
            }

            // カレンダー構築
            const calendarGridHtml = this.buildCalendarGridHtml(details);

            const contentHtml = `
                ${statusBanner}
                <div style="display:flex; justify-content:between; align-items:center; margin-bottom:16px;">
                    <div>
                        <span style="font-size:13px; color:var(--text-secondary);">支給合計時間:</span>
                        <strong id="modal-allowance-total-hours" style="font-size:20px; color:var(--primary-color); margin-left:6px;">${data.total_hours} h</strong>
                    </div>
                    <div style="margin-left:auto; display:flex; gap:8px;">
                        ${data.status === 'locked' ? `
                            <button class="btn btn-secondary" onclick="HolidayAllowance.handleIndividualUnlock(${staff.id})" style="font-size:12px; padding:6px 12px;"><i data-lucide="unlock" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> 確定解除</button>
                        ` : `
                            <button class="btn btn-primary" onclick="HolidayAllowance.handleIndividualLock(${staff.id})" style="background:var(--success); font-size:12px; padding:6px 12px;"><i data-lucide="check" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> 確定ロック</button>
                            <button class="btn btn-primary" id="btn-allowance-modal-save" onclick="HolidayAllowance.handleIndividualSave(${staff.id})" style="font-size:12px; padding:6px 12px;"><i data-lucide="save" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> 調整内容を保存</button>
                        `}
                    </div>
                </div>

                <div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:16px;">
                    <!-- カレンダーグリッド -->
                    <div style="flex:1; min-width:320px;">
                        <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap:6px; margin-bottom:6px; text-align:center; font-weight:600; font-size:12px;">
                            <div style="color:var(--accent-fire);">日</div>
                            <div>月</div>
                            <div>火</div>
                            <div>水</div>
                            <div>木</div>
                            <div>金</div>
                            <div style="color:var(--primary-color);">土</div>
                        </div>
                        <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap:6px;" id="modal-calendar-grid">
                            ${calendarGridHtml}
                        </div>
                    </div>

                    <!-- 右側: 選択日の手動編集エリア -->
                    <div style="width:280px; display:flex; flex-direction:column; gap:12px; border-left:1px solid var(--border-color); padding-left:20px;" id="modal-edit-panel">
                        <h4 style="font-size:14px; border-bottom:1px solid var(--border-color); padding-bottom:6px; margin-bottom:0;">手動調整パネル</h4>
                        <div id="modal-day-details-placeholder" style="color:var(--text-muted); font-size:13px; text-align:center; padding:40px 0;">
                            カレンダーの日付を選択すると、手動調整が行えます。
                        </div>
                        <div id="modal-day-edit-form" style="display:none; flex-direction:column; gap:12px;">
                            <div>
                                <span style="font-size:12px; color:var(--text-secondary);">選択された日:</span>
                                <strong id="edit-date-label" style="font-size:14px; margin-left:6px; color:var(--text-primary);"></strong>
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="form-label" style="font-size:11px; margin-bottom:4px;">本来の予定 / 実際の勤務</label>
                                <div id="edit-shift-label" style="font-size:13px; font-weight:500;"></div>
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="form-label" style="font-size:11px; margin-bottom:4px;">支給設定</label>
                                <select class="form-input" id="edit-hours-preset" style="padding:4px 8px; height:32px; font-size:13px;" ${data.status === 'locked' ? 'disabled' : ''}>
                                    <option value="auto">システム自動判定を適用</option>
                                    <option value="cut">支給カット (代休等による0h)</option>
                                    <option value="12">当務休日給 (12.0時間)</option>
                                    <option value="4">非番休日給 (4.0時間)</option>
                                    <option value="3.5">年末年始非番 (3.5時間)</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="form-label" style="font-size:11px; margin-bottom:4px;">調整理由</label>
                                <input type="text" class="form-input" id="edit-reason" placeholder="振替休日取得のため手当カット等" style="padding:4px 8px; height:32px; font-size:12px;" ${data.status === 'locked' ? 'disabled' : ''}>
                            </div>
                            <button class="btn btn-primary" id="btn-apply-day-adjustment" style="font-size:12px; padding:6px; display:flex; justify-content:center;" ${data.status === 'locked' ? 'disabled' : ''}>
                                この日の調整を適用
                            </button>
                        </div>
                    </div>
                </div>

                <div style="font-size:11px; color:var(--text-muted); border-top:1px solid var(--border-color); padding-top:10px;">
                    ※□：本来非番（4h/3.5h手当権利）、■：本来当直（12h手当権利）。色付きマスは手当が支給される日（スライド先を含む）です。
                </div>
            `;

            Portal.showModal(title, contentHtml);
            
            // カレンダーマス目のクリックバインド
            this.bindCalendarEvents();

        } catch (err) {
            Portal.showToast(err.message, 'error');
        }
    },

    /**
     * カレンダーグリッドのHTML構築
     */
    buildCalendarGridHtml(details) {
        if (!details || details.length === 0) return '';
        
        // 初日の曜日
        const firstDate = new Date(details[0].date.replace(/-/g, '/'));
        const startDayOfWeek = firstDate.getDay();
        
        let html = '';
        
        // 最初の曜日合わせの空マス
        for (let i = 0; i < startDayOfWeek; i++) {
            html += `<div style="background:transparent; border:1px solid transparent; height:68px;"></div>`;
        }
        
        // 日付マス目
        details.forEach((item, idx) => {
            const dateObj = new Date(item.date.replace(/-/g, '/'));
            const isSunday = (dateObj.getDay() === 0);
            const isSaturday = (dateObj.getDay() === 6);
            
            // 色判定
            let bgStyle = 'background:var(--bg-app); border:1px solid var(--border-color); color:var(--text-primary);';
            let badge = '';

            const isAllowanceDay = (item.hours > 0);
            
            if (isAllowanceDay) {
                if (item.type === '当日分') {
                    // 薄い緑色
                    bgStyle = 'background:var(--success-light); border:2px solid var(--success); color:var(--text-primary);';
                } else if (item.type === 'スライド分') {
                    // 薄い青色
                    bgStyle = 'background:var(--primary-light); border:2px solid var(--primary-color); color:var(--text-primary);';
                }
            } else if (item.is_cut) {
                // カットされた日 (薄い灰色に斜線または打ち消し線)
                bgStyle = 'background:#f1f5f9; border:1px dashed #cbd5e1; color:var(--text-muted); opacity:0.75; text-decoration:line-through;';
            }

            // 祝日名表示
            let holidayLabel = '';
            if (item.holiday_name) {
                holidayLabel = `<span style="font-size:9px; color:var(--accent-fire); font-weight:600; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.holiday_name}">${item.holiday_name}</span>`;
            }

            // 当務・非番インジケータ
            let platoonIndicator = '';
            if (item.base_shift === '当') {
                platoonIndicator = `<span style="font-size:9px; font-weight:700; color:var(--text-secondary); margin-right:4px;">■本来当</span>`;
            } else if (item.base_shift === '非') {
                platoonIndicator = `<span style="font-size:9px; font-weight:700; color:var(--text-secondary); margin-right:4px;">□本来非</span>`;
            }

            // 時間表示
            let hoursLabel = '';
            if (item.hours > 0) {
                hoursLabel = `<span class="badge" style="background:var(--primary-color); color:#fff; font-size:9px; padding:1px 4px; font-weight:bold; position:absolute; bottom:4px; right:4px;">${item.hours}h</span>`;
            } else if (item.is_cut) {
                hoursLabel = `<span class="badge" style="background:#ef4444; color:#fff; font-size:9px; padding:1px 4px; font-weight:bold; position:absolute; bottom:4px; right:4px; text-decoration:none;">カット</span>`;
            }

            // 週休との重なりインジケータ (スライド元)
            let slideSourceIndicator = '';
            if ((item.base_shift === '当' || item.base_shift === '非') && (item.actual_shift === '休' || item.actual_shift === '公') && item.holiday_name && !item.is_cut) {
                slideSourceIndicator = `<span style="font-size:8px; color:var(--primary-color); font-weight:bold; display:block;">➔スライド</span>`;
            }

            const dayNum = dateObj.getDate();

            html += `
                <div class="modal-calendar-cell" data-idx="${idx}" style="height:72px; padding:6px; border-radius:6px; font-size:12px; cursor:pointer; position:relative; display:flex; flex-direction:column; justify-content:flex-start; ${bgStyle}" title="${item.date} (${item.actual_shift})">
                    <div style="display:flex; justify-content:between; width:100%; font-weight:bold;">
                        <span style="${isSunday ? 'color:var(--accent-fire);' : isSaturday ? 'color:var(--primary-color);' : ''}">${dayNum}</span>
                        <span style="font-size:9px; color:var(--text-muted); margin-left:auto;">${item.actual_shift}</span>
                    </div>
                    ${holidayLabel}
                    <div style="margin-top:2px;">
                        ${platoonIndicator}
                        ${slideSourceIndicator}
                    </div>
                    ${hoursLabel}
                </div>
            `;
        });
        
        return html;
    },

    /**
     * モーダル内のカレンダーマスクリックイベントのバインド
     */
    bindCalendarEvents() {
        const cells = document.querySelectorAll('.modal-calendar-cell');
        const placeholder = document.getElementById('modal-day-details-placeholder');
        const form = document.getElementById('modal-day-edit-form');
        const dateLabel = document.getElementById('edit-date-label');
        const shiftLabel = document.getElementById('edit-shift-label');
        const hoursPreset = document.getElementById('edit-hours-preset');
        const reasonInput = document.getElementById('edit-reason');
        const applyBtn = document.getElementById('btn-apply-day-adjustment');

        let selectedIdx = null;

        cells.forEach(cell => {
            cell.addEventListener('click', () => {
                // ハイライト表示の切り替え
                cells.forEach(c => c.style.outline = 'none');
                cell.style.outline = '2px solid var(--primary-color)';
                cell.style.outlineOffset = '-2px';

                selectedIdx = parseInt(cell.dataset.idx);
                const item = this.currentStaffDetail.details[selectedIdx];

                // 編集パネルの表示更新
                if (placeholder) placeholder.style.display = 'none';
                if (form) form.style.display = 'flex';

                if (dateLabel) {
                    const days = ['日', '月', '火', '水', '木', '金', '土'];
                    const d = new Date(item.date.replace(/-/g, '/'));
                    dateLabel.textContent = `${item.date} (${days[d.getDay()]})`;
                }
                
                if (shiftLabel) {
                    const baseStr = item.base_shift === '当' ? '本来当務' : (item.base_shift === '非' ? '本来非番' : '日勤');
                    shiftLabel.innerHTML = `${baseStr} / 実際の勤務: <strong>${item.actual_shift}</strong>`;
                }

                // 設定プリセットの読み込み
                if (hoursPreset) {
                    if (item.is_cut) {
                        hoursPreset.value = 'cut';
                    } else if (item.type === '対象外') {
                        hoursPreset.value = 'auto'; // または手動
                    } else {
                        // 支給時間数
                        if (item.hours === 12) hoursPreset.value = '12';
                        else if (item.hours === 4) hoursPreset.value = '4';
                        else if (item.hours === 3.5) hoursPreset.value = '3.5';
                        else hoursPreset.value = 'auto';
                    }
                }

                if (reasonInput) {
                    reasonInput.value = item.reason === 'duty_on_holiday' || item.reason === 'duty_on_holiday_off' || item.reason === 'no_holiday_duty' || item.reason.startsWith('slided_from_') ? '' : item.reason;
                }
            });
        });

        // 調整適用のイベントリスナー
        if (applyBtn) {
            applyBtn.onclick = () => {
                if (selectedIdx === null) return;
                
                const item = this.currentStaffDetail.details[selectedIdx];
                const presetVal = hoursPreset.value;
                const reasonVal = reasonInput.value.trim();

                // 状態更新
                if (presetVal === 'auto') {
                    // 自動判定に戻す ➔ 自動計算値を再計算するため、一時保存データを消すか、再適用する
                    // 今回は簡易的に、自動判定としてマーク
                    item.is_cut = false;
                    item.hours = item.original_hours; 
                    // 元々スライド分ならスライド、当日なら当日
                    item.type = item.original_hours > 0 ? (item.type === '対象外' ? '当日分' : item.type) : '対象外';
                    item.reason = item.original_hours > 0 ? (item.type === 'スライド分' ? 'slided_from' : 'duty_on_holiday') : 'no_holiday_duty';
                } else if (presetVal === 'cut') {
                    item.is_cut = true;
                    item.hours = 0.0;
                    item.type = '対象外';
                    item.reason = reasonVal || 'cut_due_to_substitute_holiday';
                } else {
                    const hoursVal = parseFloat(presetVal);
                    item.is_cut = false;
                    item.hours = hoursVal;
                    item.type = item.type === '対象外' ? '当日分' : item.type;
                    item.reason = reasonVal || 'manual_adjustment';
                }

                // 合計時間の再計算
                const newTotal = this.currentStaffDetail.details.reduce((sum, d) => sum + d.hours, 0.0);
                this.currentStaffDetail.total_hours = newTotal;
                
                const totalLabel = document.getElementById('modal-allowance-total-hours');
                if (totalLabel) totalLabel.textContent = `${newTotal} h`;

                // カレンダー再描画
                const grid = document.getElementById('modal-calendar-grid');
                if (grid) {
                    grid.innerHTML = this.buildCalendarGridHtml(this.currentStaffDetail.details);
                    this.bindCalendarEvents(); // 再バインド
                }
                
                // トースト
                Portal.showToast('この日の手当調整を仮適用しました。保存するまでデータは確定しません。', 'warning');
            };
        }
    },

    /**
     * 個人別手動調整データの一時保存
     */
    async handleIndividualSave(staffId) {
        if (!this.currentStaffDetail) return;
        
        const details = this.currentStaffDetail.details;
        const total_hours = this.currentStaffDetail.total_hours;

        try {
            const response = await fetch('/api/admin/holiday-allowance/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify({
                    year_month: this.activeYearMonth,
                    staff_id: staffId,
                    details,
                    total_hours
                })
            });

            if (!response.ok) throw new Error('仮保存に失敗しました。');
            
            Portal.showToast('手動調整内容を一時保存しました。', 'success');
            Portal.closeModal();
            this.loadData(); // 一覧更新
        } catch (err) {
            Portal.showToast(err.message, 'error');
        }
    },

    /**
     * 個別の手当確定ロック
     */
    async handleIndividualLock(staffId) {
        const confirm = window.confirm('この職員の祝日手当データを確定（ロック）しますか？これ以降、シフト変更があっても手当時間数は再計算されず、手動調整も制限されます。');
        if (!confirm) return;

        try {
            const response = await fetch('/api/admin/holiday-allowance/lock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify({
                    year_month: this.activeYearMonth,
                    staff_id: staffId
                })
            });

            if (!response.ok) throw new Error('確定処理に失敗しました。');
            
            Portal.showToast('職員の手当データを確定ロックしました。', 'success');
            Portal.closeModal();
            this.loadData();
        } catch (err) {
            Portal.showToast(err.message, 'error');
        }
    },

    /**
     * 個別の手当確定解除 (ロック解除)
     */
    async handleIndividualUnlock(staffId) {
        const confirm = window.confirm('この職員の手当確定ロックを解除しますか？確定データは削除され、最新の勤務表と連動した自動判定計算値に戻ります。');
        if (!confirm) return;

        try {
            const response = await fetch('/api/admin/holiday-allowance/unlock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify({
                    year_month: this.activeYearMonth,
                    staff_id: staffId
                })
            });

            if (!response.ok) throw new Error('確定解除に失敗しました。');
            
            Portal.showToast('確定ロックを解除し、自動判定に戻しました。', 'success');
            Portal.closeModal();
            this.loadData();
        } catch (err) {
            Portal.showToast(err.message, 'error');
        }
    },

    /**
     * 月度全体の一括確定
     */
    async handleBulkLock() {
        const confirm = window.confirm(`対象月度「${this.activeYearMonth}」の全職員の手当データを一括で確定ロックしますか？（未検証・自動判定のデータもそのままロックされます）`);
        if (!confirm) return;

        try {
            const response = await fetch('/api/admin/holiday-allowance/lock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify({
                    year_month: this.activeYearMonth
                })
            });

            if (!response.ok) throw new Error('一括確定処理に失敗しました。');
            
            Portal.showToast('この月の全職員の手当データを確定ロックしました。', 'success');
            this.loadData();
        } catch (err) {
            Portal.showToast(err.message, 'error');
        }
    },

    /**
     * 月度全体の一括確定解除
     */
    async handleBulkUnlock() {
        const confirm = window.confirm(`対象月度「${this.activeYearMonth}」の確定データを一括で削除し、自動計算状態にリセットしますか？手動調整された内容もすべてリセットされます。`);
        if (!confirm) return;

        try {
            const response = await fetch('/api/admin/holiday-allowance/unlock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify({
                    year_month: this.activeYearMonth
                })
            });

            if (!response.ok) throw new Error('一括確定解除に失敗しました。');
            
            Portal.showToast('一括確定解除を行い、自動計算状態へリセットしました。', 'success');
            this.loadData();
        } catch (err) {
            Portal.showToast(err.message, 'error');
        }
    }
};

window.HolidayAllowance = HolidayAllowance;
