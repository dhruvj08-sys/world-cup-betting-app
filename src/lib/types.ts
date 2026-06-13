export interface User {
  id: number;
  uid: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isGlobalAdmin: boolean;
  createdAt: Date;
}

export interface Room {
  id: number;
  name: string;
  inviteCode: string;
  timezone: string;
  ruleConfig?: any;
  createdAt: Date;
}

export interface RoomMember {
  id: number;
  userId: number;
  roomId: number;
  role: 'admin' | 'member';
  joinedAt: Date;
}

export type MatchStage = 'Group Stage' | 'Round of 32' | 'Round of 16' | 'Quarter Finals' | 'Semi Finals' | 'Final';
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'cancelled';
export type PoolStatus = 'eligible' | 'excluded';

export interface Match {
  id: number;
  externalId?: string | null;
  teamA: string;
  teamAFlag?: string | null;
  teamB: string;
  teamBFlag?: string | null;
  stage: MatchStage;
  groupName?: string | null;
  kickoffTime: Date;
  lockTime: Date;
  scoreA?: number | null;
  scoreB?: number | null;
  status: MatchStatus;
  poolStatus: PoolStatus;
  createdAt: Date;
}

export type PickSelection = 'teamA' | 'teamB' | 'draw';

export interface Pick {
  id: number;
  userId: number;
  roomId: number;
  matchId: number;
  selection: PickSelection;
  isLockedSnapshot: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Settlement {
  id: number;
  userId: number;
  roomId: number;
  matchId: number;
  points: number;
  resultValid: boolean;
  createdAt: Date;
}

export interface ComplianceState {
  isCompliant: boolean;
  stage: MatchStage;
  ruleDenominator: number;
  currentPicksInCycle: number;
  gamesRemainingInCycle: number;
  warningLevel: 'safe' | 'warning' | 'danger';
}

export type ActivityType = 'pick_locked' | 'score_settled' | 'admin_override' | 'milestone';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  roomId: number;
  userId?: number;
  matchId?: number;
  title: string;
  description: string;
  timestamp: Date;
  metadata?: any;
}

export interface AdminAction {
  id: string;
  adminId: number;
  actionType: 'cancel_match' | 'update_score' | 'override_compliance' | 'update_rules';
  targetId: string | number;
  timestamp: Date;
  reason: string;
}
