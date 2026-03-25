import { Client } from "@notionhq/client";
import type { RunSummary, ScoredJob } from "../types.js";

export const notion = new Client({ auth: process.env.NOTION_TOKEN });

export const IDS = {
  dailySummaries: process.env.NOTION_DAILY_SUMMARIES_PAGE_ID ?? "",
  jobTracker: process.env.NOTION_JOB_TRACKER_DB_ID ?? "",
  root: process.env.NOTION_DAILY_SUMMARIES_PAGE_ID ?? "",
};

export async function writeDailySummary(summary: RunSummary): Promise<void> {
  const date = new Date(summary.runAt).toISOString().split("T")[0];
  const top = summary.topMatches.slice(0, 25);

  const appliedUrls = await getAppliedUrls();
  const newJobs = top.filter((j) => !appliedUrls.has(j.url));
  const alreadyApplied = top.filter((j) => appliedUrls.has(j.url));

  // Segment new jobs by salary fit for dedicated sections
  const highSalaryJobs = newJobs.filter(
    (j) => j.salaryFit === "target" || j.salaryFit === "stretch"
  );

  const modeLabel = summary.controlMode ? ` [${summary.controlMode}]` : "";
  const prefsLabel = summary.preferencesSource === "notion" ? " · prefs from Notion" : "";

  const blocks: any[] = [
    // ── Market Summary ──────────────────────────────────────────────────
    ...(summary.marketSummary
      ? [
          callout(
            `Today's Market: ${summary.marketSummary}`,
            "i"
          ),
        ]
      : []),

    // ── Run Stats ─────────────────────────────────────────────────────────
    heading("Run Summary"),
    bullet(`Date: ${summary.runAt}${modeLabel}${prefsLabel}`),
    bullet(`Sources: ${summary.sourcesSearched.join(", ")}`),
    bullet(`Total jobs found: ${summary.totalFound}`),
    bullet(`Jobs scored: ${summary.totalScored}`),
    bullet(
      `Top matches (score >= ${top.length > 0 ? Math.min(...top.map((j) => j.score)) : "—"}): ${summary.topMatches.length}`
    ),
    bullet(`Duration: ${(summary.durationMs / 1000).toFixed(1)}s`),

    // ── Feedback summary ─────────────────────────────────────────────────
    ...(summary.feedback && (summary.feedback.relevant.length > 0 || summary.feedback.notRelevant.length > 0)
      ? [
          divider(),
          heading("Learned From Your Feedback"),
          ...(summary.feedback.relevant.length > 0
            ? [bullet(`Marked relevant (${summary.feedback.relevant.length}): ${summary.feedback.relevant.slice(0, 3).join(" · ")}`)]
            : []),
          ...(summary.feedback.notRelevant.length > 0
            ? [bullet(`Marked not relevant (${summary.feedback.notRelevant.length}): ${summary.feedback.notRelevant.slice(0, 3).join(" · ")}`)]
            : []),
          bullet("Claude used this feedback to adjust scoring for today's results."),
        ]
      : []),

    // ── Apply Queue (Notion → Agent) ──────────────────────────────────
    ...(summary.applyQueue && summary.applyQueue.length > 0
      ? [
          divider(),
          heading("Apply Queue — Action Required"),
          callout(
            `You flagged ${summary.applyQueue.length} job(s) as "Apply" in Notion. Review and submit your applications:`,
            ">"
          ),
          ...summary.applyQueue.map((job) => bullet(job)),
        ]
      : []),

    divider(),

    // ── Top Matches Today ─────────────────────────────────────────────
    heading("Top Matches Today"),
    ...(newJobs.length > 0
      ? [jobTable(newJobs)]
      : [bullet("No new matches today.")]),

    // ── High Salary Fit ───────────────────────────────────────────────
    ...(highSalaryJobs.length > 0
      ? [
          divider(),
          heading("High Salary Fit"),
          bullet(`${highSalaryJobs.length} roles matched your target/stretch salary range:`),
          ...highSalaryJobs.map((job) =>
            bullet(
              `${job.title} at ${job.company} — ${formatSalary(job)} — score ${job.score}/100`
            )
          ),
        ]
      : []),

    divider(),

    // ── Why These Were Chosen ─────────────────────────────────────────
    heading("Why These Were Chosen"),
    ...newJobs.map((job) => reasoningBlock(job)),

    // ── Already Applied ────────────────────────────────────────────────
    ...(alreadyApplied.length > 0
      ? [
          divider(),
          heading("Already Applied"),
          ...alreadyApplied.map((job) =>
            bullet(`${job.title} at ${job.company} — score ${job.score}/100`)
          ),
        ]
      : []),

    // ── Errors ─────────────────────────────────────────────────────────
    ...(summary.errors.length > 0
      ? [
          divider(),
          heading("Source Errors"),
          ...summary.errors.map((e) => bullet(`${e.source}: ${e.error}`)),
        ]
      : []),
  ];

  await notion.pages.create({
    parent: { page_id: IDS.dailySummaries },
    properties: {
      title: {
        title: [
          {
            type: "text",
            text: { content: `${date} — ${summary.topMatches.length} matches` },
          },
        ],
      },
    },
    children: blocks,
  });

  await writeToJobTracker(newJobs, date, appliedUrls);
}

async function getAppliedUrls(): Promise<Set<string>> {
  const urls = new Set<string>();

  const tryQuery = async (property: string, value: boolean) => {
    try {
      const res = await notion.databases.query({
        database_id: IDS.jobTracker,
        filter: { property, checkbox: { equals: value } },
      });
      for (const page of res.results) {
        const props = (page as { properties: Record<string, { url?: string }> }).properties;
        const url = props["Link"]?.url ?? "";
        if (url) urls.add(url);
      }
    } catch {
      // Property doesn't exist yet in this DB — skip gracefully
    }
  };

  await Promise.all([
    tryQuery("Applied", true),
    tryQuery("Wrong Fit", true),
  ]);

  return urls;
}

async function writeToJobTracker(
  jobs: ScoredJob[],
  date: string,
  appliedUrls: Set<string>
): Promise<void> {
  const existing = await notion.databases.query({
    database_id: IDS.jobTracker,
    filter: {
      property: "Date Found",
      date: {
        on_or_after: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      },
    },
  });

  const existingUrls = new Set(
    existing.results.map((p) => {
      const props = (p as { properties: Record<string, { url?: string }> }).properties;
      return props["Link"]?.url ?? "";
    })
  );

  const toWrite = jobs.filter(
    (job) => !existingUrls.has(job.url) && !appliedUrls.has(job.url)
  );

  await Promise.allSettled(
    toWrite.map((job) =>
      notion.pages.create({
        parent: { database_id: IDS.jobTracker },
        properties: {
          "Job Title": { title: [{ type: "text", text: { content: job.title } }] },
          "Company": { rich_text: [{ type: "text", text: { content: job.company } }] },
          "Score": { number: job.score },
          "Salary": { rich_text: [{ type: "text", text: { content: formatSalary(job) } }] },
          "Salary Fit": { select: { name: job.salaryFit } },
          "Source": { select: { name: job.source } },
          "Link": { url: job.url },
          "Applied": { checkbox: false },
          "Date Found": { date: { start: date } },
          // Optional fields — only written if the property exists in the DB.
          // If it doesn't exist, Promise.allSettled catches the failure gracefully.
          "Status": { select: { name: "Found" } },
        },
      }).catch(async () => {
        // Status property may not exist yet — retry without it
        return notion.pages.create({
          parent: { database_id: IDS.jobTracker },
          properties: {
            "Job Title": { title: [{ type: "text", text: { content: job.title } }] },
            "Company": { rich_text: [{ type: "text", text: { content: job.company } }] },
            "Score": { number: job.score },
            "Salary": { rich_text: [{ type: "text", text: { content: formatSalary(job) } }] },
            "Salary Fit": { select: { name: job.salaryFit } },
            "Source": { select: { name: job.source } },
            "Link": { url: job.url },
            "Applied": { checkbox: false },
            "Date Found": { date: { start: date } },
          },
        });
      })
    )
  );
}

// ─── Block helpers ────────────────────────────────────────────────────────────

function heading(text: string) {
  return {
    object: "block" as const,
    type: "heading_2" as const,
    heading_2: { rich_text: [{ type: "text" as const, text: { content: text } }] },
  };
}

function bullet(text: string) {
  return {
    object: "block" as const,
    type: "bulleted_list_item" as const,
    bulleted_list_item: { rich_text: [{ type: "text" as const, text: { content: text } }] },
  };
}

function divider() {
  return { object: "block" as const, type: "divider" as const, divider: {} };
}

function callout(text: string, emoji: string) {
  return {
    object: "block" as const,
    type: "callout" as const,
    callout: {
      icon: { type: "emoji" as const, emoji },
      rich_text: [{ type: "text" as const, text: { content: text } }],
    },
  };
}

function jobTable(jobs: ScoredJob[]) {
  const headers = ["Title", "Company", "Score", "Salary", "Salary Fit", "Date Posted", "Source", "Link"];
  return {
    object: "block" as const,
    type: "table" as const,
    table: {
      table_width: headers.length,
      has_column_header: true,
      has_row_header: false,
      children: [plainRow(headers), ...jobs.map((job) => jobRow(job))],
    },
  };
}

function plainRow(cells: string[]) {
  return {
    object: "block" as const,
    type: "table_row" as const,
    table_row: {
      cells: cells.map((cell) => [{ type: "text" as const, text: { content: cell } }]),
    },
  };
}

function jobRow(job: ScoredJob) {
  return {
    object: "block" as const,
    type: "table_row" as const,
    table_row: {
      cells: [
        [{ type: "text" as const, text: { content: job.title, link: { url: job.url } } }],
        [{ type: "text" as const, text: { content: job.company } }],
        [{ type: "text" as const, text: { content: `${job.score}/100` } }],
        [{ type: "text" as const, text: { content: formatSalary(job) } }],
        [{ type: "text" as const, text: { content: job.salaryFit } }],
        [{ type: "text" as const, text: { content: formatDate(job.postedAt) } }],
        [{ type: "text" as const, text: { content: job.source } }],
        [{ type: "text" as const, text: { content: "→ Apply", link: { url: job.url } } }],
      ],
    },
  };
}

function reasoningBlock(job: ScoredJob) {
  return {
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: [
        {
          type: "text" as const,
          text: { content: `${job.title} at ${job.company} — ` },
          annotations: { bold: true },
        },
        { type: "text" as const, text: { content: job.reasoning } },
      ],
    },
  };
}

export function formatSalary(job: ScoredJob): string {
  if (!job.salary?.min) return "—";
  const min = job.salary.min.toLocaleString();
  const max = job.salary.max?.toLocaleString() ?? min;
  return `$${min}–$${max}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().split("T")[0];
}
