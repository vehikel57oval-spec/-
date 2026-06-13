const http = require('http');

function postJSON(url, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

function getJSON(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function run() {
    const baseURL = 'http://localhost:3000';
    
    // 1. 一般職員 1103 (小林翔太) でログイン
    console.log('=== Logging in as Staff (1103) ===');
    const staffLogin = await postJSON(`${baseURL}/api/auth/login`, {
        department_code: 'ibusuki',
        employee_number: '1103',
        pin: '1234'
    });
    if (staffLogin.statusCode !== 200) {
        throw new Error('Staff Login failed: ' + JSON.stringify(staffLogin.body));
    }
    const staffToken = staffLogin.body.token;
    const staffHeaders = { 'Authorization': `Bearer ${staffToken}` };
    console.log('Staff Login successful!');
    
    const cycleStartDate = '2026-06-29'; // 来期サイクル起算日

    // 2. 週休希望の登録 (正常系: 3日間)
    console.log('\n=== Registering Weekly Off (3 days: 6/30, 7/1, 7/2) ===');
    const regRes = await postJSON(`${baseURL}/api/attendance/weekly-off`, {
        start_date: cycleStartDate,
        dates: ['2026-06-30', '2026-07-01', '2026-07-02']
    }, staffHeaders);
    console.log('Status Code:', regRes.statusCode, regRes.body);
    if (regRes.statusCode !== 200) {
        throw new Error('Registration failed: ' + JSON.stringify(regRes.body));
    }

    // 3. 週休希望の取得検証
    console.log('\n=== Fetching Weekly Off for 2026-06-29 ===');
    const getRes = await getJSON(`${baseURL}/api/attendance/weekly-off?start_date=${cycleStartDate}`, staffHeaders);
    console.log('Status Code:', getRes.statusCode, getRes.body);
    if (getRes.statusCode !== 200 || !getRes.body.dates || getRes.body.dates.length !== 3) {
        throw new Error('Fetch failed or incorrect date count: ' + JSON.stringify(getRes.body));
    }

    // 4. 週休希望の登録 (異常系: 5日間)
    console.log('\n=== Registering Weekly Off (Error check: 5 days) ===');
    const regResErr1 = await postJSON(`${baseURL}/api/attendance/weekly-off`, {
        start_date: cycleStartDate,
        dates: ['2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04']
    }, staffHeaders);
    console.log('Status Code:', regResErr1.statusCode, regResErr1.body);
    if (regResErr1.statusCode !== 400) {
        throw new Error('Expected 400 error for 5 days limit but got ' + regResErr1.statusCode);
    }
    console.log('Successfully blocked 5-day request.');

    // 5. 週休希望の登録 (異常系: サイクル外の日付)
    console.log('\n=== Registering Weekly Off (Error check: out of cycle date) ===');
    const regResErr2 = await postJSON(`${baseURL}/api/attendance/weekly-off`, {
        start_date: cycleStartDate,
        dates: ['2026-06-28'] // サイクル開始の前日
    }, staffHeaders);
    console.log('Status Code:', regResErr2.statusCode, regResErr2.body);
    if (regResErr2.statusCode !== 400) {
        throw new Error('Expected 400 error for out of cycle date but got ' + regResErr2.statusCode);
    }
    console.log('Successfully blocked out of cycle date request.');

    // 6. 管理者 1101 (伊藤浩一) でログイン
    console.log('\n=== Logging in as Admin (1101) ===');
    const adminLogin = await postJSON(`${baseURL}/api/auth/login`, {
        department_code: 'ibusuki',
        employee_number: '1101',
        pin: '1234'
    });
    if (adminLogin.statusCode !== 200) {
        throw new Error('Admin Login failed: ' + JSON.stringify(adminLogin.body));
    }
    const adminToken = adminLogin.body.token;
    const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };
    console.log('Admin Login successful!');

    // 7. スケジュール作成API (/api/schedule/roster) から希望シフトが自動マッピングされているか確認
    console.log('\n=== Verifying hopeShifts mapping in /api/schedule/roster ===');
    const rosterRes = await getJSON(`${baseURL}/api/schedule/roster?station_id=1&start_date=${cycleStartDate}&cycle_number=1`, adminHeaders);
    console.log('Status Code:', rosterRes.statusCode);
    if (rosterRes.statusCode !== 200) {
        throw new Error('Roster fetch failed: ' + JSON.stringify(rosterRes.body));
    }

    const hopeShifts = rosterRes.body.hopeShifts;
    // 小林翔太のスタッフIDは 9
    const staffId = 9;
    const key = `1_${staffId}`;
    console.log(`Checking hopeShifts for staff ${staffId} (key: ${key}):`, hopeShifts[key]);
    
    if (!hopeShifts[key]) {
        throw new Error(`hopeShifts does not contain entry for staff ${staffId}`);
    }

    // インデックスの検証 (2026-06-29起算なので、6/30は1, 7/1は2, 7/2は3)
    if (hopeShifts[key]['1'] !== '休' || hopeShifts[key]['2'] !== '休' || hopeShifts[key]['3'] !== '休') {
        throw new Error('hopeShifts indices mapped incorrectly: ' + JSON.stringify(hopeShifts[key]));
    }
    console.log('hopeShifts indices mapped correctly! (6/30 -> 1, 7/1 -> 2, 7/2 -> 3)');
    
    console.log('\n=== All Weekly Off API Tests Passed Successfully! ===');
}

run().catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
