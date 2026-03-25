import "dotenv/config";
import { fetchRemotive } from "./sources/remotive.js";
import { fetchRemoteOK } from "./sources/remoteok.js";
import { fetchWeWorkRemotely } from "./sources/weworkremotely.js";
import { fetchGreenhouse } from "./sources/greenhouse.js";
import { fetchAshby } from "./sources/ashby.js";
import { fetchAdzuna } from "./sources/adzuna.js";
import { fetchBuiltIn } from "./sources/builtin.js";
import { fetchDice } from "./sources/dice.js";
import { fetchWorkAtAStartup } from "./sources/workatastartup.js";
import { fetchTalent } from "./sources/talent.js";
import { fetchDribbble } from "./sources/dribbble.js";
import { scoreJobs, generateMarketSummary } from "./matching/scorer.js";
import { writeDailySummary } from "./notion/writer.js";
import { loadPreferences } from "./notion/preferences.js";
import { readAgentControl, updateControlAfterRun, readUserFeedback, readApplyQueue } from "./notion/control.js";
import { deduplicateJobs } from "./utils/deduplicate.js";
import { filterByRequirements } from "./utils/filter.js";
import type { Job, RunSummary } from "./types.js";

// Add or remove sources here. Each is isolated — one failure doesn't stop others.
const SOURCES = [
  { name: "Remotive", fetch: fetchRemotive },
  { name: "RemoteOK", fetch: fetchRemoteOK },
  { name: "We Work Remotely", fetch: fetchWeWorkRemotely },
  { name: "Greenhouse", fetch: fetchGreenhouse },
  { name: "Ashby", fetch: fetchAshby },
  { name: "Adzuna", fetch: fetchAdzuna },
  { name: "Built In", fetch: fetchBuiltIn },
  { name: "Dice", fetch: fetchDice },
  { name: "YC Work at a Startup", fetch: fetchWorkAtAStartup },
  { name: "Talent.com", fetch: fetchTalent },
  { name: "Dribbble", fetch: fetchDribbble },
];

async function run(): Promise<void> {
  const startedAt = Date.now();
  const runAt = new Date().toISOString();

  console.log(`[${runAt}] Starting job search run`);

  // ── Step 1: Check Notion control panel ───────────────────────────────────
  const control = await readAgentControl();
  if (!control.shouldRun) {
    console.log("Run skipped — agent is paused in Notion control panel.");
    process.exit(0);
  }

  // ── Step 2: Load preferences (Notion → config.json → defaults) ───────────
  const { prefs, source: preferencesSource } = await loadPreferences();
  console.log(
    `[Preferences] titles=${prefs.titles.length}, skills=${prefs.skills.length}, minScore=${prefs.minScore}`
  );

  // ── Step 3: Read user feedback to improve scoring ─────────────────────────
  const feedback = await readUserFeedback();

  // ── Step 4: Read apply queue (Notion → Agent trigger) ────────────────────
  const applyQueue = await readApplyQueue();

  // ── Step 5: Fetch all sources concurrently ────────────────────────────────
  const errors: RunSummary["errors"] = [];
  const allJobs: Job[] = [];

  const settled = await Promise.allSettled(SOURCES.map((s) => s.fetch()));

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const source = SOURCES[i];
    if (result.status === "fulfilled") {
      console.log(`  ${source.name}: ${result.value.length} jobs`);
      allJobs.push(...result.value);
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.warn(`  ${source.name}: failed — ${message}`);
      errors.push({ source: source.name, error: message });
    }
  }

  // ── Step 6: Dedupe → filter → score ───────────────────────────────────────
  const unique = deduplicateJobs(allJobs);
  const relevant = filterByRequirements(unique, prefs);
  console.log(`\nTotal: ${allJobs.length} found → ${unique.length} unique → ${relevant.length} relevant`);

  console.log(`Scoring ${relevant.length} jobs with Claude...`);
  const scored = await scoreJobs(relevant, prefs, feedback);
  const topMatches = scored.filter((j) => j.score >= prefs.minScore);
  console.log(`${topMatches.length} matches at score >= ${prefs.minScore}`);

  // ── Step 7: Generate market summary ───────────────────────────────────────
  console.log("Generating market summary...");
  const marketSummary = await generateMarketSummary(topMatches, prefs);

  // ── Step 8: Write to Notion ───────────────────────────────────────────────
  const summary: RunSummary = {
    runAt,
    sourcesSearched: SOURCES.map((s) => s.name),
    totalFound: allJobs.length,
    totalScored: scored.length,
    topMatches,
    errors,
    durationMs: Date.now() - startedAt,
    marketSummary,
    applyQueue,
    feedback,
    controlMode: control.mode,
    preferencesSource,
  };

  console.log("Writing to Notion...");
  await writeDailySummary(summary);

  // ── Step 9: Update control panel ─────────────────────────────────────────
  if (control.pageId) {
    const stats = `${topMatches.length} matches from ${allJobs.length} jobs · ${(summary.durationMs / 1000).toFixed(1)}s · ${new Date(runAt).toUTCString()}`;
    await updateControlAfterRun(control.pageId, stats);
  }

  console.log(`Done in ${(summary.durationMs / 1000).toFixed(1)}s`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
