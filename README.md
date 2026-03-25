# Job Search Agent — Notion MCP Template

An automated daily job search agent that finds roles matching your criteria, scores each one 0-100 using Claude AI, and delivers top matches to a Notion page every morning.

**Notion is the brain.** Your preferences, control panel, and feedback all live in Notion — the agent reads them on every run. Change a preference in Notion and the next run reflects it immediately. No code changes needed.

Runs on GitHub Actions — no server required. Free to run within GitHub's free tier.

**Built by [Mirabelle Doiron](https://www.mirabelledoiron.com/) · [GitHub](https://github.com/mirabelledoiron) · [LinkedIn](https://www.linkedin.com/in/mirabelledoiron)**

---

## How it works

```
Notion Preferences DB
        |
   Agent reads config at runtime
        |
   Fetches jobs from 14 sources
        |
   Deduplicates + filters
        |
   Scores 0-100 with Claude
        |
   Writes daily summary to Notion
        |
   You mark feedback (Relevant / Not Relevant)
        |
   Next run is smarter
```

1. Pulls jobs from 14 sources (RSS, public APIs, HTML scraping)
2. Deduplicates across all sources
3. Filters by your titles, keywords, and location
4. Scores each match 0-100 using Claude against your specific criteria
5. Generates a market intelligence summary
6. Writes a structured daily page to Notion with top matches, salary fit, and Claude's reasoning
7. Tracks all jobs in a Job Tracker database
8. Reads your feedback (Relevant / Not Relevant) to improve future scoring
9. Surfaces jobs you flag as "Interested" in an Apply Queue section

---

## Quick start

### 1. Use this template

Click **Use this template** on GitHub to create your own copy.

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Notion

Create a Notion integration and run the seed script to set up all databases automatically:

```bash
cp .env.example .env
# Add your NOTION_TOKEN to .env first (see step 4), then:
npm run seed
```

The seed script creates all databases, seeds default preferences, and prints the IDs to add to your `.env`.

Or set them up manually — see [Manual Notion Setup](#manual-notion-setup) below.

### 4. Get your API keys

Your `.env` has two types of keys: **required** (the agent won't run without them) and **optional** (extra job sources — the agent skips any source whose keys are missing).

#### Required keys

| Key | How to get it |
|-----|---------------|
| `ANTHROPIC_API_KEY` | Sign up at [console.anthropic.com](https://console.anthropic.com), go to **API Keys**, create a new key. Starts with `sk-ant-...` |
| `NOTION_TOKEN` | Go to [notion.so/my-integrations](https://www.notion.so/my-integrations), click **+ New integration**, name it (e.g. "Job Search Agent"), copy the token. Starts with `secret_...` |
| `NOTION_DAILY_SUMMARIES_PAGE_ID` | Printed by `npm run seed` (step 3). Or copy the ID from your Notion page URL |
| `NOTION_JOB_TRACKER_DB_ID` | Printed by `npm run seed` (step 3). Or copy from your database URL |

#### Optional keys — Notion databases

| Key | How to get it |
|-----|---------------|
| `NOTION_PREFERENCES_DB_ID` | Printed by `npm run seed`. Lets you control the agent from Notion instead of `config.json` |
| `NOTION_CONTROL_DB_ID` | Printed by `npm run seed`. Lets you pause/resume the agent and track run stats from Notion |

#### Optional keys — extra job sources

These sources are **skipped automatically** if their keys are not set. The agent still works with the other sources.

| Key | How to get it |
|-----|---------------|
| `ADZUNA_APP_ID` | Register for free at [developer.adzuna.com](https://developer.adzuna.com), create an app, copy the App ID |
| `ADZUNA_APP_KEY` | Same page as above — copy the App Key |
| `DICE_API_KEY` | Dice job search API key |

#### Example `.env`

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
NOTION_TOKEN=secret_...
NOTION_DAILY_SUMMARIES_PAGE_ID=abc123...
NOTION_JOB_TRACKER_DB_ID=def456...

# Optional Notion databases
NOTION_PREFERENCES_DB_ID=ghi789...
NOTION_CONTROL_DB_ID=jkl012...

# Optional job sources (leave blank to skip)
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
DICE_API_KEY=
```

### 5. Configure your job criteria

Copy the example config and edit it for your search:

```bash
cp config.example.json config.json
```

Edit `config.json` with your target titles, skills, salary range, industries, and target companies. This is where you customize what roles the agent looks for.

The `greenhouse`, `ashby`, and `lever` sections control which companies are searched on those ATS platforms. Add any company whose careers page uses these platforms.

Alternatively, add your criteria directly to the **Notion Preferences DB** (no `config.json` needed) — Notion values always take precedence.

### 6. Test locally

```bash
npm run dev
```

### 7. Deploy to GitHub Actions

1. Push your repo to GitHub
2. Go to **Settings > Secrets and variables > Actions**
3. Add each key from `.env` as a repository secret
4. The workflow in `.github/workflows/job-search.yml` runs automatically at 6AM ET daily
5. Trigger manually anytime from the **Actions** tab

---

## Customizing search terms

Several job sources use hardcoded search terms in their source files. To customize what each source searches for, edit the `SEARCH_TERMS` array at the top of each file in `src/sources/`:

- `remotive.ts` — Remotive API search terms
- `adzuna.ts` — Adzuna API search terms
- `dice.ts` — Dice API search terms
- `dribbble.ts` — Dribbble job board search terms
- `talent.ts` — Talent.com search terms
- `hiringcafe.ts` — HiringCafe search terms

For ATS sources (Greenhouse, Ashby, Lever), configure which companies to search in `config.json`.

---

## Notion databases

### Preferences DB
Controls what the agent searches for. Change anything here — no redeploy needed.

| Setting | Example value | What it does |
|---------|--------------|--------------|
| `titles` | `Software Engineer, Backend Engineer` | Job titles to match |
| `skills` | `Python, TypeScript, AWS` | Key skills for scoring |
| `salary_floor` | `120000` | Minimum acceptable salary |
| `salary_target_min` | `140000` | Target salary range start |
| `salary_target_max` | `180000` | Target salary range end |
| `salary_stretch` | `200000` | Stretch salary |
| `min_score` | `60` | Minimum Claude score to surface |
| `locations` | `remote, us, usa` | Accepted locations |
| `target_companies` | `Stripe, Linear, Vercel` | Dream companies |
| `industry_target` | `saas, ai, fintech` | Industries to prefer |
| `industry_avoid` | `gambling, crypto` | Industries to avoid |
| `exclude_titles` | `Junior, Intern` | Title keywords to exclude |

### Job Tracker DB
Every matched job lands here. Columns:

| Column | Type | Purpose |
|--------|------|---------|
| Job Title | Title | Role name |
| Company | Text | Company name |
| Score | Number | Claude's 0-100 score |
| Salary | Text | Salary range |
| Salary Fit | Select | below_floor / at_floor / target / stretch |
| Source | Select | Where the job was found |
| Link | URL | Direct link to the posting |
| Applied | Checkbox | Check when you apply |
| Wrong Fit | Checkbox | Check to hide from future runs |
| Date Found | Date | When the agent found it |
| Date Applied | Date | When you applied |
| Status | Select | Found > Interested > Applied > Interviewing > Offer > Rejected |
| Relevant | Checkbox | Mark as good signal for future scoring |
| Not Relevant | Checkbox | Mark as noise to avoid in future |
| Notes | Text | Your notes |

**Notion > Agent triggers:**
- Set `Status = Interested` > job appears in Apply Queue in next daily summary
- Check `Relevant` or `Not Relevant` > Claude uses this to adjust scoring

### Control Panel DB *(optional)*

| Column | Type | Purpose |
|--------|------|---------|
| Agent Name | Title | "Job Search Agent" |
| Run Agent | Checkbox | Uncheck to pause all runs |
| Mode | Select | `daily` / `test` / `paused` |
| Last Run | Date | Auto-updated by agent |
| Last Run Stats | Text | Auto-updated run summary |

Set `NOTION_CONTROL_DB_ID` in your `.env` to enable.

---

## Daily summary structure

Each morning you get a new Notion page with:

- **Market Summary** — Claude's 2-3 sentence market intelligence for the day
- **Run Stats** — sources searched, jobs found, scored, duration
- **Feedback Insights** — what was learned from your Relevant/Not Relevant signals
- **Apply Queue** — jobs you flagged as Interested in Notion
- **Top Matches Today** — scored table with links
- **High Salary Fit** — subset matching your target/stretch salary range
- **Why These Were Chosen** — Claude's one-line reasoning per job
- **Already Applied** — matched jobs you've already applied to
- **Source Errors** — any sources that failed

---

## Configuration via `config.json`

If you prefer not to use the Notion Preferences DB, configure via `config.json` (gitignored):

```json
{
  "titles": ["Software Engineer", "Full Stack Engineer"],
  "titleKeywords": ["full stack", "backend", "node"],
  "excludeTitles": ["junior", "intern", "lead"],
  "salary": {
    "floor": 120000,
    "targetMin": 140000,
    "targetMax": 180000,
    "stretch": 200000
  },
  "remote": true,
  "locations": ["remote", "us", "usa", "united states"],
  "skills": ["TypeScript", "React", "Node.js", "PostgreSQL"],
  "targetCompanies": ["Stripe", "Linear", "Vercel"],
  "industryKeywords": {
    "target": ["saas", "fintech", "dev tools"],
    "avoid": ["gambling", "crypto"]
  },
  "minScore": 60,
  "greenhouse": { "Figma": "figma", "Stripe": "stripe" },
  "ashby": { "Linear": "linear", "Supabase": "supabase" },
  "lever": { "Notion": "notion", "Webflow": "webflow" }
}
```

See `config.example.json` for the full structure. Notion Preferences DB values always override `config.json`.

---

## Weekly report

For unemployment insurance or application tracking:

```bash
npm run weekly
```

Generates a formatted weekly page in Notion with all applied jobs, dates, and links.

---

## Manual Notion Setup

If you prefer to set up Notion manually instead of using `npm run seed`:

### Create a Notion integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **+ New integration**
3. Name it anything (e.g. "Job Search Agent")
4. Copy the token > `NOTION_TOKEN` in your `.env`

### Create the databases

**Daily Summaries** — plain empty page (not a database). Agent creates child pages under it.

**Job Tracker** — full-page table database with the columns listed above.

**Preferences DB** — table database with columns: `Setting` (Title), `Value` (Text), `Category` (Select), `Active` (Checkbox).

For each database: click **"..."** > **Connections** > connect your integration.

Copy each page/database ID from its URL into your `.env`.

---

## Adding a job source

1. Create `src/sources/mysource.ts` and export `fetchMySource(): Promise<Job[]>`
2. Import and add it to the `SOURCES` array in `src/index.ts`

Each source is isolated — one failure doesn't stop the others.

---

## Sources

The agent searches 14 sources. Sources that require API keys are skipped when keys are not set.

| Source | Type | Auth required |
|--------|------|---------------|
| Remotive | JSON API | No |
| RemoteOK | JSON API | No |
| We Work Remotely | RSS | No |
| Greenhouse | Public ATS API | No (configure companies in config.json) |
| Ashby | Public ATS API | No (configure companies in config.json) |
| Lever | Public ATS API | No (configure companies in config.json) |
| Built In | HTML scraping | No |
| HiringCafe | Search API | No |
| UX Engineer | HTML scraping | No |
| YC Work at a Startup | HTML scraping | No |
| Dribbble | HTML scraping | No |
| Talent.com | HTML scraping | No |
| Adzuna | REST API | Yes (free tier) |
| Dice | REST API | Yes |

**Sources that can't be automated:** LinkedIn, Indeed, and Welcome to the Jungle block automated requests from cloud servers (GitHub Actions runs on Azure IPs). Browse them manually:

- [LinkedIn Jobs](https://www.linkedin.com/jobs/)
- [Indeed](https://www.indeed.com/)
- [Welcome to the Jungle](https://www.welcometothejungle.com/)

---

## Stack

- **TypeScript / Node.js** (ESM, tsx for local dev)
- **Claude API** (`claude-sonnet-4-6`) — scoring, reasoning, market summaries
- **Notion API** (`@notionhq/client`) — bi-directional control layer
- **GitHub Actions** — scheduled daily cron, no server needed
- **Adzuna API** — optional free job data (register at [developer.adzuna.com](https://developer.adzuna.com))
- **Dice API** — optional job search (requires API key)
- **Greenhouse / Ashby / Lever** — public ATS APIs, no auth required
- **cheerio** — HTML scraping
- **fast-xml-parser** — RSS parsing

---

## Project structure

```
src/
|-- config/requirements.ts   # loads from Notion, config.json, or defaults
|-- notion/
|   |-- writer.ts            # writes daily summary + job tracker
|   |-- preferences.ts       # reads preferences from Notion
|   |-- control.ts           # reads control panel + feedback
|   |-- seed.ts              # creates Notion databases (npm run seed)
|   |-- weeklyReport.ts      # weekly applied jobs report
|-- matching/scorer.ts       # Claude scoring + market summary
|-- sources/                 # one file per job board (14 sources)
|-- utils/                   # deduplication and filtering
|-- index.ts                 # main orchestrator
```
