/**
 * 消防ポータルシステム 認証モジュール (Auth)
 */
const authStorage = window.safeStorage || window.localStorage || {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
};

const Auth = {
    token: null,
    user: null,

    /**
     * 消防本部リストの取得
     */
    async getDepartments() {
        try {
            const response = await fetch('/api/auth/departments');
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || '消防本部リストの取得に失敗しました。');
            }
            return data.departments;
        } catch (err) {
            console.error('getDepartments error:', err);
            return [];
        }
    },

    /**
     * ログイン処理
     */
    async login(departmentCode, employeeNumber, pin) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ department_code: departmentCode, employee_number: employeeNumber, pin })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'ログインに失敗しました。');
            }

            this.token = data.token;
            this.user = data.user;
            this.syncUserStationName(); // マスタ署所名と同期
            authStorage.setItem('fire_dept_token', this.token);
            
            return data;
        } catch (err) {
            console.error('Login error:', err);
            throw err;
        }
    },

    /**
     * ログアウト処理
     */
    async logout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (err) {
            console.error('Logout API error:', err);
        } finally {
            this.token = null;
            this.user = null;
            authStorage.removeItem('fire_dept_token');
            window.location.reload();
        }
    },

    /**
     * 認証状態チェック
     */
    async checkAuth() {
        const storedToken = authStorage.getItem('fire_dept_token');
        if (!storedToken) {
            this.token = null;
            this.user = null;
            return false;
        }

        try {
            this.token = storedToken;
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                // トークンが無効な場合は削除
                authStorage.removeItem('fire_dept_token');
                this.token = null;
                this.user = null;
                return false;
            }

            this.user = data.user;
            this.syncUserStationName(); // マスタ署所名と同期
            return true;
        } catch (err) {
            console.error('CheckAuth error:', err);
            this.token = null;
            this.user = null;
            return false;
        }
    },

    /**
     * 暗証番号の変更
     */
    async changePin(oldPin, newPin) {
        try {
            const response = await fetch('/api/auth/change-pin', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ old_pin: oldPin, new_pin: newPin })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '暗証番号の変更に失敗しました。');
            }

            return data;
        } catch (err) {
            console.error('Change PIN error:', err);
            throw err;
        }
    },

    getToken() {
        return this.token || authStorage.getItem('fire_dept_token');
    },

    isLoggedIn() {
        return !!this.getToken();
    },

    hasRole(...roles) {
        if (!this.user) return false;
        return roles.includes(this.user.role);
    },

    /**
     * マスタ設定された署所情報とユーザーの所属情報を同期する
     */
    syncUserStationName() {
        if (!this.user) return;
        const stationsStr = window.safeStorage.getItem('master_stations');
        if (!stationsStr) return;
        try {
            const stations = JSON.parse(stationsStr);
            if (stations.length === 0) return;
            
            const flatStations = [];
            stations.forEach((st, sIdx) => {
                flatStations.push({ id: sIdx * 10 + 1, name: st.name });
                if (st.sub_stations) {
                    st.sub_stations.forEach((sub, subIdx) => {
                        flatStations.push({ id: sIdx * 10 + 2 + subIdx, name: sub });
                    });
                }
            });
            
            // 既存のユーザーの station_id に対応するマスタ内の名前を取得
            const mappedStation = flatStations[this.user.station_id - 1];
            if (mappedStation) {
                this.user.station_name = mappedStation.name;
            }
        } catch (e) {
            console.error('Failed to sync user station name with master settings:', e);
        }
    }
};

window.Auth = Auth;
