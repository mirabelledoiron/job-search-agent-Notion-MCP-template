// Run with: npm run weekly
// Queries all Applied jobs via Notion MCP and generates a weekly report.
import "dotenv/config";
import { mcpQueryDatabase, mcpCreatePage, closeMCP } from "./mcp-client.js";
import { IDS, formatSalary } from "./writer.js";

interface AppliedJob {
  title: string;
  company: string;
  url: string;
  salary: string;
  dateFound: string;
  dateApplied: string;
}

async function generateWeeklyReport(): Promise<void> {
  console.log("Querying Job Tracker for applied jobs via MCP...");

  const response = await mcpQueryDatabase(
    IDS.jobTracker,
    { property: "Applied", checkbox: { equals: true } },
    [{ property: "Date Applied", direction: "descending" }],
  );

  const jobs: AppliedJob[] = (response.results ?? []).map((page: any) => {
    const p = page.properties ?? {};
    return {
      title: p["Job Title"]?.title?.[0]?.text?.content ?? "—",
      company: p["Company"]?.rich_text?.[0]?.text?.content ?? "—",
      url: p["Link"]?.url ?? "—",
      salary: p["Salary"]?.rich_text?.[0]?.text?.content ?? "—",
      dateFound: p["Date Found"]?.date?.start ?? "—",
      dateApplied: p["Date Applied"]?.date?.start ?? "—",
    };
  });

  if (jobs.length === 0) {
    console.log("No applied jobs found. Check a job as Applied in Notion first.");
    await closeMCP();
    return;
  }

  const appliedDates = jobs.map((j) => j.dateApplied).filter((d) => d !== "—").sort();
  const weekStart = appliedDates[0] ?? new Date().toISOString().split("T")[0];
  const weekEnd = appliedDates[appliedDates.length - 1] ?? weekStart;
  const title = `Weekly Applications — ${weekStart} to ${weekEnd}`;

  console.log(`Creating report: "${title}" (${jobs.length} applications)`);

  await mcpCreatePage(
    { page_id: IDS.root },
    {
      title: { title: [{ type: "text", text: { content: title } }] },
    },
    [
      {
        object: "block",
        type: "callout",
        callout: {
          icon: { type: "emoji", emoji: ">" },
          rich_text: [{
            type: "text",
            text: { content: `${jobs.length} applications for the week of ${weekStart} – ${weekEnd}. Use this for unemployment insurance reporting.` },
          }],
        },
      },
      {
        object: "block",
        type: "table",
        table: {
          table_width: 6,
          has_column_header: true,
          has_row_header: false,
          children: [
            tableRow(["#", "Employer", "Position", "Date Applied", "Website", "Method"]),
            ...jobs.map((job, i) =>
              tableRow([
                String(i + 1),
                job.company,
                job.title,
                job.dateApplied,
                job.url,
                "Online",
              ])
            ),
          ],
        },
      },
      {
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: [{ type: "text", text: { content: "Details" } }] },
      },
      ...jobs.map((job, i) => ({
        object: "block" as const,
        type: "bulleted_list_item" as const,
        bulleted_list_item: {
          rich_text: [
            { type: "text" as const, text: { content: `${i + 1}. ` }, annotations: { bold: true } },
            { type: "text" as const, text: { content: `${job.title} at ${job.company}` }, annotations: { bold: true } },
            { type: "text" as const, text: { content: ` — Applied: ${job.dateApplied} | Found: ${job.dateFound} | Salary: ${job.salary} | ` } },
            { type: "text" as const, text: { content: "View posting", link: { url: job.url } } },
          ],
        },
      })),
    ],
  );

  console.log(`Done. Report created in Notion: "${title}"`);
  await closeMCP();
}

function tableRow(cells: string[]) {
  return {
    object: "block" as const,
    type: "table_row" as const,
    table_row: {
      cells: cells.map((cell) => [{ type: "text" as const, text: { content: cell } }]),
    },
  };
}

generateWeeklyReport().catch((err) => {
  console.error("Error generating weekly report:", err);
  process.exit(1);
});
