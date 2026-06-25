/**
 * 隔日勤務（24時間2交代）シフト自動生成・ルール検証エンジン
 */

// 14ブロックにおける有効な35パターンのシーケンス（0: 勤務/非番, 1: 週休）
// 条件：1がちょうど4回、かつ0が循環的に4回以上連続しない（最長3連続勤務）
const VALID_SEQUENCES = (function() {
    const seqs = [];
    for (let i = 0; i < 16384; i++) {
        const seq = [];
        let temp = i;
        let onesCount = 0;
        for (let j = 0; j < 14; j++) {
            const bit = temp & 1;
            seq.push(bit);
            if (bit === 1) onesCount++;
            temp >>= 1;
        }
        if (onesCount !== 4) continue;
        
        // 循環的に0が4つ連続していないかチェック
        let valid = true;
        for (let j = 0; j < 14; j++) {
            if (seq[j] === 0 &&
                seq[(j + 1) % 14] === 0 &&
                seq[(j + 2) % 14] === 0 &&
                seq[(j + 3) % 14] === 0) {
                valid = false;
                break;
            }
        }
        if (valid) {
            seqs.push(seq);
        }
    }
    return seqs;
})();

/**
 * 日付インデックス（0〜27）から小隊ごとのブロックインデックス（0〜13）を取得する
 */
function getBlockIndex(platoon, dayIndex) {
    if (platoon === 1) {
        return Math.floor(dayIndex / 2);
    } else {
        if (dayIndex % 2 === 1) {
            return (dayIndex - 1) / 2;
        } else {
            return ((dayIndex - 2 + 28) % 28) / 2;
        }
    }
}

/**
 * 最小対立（Min-Conflicts）法を用いた小隊シフトソルバー（人員＆資格バランス両対応）
 * @param {Array} candidates 各スタッフの有効なシーケンスリスト
 * @param {number} minH 各ブロックの最小休日数 (H)
 * @param {number} maxH 各ブロックの最大休日数 (H)
 * @param {Array} platoonStaff 小隊メンバー情報（階級・資格を含む）
 */
/**
 * 応援職員（isSupport: true）が特定の14ブロックのサイクルにおいて勤務日であるかを判定する
 */
function isSupportStaffWorkingOnBlock(s, k, startDate) {
    const dutyDayOffset = s.platoon === 1 ? 2 * k : 2 * k + 1;
    const dutyDate = new Date(startDate);
    dutyDate.setDate(startDate.getDate() + dutyDayOffset);
    const y = dutyDate.getFullYear();
    const m = String(dutyDate.getMonth() + 1).padStart(2, '0');
    const d = String(dutyDate.getDate()).padStart(2, '0');
    const dayStr = `${y}-${m}-${d}`;
    return dayStr >= s.supportStart && dayStr <= s.supportEnd;
}

function solvePlatoon(candidates, minH, maxH, platoonStaff, supportStaff = [], startDate = null, minSubOfficer = 1, minLarge = 1, minParamedic = 1, minRescue = null) {
    const n = candidates.length;
    const assignment = new Array(n);
    const hCounts = new Array(14).fill(0);
    
    // 初期ランダム割り当て
    for (let i = 0; i < n; i++) {
        const cands = candidates[i];
        if (cands.length === 0) return null; // 割り当て不可能
        const idx = Math.floor(Math.random() * cands.length);
        assignment[i] = cands[idx];
        for (let k = 0; k < 14; k++) {
            if (assignment[i][k] === 1) hCounts[k]++;
        }
    }

    // 小隊内の保有資格数のカウント（正規職員＋応援職員の合算）
    let totalOfficers = 0;
    let totalSubOfficers = 0;
    let totalLarge = 0;
    let totalParamedics = 0;
    let totalRescue = 0;
    
    platoonStaff.forEach(s => {
        if (["消防司令", "消防司令補", "消防士長"].includes(s.rank)) totalOfficers++;
        if (["消防司令", "消防司令補"].includes(s.rank)) totalSubOfficers++;
        if (s.hasLargeLicense) totalLarge++;
        if (s.isParamedic) totalParamedics++;
        if (s.isRescue) totalRescue++;
    });

    supportStaff.forEach(s => {
        if (["消防司令", "消防司令補", "消防士長"].includes(s.rank)) totalOfficers++;
        if (["消防司令", "消防司令補"].includes(s.rank)) totalSubOfficers++;
        if (s.hasLargeLicense) totalLarge++;
        if (s.isParamedic) totalParamedics++;
        if (s.isRescue) totalRescue++;
    });

    // 1日あたりの必要人員目標（メンバー総数が少なすぎる場合は、総数を上限とする）
    const targetOfficers = Math.min(2, totalOfficers);
    const targetSubOfficers = Math.min(minSubOfficer, totalSubOfficers);
    const targetLarge = Math.min(minLarge, totalLarge);
    const targetParamedics = Math.min(minParamedic, totalParamedics);
    const targetRescue = (minRescue !== null && minRescue !== undefined && !isNaN(minRescue)) ? Math.min(minRescue, totalRescue) : 0;
    
    // 競合評価関数 (ペナルティスコア)
    function getScore() {
        let hardScore = 0;
        let softScore = 0;
        for (let k = 0; k < 14; k++) {
            // 休日数（出勤人員総数）の制約：超重要（ペナルティ10倍）
            if (hCounts[k] < minH) hardScore += (minH - hCounts[k]) * 10;
            if (hCounts[k] > maxH) hardScore += (hCounts[k] - maxH) * 10;
            
            // 資格・階級の出勤人数バランス
            let officers = 0;
            let subOfficers = 0;
            let large = 0;
            let paramedics = 0;
            let rescue = 0;
            
            for (let i = 0; i < n; i++) {
                if (assignment[i] && assignment[i][k] === 0) { // 勤務（当）
                    const s = platoonStaff[i];
                    if (["消防司令", "消防司令補", "消防士長"].includes(s.rank)) officers++;
                    if (["消防司令", "消防司令補"].includes(s.rank)) subOfficers++;
                    if (s.hasLargeLicense) large++;
                    if (s.isParamedic) paramedics++;
                    if (s.isRescue) rescue++;
                }
            }

            // 応援職員の勤務資格加算
            if (startDate) {
                supportStaff.forEach(s => {
                    if (isSupportStaffWorkingOnBlock(s, k, startDate)) {
                        if (["消防司令", "消防司令補", "消防士長"].includes(s.rank)) officers++;
                        if (["消防司令", "消防司令補"].includes(s.rank)) subOfficers++;
                        if (s.hasLargeLicense) large++;
                        if (s.isParamedic) paramedics++;
                        if (s.isRescue) rescue++;
                    }
                });
            }
            
            if (subOfficers < targetSubOfficers) softScore += (targetSubOfficers - subOfficers) * 5;
            if (officers < targetOfficers) softScore += (targetOfficers - officers) * 5;
            if (large < targetLarge) softScore += (targetLarge - large) * 5;
            if (paramedics < targetParamedics) softScore += (targetParamedics - paramedics) * 5;
            if ((minRescue !== null && minRescue !== undefined && !isNaN(minRescue)) && rescue < targetRescue) softScore += (targetRescue - rescue) * 5;
        }
        return { hard: hardScore, soft: softScore, total: hardScore + softScore };
    }

    let bestAssignment = [...assignment];
    let bestRes = getScore();
    let bestTotalScore = bestRes.total;
    let bestHardScore = bestRes.hard;
    
    // 最大ステップ数を5000に制限し、ブラウザのフリーズを確実に防止
    const maxSteps = 5000;
    for (let step = 0; step < maxSteps; step++) {
        const res = getScore();
        if (res.total === 0) return assignment; // 競合ゼロなら即終了

        if (res.total < bestTotalScore) {
            bestTotalScore = res.total;
            bestHardScore = res.hard;
            bestAssignment = [...assignment];
        }
        
        // 改善対象のスタッフをランダムに選択
        const employeeIdx = Math.floor(Math.random() * n);
        const cands = candidates[employeeIdx];
        if (cands.length <= 1) continue; // 選択肢が1つ以下の場合は変更不可
        
        const currentSeq = assignment[employeeIdx];
        
        // 競合スコアを最も低くするシーケンスを選択
        let bestCandidates = [];
        let minScore = 999999;
        
        for (let i = 0; i < cands.length; i++) {
            const seq = cands[i];
            
            // 一時的に適用
            for (let k = 0; k < 14; k++) {
                hCounts[k] -= currentSeq[k];
                hCounts[k] += seq[k];
            }
            assignment[employeeIdx] = seq;
            
            const tempRes = getScore();
            if (tempRes.total < minScore) {
                minScore = tempRes.total;
                bestCandidates = [seq];
            } else if (tempRes.total === minScore) {
                bestCandidates.push(seq);
            }
            
            // 元に戻す
            for (let k = 0; k < 14; k++) {
                hCounts[k] -= seq[k];
                hCounts[k] += currentSeq[k];
            }
            assignment[employeeIdx] = currentSeq;
        }
        
        // 最善の選択肢の中からランダムに選択
        const chosenSeq = bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
        
        // 恒久的に適用
        for (let k = 0; k < 14; k++) {
            hCounts[k] -= currentSeq[k];
            hCounts[k] += chosenSeq[k];
        }
        assignment[employeeIdx] = chosenSeq;
    }

    // ハードな休日数制約（人員数のハード部分）が満たされていれば、
    // 見つかった最も良い割り当て（資格バランスが最良のもの）を返します。
    if (bestHardScore === 0) {
        // カウンターをbestAssignmentの状態に復元して戻す
        for (let k = 0; k < 14; k++) {
            hCounts[k] = 0;
        }
        for (let i = 0; i < n; i++) {
            assignment[i] = bestAssignment[i];
            for (let k = 0; k < 14; k++) {
                if (assignment[i][k] === 1) hCounts[k]++;
            }
        }
        return assignment;
    }
    
    return null; // ハードな休日数制約すら満たせなかった場合
}

/**
 * 勤務表を自動生成するメイン関数
 * @param {Date} startDate 起算日
 * @param {Array} staffList スタッフリスト (動的サイズ)
 * @param {Object} hopeShifts 希望休情報 (staffId -> dayIndex -> '休')
 * @param {number} minStaffing 最低確保人員
 */
function generateRoster(startDate, staffList, hopeShifts, minStaffing = 11, minSubOfficer = 1, minLarge = 1, minParamedic = 1, minRescue = null) {
    // 応援職員と正規職員を分離
    const regularStaff = staffList.filter(s => !s.isSupport);
    const supportStaff = staffList.filter(s => s.isSupport);

    // 小隊ごとにスタッフを分割
    const platoon1 = regularStaff.filter(s => s.platoon === 1);
    const platoon2 = regularStaff.filter(s => s.platoon === 2);
    
    if (platoon1.length !== platoon2.length) {
        return {
            success: false,
            error: `正規職員の第1小隊（${platoon1.length}名）と第2小隊（${platoon2.length}名）の人数が一致していません。同じ人数に調整してください。`
        };
    }

    const N = platoon1.length; // 片方の小隊の人数 (例: 19名)

    // 各小隊の候補シーケンスを希望休でフィルタリング
    function getCandidatesForPlatoon(platoon) {
        const isDutyType = (shift) => ['当', '明', '張'].includes(shift);
        const isHolidayType = (shift) => shift && shift !== '-' && !isDutyType(shift);

        return platoon.map(staff => {
            const staffHopes = hopeShifts[staff.id] || {};
            
            // 1. 通常の有効パターンから適合するものを探す
            let filtered = VALID_SEQUENCES.filter(seq => {
                // 前サイクル末尾からの連続勤務数を考慮 (最大3日に制限)
                const prevConsec = Math.min(3, staff.prevConsecutive || 0);
                if (prevConsec > 0) {
                    let headConsec = 0;
                    for (let k = 0; k < 14; k++) {
                        if (seq[k] === 0) headConsec++;
                        else break;
                    }
                    if (prevConsec + headConsec > 3) return false;
                }

                for (let dayStr in staffHopes) {
                    const dayIdx = parseInt(dayStr);
                    const hope = staffHopes[dayStr];
                    if (!hope) continue;
                    const blockIdx = getBlockIndex(staff.platoon, dayIdx);
                    
                    if (isHolidayType(hope)) {
                        if (seq[blockIdx] !== 1) return false;
                    } else if (isDutyType(hope)) {
                        if (seq[blockIdx] !== 0) return false;
                    }
                }
                return true;
            });

            // 2. 長期出張・病休など事前指定が多すぎて適合パターンが0個になった場合の救済策
            if (filtered.length === 0) {
                const fallbackSeq = new Array(14).fill(0);
                let holidayBlocksCount = 0;
                
                // まず希望のあるブロックを休み(1)にする
                for (let k = 0; k < 14; k++) {
                    const day1 = staff.platoon === 1 ? 2 * k : 2 * k + 1;
                    const day2 = staff.platoon === 1 ? 2 * k + 1 : (2 * k + 2) % 28;
                    
                    const hope1 = staffHopes[day1];
                    const hope2 = staffHopes[day2];
                    
                    if (isHolidayType(hope1) || isHolidayType(hope2)) {
                        fallbackSeq[k] = 1;
                        holidayBlocksCount++;
                    }
                }
                
                // 週休ブロック数が4未満の場合、4になるまで他のブロックを休み(1)にして補完する
                if (holidayBlocksCount < 4) {
                    const needed = 4 - holidayBlocksCount;
                    let added = 0;
                    
                    // 優先度1: すでに休み（1）になっているブロックに隣接せず（循環も考慮）、かつ希望に当務系統が指定されていない空きブロック
                    for (let k = 0; k < 14; k++) {
                        if (fallbackSeq[k] === 0) {
                            const prevK = (k - 1 + 14) % 14;
                            const nextK = (k + 1) % 14;
                            if (fallbackSeq[prevK] === 0 && fallbackSeq[nextK] === 0) {
                                const day1 = staff.platoon === 1 ? 2 * k : 2 * k + 1;
                                const day2 = staff.platoon === 1 ? 2 * k + 1 : (2 * k + 2) % 28;
                                const hope1 = staffHopes[day1];
                                const hope2 = staffHopes[day2];
                                
                                if (!isDutyType(hope1) && !isDutyType(hope2)) {
                                    fallbackSeq[k] = 1;
                                    added++;
                                    if (added === needed) break;
                                }
                            }
                        }
                    }
                    
                    // 優先度2: すでに休み（1）になっているブロックに隣接はするが、希望に当務系統が指定されていない空きブロック
                    if (added < needed) {
                        for (let k = 0; k < 14; k++) {
                            if (fallbackSeq[k] === 0) {
                                const day1 = staff.platoon === 1 ? 2 * k : 2 * k + 1;
                                const day2 = staff.platoon === 1 ? 2 * k + 1 : (2 * k + 2) % 28;
                                const hope1 = staffHopes[day1];
                                const hope2 = staffHopes[day2];
                                
                                if (!isDutyType(hope1) && !isDutyType(hope2)) {
                                    fallbackSeq[k] = 1;
                                    added++;
                                    if (added === needed) break;
                                }
                            }
                        }
                    }
                    
                    // 優先度3: 強制的に隣接しない空きブロック
                    if (added < needed) {
                        for (let k = 0; k < 14; k++) {
                            if (fallbackSeq[k] === 0) {
                                const prevK = (k - 1 + 14) % 14;
                                const nextK = (k + 1) % 14;
                                if (fallbackSeq[prevK] === 0 && fallbackSeq[nextK] === 0) {
                                    fallbackSeq[k] = 1;
                                    added++;
                                    if (added === needed) break;
                                }
                            }
                        }
                    }
                    
                    // 優先度4: 強制的に空いている任意のブロック
                    if (added < needed) {
                        for (let k = 0; k < 14; k++) {
                            if (fallbackSeq[k] === 0) {
                                fallbackSeq[k] = 1;
                                added++;
                                if (added === needed) break;
                            }
                        }
                    }
                }
                filtered = [fallbackSeq];
            }

            return filtered;
        });
    }

    const candidates1 = getCandidatesForPlatoon(platoon1);
    const candidates2 = getCandidatesForPlatoon(platoon2);

    // いずれかのスタッフで候補が0個になった場合、その時点で解なし
    for (let i = 0; i < N; i++) {
        if (candidates1[i].length === 0) {
            return {
                success: false,
                error: `第1小隊の「${platoon1[i].name}」の希望休条件が厳しすぎるため、有効なシフトパターンが存在しません。`
            };
        }
        if (candidates2[i].length === 0) {
            return {
                success: false,
                error: `第2小隊の「${platoon2[i].name}」の希望休条件が厳しすぎるため、有効なシフトパターンが存在しません。`
            };
        }
    }

    // 応援職員の小隊別リスト
    const support1 = supportStaff.filter(s => s.platoon === 1);
    const support2 = supportStaff.filter(s => s.platoon === 2);

    // 段階的制約緩和によるソルバー実行
    const maxH_for_M = N - minStaffing; 
    const avgH = (N * 4) / 14;
    const idealMin = Math.floor(avgH); 
    const idealMax = Math.ceil(avgH);  

    const profiles = [
        { minH: idealMin, maxH: idealMax }, // 理想的な出勤平準化
        { minH: Math.max(0, idealMin - 1), maxH: Math.min(N, idealMax + 1) }, // 平準化の緩和
        { minH: 0, maxH: Math.max(0, maxH_for_M) }, // 最低確保人員を維持できる限界
        { minH: 0, maxH: N } // 希望休を最優先
    ];

    let sol1 = null;
    let sol2 = null;
    let usedProfileIndex = 3;

    for (let p = 0; p < profiles.length; p++) {
        const { minH, maxH } = profiles[p];
        sol1 = solvePlatoon(candidates1, minH, maxH, platoon1, support1, startDate, minSubOfficer, minLarge, minParamedic, minRescue);
        sol2 = solvePlatoon(candidates2, minH, maxH, platoon2, support2, startDate, minSubOfficer, minLarge, minParamedic, minRescue);
        
        if (sol1 && sol2) {
            usedProfileIndex = p;
            break;
        }
    }

    if (!sol1 || !sol2) {
        return {
            success: false,
            error: "条件を満たす勤務表を自動生成できませんでした。希望休の数や配置を調整してください。"
        };
    }

    // 解決したシーケンスから28日間の勤務配列（当/明/休）を組み立てる
    const roster = {};

    // 第1小隊のスケジュール組み立て
    platoon1.forEach((staff, idx) => {
        const seq = sol1[idx];
        const schedule = new Array(28);
        const staffHopes = hopeShifts[staff.id] || {};
        for (let k = 0; k < 14; k++) {
            const val1 = seq[k] === 0 ? '当' : '休';
            const val2 = seq[k] === 0 ? '明' : '休';
            
            schedule[2 * k] = staffHopes[2 * k] || val1;
            schedule[2 * k + 1] = staffHopes[2 * k + 1] || val2;
        }
        roster[staff.id] = schedule;
    });

    // 第2小隊のスケジュール組み立て
    platoon2.forEach((staff, idx) => {
        const seq = sol2[idx];
        const schedule = new Array(28);
        const staffHopes = hopeShifts[staff.id] || {};
        for (let k = 0; k < 14; k++) {
            const activeDay = 2 * k + 1;
            const inactiveDay = (2 * k + 2) % 28;
            const valActive = seq[k] === 0 ? '当' : '休';
            const valInactive = seq[k] === 0 ? '明' : '休';
            
            schedule[activeDay] = staffHopes[activeDay] || valActive;
            schedule[inactiveDay] = staffHopes[inactiveDay] || valInactive;
        }
        roster[staff.id] = schedule;
    });

    // 応援職員のスケジュール組み立て (第1小隊)
    support1.forEach(s => {
        const schedule = new Array(28);
        for (let d = 0; d < 28; d++) {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + d);
            const y = dayDate.getFullYear();
            const m = String(dayDate.getMonth() + 1).padStart(2, '0');
            const dayVal = String(dayDate.getDate()).padStart(2, '0');
            const dayStr = `${y}-${m}-${dayVal}`;
            
            if (dayStr >= s.supportStart && dayStr <= s.supportEnd) {
                schedule[d] = (d % 2 === 0) ? '当' : '明';
            } else {
                schedule[d] = '休';
            }
        }
        roster[s.id] = schedule;
    });

    // 応援職員のスケジュール組み立て (第2小隊)
    support2.forEach(s => {
        const schedule = new Array(28);
        for (let d = 0; d < 28; d++) {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + d);
            const y = dayDate.getFullYear();
            const m = String(dayDate.getMonth() + 1).padStart(2, '0');
            const dayVal = String(dayDate.getDate()).padStart(2, '0');
            const dayStr = `${y}-${m}-${dayVal}`;
            
            if (dayStr >= s.supportStart && dayStr <= s.supportEnd) {
                schedule[d] = (d % 2 === 1) ? '当' : '明';
            } else {
                schedule[d] = '休';
            }
        }
        roster[s.id] = schedule;
    });

    return {
        success: true,
        roster: roster,
        relaxed: usedProfileIndex > 0,
        profileMessage: usedProfileIndex > 0 ? 
            (usedProfileIndex === 3 ? `希望休を優先するため、一部の日で出勤人員が最低確保人員（${minStaffing}名）未満になることを許容して生成しました。` : "出勤人数のばらつきを許容して生成しました。") : 
            `すべての制約を満たす最適な勤務表が生成されました（毎日 ${N - idealMax}〜${N - idealMin} 名出勤、資格バランス最適化済み）。`
    };
}

/**
 * 勤務表全体のルール違反をリアルタイムに検証する
 * @param {Object} roster 勤務データ (staffId -> array of 28 elements)
 * @param {Array} staffList スタッフリスト
 * @param {number} minStaffing 最低確保人員
 * @returns {Array} 警告オブジェクトの配列
 */
function validateRoster(roster, staffList, minStaffing = 11, prevRoster = null, minSubOfficer = 1, minLarge = 1, minParamedic = 1, startDate = null, minRescue = null) {
    // 勤務表が作成される前（まだ週休などの割り当てが行われていない初期状態）は警告を出さない
    let hasAnyOffDuty = false;
    for (let staffId in roster) {
        if (roster[staffId].some(shift => ['休', '有', '公', '特', '病', '張'].includes(shift))) {
            hasAnyOffDuty = true;
            break;
        }
    }
    if (!hasAnyOffDuty) {
        return [];
    }

    const warnings = [];
    const staffMap = {};
    staffList.forEach(s => { staffMap[s.id] = s; });

    const getDayLabel = (dIndex) => {
        if (startDate) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + dIndex);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        }
        return `${dIndex + 1}日目`;
    };

    // 各資格の総登録数（小隊別）をカウントし、警告時の目標値を動的に調整
    const getPlatoonTarget = (platoonNum, prop, userMin = 2) => {
        const total = staffList.filter(s => s.platoon === platoonNum && s[prop]).length;
        return Math.min(userMin, total);
    };
    const getPlatoonOfficerTarget = (platoonNum) => {
        const total = staffList.filter(s => s.platoon === platoonNum && ["消防司令", "消防司令補", "消防士長"].includes(s.rank)).length;
        return Math.min(2, total);
    };
    const getPlatoonSubOfficerTarget = (platoonNum, userMin = 1) => {
        const total = staffList.filter(s => s.platoon === platoonNum && ["消防司令", "消防司令補"].includes(s.rank)).length;
        return Math.min(userMin, total);
    };

    // 1. 各スタッフ個人の制約チェック
    for (let staffId in roster) {
        const schedule = roster[staffId];
        const staff = staffMap[staffId];
        if (!staff) continue;
        if (staff.isSupport) continue; // 応援職員は個人制約チェックをスキップ

        // 継続的な不在（出張、病休、研修など）のチェック
        const isAbsent = schedule.some(shift => {
            if (!shift) return false;
            if (['張', '病', '特'].includes(shift)) return true;
            return /[張病特研学校学派]/.test(shift);
        });

        let dutyCount = 0;
        let holidayCount = 0;
        
        for (let d = 0; d < 28; d++) {
            const shift = schedule[d];
            if (shift === '当') dutyCount++;
            if (shift === '休') holidayCount++;

            // ハード制約：当の翌日は当であってはならない
            if (shift === '当' && schedule[(d + 1) % 28] === '当') {
                warnings.push({
                    type: 'consecutive_24h',
                    staffId: staffId,
                    staffName: staff.name,
                    dayIndex: d,
                    message: `${staff.name}：${getDayLabel(d)}と${getDayLabel((d + 1) % 28)}に24時間連続勤務（当が連続）が発生しています。`
                });
            }
        }

        // 8週休（計8日）のチェック（出張・病休・研修などの不在期間がある場合は除く）
        if (!isAbsent && holidayCount !== 8) {
            warnings.push({
                type: 'holiday_count',
                staffId: staffId,
                staffName: staff.name,
                message: `${staff.name}：週休数が ${holidayCount} 日です（28日サイクル中に8週休が必要です）。`
            });
        }

        // 最長3回連続勤務のチェック
        let prevConsecutive = 0;
        if (prevRoster && prevRoster[staffId]) {
            const prevSched = prevRoster[staffId];
            for (let b = 13; b >= 0; b--) {
                let isWorkBlock = false;
                if (staff.platoon === 1) {
                    isWorkBlock = (prevSched[2 * b] === '当');
                } else {
                    isWorkBlock = (prevSched[2 * b + 1] === '当');
                }
                if (isWorkBlock) {
                    prevConsecutive++;
                } else {
                    break;
                }
            }
        }

        let consecutiveWorkBlocks = prevConsecutive;
        let maxConsecutiveWorkBlocks = prevConsecutive;
        const numBlocks = 14;

        if (prevRoster) {
            for (let b = 0; b < numBlocks; b++) {
                let isWorkBlock = false;
                if (staff.platoon === 1) {
                    isWorkBlock = (schedule[2 * b] === '当');
                } else {
                    isWorkBlock = (schedule[2 * b + 1] === '当');
                }

                if (isWorkBlock) {
                    consecutiveWorkBlocks++;
                    if (consecutiveWorkBlocks > maxConsecutiveWorkBlocks) {
                        maxConsecutiveWorkBlocks = consecutiveWorkBlocks;
                    }
                } else {
                    consecutiveWorkBlocks = 0;
                }
            }
        } else {
            for (let b = 0; b < numBlocks * 2; b++) {
                const blockIdx = b % numBlocks;
                let isWorkBlock = false;
                if (staff.platoon === 1) {
                    isWorkBlock = (schedule[2 * blockIdx] === '当');
                } else {
                    isWorkBlock = (schedule[2 * blockIdx + 1] === '当');
                }

                if (isWorkBlock) {
                    consecutiveWorkBlocks++;
                    if (consecutiveWorkBlocks > maxConsecutiveWorkBlocks) {
                        maxConsecutiveWorkBlocks = consecutiveWorkBlocks;
                    }
                } else {
                    consecutiveWorkBlocks = 0;
                }
            }
        }

        // 連勤チェック（出張・病休・研修などの不在期間がある場合は除く）
        if (!isAbsent && maxConsecutiveWorkBlocks > 3) {
            warnings.push({
                type: 'max_consecutive_shifts',
                staffId: staffId,
                staffName: staff.name,
                message: `${staff.name}：週休を挟まない勤務が ${maxConsecutiveWorkBlocks} 回連続しています（最長3回まで）。`
            });
        }
    }

    // 2. 日ごとの最低確保人員および資格バランスのチェック
    for (let d = 0; d < 28; d++) {
        let dutyOnDay = 0;
        
        const activePlatoonNum = (d % 2 === 0) ? 1 : 2;
        const activeStaffList = staffList.filter(s => s.platoon === activePlatoonNum);
        
        let officersOnDuty = 0;
        let subOfficersOnDuty = 0;
        let largeOnDuty = 0;
        let paramedicsOnDuty = 0;
        let rescueOnDuty = 0;
        
        for (let staffId in roster) {
            if (roster[staffId][d] === '当') {
                dutyOnDay++;
                const s = staffMap[staffId];
                if (s && s.platoon === activePlatoonNum) {
                    if (["消防司令", "消防司令補", "消防士長"].includes(s.rank)) officersOnDuty++;
                    if (["消防司令", "消防司令補"].includes(s.rank)) subOfficersOnDuty++;
                    if (s.hasLargeLicense) largeOnDuty++;
                    if (s.isParamedic) paramedicsOnDuty++;
                    if (s.isRescue) rescueOnDuty++;
                }
            }
        }
        
        // 最低確保人員チェック
        if (dutyOnDay < minStaffing) {
            warnings.push({
                type: 'min_staffing',
                dayIndex: d,
                message: `${getDayLabel(d)}：当番の出勤人数が ${dutyOnDay} 名です。最低確保人員（${minStaffing}名）を満たしていません。`
            });
        }
        
        // 資格・階級別バランスの目標値（小隊内の総員から動的に決定）
        const targetSubOfficers = getPlatoonSubOfficerTarget(activePlatoonNum, minSubOfficer);
        const targetOfficers = getPlatoonOfficerTarget(activePlatoonNum);
        const targetLarge = getPlatoonTarget(activePlatoonNum, 'hasLargeLicense', minLarge);
        const targetParamedics = getPlatoonTarget(activePlatoonNum, 'isParamedic', minParamedic);
        const targetRescue = (minRescue !== null && minRescue !== undefined && !isNaN(minRescue)) ? getPlatoonTarget(activePlatoonNum, 'isRescue', minRescue) : 0;
        
        if (subOfficersOnDuty < targetSubOfficers) {
            warnings.push({
                type: 'balance_subofficer',
                dayIndex: d,
                message: `${d + 1}日目：当番（第${activePlatoonNum}小隊）の司令・司令補が ${subOfficersOnDuty} 名です。${targetSubOfficers}名必要です。`
            });
        }
        if (officersOnDuty < targetOfficers) {
            warnings.push({
                type: 'balance_officer',
                dayIndex: d,
                message: `${d + 1}日目：当番（第${activePlatoonNum}小隊）の幹部（士長以上）が ${officersOnDuty} 名です。${targetOfficers}名必要です。`
            });
        }
        if (largeOnDuty < targetLarge) {
            warnings.push({
                type: 'balance_large',
                dayIndex: d,
                message: `${d + 1}日目：当番（第${activePlatoonNum}小隊）の大型免許保有者が ${largeOnDuty} 名です。${targetLarge}名必要です。`
            });
        }
        if (paramedicsOnDuty < targetParamedics) {
            warnings.push({
                type: 'balance_paramedic',
                dayIndex: d,
                message: `${d + 1}日目：当番（第${activePlatoonNum}小隊）の救命士が ${paramedicsOnDuty} 名です。${targetParamedics}名必要です。`
            });
        }
        if (minRescue !== null && minRescue !== undefined && !isNaN(minRescue) && rescueOnDuty < targetRescue) {
            warnings.push({
                type: 'balance_rescue',
                dayIndex: d,
                message: `${d + 1}日目：当番（第${activePlatoonNum}小隊）の救助隊員が ${rescueOnDuty} 名です。${targetRescue}名必要です。`
            });
        }
    }

    return warnings;
}

/**
 * 勤務表データをCSV文字列に変換する
 * @param {Object} roster 勤務データ
 * @param {Date} startDate 起算日
 * @param {Array} staffList スタッフリスト
 */
function exportToCSV(roster, startDate, staffList, hourlyLeaves = {}, activeCycle = 1) {
    const headers = ['氏名', '小隊', '階級', '大型免許', '救命士', '救助'];
    const wdays = ['日', '月', '火', '水', '木', '金', '土'];
    
    // 日付ヘッダーの生成
    for (let d = 0; d < 28; d++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + d);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}(${wdays[date.getDay()]})`;
        headers.push(dateStr);
    }
    headers.push('当番日数', '週休日数', '年休日数');

    const rows = [headers];

    // 各スタッフの行を追加
    staffList.forEach(staff => {
        const schedule = roster[staff.id] || new Array(28).fill('-');
        const row = [
            staff.name, 
            `第${staff.platoon}小隊`, 
            staff.rank, 
            staff.hasLargeLicense ? '有' : '無',
            staff.isParamedic ? '有' : '無',
            staff.isRescue ? '有' : '無'
        ];
        
        let dutyCount = 0;
        let holidayCount = 0;
        let annualLeaveCount = 0;
        
        for (let d = 0; d < 28; d++) {
            const shift = schedule[d];
            row.push(shift);
            if (shift === '当') dutyCount++;
            if (shift === '休') holidayCount++;
            if (shift === '有') {
                const hourlyKey = `${activeCycle}_${staff.id}_${d}`;
                if (hourlyLeaves[hourlyKey]) {
                    annualLeaveCount += hourlyLeaves[hourlyKey].hours / 8.0;
                } else {
                    annualLeaveCount += staff.isDayWorker ? 1.0 : 2.0;
                }
            }
        }
        row.push(dutyCount, holidayCount, Number.isInteger(annualLeaveCount) ? annualLeaveCount.toString() : annualLeaveCount.toFixed(2));
        rows.push(row);
    });

    // 日ごとの合計出勤人数行を追加
    const totalRow = ['出勤合計', '-', '-', '-', '-', '-'];
    for (let d = 0; d < 28; d++) {
        let count = 0;
        staffList.forEach(staff => {
            if (roster[staff.id] && roster[staff.id][d] === '当') count++;
        });
        totalRow.push(count);
    }
    totalRow.push('-', '-', '-');
    rows.push(totalRow);

    // CSV文字列の生成 (BOM付き UTF-8 でExcel文字化けを防ぐ)
    const csvContent = '\uFEFF' + rows.map(r => r.map(val => `"${val}"`).join(',')).join('\n');
    return csvContent;
}

/**
 * 余剰人員がある日に「当」を「有（年休）」に置き換える後処理関数
 * @param {Object} roster 全小隊の勤務スケジュール (staffId -> array of 28 elements)
 * @param {Array} staffList スタッフ情報リスト
 * @param {number} minStaffing 最低確保人員
 */
function insertAnnualLeaves(roster, staffList, minStaffing = 11, minSubOfficer = 1, minLarge = 1, minParamedic = 1, minRescue = null) {
    const staffMap = {};
    staffList.forEach(s => { staffMap[s.id] = s; });

    // 各日において余剰人員をチェックし、年休を挿入する
    for (let d = 0; d < 28; d++) {
        const activePlatoonNum = (d % 2 === 0) ? 1 : 2;
        const activeStaffList = staffList.filter(s => s.platoon === activePlatoonNum);
        
        // その日の出勤者（「当」）をリストアップ
        let dutyStaffIds = [];
        let officersOnDuty = 0;
        let subOfficersOnDuty = 0;
        let largeOnDuty = 0;
        let paramedicsOnDuty = 0;
        let rescueOnDuty = 0;

        for (let staffId in roster) {
            if (roster[staffId][d] === '当') {
                const s = staffMap[staffId];
                if (s && s.platoon === activePlatoonNum) {
                    dutyStaffIds.push(staffId);
                    if (["消防司令", "消防司令補", "消防士長"].includes(s.rank)) officersOnDuty++;
                    if (["消防司令", "消防司令補"].includes(s.rank)) subOfficersOnDuty++;
                    if (s.hasLargeLicense) largeOnDuty++;
                    if (s.isParamedic) paramedicsOnDuty++;
                    if (s.isRescue) rescueOnDuty++;
                }
            }
        }

        // 小隊内の総登録資格者数から、目標出勤人数を計算（validateRosterと同様）
        const getPlatoonTarget = (platoonNum, prop) => {
            const total = staffList.filter(s => s.platoon === platoonNum && s[prop]).length;
            return Math.min(2, total);
        };
        const getPlatoonOfficerTarget = (platoonNum) => {
            const total = staffList.filter(s => s.platoon === platoonNum && ["消防司令", "消防司令補", "消防士長"].includes(s.rank)).length;
            return Math.min(2, total);
        };
        const getPlatoonSubOfficerTarget = (platoonNum, userMin = 1) => {
            const total = staffList.filter(s => s.platoon === platoonNum && ["消防司令", "消防司令補"].includes(s.rank)).length;
            return Math.min(userMin, total);
        };

        const targetOfficers = getPlatoonOfficerTarget(activePlatoonNum);
        const targetSubOfficers = getPlatoonSubOfficerTarget(activePlatoonNum, minSubOfficer);
        const targetLarge = getPlatoonTarget(activePlatoonNum, 'hasLargeLicense');
        const targetParamedics = getPlatoonTarget(activePlatoonNum, 'isParamedic');
        const targetRescue = (minRescue !== null && minRescue !== undefined && !isNaN(minRescue)) ? getPlatoonTarget(activePlatoonNum, 'isRescue', minRescue) : 0;

        // 余剰があるか？（出勤人数 > 最低確保人員）
        let currentDutyCount = dutyStaffIds.length;
        
        while (currentDutyCount > minStaffing) {
            // 年休に変えても、その日の人員数および資格バランスが崩れない候補者を探す
            let candidates = [];

            for (let i = 0; i < dutyStaffIds.length; i++) {
                const staffId = dutyStaffIds[i];
                const s = staffMap[staffId];
                if (!s) continue;

                // その人が休んだ（年休になった）場合の、その日の仮の資格保有数を計算
                let tempOfficers = officersOnDuty;
                let tempSubOfficers = subOfficersOnDuty;
                let tempLarge = largeOnDuty;
                let tempParamedics = paramedicsOnDuty;
                let tempRescue = rescueOnDuty;

                if (["消防司令", "消防司令補", "消防士長"].includes(s.rank)) tempOfficers--;
                if (["消防司令", "消防司令補"].includes(s.rank)) tempSubOfficers--;
                if (s.hasLargeLicense) tempLarge--;
                if (s.isParamedic) tempParamedics--;
                if (s.isRescue) tempRescue--;

                // 資格バランスが維持されるか？
                const isOfficerSafe = tempOfficers >= targetOfficers;
                const isSubOfficerSafe = tempSubOfficers >= targetSubOfficers;
                const isLargeSafe = tempLarge >= targetLarge;
                const isParamedicSafe = tempParamedics >= targetParamedics;
                const isRescueSafe = (minRescue === null || minRescue === undefined || isNaN(minRescue)) || tempRescue >= targetRescue;

                if (isOfficerSafe && isSubOfficerSafe && isLargeSafe && isParamedicSafe && isRescueSafe) {
                    candidates.push(staffId);
                }
            }

            if (candidates.length === 0) {
                // 休ませられる候補者がいない場合はループを抜ける
                break;
            }

            // 候補者の中で「この28日サイクル中で既に取得している年休（'有'）の数が最も少ない人」を優先する
            let bestStaffId = null;
            let minLeaves = 999;

            for (let i = 0; i < candidates.length; i++) {
                const staffId = candidates[i];
                let leaveCount = 0;
                for (let day = 0; day < 28; day++) {
                    if (roster[staffId][day] === '有') {
                        leaveCount++;
                    }
                }
                
                if (leaveCount < minLeaves) {
                    minLeaves = leaveCount;
                    bestStaffId = staffId;
                }
            }

            if (bestStaffId) {
                // その人のシフトを「有」に変更
                roster[bestStaffId][d] = '食'; // ※ '有' を格納
                roster[bestStaffId][d] = '有';

                // その日のステータスを更新
                const s = staffMap[bestStaffId];
                if (["消防司令", "消防司令補", "消防士長"].includes(s.rank)) officersOnDuty--;
                if (["消防司令", "消防司令補"].includes(s.rank)) subOfficersOnDuty--;
                if (s.hasLargeLicense) largeOnDuty--;
                if (s.isParamedic) paramedicsOnDuty--;
                if (s.isRescue) rescueOnDuty--;

                dutyStaffIds = dutyStaffIds.filter(id => id !== bestStaffId);
                currentDutyCount--;
            } else {
                break;
            }
        }
    }
}
