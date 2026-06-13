import { MatchStage } from './types';

export const LOCK_OFFSET_MINUTES = 10;

export const STAGE_POINTS: Record<MatchStage, number> = {
  'Group Stage': 30,
  'Round of 32': 40,
  'Round of 16': 50,
  'Quarter Finals': 80,
  'Semi Finals': 100,
  'Final': 150
};

export const STAGE_CYCLE_RULES: Record<MatchStage, number | null> = {
  'Group Stage': 3,
  'Round of 32': 2,
  'Round of 16': 2,
  'Quarter Finals': 2,
  'Semi Finals': 2,
  'Final': null // No recurring cycle for final
};
