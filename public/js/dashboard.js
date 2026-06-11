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
        } catch (err) {
            console.error('Dashboard rendering error:', err);
            container.innerHTML = `<p style="color:var(--danger)">データの取得中にエラーが発生しました。</p>`;
        }
    },

    /**
     * 一般職員向けダッシュボード
     */
    renderStaffDashboard(container, todayData, historyData) {
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
                    <!-- 当日の打刻状態・簡易打刻カード -->
                    <div class="card" style="display:flex; align-items:center; justify-content:space-between; padding:28px;">
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            <span style="font-size:12px; color:var(--text-muted); font-weight:600; text-transform:uppercase;">今日の打刻ステータス</span>
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span class="badge ${statusClass}" style="font-size:14px; padding:6px 12px;">${statusText}</span>
                                <span style="font-size:15px; font-weight:500;">
                                    ${todayData.record?.actual_clock_in ? `出勤: ${todayData.record.actual_clock_in.substring(11, 16)}` : ''}
                                    ${todayData.record?.actual_clock_out ? ` / 退勤: ${todayData.record.actual_clock_out.substring(11, 16)}` : ''}
                                </span>
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="Portal.navigate('attendance')">
                            打刻画面を開く <i data-lucide="arrow-right"></i>
                        </button>
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
                                <span class="stat-value">${Auth.user.annual_leave_balance.toFixed(1)} 日</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 直近の打刻履歴 (5件) -->
                    <div class="card">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                            <h4 style="font-weight:600;">直近の勤務履歴 (最大5件)</h4>
                            <a onclick="Portal.navigate('attendance')" style="font-size:12px; color:var(--primary-color); cursor:pointer; font-weight:600;">すべて見る &rarr;</a>
                        </div>
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>日付</th>
                                        <th>勤務型</th>
                                        <th>出勤時刻</th>
                                        <th>退勤時刻</th>
                                        <th>労働時間</th>
                                        <th>時間外</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.renderHistoryRows(historyData.history.slice(0, 5))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- サブカラム (右側) -->
                <div style="display:flex; flex-direction:column; gap:24px;">
                    <!-- 消防庁舎・車両ステータス (デモ用ビジュアル) -->
                    <div class="card" style="display:flex; flex-direction:column; gap:16px;">
                        <h4 style="font-weight:600;">出動車両稼働ステータス</h4>
                        <div style="display:flex; flex-direction:column; gap:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
                                <span style="display:flex; align-items:center; gap:6px;"><i data-lucide="truck" style="color:var(--accent-fire); width:16px;"></i> 1号消火ポンプ車</span>
                                <span style="color:var(--success); font-weight:600;">● 出動可能</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
                                <span style="display:flex; align-items:center; gap:6px;"><i data-lucide="truck" style="color:var(--accent-fire); width:16px;"></i> 救急2号車</span>
                                <span style="color:var(--success); font-weight:600;">● 出動可能</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; padding-bottom:4px;">
                                <span style="display:flex; align-items:center; gap:6px;"><i data-lucide="truck" style="color:var(--primary-color); width:16px;"></i> はしご車 (検査中)</span>
                                <span style="color:var(--warning); font-weight:600;">▲ 訓練のみ</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 休暇・出張クイックリンク -->
                    <div class="card" style="display:flex; flex-direction:column; gap:14px;">
                        <h4 style="font-weight:600;">クイックアクション</h4>
                        <button class="btn btn-primary" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:var(--text-primary); justify-content:start;" onclick="Portal.navigate('leave')">
                            <i data-lucide="file-plus" style="color:var(--primary-color);"></i> 年休・各種休暇の申請
                        </button>
                        <button class="btn btn-primary" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:var(--text-primary); justify-content:start;" onclick="Portal.navigate('schedule')">
                            <i data-lucide="calendar" style="color:var(--success);"></i> 自分の勤務シフトの確認
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 管理者（署長・本部管理者）向けダッシュボード
     */
    renderAdminDashboard(container, todayData, historyData, adminData) {
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
                    <!-- 自身の打刻機能 -->
                    <div class="card" style="display:flex; align-items:center; justify-content:space-between; padding:20px 28px;">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <span style="font-size:12px; color:var(--text-muted); font-weight:600;">自分自身の今日の打刻</span>
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span class="badge ${statusClass}">${statusText}</span>
                                <span style="font-size:14px; font-weight:500;">
                                    ${todayData.record?.actual_clock_in ? `出勤: ${todayData.record.actual_clock_in.substring(11, 16)}` : ''}
                                    ${todayData.record?.actual_clock_out ? ` / 退勤: ${todayData.record.actual_clock_out.substring(11, 16)}` : ''}
                                </span>
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="Portal.navigate('attendance')" style="padding:10px 20px; font-size:14px;">
                            打刻画面へ <i data-lucide="arrow-right"></i>
                        </button>
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
                    
                    <!-- 自身の直近履歴 -->
                    <div class="card">
                        <h4 style="font-weight:600; margin-bottom:16px;">自身の直近勤務履歴</h4>
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>日付</th>
                                        <th>勤務型</th>
                                        <th>出勤時刻</th>
                                        <th>退勤時刻</th>
                                        <th>労働時間</th>
                                        <th>時間外</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.renderHistoryRows(historyData.history.slice(0, 5))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- サブカラム (右側) -->
                <div style="display:flex; flex-direction:column; gap:24px;">
                    <!-- 組織統計概要 -->
                    <div class="card" style="display:flex; flex-direction:column; gap:16px;">
                        <h4 style="font-weight:600;">管轄出勤状況概要</h4>
                        <div style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
                            <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border-color);">
                                <span style="color:var(--text-secondary);">本日当務スケジュール者</span>
                                <span style="font-weight:600; color:var(--primary-color);">${adminStats.scheduled_tou} 名</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border-color);">
                                <span style="color:var(--text-secondary);">本日日勤スケジュール者</span>
                                <span style="font-weight:600; color:var(--success);">${adminStats.scheduled_nik} 名</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding-bottom:4px;">
                                <span style="color:var(--text-secondary);">現在未打刻者（遅刻警戒）</span>
                                <span style="font-weight:600; color:var(--danger);">${Math.max(0, adminStats.scheduled_tou + adminStats.scheduled_nik - adminStats.working_now)} 名</span>
                            </div>
                        </div>
                    </div>
                    
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
    renderHistoryRows(historyList) {
        if (!historyList || historyList.length === 0) {
            return `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">過去1ヶ月の勤務データはありません。</td></tr>`;
        }
        
        return historyList.map(item => {
            let badgeClass = 'badge-off';
            let badgeLabel = 'その他';
            
            if (item.scheduled_shift === 'tou') { badgeClass = 'badge-tou'; badgeLabel = '当務'; }
            else if (item.scheduled_shift === 'nik') { badgeClass = 'badge-nik'; badgeLabel = '日勤'; }
            else if (item.scheduled_shift === 'off') { badgeClass = 'badge-off'; badgeLabel = '時間外/非当'; }
            
            const clockIn = item.actual_clock_in ? item.actual_clock_in.substring(11, 16) : '-';
            const clockOut = item.actual_clock_out ? item.actual_clock_out.substring(11, 16) : '-';
            const workHours = item.actual_hours ? `${item.actual_hours}h` : '-';
            const overtime = item.overtime_hours ? `${item.overtime_hours}h` : '-';
            
            return `
                <tr>
                    <td style="font-weight:500;">${item.work_date}</td>
                    <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
                    <td>${clockIn}</td>
                    <td>${clockOut}</td>
                    <td>${workHours}</td>
                    <td style="${item.overtime_hours > 0 ? 'color:var(--accent-fire); font-weight:600;' : ''}">${overtime}</td>
                </tr>
            `;
        }).join('');
    }
};

window.Dashboard = Dashboard;
