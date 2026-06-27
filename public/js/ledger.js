/**
 * 消防ポータルシステム 出勤簿・月間勤務実績表モジュール (Ledger)
 */

const Ledger = {
    activeYearMonth: '',
    selectedStaffId: null,
    staffList: [],
    data: null,

    /**
     * メインレンダリング
     */
    async render(container) {
        // 初期年月を設定 (現在日付の年月)
        if (!this.activeYearMonth) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            this.activeYearMonth = `${y}-${m}`;
        }

        // 初期選択職員IDを設定
        if (this.selectedStaffId === null) {
            this.selectedStaffId = Auth.user.id;
        }

        // 管理職以上の場合は職員リストを取得
        if (Auth.hasRole('chief', 'admin', 'sysadmin') && this.staffList.length === 0) {
            try {
                const response = await fetch('/api/admin/staff', {
                    headers: { 'Authorization': `Bearer ${Auth.token}` }
                });
                if (response.ok) {
                    const resData = await response.json();
                    this.staffList = resData.staff || [];
                    
                    // 職員リストの先頭または現在のユーザーをデフォルトに選択
                    if (this.staffList.length > 0 && this.selectedStaffId === Auth.user.id) {
                        // 自分自身がリストにいればそれを、いなければ先頭を選択
                        const hasMe = this.staffList.some(s => s.id === Auth.user.id);
                        if (!hasMe) {
                            this.selectedStaffId = this.staffList[0].id;
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load staff list for ledger:', err);
            }
        }

        // HTML骨組みの描画
        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:24px;">
                <!-- 検索・操作カード -->
                <div class="card no-print" style="display:flex; flex-direction:column; gap:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                        <div>
                            <h3 style="font-size:18px; margin-bottom:4px;">出勤簿出力（月間勤務実績表）</h3>
                            <p style="color:var(--text-secondary); font-size:13px;">予定シフトと打刻実績を突き合わせた出勤簿を作成・確認・提出・承認できます。A4印刷に対応しています。</p>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-secondary" onclick="Ledger.printLedger()" style="display:flex; align-items:center; gap:6px;">
                                <i data-lucide="printer" style="width:16px; height:16px;"></i> 印刷・PDF保存
                            </button>
                        </div>
                    </div>

                    <!-- フィルターフォーム -->
                    <div style="display:flex; gap:16px; align-items:flex-end; background:var(--bg-app); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border-color); flex-wrap:wrap;">
                        <div class="form-group" style="margin-bottom:0; width:160px;">
                            <label class="form-label" style="font-size:11px; margin-bottom:4px;">対象月度</label>
                            <input type="month" class="form-input" id="ledger-month-input" value="${this.activeYearMonth}" style="padding:4px 10px; height:34px; font-size:13px;">
                        </div>
                        
                        ${Auth.hasRole('chief', 'admin', 'sysadmin') ? `
                            <div class="form-group" style="margin-bottom:0; width:260px;">
                                <label class="form-label" style="font-size:11px; margin-bottom:4px;">対象職員</label>
                                <select class="form-input" id="ledger-staff-select" style="padding:4px 10px; height:34px; font-size:13px;">
                                    ${this.staffList.map(s => `
                                        <option value="${s.id}" ${this.selectedStaffId == s.id ? 'selected' : ''}>
                                            [${s.station_name}] ${s.name} (${s.rank || '一般'})
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        ` : ''}
                        
                        <button class="btn btn-primary" onclick="Ledger.search()" style="height:34px; padding:0 16px; font-size:13px; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="refresh-cw" style="width:16px; height:16px;"></i> 表示切り替え
                        </button>
                    </div>
                </div>

                <!-- 出勤簿帳票本体 -->
                <div id="ledger-sheet-container">
                    <div class="card" style="text-align:center; padding:40px; color:var(--text-muted);">
                        <div class="spinner" style="margin:0 auto 10px;"></div>
                        出勤簿データをロード中...
                    </div>
                </div>
            </div>
        `;

        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        // 初回ロード実行
        await this.loadLedgerData();
    },

    /**
     * 出勤簿データの取得と描画
     */
    async loadLedgerData() {
        const container = document.getElementById('ledger-sheet-container');
        if (!container) return;

        const [year, month] = this.activeYearMonth.split('-');
        const staffId = this.selectedStaffId;

        try {
            const response = await fetch(`/api/attendance/ledger?staff_id=${staffId}&year=${year}&month=${month}`, {
                headers: { 'Authorization': `Bearer ${Auth.token}` }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'データの取得に失敗しました。');
            }

            this.data = await response.json();
            this.renderLedgerSheet(container);
        } catch (err) {
            console.error(err);
            container.innerHTML = `
                <div class="card" style="border-left: 4px solid var(--danger); padding:20px;">
                    <h4 style="color:var(--danger); margin-bottom:8px;">データの読み込みに失敗しました</h4>
                    <p style="color:var(--text-secondary); font-size:13px;">${err.message}</p>
                </div>
            `;
        }
    },

    /**
     * フィルター検索の実行
     */
    async search() {
        const monthInput = document.getElementById('ledger-month-input');
        if (monthInput) {
            this.activeYearMonth = monthInput.value;
        }

        const staffSelect = document.getElementById('ledger-staff-select');
        if (staffSelect) {
            this.selectedStaffId = parseInt(staffSelect.value, 10);
        }

        await this.loadLedgerData();
    },

    /**
     * 帳票（出勤簿）シートの描画
     */
    renderLedgerSheet(container) {
        const { staff, ledger, summary, approval } = this.data;
        const [year, month] = this.activeYearMonth.split('-');

        // 状態に応じたヘッダーバッジ
        let statusBadge = '';
        if (approval.status === 'submitted') {
            statusBadge = '<span class="badge badge-pending" style="font-size:12px; margin-left:12px;">提出済（承認待ち）</span>';
        } else if (approval.status === 'approved') {
            statusBadge = '<span class="badge" style="background:var(--success); color:#fff; font-size:12px; margin-left:12px;">確認済（承認完了）</span>';
        } else {
            statusBadge = '<span class="badge badge-off" style="font-size:12px; margin-left:12px;">下書き</span>';
        }

        // デジタルハンコの作成
        const renderHanko = (title, name, dateStr) => {
            if (!name) {
                return `
                    <div class="hanko-box">
                        <div class="hanko-title">${title}</div>
                        <div class="hanko-space"></div>
                    </div>
                `;
            }

            if (name === '下書き') {
                return `
                    <div class="hanko-box">
                        <div class="hanko-title">${title}</div>
                        <div class="hanko-space">
                            <div class="draft-stamp" style="
                                border: 2px solid #ef4444;
                                color: #ef4444;
                                padding: 2px 6px;
                                font-size: 11px;
                                font-weight: bold;
                                transform: rotate(-6deg);
                                background: rgba(239, 68, 68, 0.05);
                                border-radius: 3px;
                                font-family: sans-serif;
                                letter-spacing: 1px;
                                text-align: center;
                                white-space: nowrap;
                                box-shadow: 0 0 2px rgba(239, 68, 68, 0.2);
                            ">
                                下書き
                            </div>
                        </div>
                    </div>
                `;
            }

            const shortName = name.length > 3 ? name.substring(0, 3) : name;
            const dateLabel = dateStr ? dateStr.substring(5, 10).replace('-', '/') : '';
            return `
                <div class="hanko-box">
                    <div class="hanko-title">${title}</div>
                    <div class="hanko-space">
                        <div class="hanko-stamp">
                            <div class="stamp-border">
                                <span class="stamp-name">${shortName}</span>
                                ${dateLabel ? `<span class="stamp-date">${dateLabel}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        };

        // 本人印と承認印の出し分け (下書き状態の時は本人欄に「下書き」を配置)
        const selfHankoName = (approval.status === 'submitted' || approval.status === 'approved') ? staff.name : '下書き';
        const selfHankoDate = approval.submitted_at;
        
        const chiefHankoName = approval.status === 'approved' ? (approval.approved_by_name || '署長') : null;
        const chiefHankoDate = approval.approved_at;

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:20px;">
                
                <!-- 帳票部分 -->
                <div class="card ledger-print-container" style="position:relative; background:#fff; color:#0f172a; padding:32px; border-radius:var(--radius-md); box-shadow:var(--shadow-md); border:1px solid var(--border-color);">
                    
                    <!-- 印刷時のみ表示される正式な帳票タイトルヘッダー -->
                    <div class="ledger-header-print" style="display:none; text-align:center; margin-bottom:24px; border-bottom:2px double #000; padding-bottom:12px;">
                        <h2 style="font-size:24px; letter-spacing:4px; font-weight:700;">出　勤　簿</h2>
                        <p style="font-size:14px; margin-top:4px;">（${year}年 ${parseInt(month, 10)}月度）</p>
                    </div>

                    <!-- 画面表示用のヘッダー -->
                    <div class="ledger-header-screen" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
                        <div>
                            <h2 style="font-size:22px; font-weight:600; display:flex; align-items:center;">
                                ${year}年 ${parseInt(month, 10)}月度 出勤簿
                                ${statusBadge}
                            </h2>
                            <p style="color:var(--text-secondary); font-size:13px; margin-top:4px;">所属: <strong>${staff.department_name} ${staff.station_name}</strong> &nbsp;|&nbsp; 職員番号: <strong>${staff.employee_number}</strong></p>
                        </div>
                        
                        <!-- 決裁印・押印欄 -->
                        <div class="hanko-section" style="display:flex; gap:0; border:1px solid #94a3b8; border-radius:4px; overflow:hidden;">
                            ${renderHanko('署 長', chiefHankoName, chiefHankoDate)}
                            ${renderHanko('大隊長', approval.status === 'approved' ? '確認' : null, chiefHankoDate)}
                            ${renderHanko('分隊長', approval.status === 'approved' ? '確認' : null, chiefHankoDate)}
                            ${renderHanko('本 人', selfHankoName, selfHankoDate)}
                        </div>
                    </div>

                    <!-- プロフィール情報（印刷用） -->
                    <div class="ledger-profile-print" style="display:none; justify-content:space-between; margin-bottom:16px; font-size:12px; font-weight:600; border-bottom:1px solid #000; padding-bottom:8px;">
                        <span>本部: ${staff.department_name}</span>
                        <span>所属署: ${staff.station_name}</span>
                        <span>交替区分: ${staff.platoon_label}</span>
                        <span>階級: ${staff.rank || '一般'}</span>
                        <span>職員番号: ${staff.employee_number}</span>
                        <span>氏名: ${staff.name}</span>
                    </div>

                    <!-- メイン出勤簿テーブル -->
                    <div class="table-responsive" style="margin-bottom:24px;">
                        <table class="table ledger-table" style="width:100%; border-collapse:collapse; font-size:13px; border: 1px solid #64748b;">
                            <thead>
                                <tr style="background:#f1f5f9; color:#1e293b; border-bottom:2px solid #64748b; font-weight:600;">
                                    <th style="border: 1px solid #cbd5e1; text-align:center; padding:8px 4px; width:40px;">日</th>
                                    <th style="border: 1px solid #cbd5e1; text-align:center; padding:8px 4px; width:40px;">曜</th>
                                    <th style="border: 1px solid #cbd5e1; text-align:center; padding:8px 8px; width:80px;">勤務実績</th>
                                    <th style="border: 1px solid #cbd5e1; text-align:center; padding:8px 8px; width:100px;">出勤時刻</th>
                                    <th style="border: 1px solid #cbd5e1; text-align:center; padding:8px 8px; width:100px;">退勤時刻</th>
                                    <th style="border: 1px solid #cbd5e1; text-align:right; padding:8px 8px; width:70px;">所定(h)</th>
                                    <th style="border: 1px solid #cbd5e1; text-align:right; padding:8px 8px; width:70px;">実働(h)</th>
                                    <th style="border: 1px solid #cbd5e1; text-align:right; padding:8px 8px; width:70px;">超過(h)</th>
                                    <th style="border: 1px solid #cbd5e1; text-align:left; padding:8px 12px;">状態・備考</th>
                                    <th class="no-print" style="border: 1px solid #cbd5e1; text-align:center; padding:8px 8px; width:70px;">日次印</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ledger.map(day => {
                                    // 曜日・祝日によるカラーリング
                                    let rowStyle = '';
                                    let dayOfWeekColor = '';
                                    
                                    if (day.is_holiday) {
                                        rowStyle = 'background: rgba(239, 68, 68, 0.02);';
                                        dayOfWeekColor = 'color: #dc2626; font-weight:600;';
                                    } else if (day.day_of_week === '土') {
                                        rowStyle = 'background: rgba(37, 99, 235, 0.02);';
                                        dayOfWeekColor = 'color: #2563eb; font-weight:600;';
                                    }
 
                                    // シフト区分バッジ (勤務スケジュールと整合をとる)
                                    let shiftBadge = '';
                                    if (day.scheduled_shift === 'tou') shiftBadge = '<span class="badge badge-tou">勤務</span>';
                                    else if (day.scheduled_shift === 'nik') shiftBadge = '<span class="badge badge-nik">日勤</span>';
                                    else if (day.scheduled_shift === 'paid') shiftBadge = '<span class="badge badge-paid">年休</span>';
                                    else if (day.scheduled_shift === 'special') shiftBadge = '<span class="badge badge-special">特休</span>';
                                    else if (day.scheduled_shift === 'hol') shiftBadge = '<span class="badge badge-holiday">週休</span>';
                                    else if (day.scheduled_shift === 'off') shiftBadge = '<span class="badge badge-off">非番</span>';
                                    else if (day.scheduled_shift === 'public') shiftBadge = '<span class="badge" style="background:#f3e8ff; color:#6b21a8; border:1px solid #d8b4fe; padding:2px 6px; font-size:11px; border-radius:4px; font-weight:600;">公休</span>';
                                    else if (day.scheduled_shift === 'business') shiftBadge = '<span class="badge badge-business">出張</span>';
                                    else if (day.scheduled_shift === 'sick') shiftBadge = '<span class="badge badge-sick">病休</span>';
                                    else if (day.scheduled_shift === 'compensatory') shiftBadge = '<span class="badge badge-off" style="background:#e2e8f0; color:#475569;">代休</span>';
                                    else shiftBadge = `<span class="badge badge-off">${day.shift_label}</span>`;

                                    // 打刻文字色（未打刻のグレー表示）
                                    const clockInText = day.clock_in || '<span style="color:#94a3b8">-</span>';
                                    const clockOutText = day.clock_out || '<span style="color:#94a3b8">-</span>';

                                    // 日次確認チェック（出勤していればチェックマーク）
                                    const hasClockedIn = !!day.clock_in;
                                    const isDailyConfirmed = hasClockedIn ? '<i data-lucide="check" style="color:#ef4444; width:16px; height:16px; margin:0 auto;"></i>' : '';

                                    return `
                                        <tr style="${rowStyle} border-bottom:1px solid #e2e8f0;">
                                            <td style="border: 1px solid #cbd5e1; text-align:center; padding:8px 4px; font-weight:600;">${day.day}</td>
                                            <td style="border: 1px solid #cbd5e1; text-align:center; padding:8px 4px; ${dayOfWeekColor}">${day.day_of_week}</td>
                                            <td style="border: 1px solid #cbd5e1; text-align:center; padding:8px 4px;">${shiftBadge}</td>
                                            <td style="border: 1px solid #cbd5e1; text-align:center; padding:8px 4px; font-family:monospace; font-size:14px;">${clockInText}</td>
                                            <td style="border: 1px solid #cbd5e1; text-align:center; padding:8px 4px; font-family:monospace; font-size:14px;">${clockOutText}</td>
                                            <td style="border: 1px solid #cbd5e1; text-align:right; padding:8px 6px; font-family:monospace;">${day.scheduled_hours > 0 ? day.scheduled_hours.toFixed(2) : '-'}</td>
                                            <td style="border: 1px solid #cbd5e1; text-align:right; padding:8px 6px; font-family:monospace;">${day.actual_hours > 0 ? day.actual_hours.toFixed(2) : '-'}</td>
                                            <td style="border: 1px solid #cbd5e1; text-align:right; padding:8px 6px; font-family:monospace; ${day.overtime_hours > 0 ? 'color:#dc2626; font-weight:600;' : ''}">${day.overtime_hours > 0 ? day.overtime_hours.toFixed(2) : '-'}</td>
                                            <td style="border: 1px solid #cbd5e1; text-align:left; padding:8px 12px; font-size:12px; color:#475569;">${day.remarks || ''}</td>
                                            <td class="no-print" style="border: 1px solid #cbd5e1; text-align:center; padding:8px 4px;">${isDailyConfirmed}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- 月間集計情報 -->
                    <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:16px; margin-bottom:16px; font-size:13px; line-height:1.6;">
                        <h4 style="font-size:14px; font-weight:600; margin-bottom:10px; border-bottom:1px solid #cbd5e1; padding-bottom:6px; color:#1e293b;">【月間勤務実績集計】</h4>
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
                            <div>当務勤務回数: <strong>${summary.duty_count} 回</strong></div>
                            <div>日勤勤務日数: <strong>${summary.daywork_count} 日</strong></div>
                            <div>週休取得日数: <strong>${summary.holiday_count || 0} 日</strong></div>
                            <div>有給(年休)消化: <strong>${summary.annual_leave_days.toFixed(1)} 日</strong></div>
                            <div>特別休暇消化: <strong>${summary.special_leave_days.toFixed(1)} 日</strong></div>
                            <div>年休残日数(管理): <strong>${staff.annual_leave_balance !== undefined && staff.annual_leave_balance !== null ? staff.annual_leave_balance.toFixed(1) : '-'} 日</strong></div>
                            <div style="${summary.absent_days > 0 ? 'color:#dc2626; font-weight:600;' : ''}">欠勤日数: <strong>${summary.absent_days} 日</strong></div>
                            <div>総所定労働時間: <strong>${summary.total_scheduled_hours.toFixed(2)} h</strong></div>
                            <div>総実労働時間: <strong>${summary.total_actual_hours.toFixed(2)} h</strong></div>
                            <div style="color:#dc2626; font-weight:600;">総超過(残業)時間: <strong>${summary.total_overtime_hours.toFixed(2)} h</strong></div>
                        </div>
                    </div>
                </div>

                <!-- 承認ワークフローアクションパネル (印刷時には完全に非表示) -->
                <div class="card no-print" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                    <div>
                        <h4 style="font-size:15px; margin-bottom:4px;">出勤簿 提出・承認ワークフロー</h4>
                        <p style="color:var(--text-secondary); font-size:12px;">
                            ${approval.status === 'draft' ? '現在の状態: <strong>下書き（未提出）</strong>です。今月の勤務が完了したら「提出する」を押してください。' : ''}
                            ${approval.status === 'submitted' ? `提出者: <strong>${approval.submitted_by_name}</strong> (${approval.submitted_at.substring(5, 16)}) &nbsp;|&nbsp; 状態: <strong>承認待ち</strong>です。` : ''}
                            ${approval.status === 'approved' ? `承認者: <strong>${approval.approved_by_name}</strong> (${approval.approved_at.substring(5, 16)}) &nbsp;|&nbsp; 状態: <strong>確認・確定済</strong>です。` : ''}
                        </p>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <!-- 一般職員：提出ボタン -->
                        ${approval.status === 'draft' && staff.id === Auth.user.id ? `
                            <button class="btn btn-primary" onclick="Ledger.updateApproval('submit')" style="background:var(--primary-color);">
                                <i data-lucide="check-circle" style="width:16px; height:16px;"></i> 今月分を提出する
                            </button>
                        ` : ''}

                        <!-- 管理職・承認者：承認・差し戻しボタン -->
                        ${approval.status === 'submitted' && Auth.hasRole('chief', 'admin', 'sysadmin') ? `
                            <button class="btn btn-secondary" onclick="Ledger.updateApproval('reject')" style="border-color:var(--danger); color:var(--danger); background:rgba(239, 68, 68, 0.02);">
                                <i data-lucide="rotate-ccw" style="width:16px; height:16px;"></i> 差し戻す（修正依頼）
                            </button>
                            <button class="btn btn-primary" onclick="Ledger.updateApproval('approve')" style="background:var(--success);">
                                <i data-lucide="award" style="width:16px; height:16px;"></i> 承認・確定する
                            </button>
                        ` : ''}

                        <!-- 承認済みの確定解除ボタン (管理者のみ) -->
                        ${approval.status === 'approved' && Auth.hasRole('chief', 'admin', 'sysadmin') ? `
                            <button class="btn btn-secondary" onclick="Ledger.updateApproval('reject')" style="font-size:12px;">
                                <i data-lucide="unlock" style="width:14px; height:14px;"></i> 確定を解除する（下書きへ）
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    /**
     * 出勤簿承認ステータスのアップデート処理
     */
    async updateApproval(action) {
        const { staff } = this.data;
        const [year, month] = this.activeYearMonth.split('-');
        
        let confirmMsg = '';
        if (action === 'submit') confirmMsg = `${year}年${parseInt(month, 10)}月度の出勤簿を提出します。よろしいですか？（提出後は打刻修正申請ができなくなります）`;
        if (action === 'approve') confirmMsg = `${staff.name} さんの出勤簿を承認・確定します。よろしいですか？`;
        if (action === 'reject') confirmMsg = '出勤簿を差し戻します（または確定解除します）。よろしいですか？';

        if (!confirm(confirmMsg)) return;

        try {
            const response = await fetch('/api/attendance/ledger/approve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify({
                    staff_id: staff.id,
                    year_month: `${year}-${String(month).padStart(2, '0')}`,
                    action: action
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || '承認処理に失敗しました。');
            }

            const resData = await response.json();
            Portal.showToast(resData.message, 'success');
            
            // データをリロード
            await this.loadLedgerData();
        } catch (err) {
            console.error(err);
            Portal.showToast(err.message, 'error');
        }
    },

    /**
     * 出勤簿の印刷用ページ呼び出し
     */
    printLedger() {
        window.print();
    }
};

window.Ledger = Ledger;
