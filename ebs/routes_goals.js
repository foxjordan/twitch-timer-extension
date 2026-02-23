import { logger } from "./logger.js";
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  resetGoal,
  applyManualContribution,
  applyGoalValue,
  getGoal,
  getPublicGoals,
  DEFAULT_GOAL_STYLE,
  DEFAULT_GOAL_RULES,
  SEGMENT_KEYS,
} from "./goals_store.js";
import {
  fetchActiveSubscriberCount,
  fetchFollowerCount,
} from "./twitch_api.js";

export function mountGoalRoutes(app, deps = {}) {
  const {
    requireOverlayAuth,
    resolveOverlayUserId,
    getSessionUserId,
    onGoalsChanged,
  } = deps;

  const notify = (uid) => {
    try {
      if (typeof onGoalsChanged === "function") onGoalsChanged(uid);
    } catch {}
  };

  function requireAdmin(req, res) {
    if (!req?.session?.isAdmin) {
      res.status(401).json({ error: "Admin login required" });
      return null;
    }
    const uid =
      (typeof getSessionUserId === "function" && getSessionUserId(req)) ||
      req.session?.twitchUser?.id;
    if (!uid) {
      res.status(400).json({ error: "User session missing" });
      return null;
    }
    return String(uid);
  }

  app.get("/api/goals", (req, res) => {
    const uid = requireAdmin(req, res);
    if (!uid) return;
    const goals = listGoals(uid);
    res.json({
      goals,
      defaults: {
        style: DEFAULT_GOAL_STYLE,
        rules: DEFAULT_GOAL_RULES,
        segments: SEGMENT_KEYS,
      },
    });
  });

  app.post("/api/goals", async (req, res) => {
    const uid = requireAdmin(req, res);
    if (!uid) return;
    try {
      const payload = { ...(req.body || {}) };
      const type = String(payload.goalType || payload.type || "").toLowerCase();
      if (type === "sub_goal") {
        const subCount = await fetchActiveSubscriberCount({ broadcasterId: uid });
        if (typeof subCount !== "number") {
          return res
            .status(400)
            .json({ error: "Unable to fetch active subscriber count" });
        }
        payload.goalType = "sub_goal";
        payload.type = "sub_goal";
        payload.subBaseline = subCount;
        payload.lastSubCount = subCount;
        payload.unitLabel = "subs";
        payload.currentValue = 0;
      }
      const goal = createGoal(uid, payload);
      notify(uid);
      logger.info("goal_created", {
        userId: uid,
        goalId: goal.id,
        requestId: req.requestId,
      });
      res.status(201).json(goal);
    } catch (err) {
      logger.error("goal_create_failed", {
        userId: uid,
        message: err?.message,
      });
      res.status(400).json({ error: "Failed to create goal" });
    }
  });

  app.put("/api/goals/:goalId", (req, res) => {
    const uid = requireAdmin(req, res);
    if (!uid) return;
    try {
      const goal = updateGoal(uid, req.params.goalId, req.body || {});
      if (!goal) return res.status(404).json({ error: "Goal not found" });
      notify(uid);
      logger.info("goal_updated", {
        userId: uid,
        goalId: goal.id,
        requestId: req.requestId,
      });
      res.json(goal);
    } catch (err) {
      logger.error("goal_update_failed", {
        userId: uid,
        goalId: req.params.goalId,
        message: err?.message,
      });
      res.status(400).json({ error: "Failed to update goal" });
    }
  });

  app.delete("/api/goals/:goalId", (req, res) => {
    const uid = requireAdmin(req, res);
    if (!uid) return;
    const ok = deleteGoal(uid, req.params.goalId);
    if (!ok) return res.status(404).json({ error: "Goal not found" });
    notify(uid);
    logger.info("goal_deleted", {
      userId: uid,
      goalId: req.params.goalId,
      requestId: req.requestId,
    });
    res.json({ ok: true });
  });

  app.post("/api/goals/:goalId/reset", (req, res) => {
    const uid = requireAdmin(req, res);
    if (!uid) return;
    const goal = resetGoal(uid, req.params.goalId, req.body || {});
    if (!goal) return res.status(404).json({ error: "Goal not found" });
    notify(uid);
    logger.info("goal_reset", {
      userId: uid,
      goalId: req.params.goalId,
      requestId: req.requestId,
    });
    res.json(goal);
  });

  app.post("/api/goals/:goalId/manual", (req, res) => {
    const uid = requireAdmin(req, res);
    if (!uid) return;
    const goal = applyManualContribution(uid, req.params.goalId, req.body || {});
    if (!goal) return res.status(404).json({ error: "Goal not found" });
    notify(uid);
    logger.info("goal_manual_adjust", {
      userId: uid,
      goalId: req.params.goalId,
      requestId: req.requestId,
    });
    res.json(goal);
  });

  app.post("/api/goals/:goalId/enable-follows", async (req, res) => {
    const uid = requireAdmin(req, res);
    if (!uid) return;
    try {
      const { mode } = req.body || {};
      const followMode = ["new", "all"].includes(mode) ? mode : "new";

      const followerCount = await fetchFollowerCount({ broadcasterId: uid });
      if (typeof followerCount !== "number") {
        return res
          .status(400)
          .json({ error: "Unable to fetch follower count" });
      }

      // Reset follows segment before applying new baseline
      const current = getGoal(uid, req.params.goalId);
      if (!current) return res.status(404).json({ error: "Goal not found" });
      const followsSegmentValue = Number(current.segments?.follows || 0);

      const goal = updateGoal(uid, req.params.goalId, {
        rules: { autoTrackFollows: true, followMode },
        followBaseline: followerCount,
      });
      if (!goal) return res.status(404).json({ error: "Goal not found" });

      // Remove any existing follows segment value, then apply baseline if "all" mode
      if (followsSegmentValue > 0) {
        applyGoalValue(uid, req.params.goalId, -followsSegmentValue, {
          segmentKey: "follows",
        });
      }
      if (followMode === "all" && followerCount > 0) {
        applyGoalValue(uid, req.params.goalId, followerCount, {
          segmentKey: "follows",
        });
      }

      notify(uid);
      const updated = getGoal(uid, req.params.goalId);
      logger.info("goal_follows_enabled", {
        userId: uid,
        goalId: req.params.goalId,
        followMode,
        followerCount,
        requestId: req.requestId,
      });
      res.json(updated);
    } catch (err) {
      logger.error("goal_enable_follows_failed", {
        userId: uid,
        goalId: req.params.goalId,
        message: err?.message,
      });
      res.status(400).json({ error: "Failed to enable follow tracking" });
    }
  });

  app.get("/api/overlay/goals", (req, res) => {
    if (!requireOverlayAuth || !requireOverlayAuth(req, res)) return;
    const uid =
      (typeof resolveOverlayUserId === "function" &&
        resolveOverlayUserId(req)) ||
      null;
    if (!uid) {
      return res.json({ goals: [] });
    }
    const includeInactive =
      String(req.query.includeInactive ?? "") === "1" ||
      String(req.query.includeFuture ?? "") === "1";
    const goals = getPublicGoals(uid, { includeInactive });
    res.setHeader("Cache-Control", "no-store");
    res.json({ goals });
  });
}
