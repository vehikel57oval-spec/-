/**
 * 消防ポータルシステム 勤怠・打刻モジュール (Attendance)
 */
const Attendance = {
    clockInterval: null,

    /**
     * 出退勤打刻画面のレンダリング
     */
    async render(container) {
        try {
            // 現在の打刻状況を取得
            const response = await fetch('/api/attendance/today', {
                headers: { 'Authorization': `Bearer ${Auth.token}` }
            });
            const data = await response.json();
            
            // 履歴の取得（デフォルトで今月の1日〜今日まで）
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const startDate = `${yyyy}-${mm}-01`;
            const endDate = today.toISOString().slice(0, 10);
            
            const historyResponse = await fetch(`/api/attendance/history?start_date=${startDate}&end_date=${endDate}`, {
                headers: { 'Authorization': `Bearer ${Auth.token}` }
            });
            const historyData = await historyResponse.json();
            
            this.renderAttendanceLayout(container, data, historyData.history, startDate, endDate);
        } catch (err) {
            console.error('Attendance rendering error:', err);
            container.innerHTML = `<p style="color:var(--danger)">勤怠データの取得中にエラーが発生しました。</p>`;
        }
    },

    /**
     * レイアウトの構築
     */
    renderAttendanceLayout(container, data, history, startDate, endDate) {
        const record = data.record;
        const schedule = data.schedule;
        
        // 打刻ボタンの有効/無効判定
        const hasClockedIn = !!(record?.actual_clock_in);
        const hasClockedOut = !!(record?.actual_clock_out);
        
        const isClockInDisabled = hasClockedIn ? 'disabled' : '';
        const isClockOutDisabled = (!hasClockedIn || hasClockedOut) ? 'disabled' : '';
        
        // 鼓動するアニメーションクラスの判定
        const clockInActiveClass = !hasClockedIn ? 'active' : '';
        const clockOutActiveClass = (hasClockedIn && !hasClockedOut) ? 'active' : '';
        
        // 現在状態ラベル
        let statusLabel = '未出勤';
        let statusClass = 'badge-off';
        if (hasClockedIn && !hasClockedOut) {
            statusLabel = '勤務中';
            statusClass = 'badge-tou';
        } else if (hasClockedIn && hasClockedOut) {
            statusLabel = '退勤済';
            statusClass = 'badge-nik';
        }

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:28px;">
                <!-- 打刻カード -->
                <div class="card clock-main-card">
                    <!-- デジタル時計 -->
                    <div class="clock-timer">
                        <span class="timer-date" id="attendance-date-string">0000年00月00日 (木)</span>
                        <div>
                            <span class="timer-time" id="attendance-time-string">00:00</span>
                            <span class="timer-seconds" id="attendance-seconds-string">:00</span>
                        </div>
                    </div>
                    
                    <!-- スケジュール＆状態 -->
                    <div style="display:flex; gap:16px; align-items:center; justify-content:center; flex-wrap:wrap; width:100%; margin-bottom: 8px;">
                        <span class="badge ${statusClass}" style="font-size:14px; padding:6px 12px; white-space:nowrap; flex-shrink:0;">現在の状態: ${statusLabel}</span>
                        ${schedule ? `
                            <div class="shift-info-badge" style="white-space:nowrap; flex-shrink:0;">
                                <i data-lucide="calendar"></i>
                                <span>本日の勤務予定: <strong>${schedule.shift_key} (${schedule.start_time || '08:30'}〜)</strong></span>
                            </div>
                        ` : ''}
                        <div class="shift-info-badge" style="background: rgba(255,107,107,0.08); border: 1px solid rgba(255,107,107,0.2); color: var(--accent-fire); white-space:nowrap; flex-shrink:0;">
                            <i data-lucide="truck" style="color: var(--accent-fire); width: 16px; height: 16px;"></i>
                            <span>本日の乗車車両: <strong>${data.vehicleAssignment ? `${data.vehicleAssignment.vehicle_name} (${data.vehicleAssignment.role_name})` : 'なし (徒歩/待機)'}</strong></span>
                        </div>
                    </div>
                    
                    <!-- 巨大な打刻ボタン -->
                    <div class="clock-buttons-container">
                        <!-- 出勤ボタン -->
                        <button class="clock-btn clock-btn-in ${clockInActiveClass}" ${isClockInDisabled} onclick="Attendance.clockIn()">
                            <i data-lucide="play-circle" class="clock-btn-icon"></i>
                            <span class="clock-btn-label">出勤打刻</span>
                            <span class="clock-btn-sub">${record?.actual_clock_in ? `打刻済: ${record.actual_clock_in.substring(11, 16)}` : '勤務を開始します'}</span>
                        </button>
                        
                        <!-- 退勤ボタン -->
                        <button class="clock-btn clock-btn-out ${clockOutActiveClass}" ${isClockOutDisabled} onclick="Attendance.clockOut()">
                            <i data-lucide="stop-circle" class="clock-btn-icon"></i>
                            <span class="clock-btn-label">退勤打刻</span>
                            <span class="clock-btn-sub">${record?.actual_clock_out ? `打刻済: ${record.actual_clock_out.substring(11, 16)}` : '勤務を終了します'}</span>
                        </button>
                    </div>
                </div>
                
                <!-- 勤務履歴リスト -->
                <div class="card">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:16px;">
                        <div>
                            <h3>勤務打刻履歴</h3>
                            <p style="color:var(--text-secondary); font-size:13px;">打刻漏れの修正は、各行の「修正申請」ボタンから行えます。</p>
                        </div>
                        
                        <!-- 期間絞り込み -->
                        <div style="display:flex; align-items:center; gap:8px; font-size:14px;">
                            <input class="form-input" style="padding:8px 12px; width:150px;" type="date" id="history-start-date" value="${startDate}">
                            <span>〜</span>
                            <input class="form-input" style="padding:8px 12px; width:150px;" type="date" id="history-end-date" value="${endDate}">
                            <button class="btn btn-primary" style="padding:8px 16px; font-size:13px;" onclick="Attendance.searchHistory()">
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
                                    <th>出勤時刻(打刻)</th>
                                    <th>退勤時刻(打刻)</th>
                                    <th>実勤務時間</th>
                                    <th>超過勤務時間</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody id="attendance-history-table-body">
                                ${this.renderHistoryRows(history)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        this.startClock();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    /**
     * リアルタイム時計の表示処理
     */
    startClock() {
        if (this.clockInterval) clearInterval(this.clockInterval);
        
        const dateEl = document.getElementById('attendance-date-string');
        const timeEl = document.getElementById('attendance-time-string');
        const secEl = document.getElementById('attendance-seconds-string');
        
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        
        const update = () => {
            const d = new Date();
            
            if (dateEl) {
                const yyyy = d.getFullYear();
                const mm = d.getMonth() + 1;
                const dd = d.getDate();
                const day = weekdays[d.getDay()];
                dateEl.textContent = `${yyyy}年${mm}月${dd}日 (${day})`;
            }
            
            if (timeEl && secEl) {
                const hh = String(d.getHours()).padStart(2, '0');
                const min = String(d.getMinutes()).padStart(2, '0');
                const ss = String(d.getSeconds()).padStart(2, '0');
                
                timeEl.textContent = `${hh}:${min}`;
                secEl.textContent = `:${ss}`;
            }
        };
        
        update();
        this.clockInterval = setInterval(update, 1000);
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
                this.render(document.getElementById('content-body'));
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
                this.render(document.getElementById('content-body'));
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
     * 履歴一覧行の生成
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
                    <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
                    <td>${clockIn}</td>
                    <td>${clockOut}</td>
                    <td>${workHours}</td>
                    <td>${overtimeHours}</td>
                    <td>
                        <button class="btn btn-primary" style="padding:6px 12px; font-size:12px; border-radius:6px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:var(--text-secondary);" onclick="Attendance.openModifyModal(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                            修正申請
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * 修正申請モーダルの表示
     */
    openModifyModal(item) {
        const defaultDate = item.work_date;
        const defaultIn = item.actual_clock_in ? item.actual_clock_in.replace(' ', 'T').substring(0, 16) : `${defaultDate}T08:30`;
        const defaultOut = item.actual_clock_out ? item.actual_clock_out.replace(' ', 'T').substring(0, 16) : `${defaultDate}T17:15`;

        const content = `
            <form id="modify-form" onsubmit="Attendance.submitModification(event, ${item.id})">
                <div style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
                    対象日: <strong>${item.work_date}</strong> の出退勤データを修正します。
                </div>
                
                <div class="form-group" style="margin-bottom:16px;">
                    <label class="form-label">修正対象の項目</label>
                    <select class="form-input" style="padding-left:12px;" id="modify-field" onchange="Attendance.toggleModifyInput(this.value, '${defaultIn}', '${defaultOut}')" required>
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
                this.render(document.getElementById('content-body'));
            } else {
                Portal.showToast(data.error, 'error');
            }
        } catch (err) {
            Portal.showToast('申請の送信中に通信エラーが発生しました。', 'error');
        }
    }
};

window.Attendance = Attendance;
