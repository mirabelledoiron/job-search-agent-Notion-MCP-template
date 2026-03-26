/**
 * Loads job search preferences from a Notion Preferences database via MCP.
 * Falls back to config.json values, then built-in defaults.
 */
import { mcpQueryDatabase } from "./mcp-client.js";
import { defaultRequirements, loadConfigFileRequirements } from "../config/requirements.js";
import type { Requirements } from "../types.js";

const PREFS_DB = process.env.NOTION_PREFERENCES_DB_ID;

export async function loadPreferences(): Promise<{ prefs: Requirements; source: "notion" | "config" | "defaults" }> {
  if (!PREFS_DB) {
    console.log("[Preferences] NOTION_PREFERENCES_DB_ID not set — using config.json / defaults.");
    const fromFile = loadConfigFileRequirements();
    if (fromFile) return { prefs: fromFile, source: "config" };
    return { prefs: deepClone(defaultRequirements), source: "defaults" };
  }

  try {
    const response = await mcpQueryDatabase(PREFS_DB, {
      property: "Active",
      checkbox: { equals: true },
    });

    const results = response.results ?? [];
    if (results.length === 0) {
      console.log("[Preferences] Notion Preferences DB has no active rows — using config.json / defaults.");
      const fromFile = loadConfigFileRequirements();
      if (fromFile) return { prefs: fromFile, source: "config" };
      return { prefs: deepClone(defaultRequirements), source: "defaults" };
    }

    const prefs = buildPreferences(results);
    console.log(`[Preferences] Loaded ${results.length} preference rows from Notion.`);
    return { prefs, source: "notion" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Preferences] Failed to load from Notion (${msg}) — using config.json / defaults.`);
    const fromFile = loadConfigFileRequirements();
    if (fromFile) return { prefs: fromFile, source: "config" };
    return { prefs: deepClone(defaultRequirements), source: "defaults" };
  }
}

function buildPreferences(pages: any[]): Requirements {
  const prefs = deepClone(defaultRequirements);

  for (const page of pages) {
    const props = page.properties ?? {};
    const setting = (props["Setting"]?.title?.[0]?.text?.content ?? "").trim();
    const value = (props["Value"]?.rich_text?.[0]?.text?.content ?? "").trim();

    if (!setting || !value) continue;

    const toList = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
    const toInt = (v: string, fallback: number) => {
      const n = parseInt(v.replace(/[_,]/g, ""), 10);
      return isNaN(n) ? fallback : n;
    };

    switch (setting) {
      case "titles": prefs.titles = toList(value); break;
      case "exclude_titles": prefs.excludeTitleExact = toList(value); break;
      case "skills": prefs.skills = toList(value); break;
      case "locations": prefs.locations = toList(value); break;
      case "target_companies": prefs.targetCompanies = toList(value); break;
      case "salary_floor": prefs.salary.floor = toInt(value, prefs.salary.floor); break;
      case "salary_target_min": prefs.salary.targetMin = toInt(value, prefs.salary.targetMin); break;
      case "salary_target_max": prefs.salary.targetMax = toInt(value, prefs.salary.targetMax); break;
      case "salary_stretch": prefs.salary.stretch = toInt(value, prefs.salary.stretch); break;
      case "min_score": prefs.minScore = toInt(value, prefs.minScore); break;
      case "industry_target": prefs.industryKeywords.target = toList(value); break;
      case "industry_avoid": prefs.industryKeywords.avoid = toList(value); break;
    }
  }

  return prefs;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
