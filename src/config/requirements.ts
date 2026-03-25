/**
 * Loads job search requirements from config.json (gitignored).
 *
 * Priority order:
 *   1. Notion Preferences DB (if NOTION_PREFERENCES_DB_ID is set)
 *   2. config.json (if present)
 *   3. Built-in defaults (fallback — very generic, you should customize)
 *
 * To configure: copy config.example.json → config.json and edit it.
 * Or add rows to your Notion Preferences DB — those always win.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { Requirements } from "../types.js";

const CONFIG_PATH = resolve(process.cwd(), "config.json");

export const defaultRequirements: Requirements = {
  titles: ["Software Engineer", "Full Stack Engineer"],
  excludeTitleExact: ["intern", "junior"],
  salary: {
    floor: 100_000,
    targetMin: 130_000,
    targetMax: 170_000,
    stretch: 190_000,
  },
  remote: true,
  locations: ["remote", "us", "usa", "united states", "anywhere", "worldwide"],
  skills: ["TypeScript", "React", "Node.js"],
  targetCompanies: [],
  industryKeywords: {
    target: ["saas", "ai", "dev tools"],
    avoid: [],
  },
  minScore: 60,
};

function loadFromConfigFile(): Requirements | null {
  if (!existsSync(CONFIG_PATH)) return null;

  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    const cfg = JSON.parse(raw);

    return {
      titles: cfg.titles ?? defaultRequirements.titles,
      excludeTitleExact: cfg.excludeTitles ?? defaultRequirements.excludeTitleExact,
      salary: {
        floor: cfg.salary?.floor ?? defaultRequirements.salary.floor,
        targetMin: cfg.salary?.targetMin ?? defaultRequirements.salary.targetMin,
        targetMax: cfg.salary?.targetMax ?? defaultRequirements.salary.targetMax,
        stretch: cfg.salary?.stretch ?? defaultRequirements.salary.stretch,
      },
      remote: cfg.remote ?? defaultRequirements.remote,
      locations: cfg.locations ?? defaultRequirements.locations,
      skills: cfg.skills ?? defaultRequirements.skills,
      targetCompanies: cfg.targetCompanies ?? defaultRequirements.targetCompanies,
      industryKeywords: {
        target: cfg.industryKeywords?.target ?? defaultRequirements.industryKeywords.target,
        avoid: cfg.industryKeywords?.avoid ?? defaultRequirements.industryKeywords.avoid,
      },
      minScore: cfg.minScore ?? defaultRequirements.minScore,
    };
  } catch (err) {
    console.warn(`[Config] Failed to parse config.json: ${err} — using defaults.`);
    return null;
  }
}

export function loadConfigFileRequirements(): Requirements {
  const fromFile = loadFromConfigFile();
  if (fromFile) {
    console.log("[Config] Loaded job criteria from config.json.");
    return fromFile;
  }
  console.log("[Config] No config.json found — using built-in defaults. Copy config.example.json → config.json to customize.");
  return { ...defaultRequirements };
}

// Greenhouse and Ashby company slugs from config.json
export function loadAtsConfig(): { greenhouse: Record<string, string>; ashby: Record<string, string> } {
  if (!existsSync(CONFIG_PATH)) return { greenhouse: {}, ashby: {} };
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    return {
      greenhouse: cfg.greenhouse ?? {},
      ashby: cfg.ashby ?? {},
    };
  } catch {
    return { greenhouse: {}, ashby: {} };
  }
}

// Backward-compatible alias
export const requirements = defaultRequirements;
