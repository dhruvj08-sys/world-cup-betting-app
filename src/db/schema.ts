import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  isGlobalAdmin: boolean('is_global_admin').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  timezone: text('timezone').default('Asia/Hong_Kong').notNull(), // Default to HKT as per PRD
  ruleConfig: jsonb('rule_config'), // Stores custom rules if needed later
  createdAt: timestamp('created_at').defaultNow(),
});

export const roomMembers = pgTable('room_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  roomId: integer('room_id').references(() => rooms.id).notNull(),
  role: text('role').notNull().default('member'), // 'admin' or 'member'
  hasPaid: boolean('has_paid').default(false).notNull(),
  amountPaid: integer('amount_paid').default(0).notNull(),
  joinedAt: timestamp('joined_at').defaultNow(),
});

export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').unique(), // Official source ID
  teamA: text('team_a').notNull(),
  teamAFlag: text('team_a_flag'), 
  teamB: text('team_b').notNull(),
  teamBFlag: text('team_b_flag'),
  stage: text('stage').notNull(), // Group Stage, Round of 32, etc.
  groupName: text('group_name'), // e.g., Group A
  kickoffTime: timestamp('kickoff_time').notNull(), // Canonical UTC time
  lockTime: timestamp('lock_time').notNull(), // kickoff - 10 mins
  scoreA: integer('score_a'),
  scoreB: integer('score_b'),
  status: text('status').notNull().default('scheduled'), // scheduled, live, finished, cancelled
  poolStatus: text('pool_status').notNull().default('eligible'), // eligible, excluded
  createdAt: timestamp('created_at').defaultNow(),
});

export const picks = pgTable('picks', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  roomId: integer('room_id').references(() => rooms.id).notNull(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  selection: text('selection').notNull(), // 'teamA', 'teamB', 'draw'
  predictedScoreA: integer('predicted_score_a'),
  predictedScoreB: integer('predicted_score_b'),
  isLockedSnapshot: boolean('is_locked_snapshot').default(false), // true if recorded at lock time
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Settlement / Score Events
export const scoreEvents = pgTable('score_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  roomId: integer('room_id').references(() => rooms.id).notNull(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  points: integer('points').notNull(),
  resultValid: boolean('result_valid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').references(() => users.id).notNull(),
  action: text('action').notNull(), // 'UPDATE_MATCH', 'EXCLUDE_MATCH', etc.
  details: text('details').notNull(), // JSON string or text description
  targetId: integer('target_id'), // optional ID of the affected resource (like matchId)
  createdAt: timestamp('created_at').defaultNow(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(roomMembers),
  picks: many(picks),
  scoreEvents: many(scoreEvents),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  members: many(roomMembers),
  picks: many(picks),
  scoreEvents: many(scoreEvents),
}));

export const roomMembersRelations = relations(roomMembers, ({ one }) => ({
  user: one(users, { fields: [roomMembers.userId], references: [users.id] }),
  room: one(rooms, { fields: [roomMembers.roomId], references: [rooms.id] }),
}));

export const matchesRelations = relations(matches, ({ many }) => ({
  picks: many(picks),
  scoreEvents: many(scoreEvents),
}));

export const picksRelations = relations(picks, ({ one }) => ({
  user: one(users, { fields: [picks.userId], references: [users.id] }),
  room: one(rooms, { fields: [picks.roomId], references: [rooms.id] }),
  match: one(matches, { fields: [picks.matchId], references: [matches.id] }),
}));

export const scoreEventsRelations = relations(scoreEvents, ({ one }) => ({
  user: one(users, { fields: [scoreEvents.userId], references: [users.id] }),
  room: one(rooms, { fields: [scoreEvents.roomId], references: [rooms.id] }),
  match: one(matches, { fields: [scoreEvents.matchId], references: [matches.id] }),
}));
