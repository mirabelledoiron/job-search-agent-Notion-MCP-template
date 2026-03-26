/**
 * Agent Control Panel — reads run configuration and user feedback from Notion via MCP.
 *
 * All Notion interactions go through the Notion MCP server, not the SDK directly.
 */
import { mcpQueryDatabase, mcpUpdatePage } from "./mcp-client.js";
import { IDS } from "./writer.js";
import type { AgentControl, UserFeedback } from "../types.js";

const CONTROL_DB = process.env.NOTION_CONTROL_DB_ID;

// ─── Control Panel ────────────────────────────────────────────────────────────

export async function readAgentControl(): Promise<AgentControl> {
  if (!CONTROL_DB) {
    return { shouldRun: true, mode: "daily" };
  }

  try {
    const response = await mcpQueryDatabase(CONTROL_DB, undefined, undefined, 1);

    if (!response.results || response.results.length === 0) {
      return { shouldRun: true, mode: "daily" };
    }

    const page = response.results[0];
    const props = page.properties ?? {};

    const runAgent: boolean = props["Run Agent"]?.checkbox ?? true;
    const modeRaw: string = props["Mode"]?.select?.name ?? "daily";
    const mode = (["daily", "test", "paused"] as const).includes(modeRaw as any)
      ? (modeRaw as AgentControl["mode"])
      : "daily";
    const lastRun: string | undefined = props["Last Run"]?.date?.start;

    const shouldRun = runAgent && mode !== "paused";

    if (!shouldRun) {
      console.log(`[Control] Agent is paused (Run Agent=${runAgent}, Mode=${mode}) — skipping run.`);
    } else {
      console.log(`[Control] Mode: ${mode}${lastRun ? ` | Last run: ${lastRun}` : ""}`);
    }

    return { shouldRun, mode, lastRun, pageId: page.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Control] Could not read control panel (${msg}) — proceeding with defaults.`);
    return { shouldRun: true, mode: "daily" };
  }
}

export async function updateControlAfterRun(pageId: string, stats: string): Promise<void> {
  try {
    await mcpUpdatePage(pageId, {
      "Last Run": { date: { start: new Date().toISOString().split("T")[0] } },
      "Last Run Stats": { rich_text: [{ type: "text", text: { content: stats } }] },
    });
    console.log("[Control] Updated last run in control panel.");
  } catch (err) {
    console.warn(`[Control] Could not update control panel: ${err}`);
  }
}

// ─── Feedback (Notion → Agent) ────────────────────────────────────────────────

export async function readUserFeedback(): Promise<UserFeedback> {
  try {
    const [relevantRes, notRelevantRes] = await Promise.all([
      mcpQueryDatabase(IDS.jobTracker, {
        property: "Relevant",
        checkbox: { equals: true },
      }, undefined, 20),
      mcpQueryDatabase(IDS.jobTracker, {
        property: "Not Relevant",
        checkbox: { equals: true },
      }, undefined, 20),
    ]);

    const extract = (pages: any[]): string[] =>
      (pages ?? [])
        .map((p: any) => {
          const props = p.properties ?? {};
          const title = props["Job Title"]?.title?.[0]?.text?.content ?? "";
          const company = props["Company"]?.rich_text?.[0]?.text?.content ?? "";
          return title && company ? `${title} at ${company}` : "";
        })
        .filter(Boolean);

    const relevant = extract(relevantRes.results);
    const notRelevant = extract(notRelevantRes.results);

    if (relevant.length > 0 || notRelevant.length > 0) {
      console.log(
        `[Feedback] Found ${relevant.length} relevant, ${notRelevant.length} not-relevant signals.`
      );
    }

    return { relevant, notRelevant };
  } catch {
    return { relevant: [], notRelevant: [] };
  }
}

// ─── Apply Queue (Notion → Agent trigger) ─────────────────────────────────────

export async function readApplyQueue(): Promise<string[]> {
  try {
    const response = await mcpQueryDatabase(IDS.jobTracker, {
      and: [
        { property: "Status", select: { equals: "Interested" } },
        { property: "Applied", checkbox: { equals: false } },
      ],
    });

    const jobs = (response.results ?? []).map((p: any) => {
      const props = p.properties ?? {};
      const title = props["Job Title"]?.title?.[0]?.text?.content ?? "";
      const company = props["Company"]?.rich_text?.[0]?.text?.content ?? "";
      const url = props["Link"]?.url ?? "";
      return title && company ? `${title} at ${company}${url ? ` — ${url}` : ""}` : "";
    }).filter(Boolean);

    if (jobs.length > 0) {
      console.log(`[Apply Queue] ${jobs.length} job(s) flagged for application.`);
    }

    return jobs;
  } catch {
    return [];
  }
}
