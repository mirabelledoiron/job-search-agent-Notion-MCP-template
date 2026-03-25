/**
 * Agent Control Panel — reads run configuration and user feedback from Notion.
 *
 * Control Panel DB (created by `npm run seed`, or set NOTION_CONTROL_DB_ID):
 *   Agent Name     — Title      — "Job Search Agent"
 *   Run Agent      — Checkbox   — uncheck to pause automatic runs
 *   Mode           — Select     — "daily" | "test" | "paused"
 *   Last Run       — Date       — auto-updated by agent after each run
 *   Last Run Stats — Rich text  — auto-updated run summary
 *
 * Job Tracker optional fields (created by `npm run seed`):
 *   Status         — Select     — set to "Interested" to surface in Apply Queue
 *   Relevant       — Checkbox   — mark jobs you found useful
 *   Not Relevant   — Checkbox   — mark jobs that were noise
 *   Notes          — Text       — freeform feedback
 */
import { notion, IDS } from "./writer.js";
import type { AgentControl, UserFeedback } from "../types.js";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";

const CONTROL_DB = process.env.NOTION_CONTROL_DB_ID;

export async function readAgentControl(): Promise<AgentControl> {
  if (!CONTROL_DB) {
    return { shouldRun: true, mode: "daily" };
  }

  try {
    const response = await notion.databases.query({ database_id: CONTROL_DB, page_size: 1 });

    if (response.results.length === 0) return { shouldRun: true, mode: "daily" };

    const page = response.results[0] as PageObjectResponse;
    const props = page.properties as Record<string, any>;

    const runAgent: boolean = props["Run Agent"]?.checkbox ?? true;
    const modeRaw: string = props["Mode"]?.select?.name ?? "daily";
    const mode = (["daily", "test", "paused"] as const).includes(modeRaw as any)
      ? (modeRaw as AgentControl["mode"])
      : "daily";
    const lastRun: string | undefined = props["Last Run"]?.date?.start;
    const shouldRun = runAgent && mode !== "paused";

    if (!shouldRun) {
      console.log(`[Control] Agent paused (Run Agent=${runAgent}, Mode=${mode}).`);
    } else {
      console.log(`[Control] Mode: ${mode}${lastRun ? ` | Last run: ${lastRun}` : ""}`);
    }

    return { shouldRun, mode, lastRun, pageId: page.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Control] Could not read control panel (${msg}) — proceeding.`);
    return { shouldRun: true, mode: "daily" };
  }
}

export async function updateControlAfterRun(pageId: string, stats: string): Promise<void> {
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        "Last Run": { date: { start: new Date().toISOString().split("T")[0] } },
        "Last Run Stats": { rich_text: [{ type: "text", text: { content: stats } }] },
      },
    });
    console.log("[Control] Updated last run in control panel.");
  } catch (err) {
    console.warn(`[Control] Could not update control panel: ${err}`);
  }
}

export async function readUserFeedback(): Promise<UserFeedback> {
  try {
    const [relevantRes, notRelevantRes] = await Promise.all([
      notion.databases.query({
        database_id: IDS.jobTracker,
        filter: { property: "Relevant", checkbox: { equals: true } },
        page_size: 20,
      }),
      notion.databases.query({
        database_id: IDS.jobTracker,
        filter: { property: "Not Relevant", checkbox: { equals: true } },
        page_size: 20,
      }),
    ]);

    const extract = (pages: any[]): string[] =>
      pages.map((p) => {
        const props = (p as PageObjectResponse).properties as Record<string, any>;
        const title = props["Job Title"]?.title?.[0]?.text?.content ?? "";
        const company = props["Company"]?.rich_text?.[0]?.text?.content ?? "";
        return title && company ? `${title} at ${company}` : "";
      }).filter(Boolean);

    const relevant = extract(relevantRes.results);
    const notRelevant = extract(notRelevantRes.results);

    if (relevant.length > 0 || notRelevant.length > 0) {
      console.log(`[Feedback] ${relevant.length} relevant, ${notRelevant.length} not-relevant signals.`);
    }

    return { relevant, notRelevant };
  } catch {
    return { relevant: [], notRelevant: [] };
  }
}

export async function readApplyQueue(): Promise<string[]> {
  try {
    const response = await notion.databases.query({
      database_id: IDS.jobTracker,
      filter: {
        and: [
          { property: "Status", select: { equals: "Interested" } },
          { property: "Applied", checkbox: { equals: false } },
        ],
      },
    });

    const jobs = response.results.map((p) => {
      const props = (p as PageObjectResponse).properties as Record<string, any>;
      const title = props["Job Title"]?.title?.[0]?.text?.content ?? "";
      const company = props["Company"]?.rich_text?.[0]?.text?.content ?? "";
      const url = props["Link"]?.url ?? "";
      return title && company ? `${title} at ${company}${url ? ` — ${url}` : ""}` : "";
    }).filter(Boolean);

    if (jobs.length > 0) console.log(`[Apply Queue] ${jobs.length} job(s) flagged.`);
    return jobs;
  } catch {
    return [];
  }
}
