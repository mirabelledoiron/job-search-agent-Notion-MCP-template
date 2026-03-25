/**
 * Loads job search requirements from config.json (gitignored).
 *
 * Priority order:
 *   1. Notion Preferences DB (if NOTION_PREFERENCES_DB_ID is set)
 *   2. config.json (if present)
 *   3. Built-in defaults (fallback — very generic, you should customize)
 *
 * To configure: copy config.example.json to config.json and edit it.
 * Or add rows to your Notion Preferences DB — those always win.
 */
import { readFileSync, existsSync } from "node:fs";
import type { Requirements } from "../types.js";

// Built-in defaults — used when no config.json exists and Notion Preferences DB is not set.
// These are intentionally generic. Copy config.example.json to config.json to customize,
// or set up the Notion Preferences DB (see README).
export const defaultRequirements: Requirements = {
  titles: [
    "Software Engineer",
    "Full Stack Engineer",
  ],

  excludeTitleExact: [],

  salary: {
    floor: 100_000,
    targetMin: 130_000,
    targetMax: 170_000,
    stretch: 190_000,
  },

  remote: true,
  locations: ["remote", "us", "usa", "united states", "anywhere", "worldwide"],

  skills: [
    "TypeScript",
    "React",
    "Node.js",
  ],

  targetCompanies: [],

  industryKeywords: {
    target: ["saas", "ai", "dev tools"],
    avoid: [],
  },

  minScore: 60,
};

// Backward-compatible alias used by modules that haven't been updated yet.
export const requirements = defaultRequirements;

/**
 * Loads config.json if it exists. Returns null if not found.
 */
export function loadConfigFileRequirements(): Requirements | null {
  const path = "config.json";
  if (!existsSync(path)) {
    console.log("[Config] No config.json found — using built-in defaults. Copy config.example.json to config.json to customize.");
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    console.log("[Config] Loaded job criteria from config.json.");
    return {
      titles: raw.titles ?? defaultRequirements.titles,
      excludeTitleExact: raw.excludeTitles ?? defaultRequirements.excludeTitleExact,
      salary: {
        floor: raw.salary?.floor ?? defaultRequirements.salary.floor,
        targetMin: raw.salary?.targetMin ?? defaultRequirements.salary.targetMin,
        targetMax: raw.salary?.targetMax ?? defaultRequirements.salary.targetMax,
        stretch: raw.salary?.stretch ?? defaultRequirements.salary.stretch,
      },
      remote: raw.remote ?? defaultRequirements.remote,
      locations: raw.locations ?? defaultRequirements.locations,
      skills: raw.skills ?? defaultRequirements.skills,
      targetCompanies: raw.targetCompanies ?? defaultRequirements.targetCompanies,
      industryKeywords: {
        target: raw.industryKeywords?.target ?? defaultRequirements.industryKeywords.target,
        avoid: raw.industryKeywords?.avoid ?? defaultRequirements.industryKeywords.avoid,
      },
      minScore: raw.minScore ?? defaultRequirements.minScore,
    };
  } catch (err) {
    console.warn(`[Config] Failed to parse config.json: ${err}`);
    return null;
  }
}

/**
 * Loads ATS company slugs from config.json for Greenhouse, Ashby, and Lever sources.
 */
export function loadAtsConfig(): { greenhouse: Record<string, string>; ashby: Record<string, string>; lever: Record<string, string> } {
  const defaults = { greenhouse: {}, ashby: {}, lever: {} };
  const path = "config.json";
  if (!existsSync(path)) return defaults;

  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    return {
      greenhouse: raw.greenhouse ?? {},
      ashby: raw.ashby ?? {},
      lever: raw.lever ?? {},
    };
  } catch {
    return defaults;
  }
}
