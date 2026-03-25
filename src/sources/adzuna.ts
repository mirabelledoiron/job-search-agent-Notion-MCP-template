/**
 * Fetches jobs from the Adzuna API.
 * Get a free API key at developer.adzuna.com
 * Set ADZUNA_APP_ID and ADZUNA_APP_KEY in your .env
 */
import type { Job } from "../types.js";

const APP_ID = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;

const SEARCH_TERMS = ["software engineer remote", "full stack engineer remote", "frontend engineer remote"];

export async function fetchAdzuna(): Promise<Job[]> {
  if (!APP_ID || !APP_KEY) {
    console.log("[Adzuna] Skipping — ADZUNA_APP_ID or ADZUNA_APP_KEY not set");
    return [];
  }

  const results = await Promise.allSettled(
    SEARCH_TERMS.map((term) => fetchTerm(term))
  );

  const jobs: Job[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") jobs.push(...r.value);
  }
  return jobs;
}

async function fetchTerm(term: string): Promise<Job[]> {
  const params = new URLSearchParams({
    app_id: APP_ID!,
    app_key: APP_KEY!,
    results_per_page: "20",
    what: term,
    where: "us",
    content_type: "application/json",
    salary_min: "80000",
    sort_by: "date",
  });

  const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Adzuna: HTTP ${res.status}`);

  const data = await res.json() as { results: any[] };

  return (data.results ?? []).map((j: any): Job => ({
    id: `adzuna-${j.id}`,
    title: j.title ?? "",
    company: j.company?.display_name ?? "",
    location: j.location?.display_name ?? "",
    remote: (j.title ?? "").toLowerCase().includes("remote") || (j.description ?? "").toLowerCase().includes("remote"),
    url: j.redirect_url ?? "",
    description: (j.description ?? "").slice(0, 3000),
    salary:
      j.salary_min
        ? { min: Math.round(j.salary_min), max: Math.round(j.salary_max ?? j.salary_min) }
        : undefined,
    postedAt: j.created ? new Date(j.created).toISOString() : undefined,
    source: "Adzuna",
  }));
}
