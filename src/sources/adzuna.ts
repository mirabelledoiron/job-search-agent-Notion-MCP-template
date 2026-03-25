// Adzuna — free tier (500 requests/month)
// Register at: https://developer.adzuna.com/
// Note: do NOT use where=remote — it returns 0 results. Filter remote in post-processing.
import type { Job } from "../types.js";

interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string; area?: string[] };
  redirect_url: string;
  description: string;
  salary_min?: number;
  salary_max?: number;
  created: string;
}

interface AdzunaResponse {
  results: AdzunaJob[];
}

// Customize these search terms for your job search.
const SEARCH_TERMS = ["software engineer", "full stack engineer", "frontend engineer"];

export async function fetchAdzuna(): Promise<Job[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    console.warn("[Adzuna] Skipping — ADZUNA_APP_ID or ADZUNA_APP_KEY not set");
    return [];
  }

  const results: Job[] = [];
  const seen = new Set<string>();

  for (const term of SEARCH_TERMS) {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      what: term,
      results_per_page: "50",
      sort_by: "date",
      "content-type": "application/json",
    });

    const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?${params}`;
    const response = await fetch(url);
    if (!response.ok) continue;

    const data = (await response.json()) as AdzunaResponse;

    for (const job of data.results ?? []) {
      if (seen.has(job.id)) continue;
      seen.add(job.id);

      const locationStr = job.location.display_name.toLowerCase();
      const isRemote =
        locationStr.includes("remote") ||
        job.title.toLowerCase().includes("remote") ||
        job.description.toLowerCase().includes("remote");

      results.push({
        id: `adzuna-${job.id}`,
        title: job.title,
        company: job.company.display_name,
        location: job.location.display_name,
        remote: isRemote,
        url: job.redirect_url,
        description: job.description,
        salary: job.salary_min
          ? { min: job.salary_min, max: job.salary_max, currency: "USD" }
          : undefined,
        postedAt: job.created,
        source: "Adzuna",
      });
    }
  }

  return results;
}
