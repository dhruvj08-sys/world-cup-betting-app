import express from "express";
import { requireAuth, AuthRequest } from "../src/middleware/auth.js";
import { db } from "../src/db/index.js";
import { matches, picks, roomMembers, rooms, users, auditLogs, scoreEvents } from "../src/db/schema.js";
import { calculateScore, getCurrentComplianceStatus, POINTS_BY_STAGE, MatchDTO, PickDTO } from "../src/lib/engine.js";
import { and, asc, desc, eq } from "drizzle-orm";

const app = express();

app.use(express.json());

function mapApiFootballStatus(shortStatus: string): string {
  if (['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(shortStatus)) return 'live';
  if (['FT', 'AET', 'PEN'].includes(shortStatus)) return 'finished';
  if (['CANC', 'POSTP'].includes(shortStatus)) return 'cancelled';
  return 'scheduled';
}

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
    const withResult = allMatches.map(m => ({
      ...m,
      result: m.scoreA !== null && m.scoreB !== null
        ? (m.scoreA > m.scoreB ? 'teamA' : (m.scoreA < m.scoreB ? 'teamB' : 'draw'))
        : undefined
    }));
    res.json(withResult);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch matches."});
  }
});

// Pick submission
app.post("/api/picks", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { matchId, roomId, selection } = req.body;
    const userId = req.dbUser.id;

    if (!['teamA', 'teamB', 'draw'].includes(selection)) {
      return res.status(400).json({ error: "Selection must be teamA, teamB, or draw" });
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
        .set({ selection, updatedAt: new Date() })
        .where(eq(picks.id, existingPick[0].id));
    } else {
      await db.insert(picks).values({
        userId,
        matchId,
        roomId,
        selection
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save pick."});
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
    res.status(500).json({ error: "Failed to fetch picks"});
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
    let userHasPaid = false;
    if (!memberships.length) {
      await db.insert(roomMembers).values({
        userId: req.dbUser.id,
        roomId: activeRoom.id,
        role: "member", // Or admin if first user
        hasPaid: false
      });
    } else {
      userHasPaid = memberships[0].hasPaid;
    }

    res.json({ ...activeRoom, hasPaid: userHasPaid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get room"});
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
    res.status(500).json({ error: "Failed"});
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
     res.status(500).json({ error: "Failed to fetch leaderboard"});
  }
});

// Activity feed
app.get("/api/feed/:roomId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const feed = await db.select({
      id: scoreEvents.id,
      points: scoreEvents.points,
      createdAt: scoreEvents.createdAt,
      matchId: scoreEvents.matchId,
      userId: scoreEvents.userId,
      userDisplayName: users.displayName,
      userAvatar: users.avatarUrl,
      teamA: matches.teamA,
      teamB: matches.teamB,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB
    }).from(scoreEvents)
      .innerJoin(users, eq(scoreEvents.userId, users.id))
      .innerJoin(matches, eq(scoreEvents.matchId, matches.id))
      .where(eq(scoreEvents.roomId, roomId))
      .orderBy(desc(scoreEvents.createdAt))
      .limit(20);
    res.json(feed);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch feed" });
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
    const shortStatus = fixture.status.short;
    const newStatus = mapApiFootballStatus(shortStatus);

    // 5. Update Database
    const updateData: Partial<typeof matches.$inferInsert> = {
      status: newStatus
    };
    if (goals && goals.home !== null) updateData.scoreA = goals.home;
    if (goals && goals.away !== null) updateData.scoreB = goals.away;

    await db.update(matches).set(updateData).where(eq(matches.id, match.id));
    
    // Log the webhook action (find first admin for audit trail)
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.isGlobalAdmin, true)).limit(1);
    if (admins.length) {
      await db.insert(auditLogs).values({
        adminId: admins[0].id,
        action: 'WEBHOOK_UPDATE',
        targetId: match.id,
        details: JSON.stringify({ externalId: externalIdStr, updateData })
      });
    }

    res.json({ success: true, updatedMatchId: match.id });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ error: "Internal server error processing webhook" });
  }
});

// Cron: Update live scores from API-Football
app.get("/api/cron/update-scores", async (req, res) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(500).json({ error: "CRON_SECRET not configured" });
  }
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API_FOOTBALL_KEY not configured" });
    }

    // Find matches that are live or starting soon (within 30 min)
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60 * 1000);
    const recentCutoff = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    const activeMatches = await db.select().from(matches).where(
      eq(matches.poolStatus, 'eligible')
    );

    // Filter to matches that are live or starting soon
    const matchesToCheck = activeMatches.filter(m => {
      const kickoff = new Date(m.kickoffTime);
      return (m.status === 'live') ||
             (m.status === 'scheduled' && kickoff >= recentCutoff && kickoff <= soon);
    });

    if (matchesToCheck.length === 0) {
      return res.json({ updated: 0, checked: 0, message: "No active matches" });
    }

    // Batch fetch from API-Football (up to 20 IDs)
    const externalIds = matchesToCheck
      .filter(m => m.externalId)
      .map(m => m.externalId)
      .slice(0, 20);

    if (externalIds.length === 0) {
      return res.json({ updated: 0, checked: 0, message: "No external IDs mapped" });
    }

    const apiRes = await fetch(
      `https://v3.football.api-sports.io/fixtures?ids=${externalIds.join('-')}`,
      { headers: { 'x-apisports-key': apiKey } }
    );
    const apiData = await apiRes.json();

    let updated = 0;
    for (const fixture of (apiData.response || [])) {
      const extId = fixture.fixture.id.toString();
      const match = matchesToCheck.find(m => m.externalId === extId);
      if (!match) continue;

      const newStatus = mapApiFootballStatus(fixture.fixture.status.short);
      const updateData: any = { status: newStatus };
      if (fixture.goals?.home !== null) updateData.scoreA = fixture.goals.home;
      if (fixture.goals?.away !== null) updateData.scoreB = fixture.goals.away;

      await db.update(matches).set(updateData).where(eq(matches.id, match.id));

      // Create scoreEvents when a match transitions to finished
      if (newStatus === 'finished' && match.status !== 'finished' && updateData.scoreA !== undefined && updateData.scoreB !== undefined) {
        const result = updateData.scoreA > updateData.scoreB ? 'teamA' : (updateData.scoreA < updateData.scoreB ? 'teamB' : 'draw');
        const stagePoints = POINTS_BY_STAGE[match.stage] || 0;
        const matchPicks = await db.select().from(picks).where(eq(picks.matchId, match.id));
        for (const p of matchPicks) {
          const correct = p.selection === result;
          await db.insert(scoreEvents).values({
            userId: p.userId,
            roomId: p.roomId,
            matchId: match.id,
            points: correct ? stagePoints : 0,
            resultValid: correct,
          });
        }
      }

      updated++;
    }

    res.json({ updated, checked: matchesToCheck.length });
  } catch (error) {
    console.error("Cron update error:", error);
    res.status(500).json({ error: "Failed to update scores" });
  }
});

// Finance: Get payment status for all room members
app.get("/api/finance/:roomId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const membership = await db.select().from(roomMembers).where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, req.dbUser.id))).limit(1);
    if (membership.length === 0) return res.status(403).json({ error: "Not a member of this room" });

    const members = await db.select({
      userId: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      poolName: users.poolName,
      hasPaid: roomMembers.hasPaid,
      amountPaid: roomMembers.amountPaid,
      joinedAt: roomMembers.joinedAt,
    }).from(roomMembers)
      .innerJoin(users, eq(roomMembers.userId, users.id))
      .where(eq(roomMembers.roomId, roomId));
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch finance data" });
  }
});

// Finance: Admin update payment status
app.post("/api/admin/finance", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser.isGlobalAdmin) {
      return res.status(403).json({ error: "Admin only" });
    }
    const { userId, roomId, hasPaid, amountPaid } = req.body;

    await db.update(roomMembers)
      .set({
        hasPaid: hasPaid ?? false,
        amountPaid: amountPaid ?? 0
      })
      .where(and(eq(roomMembers.userId, userId), eq(roomMembers.roomId, roomId)));

    await db.insert(auditLogs).values({
      adminId: req.dbUser.id,
      action: 'UPDATE_PAYMENT',
      targetId: userId,
      details: JSON.stringify({ roomId, hasPaid, amountPaid })
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update payment" });
  }
});

// Finance: Get pot summary
app.get("/api/finance/:roomId/summary", requireAuth, async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const membership = await db.select().from(roomMembers).where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, req.dbUser.id))).limit(1);
    if (membership.length === 0) return res.status(403).json({ error: "Not a member of this room" });

    const members = await db.select({
      hasPaid: roomMembers.hasPaid,
      amountPaid: roomMembers.amountPaid,
    }).from(roomMembers).where(eq(roomMembers.roomId, roomId));

    const totalMembers = members.length;
    const paidCount = members.filter(m => m.hasPaid).length;
    const potTotal = members.reduce((sum, m) => sum + (m.amountPaid || 0), 0);

    res.json({ totalMembers, paidCount, unpaidCount: totalMembers - paidCount, potTotal, defaultBuyIn: 30 });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch finance summary" });
  }
});

// Claim pool identity (link Firebase account to WhatsApp pool name)
app.post("/api/me/claim-pool-name", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { poolName } = req.body;
    const VALID_NAMES = ['Kanav', 'Gaurav', 'Divij', 'Jainam', 'Rohan', 'Darsh', 'Moksh', 'Mir', 'Heet', 'DJ'];
    if (!poolName || !VALID_NAMES.includes(poolName)) {
      return res.status(400).json({ error: "Invalid pool name" });
    }

    const existing = await db.select().from(users).where(eq(users.poolName, poolName)).limit(1);
    if (existing.length && existing[0].id !== req.dbUser.id) {
      return res.status(409).json({ error: `${poolName} is already claimed by another account` });
    }

    await db.update(users).set({ poolName }).where(eq(users.id, req.dbUser.id));
    res.json({ success: true, poolName });
  } catch (error) {
    res.status(500).json({ error: "Failed to claim pool name" });
  }
});

// Pool standings computed from picks + matches (readable by all authenticated users)
app.get("/api/pool-standings", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const BET_AMOUNT = 30;

    // 1. Fetch all data
    const [allMatches, allPicksWithUsers, poolUsers] = await Promise.all([
      db.select().from(matches).orderBy(asc(matches.kickoffTime)),
      db.select({
        id: picks.id,
        userId: picks.userId,
        matchId: picks.matchId,
        selection: picks.selection,
        poolName: users.poolName,
      }).from(picks).innerJoin(users, eq(picks.userId, users.id)),
      db.select({ poolName: users.poolName, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users),
    ]);

    // Only picks from users with a poolName
    const poolPicks = allPicksWithUsers.filter(p => p.poolName);

    // 2. Settle each finished match
    type Settlement = {
      matchId: number;
      match: typeof allMatches[number];
      result: 'teamA' | 'teamB' | 'draw';
      matchPicks: typeof poolPicks;
      cancelled: boolean;
      winners: typeof poolPicks;
      losers: typeof poolPicks;
      winnerPayout: number;
    };
    const settlements: Settlement[] = [];

    const finishedMatches = allMatches.filter(m => m.status === 'finished' && m.scoreA !== null && m.scoreB !== null);

    for (const m of finishedMatches) {
      const result: 'teamA' | 'teamB' | 'draw' = m.scoreA! > m.scoreB! ? 'teamA' : (m.scoreA! < m.scoreB! ? 'teamB' : 'draw');
      const matchPicks = poolPicks.filter(p => p.matchId === m.id);
      if (matchPicks.length === 0) continue;

      if (matchPicks.length === 1) {
        settlements.push({ matchId: m.id, match: m, result, matchPicks, cancelled: true, winners: [], losers: [], winnerPayout: 0 });
        continue;
      }

      const winners = matchPicks.filter(p => p.selection === result);
      const losers = matchPicks.filter(p => p.selection !== result);
      const winnerPayout = winners.length > 0 ? (losers.length * BET_AMOUNT) / winners.length : 0;

      settlements.push({ matchId: m.id, match: m, result, matchPicks, cancelled: false, winners, losers, winnerPayout });
    }

    // 3. Build standings
    const balances: Record<string, { balance: number; betsPlaced: number; betsWon: number; lastSettledWin: boolean | null }> = {};

    // Init all pool users
    for (const u of poolUsers) {
      if (u.poolName) {
        balances[u.poolName] = { balance: 0, betsPlaced: 0, betsWon: 0, lastSettledWin: null };
      }
    }

    // Sort settlements by kickoff time for trend calculation
    const sortedSettlements = settlements.filter(s => !s.cancelled).sort((a, b) => new Date(a.match.kickoffTime).getTime() - new Date(b.match.kickoffTime).getTime());

    for (const s of sortedSettlements) {
      for (const w of s.winners) {
        const name = w.poolName!;
        if (!balances[name]) balances[name] = { balance: 0, betsPlaced: 0, betsWon: 0, lastSettledWin: null };
        balances[name].balance += Math.round(s.winnerPayout);
        balances[name].betsPlaced++;
        balances[name].betsWon++;
        balances[name].lastSettledWin = true;
      }
      for (const l of s.losers) {
        const name = l.poolName!;
        if (!balances[name]) balances[name] = { balance: 0, betsPlaced: 0, betsWon: 0, lastSettledWin: null };
        balances[name].balance -= BET_AMOUNT;
        balances[name].betsPlaced++;
        balances[name].lastSettledWin = false;
      }
    }

    const standings = Object.entries(balances).map(([name, data]) => ({
      name,
      balance: data.balance,
      betsPlaced: data.betsPlaced,
      betsWon: data.betsWon,
      trend: data.lastSettledWin === true ? 'up' : data.lastSettledWin === false ? 'down' : 'stable',
    })).sort((a, b) => b.balance - a.balance);

    // 4. Build recentResults
    const recentResults: { match: string; date: string; winners: string[]; losers: string[] }[] = [];

    for (const s of settlements.sort((a, b) => new Date(a.match.kickoffTime).getTime() - new Date(b.match.kickoffTime).getTime())) {
      const m = s.match;
      const isDraw = m.scoreA === m.scoreB;
      const matchLabel = `${m.teamA} ${m.scoreA}-${m.scoreB} ${m.teamB}${isDraw ? ' (Draw)' : ''}`;
      const date = new Date(m.kickoffTime).toISOString();

      if (s.cancelled) {
        const bettorName = s.matchPicks.length === 1 ? s.matchPicks[0].poolName : 'Unknown';
        recentResults.push({
          match: matchLabel,
          date,
          winners: [`Only ${bettorName} bet (cancelled)`],
          losers: [],
        });
        continue;
      }

      const winnersArr: string[] = [];
      const losersArr: string[] = [];

      if (s.winners.length === 0) {
        // No winners: all bettors lose
        for (const p of s.matchPicks) {
          const suffix = p.selection === 'draw' ? ' draw' : '';
          losersArr.push(`${p.poolName} (-$${BET_AMOUNT})${suffix}`);
        }
      } else {
        const payout = Math.round(s.winnerPayout);
        for (const w of s.winners) {
          winnersArr.push(`${w.poolName} (+$${payout})`);
        }
        for (const l of s.losers) {
          const suffix = l.selection === 'draw' && s.result !== 'draw' ? ' draw' : '';
          losersArr.push(`${l.poolName} (-$${BET_AMOUNT})${suffix}`);
        }
      }

      recentResults.push({ match: matchLabel, date, winners: winnersArr, losers: losersArr });
    }

    // 5. Build pendingBets
    const pendingMatches = allMatches.filter(m => m.status !== 'finished' && m.status !== 'cancelled');
    const pendingBets: { matchId: number; match: string; date: string; bets: { name: string; pick: string }[] }[] = [];

    for (const m of pendingMatches) {
      const matchPicks = poolPicks.filter(p => p.matchId === m.id);
      if (matchPicks.length === 0) continue;

      const bets = matchPicks.map(p => ({
        name: p.poolName!,
        pick: p.selection === 'teamA' ? m.teamA : p.selection === 'teamB' ? m.teamB : 'Draw',
      }));

      pendingBets.push({
        matchId: m.id,
        match: `${m.teamA} vs ${m.teamB}`,
        date: new Date(m.kickoffTime).toISOString(),
        bets,
      });
    }

    // 6. Compute gamesCompleted (finished matches with 2+ bettors, not cancelled)
    const gamesCompleted = settlements.filter(s => !s.cancelled).length;

    // 7. Build claimedUsers
    const claimed = poolUsers.filter(u => u.poolName).reduce((acc, u) => {
      acc[u.poolName!] = { displayName: u.displayName, avatarUrl: u.avatarUrl };
      return acc;
    }, {} as Record<string, { displayName: string | null; avatarUrl: string | null }>);

    res.json({
      standings,
      recentResults,
      pendingBets,
      gamesCompleted,
      lastUpdated: new Date().toISOString(),
      claimedUsers: claimed,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch pool standings" });
  }
});

export default app;
