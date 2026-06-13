export const POINTS_BY_STAGE: Record<string, number> = {
  "Group Stage": 30,
  "Round of 32": 40,
  "Round of 16": 50,
  "Quarter Finals": 80,
  "Semi Finals": 100,
  "Final": 150
};

export const COMPLIANCE_WINDOW_BY_STAGE: Record<string, number> = {
  "Group Stage": 5,
  "Round of 32": 2,
  "Round of 16": 2,
  "Quarter Finals": 2,
  "Semi Finals": 2,
  // Final does not have a rolling cycle
};

export interface MatchDTO {
  id: number;
  stage: string;
  kickoffTime: Date | string;
  status: string; // 'scheduled', 'live', 'finished', 'cancelled'
  poolStatus: string; // 'eligible', 'excluded'
  result?: string; // 'teamA', 'teamB', 'draw'
  scoreA?: number | null;
  scoreB?: number | null;
}

export interface PickDTO {
  matchId: number;
  selection: string;
  predictedScoreA?: number | null;
  predictedScoreB?: number | null;
}

export function isCompliant(matches: MatchDTO[], picks: PickDTO[], stage: string): { compliant: boolean; missingPicks: number; violations: number; currentStreak: number; gamesToMakePick: number; windowSize: number; stageMatches: MatchDTO[] } {
  const windowSize = COMPLIANCE_WINDOW_BY_STAGE[stage];
  if (!windowSize) return { compliant: true, missingPicks: 0, violations: 0, currentStreak: 0, gamesToMakePick: 0, windowSize: 0, stageMatches: [] }; // Final

  // Sort matches by kickoff time
  const stageMatches = matches
    .filter(m => m.stage === stage && m.poolStatus === 'eligible' && m.status !== 'cancelled')
    .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());

  if (stageMatches.length < windowSize) {
    return { compliant: true, missingPicks: 0, violations: 0, currentStreak: 0, gamesToMakePick: windowSize, windowSize, stageMatches };
  }

  const pickSet = new Set(picks.map(p => p.matchId));
  let violations = 0;

  for (let i = 0; i <= stageMatches.length - windowSize; i++) {
    const window = stageMatches.slice(i, i + windowSize);
    
    const picksInWindow = window.filter(m => pickSet.has(m.id)).length;
    const allLocked = window.every(m => m.status === 'finished' || m.status === 'live');
    if (picksInWindow === 0 && allLocked) {
      violations++;
    }
  }

  // Calculate consecutive misses looking backwards from the nearest upcoming match.
  // Actually, we can just look backwards from the end of the array, or up to the next available match.
  // We'll calculate the gap from the LAST pick.
  let lastPickIndex = -1;
  for (let i = stageMatches.length - 1; i >= 0; i--) {
     if (pickSet.has(stageMatches[i].id)) {
        lastPickIndex = i;
        break;
     }
  }

  // The number of matches since the last pick
  const consecutiveMisses = stageMatches.length - 1 - lastPickIndex;
  const gamesToMakePick = Math.max(0, windowSize - consecutiveMisses);

  return {
    compliant: violations === 0,
    missingPicks: consecutiveMisses >= windowSize ? 1 : 0, 
    violations,
    currentStreak: consecutiveMisses,
    gamesToMakePick,
    windowSize,
    stageMatches
  };
}

export function getCurrentComplianceStatus(matches: MatchDTO[], picks: PickDTO[]) {
  // Check compliance for all stages that have happened or are happening
  const stages = [...new Set(matches.map(m => m.stage))];
  const results = [];
  let isOverallCompliant = true;

  for (const stage of stages) {
    if (!COMPLIANCE_WINDOW_BY_STAGE[stage]) continue;
    
    // We only care about matches up to "now" for current compliance?
    // Actually, compliance is based on matches that are locked or finished.
    // If a user has 0 picks in the last 3 locked eligible games, they are non-compliant.
    const res = isCompliant(matches, picks, stage);
    if (!res.compliant) {
      isOverallCompliant = false;
    }
    results.push({ stage, ...res });
  }

  return { isOverallCompliant, stages: results };
}

export function calculateScore(matches: MatchDTO[], picks: PickDTO[], adminOverrides?: any[]) {
  let score = 0;
  let correct = 0;
  let totalFinished = 0;

  const pickMap = new Map(picks.map(p => [p.matchId, p]));

  for (const match of matches) {
    if (match.status !== 'finished') continue;
    if (match.poolStatus === 'excluded') continue;
    
    totalFinished++;
    
    const userPick = pickMap.get(match.id);
    if (userPick && userPick.selection === match.result) {
      // Check admin overrides here if provided
      let points = POINTS_BY_STAGE[match.stage] || 0;
      
      // Bonus for exact score prediction
      // We assume pick has predictedScoreA and predictedScoreB (which we should add to PickDTO)
      const exactScore = userPick.predictedScoreA === match.scoreA && userPick.predictedScoreB === match.scoreB;
      if (exactScore) {
        points += 5; // e.g., +5 bonus for exact score
      }

      score += points;
      correct++;
    }
  }

  return { score, accuracy: totalFinished > 0 ? Math.round((correct / totalFinished) * 100) : 0, correct, totalFinished };
}
