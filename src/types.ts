export interface DbUser {
  id: number;
  firebaseId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  isGlobalAdmin: boolean;
  createdAt: string;
}

export interface Match {
  id: number;
  externalId: string | null;
  teamA: string;
  teamAFlag: string | null;
  teamB: string;
  teamBFlag: string | null;
  stage: string;
  groupName: string | null;
  kickoffTime: string;
  lockTime: string;
  scoreA: number | null;
  scoreB: number | null;
  status: 'scheduled' | 'live' | 'finished' | 'cancelled';
  poolStatus: 'eligible' | 'excluded';
  result?: string;
  createdAt: string;
}

export interface Pick {
  id: number;
  userId: number;
  roomId: number;
  matchId: number;
  selection: string;
  predictedScoreA: number | null;
  predictedScoreB: number | null;
  status: string;
  pointsAwarded: number;
  createdAt: string;
}

export interface Room {
  id: number;
  name: string;
  inviteCode: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  basePoints: number;
  strikePenalties: number;
  bonusPoints: number;
  totalPoints: number;
  correctPicks: number;
  perfectScores: number;
  trend: 'up' | 'down' | 'stable';
  compliance?: any;
}

export interface AuditLog {
  id: number;
  action: string;
  details: string;
  targetId: number | null;
  createdAt: string;
  adminName: string | null;
  adminEmail: string | null;
}
