import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ---------------------------------------------------------------------------
// FIFA World Cup 2026 -- Group Stage (72 matches, hardcoded)
// ---------------------------------------------------------------------------
// Sources: FIFA official draw + published schedule (June 2026)
// All kickoff times in UTC. Lock time = kickoff minus 10 minutes.
// ---------------------------------------------------------------------------

interface MatchSeed {
  externalId: string;
  teamA: string;
  teamAFlag: string;
  teamB: string;
  teamBFlag: string;
  stage: string;
  groupName: string;
  kickoffTime: Date;
  lockTime: Date;
  scoreA: number | null;
  scoreB: number | null;
  status: string;
  poolStatus: string;
}

function lock(kickoff: Date): Date {
  return new Date(kickoff.getTime() - 10 * 60 * 1000);
}

function scheduled(
  externalId: string,
  teamA: string, teamAFlag: string,
  teamB: string, teamBFlag: string,
  group: string,
  kickoff: string,
): MatchSeed {
  const ko = new Date(kickoff);
  return {
    externalId,
    teamA, teamAFlag,
    teamB, teamBFlag,
    stage: 'Group Stage',
    groupName: group,
    kickoffTime: ko,
    lockTime: lock(ko),
    scoreA: null,
    scoreB: null,
    status: 'scheduled',
    poolStatus: 'eligible',
  };
}

function finished(
  externalId: string,
  teamA: string, teamAFlag: string,
  teamB: string, teamBFlag: string,
  group: string,
  kickoff: string,
  scoreA: number, scoreB: number,
): MatchSeed {
  const ko = new Date(kickoff);
  return {
    externalId,
    teamA, teamAFlag,
    teamB, teamBFlag,
    stage: 'Group Stage',
    groupName: group,
    kickoffTime: ko,
    lockTime: lock(ko),
    scoreA,
    scoreB,
    status: 'finished',
    poolStatus: 'eligible',
  };
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------
const T = {
  MEX: { name: 'Mexico', flag: '\u{1F1F2}\u{1F1FD}' },            // 🇲🇽
  RSA: { name: 'South Africa', flag: '\u{1F1FF}\u{1F1E6}' },       // 🇿🇦
  KOR: { name: 'South Korea', flag: '\u{1F1F0}\u{1F1F7}' },        // 🇰🇷
  CZE: { name: 'Czechia', flag: '\u{1F1E8}\u{1F1FF}' },            // 🇨🇿
  CAN: { name: 'Canada', flag: '\u{1F1E8}\u{1F1E6}' },             // 🇨🇦
  BIH: { name: 'Bosnia and Herzegovina', flag: '\u{1F1E7}\u{1F1E6}' }, // 🇧🇦
  QAT: { name: 'Qatar', flag: '\u{1F1F6}\u{1F1E6}' },              // 🇶🇦
  SUI: { name: 'Switzerland', flag: '\u{1F1E8}\u{1F1ED}' },        // 🇨🇭
  BRA: { name: 'Brazil', flag: '\u{1F1E7}\u{1F1F7}' },             // 🇧🇷
  MAR: { name: 'Morocco', flag: '\u{1F1F2}\u{1F1E6}' },            // 🇲🇦
  HAI: { name: 'Haiti', flag: '\u{1F1ED}\u{1F1F9}' },              // 🇭🇹
  SCO: { name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' }, // 🏴󠁧󠁢󠁳󠁣󠁴󠁿
  USA: { name: 'United States', flag: '\u{1F1FA}\u{1F1F8}' },      // 🇺🇸
  PAR: { name: 'Paraguay', flag: '\u{1F1F5}\u{1F1FE}' },           // 🇵🇾
  AUS: { name: 'Australia', flag: '\u{1F1E6}\u{1F1FA}' },          // 🇦🇺
  TUR: { name: 'Turkey', flag: '\u{1F1F9}\u{1F1F7}' },             // 🇹🇷
  GER: { name: 'Germany', flag: '\u{1F1E9}\u{1F1EA}' },            // 🇩🇪
  CUR: { name: 'Curaçao', flag: '\u{1F1E8}\u{1F1FC}' },      // 🇨🇼
  CIV: { name: 'Ivory Coast', flag: '\u{1F1E8}\u{1F1EE}' },       // 🇨🇮
  ECU: { name: 'Ecuador', flag: '\u{1F1EA}\u{1F1E8}' },            // 🇪🇨
  NED: { name: 'Netherlands', flag: '\u{1F1F3}\u{1F1F1}' },        // 🇳🇱
  JPN: { name: 'Japan', flag: '\u{1F1EF}\u{1F1F5}' },              // 🇯🇵
  SWE: { name: 'Sweden', flag: '\u{1F1F8}\u{1F1EA}' },             // 🇸🇪
  TUN: { name: 'Tunisia', flag: '\u{1F1F9}\u{1F1F3}' },            // 🇹🇳
  BEL: { name: 'Belgium', flag: '\u{1F1E7}\u{1F1EA}' },            // 🇧🇪
  EGY: { name: 'Egypt', flag: '\u{1F1EA}\u{1F1EC}' },              // 🇪🇬
  IRN: { name: 'Iran', flag: '\u{1F1EE}\u{1F1F7}' },               // 🇮🇷
  NZL: { name: 'New Zealand', flag: '\u{1F1F3}\u{1F1FF}' },        // 🇳🇿
  ESP: { name: 'Spain', flag: '\u{1F1EA}\u{1F1F8}' },              // 🇪🇸
  CPV: { name: 'Cape Verde', flag: '\u{1F1E8}\u{1F1FB}' },         // 🇨🇻
  KSA: { name: 'Saudi Arabia', flag: '\u{1F1F8}\u{1F1E6}' },       // 🇸🇦
  URU: { name: 'Uruguay', flag: '\u{1F1FA}\u{1F1FE}' },            // 🇺🇾
  FRA: { name: 'France', flag: '\u{1F1EB}\u{1F1F7}' },             // 🇫🇷
  SEN: { name: 'Senegal', flag: '\u{1F1F8}\u{1F1F3}' },            // 🇸🇳
  IRQ: { name: 'Iraq', flag: '\u{1F1EE}\u{1F1F6}' },               // 🇮🇶
  NOR: { name: 'Norway', flag: '\u{1F1F3}\u{1F1F4}' },             // 🇳🇴
  ARG: { name: 'Argentina', flag: '\u{1F1E6}\u{1F1F7}' },          // 🇦🇷
  ALG: { name: 'Algeria', flag: '\u{1F1E9}\u{1F1FF}' },            // 🇩🇿
  AUT: { name: 'Austria', flag: '\u{1F1E6}\u{1F1F9}' },            // 🇦🇹
  JOR: { name: 'Jordan', flag: '\u{1F1EF}\u{1F1F4}' },             // 🇯🇴
  POR: { name: 'Portugal', flag: '\u{1F1F5}\u{1F1F9}' },           // 🇵🇹
  COD: { name: 'DR Congo', flag: '\u{1F1E8}\u{1F1E9}' },           // 🇨🇩
  UZB: { name: 'Uzbekistan', flag: '\u{1F1FA}\u{1F1FF}' },         // 🇺🇿
  COL: { name: 'Colombia', flag: '\u{1F1E8}\u{1F1F4}' },           // 🇨🇴
  ENG: { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' }, // 🏴󠁧󠁢󠁥󠁮󠁧󠁿
  CRO: { name: 'Croatia', flag: '\u{1F1ED}\u{1F1F7}' },            // 🇭🇷
  GHA: { name: 'Ghana', flag: '\u{1F1EC}\u{1F1ED}' },              // 🇬🇭
  PAN: { name: 'Panama', flag: '\u{1F1F5}\u{1F1E6}' },             // 🇵🇦
} as const;

// ---------------------------------------------------------------------------
// All 72 Group Stage Matches
// ---------------------------------------------------------------------------
// externalId format: wc2026-{group}-{match#} (1-6 per group)
//
// Each group plays 3 matchdays:
//   MD1: 1v2, 3v4
//   MD2: 1v3, 2v4
//   MD3: 1v4, 2v3
// (where 1-4 = seeding order listed above)
//
// Matches before June 14 with known results are marked finished.
// Matches on June 13 (today) are scheduled -- they may be in progress.
// ---------------------------------------------------------------------------

const allMatches: MatchSeed[] = [
  // =========================================================================
  // GROUP A: Mexico, South Africa, South Korea, Czechia
  // =========================================================================
  // MD1 - June 11
  finished('wc2026-a-1', T.MEX.name, T.MEX.flag, T.RSA.name, T.RSA.flag, 'Group A', '2026-06-11T19:00:00Z', 2, 0),
  finished('wc2026-a-2', T.KOR.name, T.KOR.flag, T.CZE.name, T.CZE.flag, 'Group A', '2026-06-12T01:00:00Z', 2, 1),
  // MD2 - June 16
  scheduled('wc2026-a-3', T.MEX.name, T.MEX.flag, T.KOR.name, T.KOR.flag, 'Group A', '2026-06-16T22:00:00Z'),
  scheduled('wc2026-a-4', T.RSA.name, T.RSA.flag, T.CZE.name, T.CZE.flag, 'Group A', '2026-06-16T19:00:00Z'),
  // MD3 - June 21
  scheduled('wc2026-a-5', T.MEX.name, T.MEX.flag, T.CZE.name, T.CZE.flag, 'Group A', '2026-06-21T22:00:00Z'),
  scheduled('wc2026-a-6', T.RSA.name, T.RSA.flag, T.KOR.name, T.KOR.flag, 'Group A', '2026-06-21T22:00:00Z'),

  // =========================================================================
  // GROUP B: Canada, Bosnia and Herzegovina, Qatar, Switzerland
  // =========================================================================
  // MD1 - June 12
  finished('wc2026-b-1', T.CAN.name, T.CAN.flag, T.BIH.name, T.BIH.flag, 'Group B', '2026-06-12T16:00:00Z', 1, 0),
  scheduled('wc2026-b-2', T.QAT.name, T.QAT.flag, T.SUI.name, T.SUI.flag, 'Group B', '2026-06-13T01:00:00Z'),
  // MD2 - June 17
  scheduled('wc2026-b-3', T.CAN.name, T.CAN.flag, T.QAT.name, T.QAT.flag, 'Group B', '2026-06-17T22:00:00Z'),
  scheduled('wc2026-b-4', T.BIH.name, T.BIH.flag, T.SUI.name, T.SUI.flag, 'Group B', '2026-06-17T19:00:00Z'),
  // MD3 - June 22
  scheduled('wc2026-b-5', T.CAN.name, T.CAN.flag, T.SUI.name, T.SUI.flag, 'Group B', '2026-06-22T22:00:00Z'),
  scheduled('wc2026-b-6', T.BIH.name, T.BIH.flag, T.QAT.name, T.QAT.flag, 'Group B', '2026-06-22T22:00:00Z'),

  // =========================================================================
  // GROUP C: Brazil, Morocco, Haiti, Scotland
  // =========================================================================
  // MD1 - June 12-13
  scheduled('wc2026-c-1', T.BRA.name, T.BRA.flag, T.MAR.name, T.MAR.flag, 'Group C', '2026-06-13T19:00:00Z'),
  scheduled('wc2026-c-2', T.HAI.name, T.HAI.flag, T.SCO.name, T.SCO.flag, 'Group C', '2026-06-13T22:00:00Z'),
  // MD2 - June 18
  scheduled('wc2026-c-3', T.BRA.name, T.BRA.flag, T.HAI.name, T.HAI.flag, 'Group C', '2026-06-18T22:00:00Z'),
  scheduled('wc2026-c-4', T.MAR.name, T.MAR.flag, T.SCO.name, T.SCO.flag, 'Group C', '2026-06-18T19:00:00Z'),
  // MD3 - June 23
  scheduled('wc2026-c-5', T.BRA.name, T.BRA.flag, T.SCO.name, T.SCO.flag, 'Group C', '2026-06-23T22:00:00Z'),
  scheduled('wc2026-c-6', T.MAR.name, T.MAR.flag, T.HAI.name, T.HAI.flag, 'Group C', '2026-06-23T22:00:00Z'),

  // =========================================================================
  // GROUP D: United States, Paraguay, Australia, Turkey
  // =========================================================================
  // MD1 - June 12-13
  finished('wc2026-d-1', T.USA.name, T.USA.flag, T.PAR.name, T.PAR.flag, 'Group D', '2026-06-13T01:00:00Z', 4, 1),
  scheduled('wc2026-d-2', T.AUS.name, T.AUS.flag, T.TUR.name, T.TUR.flag, 'Group D', '2026-06-13T16:00:00Z'),
  // MD2 - June 18
  scheduled('wc2026-d-3', T.USA.name, T.USA.flag, T.AUS.name, T.AUS.flag, 'Group D', '2026-06-18T01:00:00Z'),
  scheduled('wc2026-d-4', T.PAR.name, T.PAR.flag, T.TUR.name, T.TUR.flag, 'Group D', '2026-06-18T22:00:00Z'),
  // MD3 - June 23
  scheduled('wc2026-d-5', T.USA.name, T.USA.flag, T.TUR.name, T.TUR.flag, 'Group D', '2026-06-23T01:00:00Z'),
  scheduled('wc2026-d-6', T.PAR.name, T.PAR.flag, T.AUS.name, T.AUS.flag, 'Group D', '2026-06-23T01:00:00Z'),

  // =========================================================================
  // GROUP E: Germany, Curacao, Ivory Coast, Ecuador
  // =========================================================================
  // MD1 - June 13-14
  scheduled('wc2026-e-1', T.GER.name, T.GER.flag, T.CUR.name, T.CUR.flag, 'Group E', '2026-06-14T01:00:00Z'),
  scheduled('wc2026-e-2', T.CIV.name, T.CIV.flag, T.ECU.name, T.ECU.flag, 'Group E', '2026-06-14T19:00:00Z'),
  // MD2 - June 19
  scheduled('wc2026-e-3', T.GER.name, T.GER.flag, T.CIV.name, T.CIV.flag, 'Group E', '2026-06-19T22:00:00Z'),
  scheduled('wc2026-e-4', T.CUR.name, T.CUR.flag, T.ECU.name, T.ECU.flag, 'Group E', '2026-06-19T19:00:00Z'),
  // MD3 - June 24
  scheduled('wc2026-e-5', T.GER.name, T.GER.flag, T.ECU.name, T.ECU.flag, 'Group E', '2026-06-24T22:00:00Z'),
  scheduled('wc2026-e-6', T.CUR.name, T.CUR.flag, T.CIV.name, T.CIV.flag, 'Group E', '2026-06-24T22:00:00Z'),

  // =========================================================================
  // GROUP F: Netherlands, Japan, Sweden, Tunisia
  // =========================================================================
  // MD1 - June 14
  scheduled('wc2026-f-1', T.NED.name, T.NED.flag, T.JPN.name, T.JPN.flag, 'Group F', '2026-06-14T22:00:00Z'),
  scheduled('wc2026-f-2', T.SWE.name, T.SWE.flag, T.TUN.name, T.TUN.flag, 'Group F', '2026-06-15T01:00:00Z'),
  // MD2 - June 19
  scheduled('wc2026-f-3', T.NED.name, T.NED.flag, T.SWE.name, T.SWE.flag, 'Group F', '2026-06-19T01:00:00Z'),
  scheduled('wc2026-f-4', T.JPN.name, T.JPN.flag, T.TUN.name, T.TUN.flag, 'Group F', '2026-06-19T22:00:00Z'),
  // MD3 - June 24
  scheduled('wc2026-f-5', T.NED.name, T.NED.flag, T.TUN.name, T.TUN.flag, 'Group F', '2026-06-24T01:00:00Z'),
  scheduled('wc2026-f-6', T.JPN.name, T.JPN.flag, T.SWE.name, T.SWE.flag, 'Group F', '2026-06-24T01:00:00Z'),

  // =========================================================================
  // GROUP G: Belgium, Egypt, Iran, New Zealand
  // =========================================================================
  // MD1 - June 14-15
  scheduled('wc2026-g-1', T.BEL.name, T.BEL.flag, T.EGY.name, T.EGY.flag, 'Group G', '2026-06-15T16:00:00Z'),
  scheduled('wc2026-g-2', T.IRN.name, T.IRN.flag, T.NZL.name, T.NZL.flag, 'Group G', '2026-06-15T19:00:00Z'),
  // MD2 - June 20
  scheduled('wc2026-g-3', T.BEL.name, T.BEL.flag, T.IRN.name, T.IRN.flag, 'Group G', '2026-06-20T22:00:00Z'),
  scheduled('wc2026-g-4', T.EGY.name, T.EGY.flag, T.NZL.name, T.NZL.flag, 'Group G', '2026-06-20T19:00:00Z'),
  // MD3 - June 25
  scheduled('wc2026-g-5', T.BEL.name, T.BEL.flag, T.NZL.name, T.NZL.flag, 'Group G', '2026-06-25T22:00:00Z'),
  scheduled('wc2026-g-6', T.EGY.name, T.EGY.flag, T.IRN.name, T.IRN.flag, 'Group G', '2026-06-25T22:00:00Z'),

  // =========================================================================
  // GROUP H: Spain, Cape Verde, Saudi Arabia, Uruguay
  // =========================================================================
  // MD1 - June 15
  scheduled('wc2026-h-1', T.ESP.name, T.ESP.flag, T.CPV.name, T.CPV.flag, 'Group H', '2026-06-15T22:00:00Z'),
  scheduled('wc2026-h-2', T.KSA.name, T.KSA.flag, T.URU.name, T.URU.flag, 'Group H', '2026-06-16T01:00:00Z'),
  // MD2 - June 20
  scheduled('wc2026-h-3', T.ESP.name, T.ESP.flag, T.KSA.name, T.KSA.flag, 'Group H', '2026-06-20T01:00:00Z'),
  scheduled('wc2026-h-4', T.CPV.name, T.CPV.flag, T.URU.name, T.URU.flag, 'Group H', '2026-06-20T22:00:00Z'),
  // MD3 - June 25
  scheduled('wc2026-h-5', T.ESP.name, T.ESP.flag, T.URU.name, T.URU.flag, 'Group H', '2026-06-25T01:00:00Z'),
  scheduled('wc2026-h-6', T.CPV.name, T.CPV.flag, T.KSA.name, T.KSA.flag, 'Group H', '2026-06-25T01:00:00Z'),

  // =========================================================================
  // GROUP I: France, Senegal, Iraq, Norway
  // =========================================================================
  // MD1 - June 16
  scheduled('wc2026-i-1', T.FRA.name, T.FRA.flag, T.SEN.name, T.SEN.flag, 'Group I', '2026-06-16T01:00:00Z'),
  scheduled('wc2026-i-2', T.IRQ.name, T.IRQ.flag, T.NOR.name, T.NOR.flag, 'Group I', '2026-06-16T16:00:00Z'),
  // MD2 - June 21
  scheduled('wc2026-i-3', T.FRA.name, T.FRA.flag, T.IRQ.name, T.IRQ.flag, 'Group I', '2026-06-21T01:00:00Z'),
  scheduled('wc2026-i-4', T.SEN.name, T.SEN.flag, T.NOR.name, T.NOR.flag, 'Group I', '2026-06-21T19:00:00Z'),
  // MD3 - June 26
  scheduled('wc2026-i-5', T.FRA.name, T.FRA.flag, T.NOR.name, T.NOR.flag, 'Group I', '2026-06-26T22:00:00Z'),
  scheduled('wc2026-i-6', T.SEN.name, T.SEN.flag, T.IRQ.name, T.IRQ.flag, 'Group I', '2026-06-26T22:00:00Z'),

  // =========================================================================
  // GROUP J: Argentina, Algeria, Austria, Jordan
  // =========================================================================
  // MD1 - June 16-17
  scheduled('wc2026-j-1', T.ARG.name, T.ARG.flag, T.ALG.name, T.ALG.flag, 'Group J', '2026-06-17T01:00:00Z'),
  scheduled('wc2026-j-2', T.AUT.name, T.AUT.flag, T.JOR.name, T.JOR.flag, 'Group J', '2026-06-17T16:00:00Z'),
  // MD2 - June 21
  scheduled('wc2026-j-3', T.ARG.name, T.ARG.flag, T.AUT.name, T.AUT.flag, 'Group J', '2026-06-22T01:00:00Z'),
  scheduled('wc2026-j-4', T.ALG.name, T.ALG.flag, T.JOR.name, T.JOR.flag, 'Group J', '2026-06-21T16:00:00Z'),
  // MD3 - June 26
  scheduled('wc2026-j-5', T.ARG.name, T.ARG.flag, T.JOR.name, T.JOR.flag, 'Group J', '2026-06-26T01:00:00Z'),
  scheduled('wc2026-j-6', T.ALG.name, T.ALG.flag, T.AUT.name, T.AUT.flag, 'Group J', '2026-06-26T01:00:00Z'),

  // =========================================================================
  // GROUP K: Portugal, DR Congo, Uzbekistan, Colombia
  // =========================================================================
  // MD1 - June 17
  scheduled('wc2026-k-1', T.POR.name, T.POR.flag, T.COD.name, T.COD.flag, 'Group K', '2026-06-17T22:00:00Z'),
  scheduled('wc2026-k-2', T.UZB.name, T.UZB.flag, T.COL.name, T.COL.flag, 'Group K', '2026-06-18T01:00:00Z'),
  // MD2 - June 22
  scheduled('wc2026-k-3', T.POR.name, T.POR.flag, T.UZB.name, T.UZB.flag, 'Group K', '2026-06-22T19:00:00Z'),
  scheduled('wc2026-k-4', T.COD.name, T.COD.flag, T.COL.name, T.COL.flag, 'Group K', '2026-06-22T16:00:00Z'),
  // MD3 - June 27
  scheduled('wc2026-k-5', T.POR.name, T.POR.flag, T.COL.name, T.COL.flag, 'Group K', '2026-06-27T22:00:00Z'),
  scheduled('wc2026-k-6', T.COD.name, T.COD.flag, T.UZB.name, T.UZB.flag, 'Group K', '2026-06-27T22:00:00Z'),

  // =========================================================================
  // GROUP L: England, Croatia, Ghana, Panama
  // =========================================================================
  // MD1 - June 17-18
  scheduled('wc2026-l-1', T.ENG.name, T.ENG.flag, T.CRO.name, T.CRO.flag, 'Group L', '2026-06-18T01:00:00Z'),
  scheduled('wc2026-l-2', T.GHA.name, T.GHA.flag, T.PAN.name, T.PAN.flag, 'Group L', '2026-06-17T19:00:00Z'),
  // MD2 - June 23
  scheduled('wc2026-l-3', T.ENG.name, T.ENG.flag, T.GHA.name, T.GHA.flag, 'Group L', '2026-06-23T19:00:00Z'),
  scheduled('wc2026-l-4', T.CRO.name, T.CRO.flag, T.PAN.name, T.PAN.flag, 'Group L', '2026-06-23T16:00:00Z'),
  // MD3 - June 27
  scheduled('wc2026-l-5', T.ENG.name, T.ENG.flag, T.PAN.name, T.PAN.flag, 'Group L', '2026-06-27T01:00:00Z'),
  scheduled('wc2026-l-6', T.CRO.name, T.CRO.flag, T.GHA.name, T.GHA.flag, 'Group L', '2026-06-27T01:00:00Z'),
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  const { db } = await import('../src/db/index.js');
  const { matches, picks, scoreEvents } = await import('../src/db/schema.js');

  // Validate before touching the DB
  if (allMatches.length !== 72) {
    console.error(`Expected 72 matches, got ${allMatches.length}. Aborting.`);
    process.exit(1);
  }

  // Validate every group has exactly 6 matches
  const groupCounts = new Map<string, number>();
  for (const m of allMatches) {
    groupCounts.set(m.groupName, (groupCounts.get(m.groupName) ?? 0) + 1);
  }
  for (const [group, count] of groupCounts) {
    if (count !== 6) {
      console.error(`${group} has ${count} matches (expected 6). Aborting.`);
      process.exit(1);
    }
  }

  console.log('Clearing existing data...');
  await db.delete(scoreEvents);
  await db.delete(picks);
  await db.delete(matches);

  console.log('Inserting 72 group stage matches...');
  await db.insert(matches).values(allMatches);

  const finishedCount = allMatches.filter(m => m.status === 'finished').length;
  const scheduledCount = allMatches.filter(m => m.status === 'scheduled').length;

  console.log(`Seeded ${allMatches.length} matches (${finishedCount} finished, ${scheduledCount} upcoming)`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
