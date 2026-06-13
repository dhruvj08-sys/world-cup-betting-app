import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { db } from "./src/db/index.ts";
import { matches, picks, roomMembers, rooms, users, auditLogs, scoreEvents } from "./src/db/schema.ts";
import { calculateScore, getCurrentComplianceStatus, MatchDTO, PickDTO } from "./src/lib/engine.ts";
import { and, asc, desc, eq, isNotNull, or } from "drizzle-orm";

async function startServer() {
  const app = express();
  const PORT = 3000;

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
      const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
      if (!match.length) {
        return res.status(404).json({ error: "Match not found" });
      }

      const matchData = match[0];
      const now = new Date();
      if (new Date(matchData.lockTime) <= now) {
        return res.status(403).json({ error: "Match is already locked." });
      }

      // Upsert pick
      // Wait, Drizzle Postgres upsert requires unique constraints. We don't have a unique constraint on (userId, matchId, roomId).
      // We will select first, then update or insert.
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
    return res.json({ success: true, message: "No live matches" });
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
      // GROUP A
      { teamA: "Germany", teamAFlag: "🇩🇪", teamB: "Scotland", teamBFlag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", stage: "Group Stage", groupName: "Group A", kickoffTime: new Date(now.getTime() - 1000 * 60 * 60 * 48), lockTime: new Date(now.getTime() - 1000 * 60 * 60 * 48 - 1000 * 60 * 10), status: 'finished', scoreA: 5, scoreB: 1, poolStatus: 'eligible' },
      { teamA: "Hungary", teamAFlag: "🇭🇺", teamB: "Switzerland", teamBFlag: "🇨🇭", stage: "Group Stage", groupName: "Group A", kickoffTime: new Date(now.getTime() - 1000 * 60 * 60 * 24), lockTime: new Date(now.getTime() - 1000 * 60 * 60 * 24 - 1000 * 60 * 10), status: 'finished', scoreA: 1, scoreB: 3, poolStatus: 'eligible' },
      { teamA: "Germany", teamAFlag: "🇩🇪", teamB: "Hungary", teamBFlag: "🇭🇺", stage: "Group Stage", groupName: "Group A", kickoffTime: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3), lockTime: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3 - 1000 * 60 * 10), status: 'scheduled', scoreA: null, scoreB: null, poolStatus: 'eligible' },
      
      // GROUP B
      { teamA: "Spain", teamAFlag: "🇪🇸", teamB: "Croatia", teamBFlag: "🇭🇷", stage: "Group Stage", groupName: "Group B", kickoffTime: new Date(now.getTime() - 1000 * 60 * 60 * 24), lockTime: new Date(now.getTime() - 1000 * 60 * 60 * 24 - 1000 * 60 * 10), status: 'finished', scoreA: 3, scoreB: 0, poolStatus: 'eligible' },
      { teamA: "Italy", teamAFlag: "🇮🇹", teamB: "Albania", teamBFlag: "🇦🇱", stage: "Group Stage", groupName: "Group B", kickoffTime: new Date(now.getTime() - 1000 * 60 * 60 * 12), lockTime: new Date(now.getTime() - 1000 * 60 * 60 * 12 - 1000 * 60 * 10), status: 'finished', scoreA: 2, scoreB: 1, poolStatus: 'eligible' },
      { teamA: "Croatia", teamAFlag: "🇭🇷", teamB: "Albania", teamBFlag: "🇦🇱", stage: "Group Stage", groupName: "Group B", kickoffTime: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 4), lockTime: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 4 - 1000 * 60 * 10), status: 'scheduled', scoreA: null, scoreB: null, poolStatus: 'eligible' },

      // GROUP C
      { teamA: "Slovenia", teamAFlag: "🇸🇮", teamB: "Denmark", teamBFlag: "🇩🇰", stage: "Group Stage", groupName: "Group C", kickoffTime: new Date(now.getTime() - 1000 * 60 * 10), lockTime: new Date(now.getTime() - 1000 * 60 * 10 - 1000 * 60 * 10), status: 'live', scoreA: 0, scoreB: 0, poolStatus: 'eligible' },
      { teamA: "Serbia", teamAFlag: "🇷🇸", teamB: "England", teamBFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", stage: "Group Stage", groupName: "Group C", kickoffTime: new Date(now.getTime() + 1000 * 60 * 15), lockTime: new Date(now.getTime() + 1000 * 60 * 15 - 1000 * 60 * 10), status: 'scheduled', scoreA: null, scoreB: null, poolStatus: 'eligible' },

      // GROUP D
      { teamA: "Poland", teamAFlag: "🇵🇱", teamB: "Netherlands", teamBFlag: "🇳🇱", stage: "Group Stage", groupName: "Group D", kickoffTime: new Date(now.getTime() + 1000 * 60 * 60 * 2), lockTime: new Date(now.getTime() + 1000 * 60 * 60 * 2 - 1000 * 60 * 10), status: 'scheduled', scoreA: null, scoreB: null, poolStatus: 'eligible' },
      { teamA: "Austria", teamAFlag: "🇦🇹", teamB: "France", teamBFlag: "🇫🇷", stage: "Group Stage", groupName: "Group D", kickoffTime: new Date(now.getTime() + 1000 * 60 * 60 * 5), lockTime: new Date(now.getTime() + 1000 * 60 * 60 * 5 - 1000 * 60 * 10), status: 'scheduled', scoreA: null, scoreB: null, poolStatus: 'eligible' },
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
         result: m.scoreA !== null && m.scoreB !== null ? (m.scoreA > m.scoreB ? 'teamA' : (m.scoreA < m.scoreB ? 'teamB' : 'draw')) : undefined
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

  // Simulated live score engine matching Forza Football experience
  setInterval(async () => {
    try {
      const liveMatches = await db.select().from(matches).where(eq(matches.status, 'live'));
      for (const m of liveMatches) {
        // 10% chance to score a goal every interval to make it feel live but not crazy fast
        if (Math.random() < 0.1) {
          const scoreToUpdate = Math.random() < 0.5 ? 'scoreA' : 'scoreB';
          const newScore = (m[scoreToUpdate] || 0) + 1;
          await db.update(matches).set({ [scoreToUpdate]: newScore }).where(eq(matches.id, m.id));
        }
      }
    } catch (e) {
      console.error("Failed to run live simulation", e);
    }
  }, 8000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Support Express 4 fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
