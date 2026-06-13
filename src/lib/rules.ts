import { MatchStage, ComplianceState, Match, Pick } from './types';
import { STAGE_CYCLE_RULES, STAGE_POINTS } from './constants';

export function getPointsForStage(stage: MatchStage): number {
  return STAGE_POINTS[stage] || 0;
}

export function getCycleRequirement(stage: MatchStage): number | null {
  return STAGE_CYCLE_RULES[stage] || null;
}

/**
 * A basic client-side check to determine compliance state.
 * In production, this should be validated server-side.
 */
export function calculateCompliance(
  stage: MatchStage, 
  eligibleMatchesInCycle: Match[], 
  userPicksForCycle: Pick[]
): ComplianceState {
  const ruleDenominator = getCycleRequirement(stage);
  
  if (ruleDenominator === null) {
    // Stage has no compliance cycle (e.g. Final)
    return {
      isCompliant: true,
      stage,
      ruleDenominator: 0,
      currentPicksInCycle: 0,
      gamesRemainingInCycle: 0,
      warningLevel: 'safe'
    };
  }

  const currentPicksInCycle = userPicksForCycle.length;
  const isCompliant = currentPicksInCycle >= 1;
  const gamesRemainingInCycle = ruleDenominator - eligibleMatchesInCycle.length;
  
  let warningLevel: 'safe' | 'warning' | 'danger' = 'safe';
  
  if (!isCompliant) {
    if (gamesRemainingInCycle === 1) {
      warningLevel = 'danger'; // Must pick the next game
    } else if (gamesRemainingInCycle > 1) {
      warningLevel = 'warning';
    }
  }

  return {
    isCompliant,
    stage,
    ruleDenominator,
    currentPicksInCycle,
    gamesRemainingInCycle: Math.max(0, gamesRemainingInCycle),
    warningLevel
  };
}
