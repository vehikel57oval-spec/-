/**
 * 消防ポータルシステム ダッシュボードモジュール (Dashboard)
 */
const Dashboard = {
    /**
     * ダッシュボード画面のレンダリング
     */
    async render(container) {
        try {
            // 本日の出勤レコード・スケジュールの取得
            const todayResponse = await fetch('/api/attendance/today', {
                headers: { 'Authorization': `Bearer ${Auth.token}` }
            });
            const todayData = await todayResponse.json();
            
            // 履歴データの取得 (直近1ヶ月分)
            const todayDate = new Date();
            const lastMonthDate = new Date();
            lastMonthDate.setMonth(todayDate.getMonth() - 1);
            
            const startDateStr = lastMonthDate.toISOString().slice(0, 10);
            const endDateStr = todayDate.toISOString().slice(0, 10);
            
            const historyResponse = await fetch(`/api/attendance/history?start_date=${startDateStr}&end_date=${endDateStr}`, {
                headers: { 'Authorization': `Bearer ${Auth.token}` }
            });
            const historyData = await historyResponse.json();
            
            // ロールに応じたHTML構築
            if (Auth.hasRole('chief', 'admin', 'sysadmin')) {
                // 管理者用統計の取得
                const adminResponse = await fetch('/api/admin/dashboard', {
                    headers: { 'Authorization': `Bearer ${Auth.token}` }
                });
                const adminData = await adminResponse.json();
                
                this.renderAdminDashboard(container, todayData, historyData, adminData);
            } else {
                this.renderStaffDashboard(container, todayData, historyData);
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (err) {
            console.error('Dashboard rendering error:', err);
            container.innerHTML = `<p style="color:var(--danger)">データの取得中にエラーが発生しました。</p>`;
        }
    },

    /**
     * 一般職員向けダッシュボード
     */
    renderStaffDashboard(container, todayData, historyData) {
        // 直近4ヶ月の選択肢を生成
        const monthOptions = [];
        const dateForMonths = new Date();
        for (let i = 0; i < 4; i++) {
            const y = dateForMonths.getFullYear();
            const m = String(dateForMonths.getMonth() + 1).padStart(2, '0');
            monthOptions.push(`<option value="${y}-${m}">${y}年${m}月</option>`);
            dateForMonths.setMonth(dateForMonths.getMonth() - 1);
        }
        const monthOptionsHTML = monthOptions.join('');

        // 月間集計
        const stats = this.calculateMonthlyStats(historyData.history);
        
        // 当日の勤怠状態テキスト
        let statusText = '未出勤';
        let statusClass = 'badge-off';
        
        if (todayData.record) {
            if (todayData.record.status === 'working') {
                statusText = '勤務中';
                statusClass = 'badge-tou';
            } else if (todayData.record.status === 'present') {
                statusText = '退勤済';
                statusClass = 'badge-nik';
            }
        }

        // 今日のスケジュールキーの変換
        const shiftKey = todayData.schedule ? todayData.schedule.shift_key : (Auth.user.platoon === 'nikkin' ? '日' : '当');
        const shiftLabel = shiftKey === '当' ? '当務 (24h)' : (shiftKey === '日' ? '日勤' : '公休/週休');
        const shiftTime = shiftKey === '当' ? '08:30 〜 翌08:30' : (shiftKey === '日' ? '08:30 〜 17:15' : '---');

        // 日付検索のデフォルト範囲（今月1日〜今日）
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const startDate = `${yyyy}-${mm}-01`;
        const endDate = today.toISOString().slice(0, 10);

        container.innerHTML = `
            <div class="dashboard-grid">
                <!-- 歓迎メッセージ -->
                <div class="welcome-section">
                    <div>
                        <h2 class="welcome-title">こんにちは、${Auth.user.name} 職員</h2>
                        <p class="welcome-date">${new Date().toLocaleDateString('ja-JP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div class="shift-info-badge">
                        <i data-lucide="shield-alert"></i>
                        <span>本日勤務区分: <strong>${shiftLabel} (${shiftTime})</strong></span>
                    </div>
                </div>
                
                <!-- メインカラム (左側) -->
                <div style="display:flex; flex-direction:column; gap:24px;">
                    <!-- 車両配置連動型打刻ウィジェット -->
                    <div class="card" style="display:flex; flex-direction:column; gap:20px; padding:28px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255,255,255,0.08); position: relative; overflow: hidden;">
                        <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: var(--accent-fire); opacity: 0.05; filter: blur(50px); pointer-events: none; border-radius: 50%;"></div>
                        
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                            <div style="display:flex; flex-direction:column; gap:6px;">
                                <span style="font-size:11px; color:var(--text-muted); font-weight:700; letter-spacing:1px; text-transform:uppercase;">本日の乗車車両・役割</span>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <i data-lucide="truck" style="color:var(--accent-fire); width:20px; height:20px;"></i>
                                    <span style="font-size:18px; font-weight:700; color:var(--text-primary);">
                                        ${todayData.vehicleAssignment ? `${todayData.vehicleAssignment.vehicle_name} <span style="font-size:14px; font-weight:500; color:var(--text-secondary); margin-left:6px;">(${todayData.vehicleAssignment.role_name})</span>` : '<span style="color:var(--text-muted); font-weight:500; font-size:15px;">車両アサインなし (徒歩/待機)</span>'}
                                    </span>
                                </div>
                            </div>
                            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                                <span style="font-size:11px; color:var(--text-muted); font-weight:700; letter-spacing:1px; text-transform:uppercase; text-align:right;">現在の打刻ステータス</span>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span class="badge ${statusClass}" style="font-size:13px; padding:4px 10px; width:auto; height:auto; white-space:nowrap; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;">${statusText}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:16px; display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                            <!-- 出勤ボタン -->
                            ${!todayData.record?.actual_clock_in ? `
                                <button class="btn btn-primary" onclick="Dashboard.clockIn()" style="display:flex; align-items:center; justify-content:center; gap:8px; padding:14px 20px; background: var(--primary-color); font-weight:600; font-size:15px; border-radius:10px; transition: all 0.2s ease; border: none; cursor: pointer;">
                                    <i data-lucide="play" style="width:16px; height:16px;"></i> 出勤打刻 (1タップ)
                                </button>
                            ` : `
                                <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; padding:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); border-radius:10px; height:50px;">
                                    <span style="font-size:11px; color:var(--text-muted);">出勤時刻</span>
                                    <span style="font-size:15px; font-weight:600; color:var(--success);">${todayData.record.actual_clock_in.substring(11, 16)}</span>
                                </div>
                            `}
                            
                            <!-- 退勤ボタン -->
                            ${todayData.record?.actual_clock_in && !todayData.record?.actual_clock_out ? `
                                <button class="btn" onclick="Dashboard.clockOut()" style="display:flex; align-items:center; justify-content:center; gap:8px; padding:14px 20px; background: var(--accent-fire); color:white; font-weight:600; font-size:15px; border:none; border-radius:10px; transition: all 0.2s ease; cursor: pointer;">
                                    <i data-lucide="square" style="width:14px; height:14px;"></i> 退勤打刻 (1タップ)
                                </button>
                            ` : `
                                <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; padding:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); border-radius:10px; height:50px;">
                                    <span style="font-size:11px; color:var(--text-muted);">退勤時刻</span>
                                    <span style="font-size:15px; font-weight:600; color:${todayData.record?.actual_clock_out ? 'var(--text-primary)' : 'var(--text-muted)'};">
                                        ${todayData.record?.actual_clock_out ? todayData.record.actual_clock_out.substring(11, 16) : '--:--'}
                                    </span>
                                </div>
                            `}
                        </div>
                    </div>
                    
                    <!-- 統計カード -->
                    <div class="stats-row">
                        <div class="card stat-card">
                            <div class="stat-icon success"><i data-lucide="calendar"></i></div>
                            <div class="stat-info">
                                <span class="stat-label">今月の勤務日数</span>
                                <span class="stat-value">${stats.daysWorked} 日</span>
                            </div>
                        </div>
                        <div class="card stat-card">
                            <div class="stat-icon orange"><i data-lucide="clock"></i></div>
                            <div class="stat-info">
                                <span class="stat-label">時間外労働 (超過)</span>
                                <span class="stat-value">${stats.overtimeHours.toFixed(1)} h</span>
                            </div>
                        </div>
                        <div class="card stat-card">
                            <div class="stat-icon primary"><i data-lucide="heart"></i></div>
                            <div class="stat-info">
                                <span class="stat-label">年次有給休暇残数</span>
                                <span class="stat-value">${Number(Auth.user.annual_leave_balance || 0).toFixed(1)} 日</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 勤務打刻履歴 -->
                    <div class="card">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:16px;">
                            <div>
                                <h4 style="font-weight:600; margin:0;">勤務打刻履歴</h4>
                                <p style="color:var(--text-secondary); font-size:12px; margin-top:4px;">打刻漏れの修正申請は、各行の「修正申請」ボタンから行えます。</p>
                            </div>
                            
                            <!-- 期間検索 -->
                            <div style="display:flex; align-items:center; gap:8px; font-size:13px;">
                                <input class="form-input" style="padding:6px 12px; width:140px; height:36px;" type="date" id="history-start-date" value="${startDate}">
                                <span>〜</span>
                                <input class="form-input" style="padding:6px 12px; width:140px; height:36px;" type="date" id="history-end-date" value="${endDate}">
                                <button class="btn btn-primary" style="padding:6px 12px; font-size:12px; height:36px; cursor:pointer;" onclick="Dashboard.searchHistory()">
                                    検索
                                </button>
                            </div>
                        </div>
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>対象日</th>
                                        <th>予定型</th>
                                        <th>出勤時刻</th>
                                        <th>退勤時刻</th>
                                        <th>実勤務</th>
                                        <th>超過勤務</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody id="attendance-history-table-body">
                                    ${this.renderHistoryRows(historyData.history)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- サブカラム (右側) -->
                <div style="display:flex; flex-direction:column; gap:24px;">
                    <!-- 休暇・出張クイックリンク -->
                    <div class="card" style="display:flex; flex-direction:column; gap:14px;">
                        <h4 style="font-weight:600;">クイックアクション</h4>
                        <button class="btn btn-primary" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:var(--text-primary); justify-content:start;" onclick="Portal.navigate('leave')">
                            <i data-lucide="file-plus" style="color:var(--primary-color);"></i> 年休・各種休暇の申請
                        </button>
                        <button class="btn btn-primary" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:var(--text-primary); justify-content:start;" onclick="Dashboard.openWeeklyOffModal()">
                            <i data-lucide="calendar-days" style="color:var(--primary-color);"></i> 週休希望の登録・変更
                        </button>
                        <button class="btn btn-primary" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:var(--text-primary); justify-content:start;" onclick="Portal.navigate('schedule')">
                            <i data-lucide="calendar" style="color:var(--success);"></i> 自分の勤務シフトの確認
                        </button>
                        <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 14px; margin-top: 4px; display: flex; flex-direction: column; gap: 10px;">
                            <span style="font-size:12px; color:var(--text-muted); font-weight:600;">出勤簿の作成</span>
                            <div style="display: flex; gap: 8px;">
                                <select class="form-input" id="attendance-sheet-month-staff" style="flex: 1; padding: 6px 10px; height: 36px; font-size: 13px;">
                                    ${monthOptionsHTML}
                                </select>
                                <button class="btn btn-primary" style="padding: 0 12px; font-size: 13px; height: 36px; white-space: nowrap; cursor: pointer;" onclick="Portal.showToast('機能は開発中です', 'info')">
                                    作成
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 管理者（署長・本部管理者）向けダッシュボード
     */
    renderAdminDashboard(container, todayData, historyData, adminData) {
        // 直近4ヶ月の選択肢を生成
        const monthOptions = [];
        const dateForMonths = new Date();
        for (let i = 0; i < 4; i++) {
            const y = dateForMonths.getFullYear();
            const m = String(dateForMonths.getMonth() + 1).padStart(2, '0');
            monthOptions.push(`<option value="${y}-${m}">${y}年${m}月</option>`);
            dateForMonths.setMonth(dateForMonths.getMonth() - 1);
        }
        const monthOptionsHTML = monthOptions.join('');

        const stats = this.calculateMonthlyStats(historyData.history);
        const adminStats = adminData.stats;
        
        let statusText = '未出勤';
        let statusClass = 'badge-off';
        
        if (todayData.record) {
            if (todayData.record.status === 'working') {
                statusText = '勤務中';
                statusClass = 'badge-tou';
            } else if (todayData.record.status === 'present') {
                statusText = '退勤済';
                statusClass = 'badge-nik';
            }
        }

        // 日付検索のデフォルト範囲（今月1日〜今日）
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const startDate = `${yyyy}-${mm}-01`;
        const endDate = today.toISOString().slice(0, 10);

        container.innerHTML = `
            <div class="dashboard-grid">
                <!-- 歓迎メッセージ -->
                <div class="welcome-section">
                    <div>
                        <h2 class="welcome-title">管理者ダッシュボード</h2>
                        <p class="welcome-date">${Auth.user.name} 階級: <strong>${Auth.user.rank || '管理者'}</strong></p>
                    </div>
                    <div class="shift-info-badge" style="background-color: var(--accent-fire-glow); color: var(--accent-fire);">
                        <i data-lucide="shield"></i>
                        <span>権限: <strong>${Auth.user.role === 'sysadmin' ? '全体システム管理者' : '署所管理者'}</strong></span>
                    </div>
                </div>
                
                <!-- 管理者用サマリー (最上部) -->
                <div class="stats-row" style="grid-column: 1 / -1; margin-bottom: 8px;">
                    <div class="card stat-card">
                        <div class="stat-icon primary"><i data-lucide="users"></i></div>
                        <div class="stat-info">
                            <span class="stat-label">管轄職員総数</span>
                            <span class="stat-value">${adminStats.total_staff} 名</span>
                        </div>
                    </div>
                    <div class="card stat-card">
                        <div class="stat-icon success"><i data-lucide="user-check"></i></div>
                        <div class="stat-info">
                            <span class="stat-label">現在出勤(勤務中)</span>
                            <span class="stat-value">${adminStats.working_now} 名</span>
                        </div>
                    </div>
                    <div class="card stat-card">
                        <div class="stat-icon"><i data-lucide="flame" style="color:var(--accent-fire)"></i></div>
                        <div class="stat-info">
                            <span class="stat-label">本日当務予定者</span>
                            <span class="stat-value">${adminStats.scheduled_tou} 名</span>
                        </div>
                    </div>
                    <div class="card stat-card" onclick="Portal.navigate('approvals')" style="cursor:pointer;">
                        <div class="stat-icon orange" style="position:relative;">
                            <i data-lucide="alert-circle"></i>
                            ${adminStats.pending_approvals > 0 ? `<span style="position:absolute; top:-4px; right:-4px; background:var(--danger); width:12px; height:12px; border-radius:50%;"></span>` : ''}
                        </div>
                        <div class="stat-info">
                            <span class="stat-label">未承認の修正申請</span>
                            <span class="stat-value" style="color: ${adminStats.pending_approvals > 0 ? 'var(--warning)' : 'var(--text-primary)'}">
                                ${adminStats.pending_approvals} 件
                            </span>
                        </div>
                    </div>
                </div>
                
                <!-- メインカラム (左側) -->
                <div style="display:flex; flex-direction:column; gap:24px;">
                    <!-- 車両配置連動型打刻ウィジェット -->
                    <div class="card" style="display:flex; flex-direction:column; gap:20px; padding:28px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255,255,255,0.08); position: relative; overflow: hidden;">
                        <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: var(--accent-fire); opacity: 0.05; filter: blur(50px); pointer-events: none; border-radius: 50%;"></div>
                        
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                            <div style="display:flex; flex-direction:column; gap:6px;">
                                <span style="font-size:11px; color:var(--text-muted); font-weight:700; letter-spacing:1px; text-transform:uppercase;">本日の乗車車両・役割</span>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <i data-lucide="truck" style="color:var(--accent-fire); width:20px; height:20px;"></i>
                                    <span style="font-size:18px; font-weight:700; color:var(--text-primary);">
                                        ${todayData.vehicleAssignment ? `${todayData.vehicleAssignment.vehicle_name} <span style="font-size:14px; font-weight:500; color:var(--text-secondary); margin-left:6px;">(${todayData.vehicleAssignment.role_name})</span>` : '<span style="color:var(--text-muted); font-weight:500; font-size:15px;">車両アサインなし (徒歩/待機)</span>'}
                                    </span>
                                </div>
                            </div>
                            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                                <span style="font-size:11px; color:var(--text-muted); font-weight:700; letter-spacing:1px; text-transform:uppercase; text-align:right;">現在の打刻ステータス</span>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span class="badge ${statusClass}" style="font-size:13px; padding:4px 10px; width:auto; height:auto; white-space:nowrap; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;">${statusText}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:16px; display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                            <!-- 出勤ボタン -->
                            ${!todayData.record?.actual_clock_in ? `
                                <button class="btn btn-primary" onclick="Dashboard.clockIn()" style="display:flex; align-items:center; justify-content:center; gap:8px; padding:14px 20px; background: var(--primary-color); font-weight:600; font-size:15px; border-radius:10px; transition: all 0.2s ease; border: none; cursor: pointer;">
                                    <i data-lucide="play" style="width:16px; height:16px;"></i> 出勤打刻 (1タップ)
                                </button>
                            ` : `
                                <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; padding:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); border-radius:10px; height:50px;">
                                    <span style="font-size:11px; color:var(--text-muted);">出勤時刻</span>
                                    <span style="font-size:15px; font-weight:600; color:var(--success);">${todayData.record.actual_clock_in.substring(11, 16)}</span>
                                </div>
                            `}
                            
                            <!-- 退勤ボタン -->
                            ${todayData.record?.actual_clock_in && !todayData.record?.actual_clock_out ? `
                                <button class="btn" onclick="Dashboard.clockOut()" style="display:flex; align-items:center; justify-content:center; gap:8px; padding:14px 20px; background: var(--accent-fire); color:white; font-weight:600; font-size:15px; border:none; border-radius:10px; transition: all 0.2s ease; cursor: pointer;">
                                    <i data-lucide="square" style="width:14px; height:14px;"></i> 退勤打刻 (1タップ)
                                </button>
                            ` : `
                                <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; padding:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); border-radius:10px; height:50px;">
                                    <span style="font-size:11px; color:var(--text-muted);">退勤時刻</span>
                                    <span style="font-size:15px; font-weight:600; color:${todayData.record?.actual_clock_out ? 'var(--text-primary)' : 'var(--text-muted)'};">
                                        ${todayData.record?.actual_clock_out ? todayData.record.actual_clock_out.substring(11, 16) : '--:--'}
                                    </span>
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- 保留中申請リストがある場合、ショートカット表示 -->
                    ${adminStats.pending_approvals > 0 ? `
                        <div class="card" style="border-left:4px solid var(--warning);">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <h4 style="font-weight:600; color:var(--warning);">打刻時刻の修正申請が届いています</h4>
                                    <p style="font-size:13px; color:var(--text-secondary); margin-top:4px;">職員の打刻忘れや間違いに伴う修正申請が ${adminStats.pending_approvals} 件待機しています。</p>
                                </div>
                                <button class="btn btn-primary" onclick="Portal.navigate('approvals')" style="background:var(--warning); color:white; box-shadow:none; padding:10px 16px; font-size:13px;">
                                    審査画面を開く &rarr;
                                </button>
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- 勤務打刻履歴 -->
                    <div class="card">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:16px;">
                            <div>
                                <h4 style="font-weight:600; margin:0;">勤務打刻履歴</h4>
                                <p style="color:var(--text-secondary); font-size:12px; margin-top:4px;">打刻漏れの修正申請は、各行の「修正申請」ボタンから行えます。</p>
                            </div>
                            
                            <!-- 期間検索 -->
                            <div style="display:flex; align-items:center; gap:8px; font-size:13px;">
                                <input class="form-input" style="padding:6px 12px; width:140px; height:36px;" type="date" id="history-start-date" value="${startDate}">
                                <span>〜</span>
                                <input class="form-input" style="padding:6px 12px; width:140px; height:36px;" type="date" id="history-end-date" value="${endDate}">
                                <button class="btn btn-primary" style="padding:6px 12px; font-size:12px; height:36px; cursor:pointer;" onclick="Dashboard.searchHistory()">
                                    検索
                                </button>
                            </div>
                        </div>
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>対象日</th>
                                        <th>予定型</th>
                                        <th>出勤時刻</th>
                                        <th>退勤時刻</th>
                                        <th>実勤務</th>
                                        <th>超過勤務</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody id="attendance-history-table-body">
                                    ${this.renderHistoryRows(historyData.history)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- サブカラム (右側) -->
                <div style="display:flex; flex-direction:column; gap:24px;">
                    <!-- 管理タスク一覧 -->
                    <div class="card" style="display:flex; flex-direction:column; gap:14px;">
                        <h4 style="font-weight:600;">管理業務メニュー</h4>
                        <button class="btn btn-primary" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:var(--text-primary); justify-content:start;" onclick="Portal.navigate('staff_admin')">
                            <i data-lucide="users" style="color:var(--primary-color);"></i> 職員名簿マスタの管理
                        </button>
                        ${Auth.hasRole('admin', 'sysadmin') ? `
                            <button class="btn btn-primary" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:var(--text-primary); justify-content:start;" onclick="Portal.navigate('settings')">
                                <i data-lucide="settings" style="color:var(--accent-fire);"></i> 丸め設定・システム設定
                            </button>
                        ` : ''}
                    </div>

                    <!-- クイックアクション -->
                    <div class="card" style="display:flex; flex-direction:column; gap:14px;">
                        <h4 style="font-weight:600;">クイックアクション</h4>
                        <button class="btn btn-primary" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:var(--text-primary); justify-content:start;" onclick="Portal.navigate('leave')">
                            <i data-lucide="file-plus" style="color:var(--primary-color);"></i> 年休・各種休暇の申請
                        </button>
                        <button class="btn btn-primary" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:var(--text-primary); justify-content:start;" onclick="Dashboard.openWeeklyOffModal()">
                            <i data-lucide="calendar-days" style="color:var(--primary-color);"></i> 週休希望の登録・変更
                        </button>
                        <button class="btn btn-primary" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:var(--text-primary); justify-content:start;" onclick="Portal.navigate('schedule')">
                            <i data-lucide="calendar" style="color:var(--success);"></i> 自分の勤務シフトの確認
                        </button>
                        <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 14px; margin-top: 4px; display: flex; flex-direction: column; gap: 10px;">
                            <span style="font-size:12px; color:var(--text-muted); font-weight:600;">出勤簿の作成</span>
                            <div style="display: flex; gap: 8px;">
                                <select class="form-input" id="attendance-sheet-month-admin" style="flex: 1; padding: 6px 10px; height: 36px; font-size: 13px;">
                                    ${monthOptionsHTML}
                                </select>
                                <button class="btn btn-primary" style="padding: 0 12px; font-size: 13px; height: 36px; white-space: nowrap; cursor: pointer;" onclick="Portal.showToast('機能は開発中です', 'info')">
                                    作成
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 直近履歴から月間統計（出勤日数、超過時間）を簡易計算
     */
    calculateMonthlyStats(historyList) {
        let daysWorked = 0;
        let overtimeHours = 0.0;
        
        historyList.forEach(item => {
            if (item.status === 'present' || item.status === 'working') {
                daysWorked++;
                overtimeHours += item.overtime_hours || 0.0;
            }
        });
        
        return {
            daysWorked,
            overtimeHours
        };
    },

    /**
     * 履歴行の生成
     */
    renderHistoryRows(history) {
        if (!history || history.length === 0) {
            return `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:24px;">該当期間の打刻履歴はありません。</td></tr>`;
        }
        
        return history.map(item => {
            let badgeClass = 'badge-off';
            let badgeLabel = 'その他';
            if (item.scheduled_shift === 'tou') { badgeClass = 'badge-tou'; badgeLabel = '当務'; }
            else if (item.scheduled_shift === 'nik') { badgeClass = 'badge-nik'; badgeLabel = '日勤'; }
            else if (item.scheduled_shift === 'off') { badgeClass = 'badge-off'; badgeLabel = '時間外/非当'; }
            
            const clockIn = item.actual_clock_in ? item.actual_clock_in.substring(11, 19) : '<span style="color:var(--text-muted)">未打刻</span>';
            const clockOut = item.actual_clock_out ? item.actual_clock_out.substring(11, 19) : '<span style="color:var(--text-muted)">未打刻</span>';
            const workHours = item.actual_hours !== null ? `${item.actual_hours}時間` : '-';
            const overtimeHours = item.overtime_hours > 0 ? `<span style="color:var(--accent-fire); font-weight:600;">${item.overtime_hours}時間</span>` : '0時間';

            return `
                <tr>
                    <td style="font-weight:500;">${item.work_date}</td>
                    <td><span class="badge ${badgeClass}" style="width:auto; height:auto; white-space:nowrap; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;">${badgeLabel}</span></td>
                    <td>${clockIn}</td>
                    <td>${clockOut}</td>
                    <td>${workHours}</td>
                    <td>${overtimeHours}</td>
                    <td>
                        <button class="btn btn-primary" style="padding:6px 12px; font-size:12px; border-radius:6px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:var(--text-secondary); cursor:pointer;" onclick="Dashboard.openModifyModal(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                            修正申請
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * 出勤打刻の実行
     */
    async clockIn() {
        try {
            const response = await fetch('/api/attendance/clock-in', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                Portal.showToast(data.message, 'success');
                const container = document.getElementById('content-body');
                if (container) {
                    this.render(container);
                }
            } else {
                Portal.showToast(data.error, 'error');
            }
        } catch (err) {
            Portal.showToast('出勤打刻中に通信エラーが発生しました。', 'error');
        }
    },

    /**
     * 退勤打刻の実行
     */
    async clockOut() {
        try {
            const response = await fetch('/api/attendance/clock-out', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                Portal.showToast(data.message, 'success');
                const container = document.getElementById('content-body');
                if (container) {
                    this.render(container);
                }
            } else {
                Portal.showToast(data.error, 'error');
            }
        } catch (err) {
            Portal.showToast('退勤打刻中に通信エラーが発生しました。', 'error');
        }
    },

    /**
     * 履歴の検索実行
     */
    async searchHistory() {
        const start = document.getElementById('history-start-date').value;
        const end = document.getElementById('history-end-date').value;
        
        if (!start || !end) {
            Portal.showToast('期間を指定してください。', 'warning');
            return;
        }
        
        try {
            const response = await fetch(`/api/attendance/history?start_date=${start}&end_date=${end}`, {
                headers: { 'Authorization': `Bearer ${Auth.token}` }
            });
            const data = await response.json();
            if (response.ok) {
                const tbody = document.getElementById('attendance-history-table-body');
                if (tbody) {
                    tbody.innerHTML = this.renderHistoryRows(data.history);
                }
            } else {
                Portal.showToast(data.error, 'error');
            }
        } catch (err) {
            Portal.showToast('検索中にエラーが発生しました。', 'error');
        }
    },

    /**
     * 修正申請モーダルの表示
     */
    openModifyModal(item) {
        const defaultDate = item.work_date;
        const defaultIn = item.actual_clock_in ? item.actual_clock_in.replace(' ', 'T').substring(0, 16) : `${defaultDate}T08:30`;
        const defaultOut = item.actual_clock_out ? item.actual_clock_out.replace(' ', 'T').substring(0, 16) : `${defaultDate}T17:15`;

        const content = `
            <form id="modify-form" onsubmit="Dashboard.submitModification(event, ${item.id})">
                <div style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
                    対象日: <strong>${item.work_date}</strong> の出退勤データを修正します。
                </div>
                
                <div class="form-group" style="margin-bottom:16px;">
                    <label class="form-label">修正対象の項目</label>
                    <select class="form-input" style="padding-left:12px;" id="modify-field" onchange="Dashboard.toggleModifyInput(this.value, '${defaultIn}', '${defaultOut}')" required>
                        <option value="actual_clock_in">出勤時刻</option>
                        <option value="actual_clock_out">退勤時刻</option>
                    </select>
                </div>
                
                <div class="form-group" style="margin-bottom:16px;">
                    <label class="form-label">新しい日時</label>
                    <input class="form-input" style="padding-left:12px;" type="datetime-local" id="modify-new-value" value="${defaultIn}" required>
                </div>
                
                <div class="form-group" style="margin-bottom:20px;">
                    <label class="form-label">修正申請の理由 (打刻忘れ等)</label>
                    <textarea class="form-input" style="padding-left:12px; height:80px; resize:none;" id="modify-reason" required placeholder="例: 出勤時に打刻端末の操作を失念したため。"></textarea>
                </div>
                
                <button type="submit" class="btn btn-primary" style="width:100%;">申請を送信する</button>
            </form>
        `;
        
        Portal.showModal('打刻時刻の修正申請', content);
    },

    toggleModifyInput(field, inVal, outVal) {
        const input = document.getElementById('modify-new-value');
        if (input) {
            input.value = field === 'actual_clock_in' ? inVal : outVal;
        }
    },

    /**
     * 修正申請の送信
     */
    async submitModification(event, recordId) {
        event.preventDefault();
        
        const fieldName = document.getElementById('modify-field').value;
        const rawNewValue = document.getElementById('modify-new-value').value; // YYYY-MM-DDTHH:MM
        const reason = document.getElementById('modify-reason').value.trim();
        
        // データベース保存形式 (YYYY-MM-DD HH:MM:00) に整形
        const newValue = rawNewValue.replace('T', ') ').substring(0, 16) + ':00';
        const formattedNewValue = newValue.replace(') ', ' ');
        
        try {
            const response = await fetch(`/api/attendance/${recordId}/modify`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify({
                    field_name: fieldName,
                    new_value: formattedNewValue,
                    reason
                })
            });
            
            const data = await response.json();
            if (response.ok) {
                Portal.showToast(data.message, 'success');
                Portal.closeModal();
                // 表示更新
                const container = document.getElementById('content-body');
                if (container) {
                    this.render(container);
                }
            } else {
                Portal.showToast(data.error, 'error');
            }
        } catch (err) {
            Portal.showToast('申請の送信中に通信エラーが発生しました。', 'error');
        }
    },

    /**
     * 週休希望登録モーダルの表示
     */
    async openWeeklyOffModal() {
        const anchor = new Date('2026-06-01');
        const today = new Date();
        const diffTime = today - anchor;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const currentCycleIdx = Math.floor(diffDays / 28);
        
        let optionsHtml = '';
        let defaultStartDate = '';
        
        for (let i = -1; i <= 2; i++) {
            const cycleStart = new Date(anchor.getTime());
            cycleStart.setDate(anchor.getDate() + (currentCycleIdx + i) * 28);
            const y = cycleStart.getFullYear();
            const m = String(cycleStart.getMonth() + 1).padStart(2, '0');
            const d = String(cycleStart.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            
            const cycleEnd = new Date(cycleStart.getTime());
            cycleEnd.setDate(cycleStart.getDate() + 27);
            const ye = cycleEnd.getFullYear();
            const me = String(cycleEnd.getMonth() + 1).padStart(2, '0');
            const de = String(cycleEnd.getDate()).padStart(2, '0');
            
            let label = `${y}年${m}月${d}日 〜 ${me}月${de}日`;
            if (i === 0) label += " (今期)";
            if (i === 1) {
                label += " (来期/受付中)";
                defaultStartDate = dateStr;
            }
            if (i === 2) label += " (次々期)";
            if (i === -1) label += " (前期)";
            
            optionsHtml += `<option value="${dateStr}" ${i === 1 ? 'selected' : ''}>${label}</option>`;
        }
        
        if (!defaultStartDate) {
            const cycleStart = new Date(anchor.getTime());
            cycleStart.setDate(anchor.getDate() + currentCycleIdx * 28);
            defaultStartDate = `${cycleStart.getFullYear()}-${String(cycleStart.getMonth()+1).padStart(2,'0')}-${String(cycleStart.getDate()).padStart(2,'0')}`;
        }

        const content = `
            <div style="display:flex; flex-direction:column; gap:16px;">
                <div style="padding:12px; background:rgba(59,130,246,0.1); border-left:4px solid var(--primary-color); border-radius:4px; font-size:13px; line-height:1.5; color:var(--text-primary);">
                    <strong>【週休取得の原則】</strong><br>
                    週休は<strong>原則2日連続での取得</strong>となります。申請する際は、極力2日連続（例: 土日、日月など）になるようご指定ください。最大で<strong>4日間</strong>まで指定可能です。
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="weekly-off-cycle-select">対象サイクル（28日間）</label>
                    <select class="form-input" id="weekly-off-cycle-select" style="width:100%; height:40px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); color:var(--text-primary); padding:0 12px; border-radius:6px;">
                        ${optionsHtml}
                    </select>
                </div>
                
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:14px; font-weight:600; color:var(--text-primary);">希望日の選択 (カレンダー)</span>
                    <span id="weekly-off-count-badge" style="font-size:12px; font-weight:600; padding:2px 8px; border-radius:12px; background:rgba(255,255,255,0.06); color:var(--text-secondary);">選択中: 0 / 4 日</span>
                </div>
                
                <div id="weekly-off-calendar-container" style="background:rgba(255,255,255,0.01); border:1px solid var(--border-color); border-radius:8px; padding:16px; min-height:200px;">
                </div>
                
                <div id="weekly-off-error" style="color:var(--danger); font-size:12px; font-weight:600; display:none;"></div>
                
                <button id="btn-submit-weekly-off" class="btn btn-primary" style="width:100%; height:44px; margin-top:8px; font-weight:600;">
                    週休希望を登録する
                </button>
            </div>
        `;
        
        Portal.showModal('週休希望日の登録・変更', content);
        
        this.bindWeeklyOffModalEvents(defaultStartDate);
    },

    bindWeeklyOffModalEvents(startDateStr) {
        const select = document.getElementById('weekly-off-cycle-select');
        const container = document.getElementById('weekly-off-calendar-container');
        const countBadge = document.getElementById('weekly-off-count-badge');
        const errorDiv = document.getElementById('weekly-off-error');
        const submitBtn = document.getElementById('btn-submit-weekly-off');
        
        let selectedDates = new Set();
        
        const onCycleChange = async (dateStr) => {
            selectedDates.clear();
            errorDiv.style.display = 'none';
            container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">読み込み中...</div>';
            
            try {
                const response = await fetch(`/api/attendance/weekly-off?start_date=${dateStr}`, {
                    headers: { 'Authorization': `Bearer ${Auth.token}` }
                });
                const data = await response.json();
                if (response.ok && data.dates) {
                    data.dates.forEach(d => selectedDates.add(d));
                }
                
                renderCalendarGrid(dateStr);
                updateUIState();
            } catch (err) {
                console.error(err);
                container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--danger);">データの取得に失敗しました。</div>';
            }
        };
        
        const renderCalendarGrid = (startDateStr) => {
            const start = new Date(startDateStr.replace(/-/g, '/'));
            const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
            
            const dates = [];
            for (let i = 0; i < 28; i++) {
                const d = new Date(start.getTime());
                d.setDate(start.getDate() + i);
                dates.push(d);
            }
            
            const startDay = start.getDay();
            
            let gridHtml = '<div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:8px; text-align:center;">';
            
            weekdays.forEach(w => {
                let color = 'var(--text-secondary)';
                if (w === '日') color = 'var(--accent-fire)';
                if (w === '土') color = '#3b82f6';
                gridHtml += `<div style="font-size:11px; font-weight:700; color:${color}; padding-bottom:8px;">${w}</div>`;
            });
            
            for (let i = 0; i < startDay; i++) {
                gridHtml += '<div></div>';
            }
            
            dates.forEach(date => {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${d}`;
                const isSelected = selectedDates.has(dateStr);
                
                const cellId = `wo-cell-${dateStr}`;
                const dayOfWeek = date.getDay();
                let dayColor = 'var(--text-primary)';
                if (dayOfWeek === 0) dayColor = 'var(--accent-fire)';
                if (dayOfWeek === 6) dayColor = '#3b82f6';
                
                const style = `
                    cursor: pointer;
                    padding: 8px 0;
                    border-radius: 6px;
                    font-weight: 500;
                    font-size: 13px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s ease;
                    border: 1px solid ${isSelected ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)'};
                    background: ${isSelected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)'};
                    color: ${isSelected ? 'var(--primary-color)' : dayColor};
                `;
                
                gridHtml += `
                    <div id="${cellId}" class="weekly-off-date-cell" data-date="${dateStr}" style="${style}">
                        <span>${date.getDate()}</span>
                    </div>
                `;
            });
            
            gridHtml += '</div>';
            container.innerHTML = gridHtml;
            
            document.querySelectorAll('.weekly-off-date-cell').forEach(cell => {
                cell.addEventListener('click', (e) => {
                    const dateStr = cell.getAttribute('data-date');
                    if (selectedDates.has(dateStr)) {
                        selectedDates.delete(dateStr);
                        cell.style.background = 'rgba(255,255,255,0.02)';
                        cell.style.borderColor = 'rgba(255,255,255,0.08)';
                        const dateObj = new Date(dateStr.replace(/-/g, '/'));
                        let dayColor = 'var(--text-primary)';
                        if (dateObj.getDay() === 0) dayColor = 'var(--accent-fire)';
                        if (dateObj.getDay() === 6) dayColor = '#3b82f6';
                        cell.style.color = dayColor;
                    } else {
                        if (selectedDates.size >= 4) {
                            errorDiv.textContent = '週休希望日は最大4日までしか登録できません。';
                            errorDiv.style.display = 'block';
                            return;
                        }
                        selectedDates.add(dateStr);
                        cell.style.background = 'rgba(59,130,246,0.15)';
                        cell.style.borderColor = 'var(--primary-color)';
                        cell.style.color = 'var(--primary-color)';
                    }
                    errorDiv.style.display = 'none';
                    updateUIState();
                });
            });
        };
        
        const updateUIState = () => {
            countBadge.textContent = `選択中: ${selectedDates.size} / 4 日`;
            if (selectedDates.size > 4) {
                submitBtn.disabled = true;
            } else {
                submitBtn.disabled = false;
            }
        };
        
        select.addEventListener('change', (e) => {
            onCycleChange(e.target.value);
        });
        
        submitBtn.addEventListener('click', async () => {
            const startVal = select.value;
            const datesArr = Array.from(selectedDates);
            
            errorDiv.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.textContent = '登録中...';
            
            try {
                const response = await fetch('/api/attendance/weekly-off', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${Auth.token}`
                    },
                    body: JSON.stringify({
                        start_date: startVal,
                        dates: datesArr
                    })
                });
                
                const data = await response.json();
                if (response.ok) {
                    Portal.showToast(data.message, 'success');
                    Portal.closeModal();
                } else {
                    errorDiv.textContent = data.error || '登録に失敗しました。';
                    errorDiv.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.textContent = '週休希望を登録する';
                }
            } catch (err) {
                console.error(err);
                errorDiv.textContent = '通信エラーが発生しました。';
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = '週休希望を登録する';
            }
        });
        
        onCycleChange(startDateStr);
    }
};

window.Dashboard = Dashboard;
