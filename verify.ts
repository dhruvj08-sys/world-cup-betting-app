import { calculateScore, getCurrentComplianceStatus, isCompliant, MatchDTO, PickDTO } from './src/lib/engine.ts';

const matches: MatchDTO[] = [
  { id: 1, stage: 'Group Stage', kickoffTime: new Date(2026, 5, 10, 10).toISOString(), status: 'finished', poolStatus: 'eligible', result: 'teamA' },
  { id: 2, stage: 'Group Stage', kickoffTime: new Date(2026, 5, 11, 10).toISOString(), status: 'finished', poolStatus: 'eligible', result: 'teamB' },
  { id: 3, stage: 'Group Stage', kickoffTime: new Date(2026, 5, 12, 10).toISOString(), status: 'scheduled', poolStatus: 'eligible' },
  { id: 4, stage: 'Group Stage', kickoffTime: new Date(2026, 5, 13, 10).toISOString(), status: 'scheduled', poolStatus: 'eligible' },
];

const picks: PickDTO[] = [
  { matchId: 1, selection: 'teamA' }, // User picked match 1
];

console.log("== Compliance Test 1 ==");
let res = isCompliant(matches, picks, 'Group Stage');
console.log("User picked 1st game. Should be safe. Streak of non-picks should be 1 (Game 2 missed)");
console.log(res);

const picks2: PickDTO[] = []; // Zero picks
console.log("\n== Compliance Test 2 ==");
res = isCompliant(matches, picks2, 'Group Stage');
console.log("User picked 0 games. Streak of non-picks should be 2. Violation should be 0 because 3rd game hasn't locked yet. gamesToMakePick: 1");
console.log(res);

const matches2: MatchDTO[] = [
  { id: 1, stage: 'Group Stage', kickoffTime: new Date(2026, 5, 10, 10).toISOString(), status: 'finished', poolStatus: 'eligible', result: 'teamA' },
  { id: 2, stage: 'Group Stage', kickoffTime: new Date(2026, 5, 11, 10).toISOString(), status: 'finished', poolStatus: 'eligible', result: 'teamB' },
  { id: 3, stage: 'Group Stage', kickoffTime: new Date(2026, 5, 12, 10).toISOString(), status: 'finished', poolStatus: 'eligible', result: 'teamA' },
];

console.log("\n== Compliance Test 3 ==");
res = isCompliant(matches2, picks2, 'Group Stage');
console.log("User picked 0 games in a fully finished window. Violations should be 1.");
console.log(res);

const matchesCancelled: MatchDTO[] = [
  { id: 1, stage: 'Group Stage', kickoffTime: new Date(2026, 5, 10, 10).toISOString(), status: 'cancelled', poolStatus: 'eligible', result: 'teamA' },
  { id: 2, stage: 'Group Stage', kickoffTime: new Date(2026, 5, 11, 10).toISOString(), status: 'finished', poolStatus: 'eligible', result: 'teamB' },
  { id: 3, stage: 'Group Stage', kickoffTime: new Date(2026, 5, 12, 10).toISOString(), status: 'finished', poolStatus: 'eligible', result: 'teamA' },
  { id: 4, stage: 'Group Stage', kickoffTime: new Date(2026, 5, 13, 10).toISOString(), status: 'finished', poolStatus: 'eligible', result: 'teamA' },
];

console.log("\n== Compliance Test 4: Cancelled games excluded ==");
res = isCompliant(matchesCancelled, picks2, 'Group Stage');
console.log("User picked 0 games. 1 game is cancelled. They missed 2, 3, 4. So length=3, violation=1.");
console.log(res);
