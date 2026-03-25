/**
 * Loads job search preferences from the Notion Preferences database.
 * Falls back to config.json values, then built-in defaults.
 *
 * Notion DB schema (created by `npm run seed`):
 *   Setting  — Title    — key name (see supported keys below)
 *   Value    — Text     — comma-separated for lists, plain number for numerics
 *   Category — Select   — for visual organisation only
 *   Active   — Checkbox — uncheck to temporarily disable a row
 *
 * Supported Setting keys:
 *   titles, exclude_titles, skills, locations, target_companies,
 *   salary_floor, salary_target_min, salary_target_max, salary_stretch,
 *   min_score, industry_target, industry_avoid
 */
import { notion } from "./writer.js";
import { loadConfigFileRequirements } from "../config/requirements.js";
import type { Requirements } from "../types.js";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";

const PREFS_DB = process.env.NOTION_PREFERENCES_DB_ID;

export async function loadPreferences(): Promise<{ prefs: Requirements; source: "notion" | "config" | "defaults" }> {
  const configPrefs = loadConfigFileRequirements();
  const source = configPrefs ? "config" : "defaults";

  if (!PREFS_DB) {
    console.log("[Preferences] NOTION_PREFERENCES_DB_ID not set — using config.json / defaults.");
    return { prefs: configPrefs, source };
  }

  try {
    const response = await notion.databases.query({
      database_id: PREFS_DB,
      filter: { property: "Active", checkbox: { equals: true } },
    });

    if (response.results.length === 0) {
      console.log("[Preferences] Notion Preferences DB is empty — using config.json / defaults.");
      return { prefs: configPrefs, source };
    }

    const prefs = buildPreferences(response.results as PageObjectResponse[], configPrefs);
    console.log(`[Preferences] Loaded ${response.results.length} preference rows from Notion.`);
    return { prefs, source: "notion" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Preferences] Failed to load from Notion (${msg}) — using config.json / defaults.`);
    return { prefs: configPrefs, source };
  }
}

function buildPreferences(pages: PageObjectResponse[], base: Requirements): Requirements {
  const prefs: Requirements = JSON.parse(JSON.stringify(base));

  for (const page of pages) {
    const props = page.properties as Record<string, any>;
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
