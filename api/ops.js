/**
 * Ops router - one serverless function serving four small endpoints, so the
 * project stays well under Vercel Hobby's 12-function cap.
 * Public URLs are unchanged (vercel.json rewrites):
 *   /api/debug              -> ops?task=debug
 *   /api/index-status       -> ops?task=index-status
 *   /api/reindex-existing   -> ops?task=reindex-existing
 *   /api/track-view         -> ops?task=track-view
 * Implementations live in _debug.js, _index-status.js, _reindex-existing.js,
 * _track-view.js (underscore = not counted as functions).
 */
import debug from "./_debug.js";
import indexStatus from "./_index-status.js";
import reindexExisting from "./_reindex-existing.js";
import trackView from "./_track-view.js";

const TASKS = { "debug": debug, "index-status": indexStatus, "reindex-existing": reindexExisting, "track-view": trackView };

export default async function handler(req, res) {
  const task = String((req.query && req.query.task) || "");
  const fn = TASKS[task];
  if (!fn) return res.status(404).json({ error: "Unknown task", tasks: Object.keys(TASKS) });
  return fn(req, res);
}
