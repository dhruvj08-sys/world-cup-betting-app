import express from "express";
import { requireAuth, AuthRequest } from "../src/middleware/auth.js";
import { db } from "../src/db/index.js";
import { matches, picks, roomMembers, rooms, users, auditLogs, scoreEvents } from "../src/db/schema.js";
import { calculateScore, getCurrentComplianceStatus, MatchDTO, PickDTO } from "../src/lib/engine.js";
import { and, asc, desc, eq } from "drizzle-orm";

const app = express();

app.use(express.json());

// API endpoints

// Return current user session
app.get("/api/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    res.json(req.dbUser);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Update user avatar
app.post("/api/me/avatar", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { avatarUrl } = req.body;
    await db.update(users).set({ avatarUrl }).where(eq(users.id, req.dbUser.id));
    res.json({ success: true, avatarUrl });
  } catch (error) {
    res.status(500).json({ error: "Failed to update avatar" });
  }
});

// Get active matches for the user's room
app.get("/api/matches", requireAuth, async (req: AuthRequest, res) => {
  try {
    const allMatches = await db.select().from(matches).orderBy(asc(matches.kickoffTime));
    res.json(allMatches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch matches.", cause: error });
  }
});

// Pick submission
app.post("/api/picks", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { matchId, roomId, selection, predictedScoreA, predictedScoreB } = req.body;
    const userId = req.dbUser.id;

    if (
      (predictedScoreA !== undefined && predictedScoreA < 0) || 
      (predictedScoreB !== undefined && predictedScoreB < 0)
    ) {
      return res.status(400).json({ error: "Scores must be non-negative" });
    }

    // Ensure match exists and is not locked
    const matchList = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!matchList.length) {
      return res.status(404).json({ error: "Match not found" });
    }

    const matchData = matchList[0];
    const now = new Date();
    if (new Date(matchData.lockTime) <= now) {
      return res.status(403).json({ error: "Match is already locked." });
    }

    // Upsert pick
    const existingPick = await db.select().from(picks)
      .where(
        and(
          eq(picks.userId, userId),
          eq(picks.matchId, matchId),
          eq(picks.roomId, roomId)
        )
      ).limit(1);

    if (existingPick.length) {
      await db.update(picks)
        .set({ selection, predictedScoreA, predictedScoreB, updatedAt: new Date() })
        .where(eq(picks.id, existingPick[0].id));
    } else {
      await db.insert(picks).values({
        userId,
        matchId,
        roomId,
        selection,
        predictedScoreA,
        predictedScoreB
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save pick.", cause: error });
  }
});

// Get users picks
app.get("/api/picks/:roomId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const userPicks = await db.select().from(picks).where(
      and(eq(picks.userId, req.dbUser.id), eq(picks.roomId, roomId))
    );
    res.json(userPicks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch picks", cause: error });
  }
});

// Admin: Simulate live score update for test
app.post("/api/admin/sim-live", requireAuth, async (req: AuthRequest, res) => {
  return res.json({ success: true, message: "Live intervals removed for Vercel." });
});

// Get single room (dummy single room initialization for V1)
app.get("/api/room", requireAuth, async (req: AuthRequest, res) => {
  try {
    const inviteCode = req.query.invite as string;
    let activeRoom;

    if (inviteCode) {
      let roomList = await db.select().from(rooms).where(eq(rooms.inviteCode, inviteCode)).limit(1);
      if (roomList.length) {
        activeRoom = roomList[0];
      }
    }
    
    // Fallback to Global Pool
    if (!activeRoom) {
      let roomList = await db.select().from(rooms).where(eq(rooms.inviteCode, "WC-GLOBAL-2026")).limit(1);
      
      if (!roomList.length) {
        // Create a default room if it doesn't exist
        const inserted = await db.insert(rooms).values({
          name: "Global Pool",
          inviteCode: "WC-GLOBAL-2026",
          timezone: "Asia/Hong_Kong"
        }).returning();
        activeRoom = inserted[0];
      } else {
        activeRoom = roomList[0];
      }
    }

    // Ensure membership
    const memberships = await db.select().from(roomMembers).where(
      and(eq(roomMembers.userId, req.dbUser.id), eq(roomMembers.roomId, activeRoom.id))
    );
    if (!memberships.length) {
      await db.insert(roomMembers).values({
        userId: req.dbUser.id,
        roomId: activeRoom.id,
        role: "member" // Or admin if first user
      });
    }

    res.json(activeRoom);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get room", cause: error });
  }
});

// Admin override: Exclude or include match
app.post("/api/admin/matches/:matchId/override", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser.isGlobalAdmin) {
       return res.status(403).json({ error: "Forbidden: Admins only" });
    }
    
    const matchId = parseInt(req.params.matchId);
    const { poolStatus, status, scoreA, scoreB } = req.body;
    
    const updateData: Partial<typeof matches.$inferInsert> = {};
    if (poolStatus !== undefined) updateData.poolStatus = poolStatus;
    if (status !== undefined) updateData.status = status;
    if (scoreA !== undefined) updateData.scoreA = scoreA;
    if (scoreB !== undefined) updateData.scoreB = scoreB;
    
    await db.update(matches).set(updateData).where(eq(matches.id, matchId));
    
    await db.insert(auditLogs).values({
      adminId: req.dbUser.id,
      action: 'UPDATE_MATCH',
      targetId: matchId,
      details: JSON.stringify(updateData)
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to override match" });
  }
});

// Admin GET Audits
app.get("/api/admin/audits", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser.isGlobalAdmin) return res.status(403).json({ error: "Forbidden" });
    const logs = await db.select({
      id: auditLogs.id,
      action: auditLogs.action,
      details: auditLogs.details,
      targetId: auditLogs.targetId,
      createdAt: auditLogs.createdAt,
      adminName: users.displayName,
      adminEmail: users.email
    }).from(auditLogs)
    .innerJoin(users, eq(auditLogs.adminId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch audits" });
  }
});

// Admin: Sync matches (mock simple schedule creation)
app.post("/api/admin/seed", requireAuth, async (req: AuthRequest, res) => {
  if (!req.dbUser.isGlobalAdmin) {
     // Just auto-promote for dev environment if it's the first
     const adminCount = await db.select().from(users).where(eq(users.isGlobalAdmin, true));
     if (adminCount.length === 0) {
       await db.update(users).set({ isGlobalAdmin: true }).where(eq(users.id, req.dbUser.id));
     } else {
       return res.status(403).json({ error: "Admin only" });
     }
  }
  
  const now = new Date();
  // Seed some mock matches
  const mockMatches = [
    { externalId: "ext-101", teamA: "Germany", teamAFlag: "🇩🇪", teamB: "Scotland", teamBFlag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", stage: "Group Stage", groupName: "Group A", kickoffTime: new Date(now.getTime() - 1000 * 60 * 60 * 48), lockTime: new Date(now.getTime() - 1000 * 60 * 60 * 48 - 1000 * 60 * 10), status: 'finished', scoreA: 5, scoreB: 1, poolStatus: 'eligible' },
    { externalId: "ext-102", teamA: "Hungary", teamAFlag: "🇭🇺", teamB: "Switzerland", teamBFlag: "🇨🇭", stage: "Group Stage", groupName: "Group A", kickoffTime: new Date(now.getTime() - 1000 * 60 * 60 * 24), lockTime: new Date(now.getTime() - 1000 * 60 * 60 * 24 - 1000 * 60 * 10), status: 'finished', scoreA: 1, scoreB: 3, poolStatus: 'eligible' },
    { externalId: "ext-103", teamA: "Germany", teamAFlag: "🇩🇪", teamB: "Hungary", teamBFlag: "🇭🇺", stage: "Group Stage", groupName: "Group A", kickoffTime: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3), lockTime: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3 - 1000 * 60 * 10), status: 'scheduled', scoreA: null, scoreB: null, poolStatus: 'eligible' },
    { externalId: "ext-104", teamA: "Spain", teamAFlag: "🇪🇸", teamB: "Croatia", teamBFlag: "🇭🇷", stage: "Group Stage", groupName: "Group B", kickoffTime: new Date(now.getTime() - 1000 * 60 * 60 * 24), lockTime: new Date(now.getTime() - 1000 * 60 * 60 * 24 - 1000 * 60 * 10), status: 'finished', scoreA: 3, scoreB: 0, poolStatus: 'eligible' },
    { externalId: "ext-105", teamA: "Italy", teamAFlag: "🇮🇹", teamB: "Albania", teamBFlag: "🇦🇱", stage: "Group Stage", groupName: "Group B", kickoffTime: new Date(now.getTime() - 1000 * 60 * 60 * 12), lockTime: new Date(now.getTime() - 1000 * 60 * 60 * 12 - 1000 * 60 * 10), status: 'finished', scoreA: 2, scoreB: 1, poolStatus: 'eligible' },
    { externalId: "ext-106", teamA: "Croatia", teamAFlag: "🇭🇷", teamB: "Albania", teamBFlag: "🇦🇱", stage: "Group Stage", groupName: "Group B", kickoffTime: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 4), lockTime: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 4 - 1000 * 60 * 10), status: 'scheduled', scoreA: null, scoreB: null, poolStatus: 'eligible' },
    { externalId: "ext-107", teamA: "Slovenia", teamAFlag: "🇸🇮", teamB: "Denmark", teamBFlag: "🇩🇰", stage: "Group Stage", groupName: "Group C", kickoffTime: new Date(now.getTime() - 1000 * 60 * 10), lockTime: new Date(now.getTime() - 1000 * 60 * 10 - 1000 * 60 * 10), status: 'live', scoreA: 0, scoreB: 0, poolStatus: 'eligible' },
    { externalId: "ext-108", teamA: "Serbia", teamAFlag: "🇷🇸", teamB: "England", teamBFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", stage: "Group Stage", groupName: "Group C", kickoffTime: new Date(now.getTime() + 1000 * 60 * 15), lockTime: new Date(now.getTime() + 1000 * 60 * 15 - 1000 * 60 * 10), status: 'scheduled', scoreA: null, scoreB: null, poolStatus: 'eligible' },
    { externalId: "ext-109", teamA: "Poland", teamAFlag: "🇵🇱", teamB: "Netherlands", teamBFlag: "🇳🇱", stage: "Group Stage", groupName: "Group D", kickoffTime: new Date(now.getTime() + 1000 * 60 * 60 * 2), lockTime: new Date(now.getTime() + 1000 * 60 * 60 * 2 - 1000 * 60 * 10), status: 'scheduled', scoreA: null, scoreB: null, poolStatus: 'eligible' },
    { externalId: "ext-110", teamA: "Austria", teamAFlag: "🇦🇹", teamB: "France", teamBFlag: "🇫🇷", stage: "Group Stage", groupName: "Group D", kickoffTime: new Date(now.getTime() + 1000 * 60 * 60 * 5), lockTime: new Date(now.getTime() + 1000 * 60 * 60 * 5 - 1000 * 60 * 10), status: 'scheduled', scoreA: null, scoreB: null, poolStatus: 'eligible' },
  ];

  try {
    await db.delete(picks);
    await db.delete(scoreEvents);
    await db.delete(matches);
    await db.insert(matches).values(mockMatches);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed", cause: error });
  }
});

// Leaderboard
app.get("/api/leaderboard/:roomId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const members = await db.select()
      .from(roomMembers)
      .where(eq(roomMembers.roomId, roomId))
      .innerJoin(users, eq(roomMembers.userId, users.id));
    
    const allMatches = await db.select().from(matches);
    // Map to MatchDTO format
    const matchDTOs: MatchDTO[] = allMatches.map(m => ({
       id: m.id,
       stage: m.stage,
       kickoffTime: m.kickoffTime,
       status: m.status,
       poolStatus: m.poolStatus,
       result: m.scoreA !== null && m.scoreB !== null ? (m.scoreA > m.scoreB ? 'teamA' : (m.scoreA < m.scoreB ? 'teamB' : 'draw')) : undefined,
       scoreA: m.scoreA,
       scoreB: m.scoreB
    }));

    const allPicks = await db.select().from(picks).where(eq(picks.roomId, roomId));

    const leaderboard = members.map((m) => {
      const userPicks = allPicks.filter(p => p.userId === m.users.id);
      const { score, accuracy } = calculateScore(matchDTOs, userPicks);
      const compliance = getCurrentComplianceStatus(matchDTOs, userPicks);
      
      return {
        id: m.users.id,
        displayName: m.users.displayName || "Unknown",
        avatarUrl: m.users.avatarUrl,
        points: score,
        accuracy: accuracy,
        compliance,
        trend: 'same' // We can improve trend calculation later
      };
    }).sort((a, b) => b.points - a.points);

    res.json(leaderboard);
  } catch (error) {
     res.status(500).json({ error: "Failed to fetch leaderboard", cause: error });
  }
});

// External API Webhook endpoint
app.post("/api/webhook/sports-data", express.json(), async (req: express.Request, res: express.Response) => {
  try {
    // 1. Verify API Key
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.WEBHOOK_SECRET || 'dev-secret-key';
    
    if (!apiKey || apiKey !== expectedKey) {
      return res.status(401).json({ error: "Unauthorized webhook caller" });
    }

    // 2. Parse payload (e.g. API-Football format)
    const { fixture, goals } = req.body;
    if (!fixture || !fixture.id) {
      return res.status(400).json({ error: "Invalid payload format" });
    }

    // 3. Find Match by externalId
    const externalIdStr = fixture.id.toString();
    const matchList = await db.select().from(matches).where(eq(matches.externalId, externalIdStr)).limit(1);
    
    if (matchList.length === 0) {
      return res.status(404).json({ error: "Match not found for externalId" });
    }

    const match = matchList[0];

    // 4. Map external status to internal status
    let newStatus = match.status;
    const shortStatus = fixture.status.short;
    if (['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(shortStatus)) {
      newStatus = 'live';
    } else if (['FT', 'AET', 'PEN'].includes(shortStatus)) {
      newStatus = 'finished';
    } else if (['CANC', 'POSTP'].includes(shortStatus)) {
      newStatus = 'cancelled';
    }

    // 5. Update Database
    const updateData: Partial<typeof matches.$inferInsert> = {
      status: newStatus
    };
    if (goals && goals.home !== null) updateData.scoreA = goals.home;
    if (goals && goals.away !== null) updateData.scoreB = goals.away;

    await db.update(matches).set(updateData).where(eq(matches.id, match.id));
    
    // Log the webhook action
    await db.insert(auditLogs).values({
      adminId: 1, // Assume system user or admin 1
      action: 'WEBHOOK_UPDATE',
      targetId: match.id,
      details: JSON.stringify({ externalId: externalIdStr, updateData })
    });

    res.json({ success: true, updatedMatchId: match.id });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ error: "Internal server error processing webhook" });
  }
});

export default app;
