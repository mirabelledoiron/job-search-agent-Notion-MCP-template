/**
 * npm run seed
 *
 * Creates all required Notion databases for the job search agent:
 *   1. Daily Summaries — parent page for daily run output
 *   2. Job Tracker     — database for tracking all matched jobs
 *   3. Preferences     — database for controlling agent behavior from Notion
 *
 * Prerequisites:
 *   - NOTION_TOKEN must be set in your .env
 *   - Your integration must have "Insert content" capability
 *
 * After running, copy the printed IDs into your .env and GitHub secrets.
 */
import "dotenv/config";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function seed(): Promise<void> {
  if (!process.env.NOTION_TOKEN) {
    console.error("Error: NOTION_TOKEN is not set. Add it to your .env file first.");
    process.exit(1);
  }

  console.log("Setting up Notion databases for your job search agent...\n");

  // ── 1. Find a parent page to put everything under ─────────────────────────
  // We create a root page in the user's workspace first
  let rootPageId: string;
  try {
    const root = await notion.pages.create({
      parent: { type: "workspace", workspace: true },
      properties: {
        title: { title: [{ type: "text", text: { content: "Job Search Agent" } }] },
      },
      children: [
        {
          object: "block",
          type: "callout",
          callout: {
            icon: { type: "emoji", emoji: ">" },
            rich_text: [{
              type: "text",
              text: { content: "This workspace is managed by your Job Search Agent. Daily summaries appear as child pages. Your Job Tracker and Preferences databases are linked below." },
            }],
          },
        },
      ],
    });
    rootPageId = root.id;
    console.log(`Created root page: Job Search Agent (${rootPageId})`);
  } catch (err: any) {
    // Some workspaces don't allow workspace-level pages — use a fallback message
    console.error("Error: Could not create a root page in your workspace.");
    console.error("   This usually means your integration doesn't have 'Insert content' permission.");
    console.error("   Fix: Go to notion.so/my-integrations → your integration → Capabilities → enable 'Insert content'.");
    console.error(`   Error: ${err.message}`);
    process.exit(1);
  }

  // ── 2. Daily Summaries page ───────────────────────────────────────────────
  const dailySummaries = await notion.pages.create({
    parent: { page_id: rootPageId },
    properties: {
      title: { title: [{ type: "text", text: { content: "Daily Summaries" } }] },
    },
  });
  const dailySummariesId = dailySummaries.id;
  console.log(`Created Daily Summaries page (${dailySummariesId})`);

  // ── 3. Job Tracker database ───────────────────────────────────────────────
  const jobTracker = await notion.databases.create({
    parent: { page_id: rootPageId },
    title: [{ type: "text", text: { content: "Job Tracker" } }],
    properties: {
      "Job Title": { title: {} },
      "Company": { rich_text: {} },
      "Score": { number: { format: "number" } },
      "Salary": { rich_text: {} },
      "Salary Fit": {
        select: {
          options: [
            { name: "below_floor", color: "red" },
            { name: "at_floor", color: "yellow" },
            { name: "target", color: "green" },
            { name: "stretch", color: "blue" },
            { name: "unknown", color: "gray" },
          ],
        },
      },
      "Source": { select: { options: [] } },
      "Link": { url: {} },
      "Applied": { checkbox: {} },
      "Wrong Fit": { checkbox: {} },
      "Date Found": { date: {} },
      "Date Applied": { date: {} },
      "Status": {
        select: {
          options: [
            { name: "Found", color: "gray" },
            { name: "Interested", color: "blue" },
            { name: "Applied", color: "yellow" },
            { name: "Interviewing", color: "orange" },
            { name: "Offer", color: "green" },
            { name: "Rejected", color: "red" },
            { name: "Closed", color: "default" },
          ],
        },
      },
      "Relevant": { checkbox: {} },
      "Not Relevant": { checkbox: {} },
      "Notes": { rich_text: {} },
    },
  });
  const jobTrackerId = jobTracker.id;
  console.log(`Created Job Tracker database (${jobTrackerId})`);

  // ── 4. Preferences database ───────────────────────────────────────────────
  const preferencesDb = await notion.databases.create({
    parent: { page_id: rootPageId },
    title: [{ type: "text", text: { content: "Job Search Preferences" } }],
    properties: {
      "Setting": { title: {} },
      "Value": { rich_text: {} },
      "Category": {
        select: {
          options: [
            { name: "Titles", color: "blue" },
            { name: "Skills", color: "green" },
            { name: "Salary", color: "yellow" },
            { name: "Locations", color: "purple" },
            { name: "Exclusions", color: "red" },
            { name: "Industry", color: "orange" },
            { name: "Companies", color: "pink" },
            { name: "Scoring", color: "gray" },
          ],
        },
      },
      "Active": { checkbox: {} },
    },
  });
  const preferencesId = preferencesDb.id;
  console.log(`Created Job Search Preferences database (${preferencesId})`);

  // ── 5. Seed default preference rows ──────────────────────────────────────
  const defaultPrefs = [
    { setting: "titles", value: "Software Engineer, Full Stack Engineer", category: "Titles" },
    { setting: "skills", value: "TypeScript, React, Node.js", category: "Skills" },
    { setting: "salary_floor", value: "100000", category: "Salary" },
    { setting: "salary_target_min", value: "130000", category: "Salary" },
    { setting: "salary_target_max", value: "170000", category: "Salary" },
    { setting: "salary_stretch", value: "190000", category: "Salary" },
    { setting: "min_score", value: "60", category: "Scoring" },
    { setting: "locations", value: "remote, us, usa, united states", category: "Locations" },
    { setting: "industry_target", value: "saas, ai, dev tools", category: "Industry" },
    { setting: "industry_avoid", value: "", category: "Industry" },
    { setting: "exclude_titles", value: "intern, junior", category: "Exclusions" },
    { setting: "target_companies", value: "", category: "Companies" },
  ];

  await Promise.all(
    defaultPrefs.map((pref) =>
      notion.pages.create({
        parent: { database_id: preferencesId },
        properties: {
          "Setting": { title: [{ type: "text", text: { content: pref.setting } }] },
          "Value": { rich_text: [{ type: "text", text: { content: pref.value } }] },
          "Category": { select: { name: pref.category } },
          "Active": { checkbox: true },
        },
      })
    )
  );
  console.log(`Seeded ${defaultPrefs.length} default preference rows`);

  // ── 6. Control Panel database ─────────────────────────────────────────────
  const controlDb = await notion.databases.create({
    parent: { page_id: rootPageId },
    title: [{ type: "text", text: { content: "Agent Control Panel" } }],
    properties: {
      "Agent Name": { title: {} },
      "Run Agent": { checkbox: {} },
      "Mode": {
        select: {
          options: [
            { name: "daily", color: "green" },
            { name: "test", color: "yellow" },
            { name: "paused", color: "red" },
          ],
        },
      },
      "Last Run": { date: {} },
      "Last Run Stats": { rich_text: {} },
    },
  });
  const controlId = controlDb.id;

  // Add the default control row
  await notion.pages.create({
    parent: { database_id: controlId },
    properties: {
      "Agent Name": { title: [{ type: "text", text: { content: "Job Search Agent" } }] },
      "Run Agent": { checkbox: true },
      "Mode": { select: { name: "daily" } },
    },
  });
  console.log(`Created Agent Control Panel database (${controlId})`);

  // ── 7. Print results ──────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log("Setup complete! Add these to your .env and GitHub secrets:\n");
  console.log(`NOTION_DAILY_SUMMARIES_PAGE_ID=${dailySummariesId}`);
  console.log(`NOTION_JOB_TRACKER_DB_ID=${jobTrackerId}`);
  console.log(`NOTION_PREFERENCES_DB_ID=${preferencesId}`);
  console.log(`NOTION_CONTROL_DB_ID=${controlId}`);
  console.log("\n" + "─".repeat(60));
  console.log("\nNext steps:");
  console.log("  1. Copy the IDs above into your .env");
  console.log("  2. Edit your preferences in the 'Job Search Preferences' database in Notion");
  console.log("  3. Run: npm run dev");
  console.log("  4. Push to GitHub and add the IDs as repository secrets");
}

seed().catch((err) => {
  console.error("Fatal error during seed:", err);
  process.exit(1);
});
