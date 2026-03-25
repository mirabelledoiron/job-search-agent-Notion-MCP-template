/**
 * Fetches jobs from Ashby ATS for companies listed in config.json.
 *
 * In config.json, add an "ashby" object:
 *   "ashby": {
 *     "Notion": "notion",
 *     "Loom": "loom"
 *   }
 *
 * The value is the slug from jobs.ashbyhq.com/{slug}.
 * No API key required.
 */
import type { Job } from "../types.js";
import { loadAtsConfig } from "../config/requirements.js";

const BASE_URL = "https://api.ashbyhq.com/posting-api/job-board";

export async function fetchAshby(): Promise<Job[]> {
  const { ashby: companies } = loadAtsConfig();

  if (Object.keys(companies).length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    Object.entries(companies).map(([companyName, slug]) =>
      fetchCompany(companyName, slug as string)
    )
  );

  const jobs: Job[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") jobs.push(...r.value);
  }
  return jobs;
}

async function fetchCompany(companyName: string, slug: string): Promise<Job[]> {
  const url = `${BASE_URL}/${slug}?includeCompensation=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];

  const data = await res.json() as { jobs: any[] };
  return (data.jobs ?? []).map((j: any): Job => {
    const comp = j.compensation;
    return {
      id: `ashby-${j.id}`,
      title: j.title ?? "",
      company: companyName,
      location: j.location ?? "Remote",
      remote: (j.location ?? "").toLowerCase().includes("remote") || j.isRemote === true,
      url: j.jobUrl ?? `https://jobs.ashbyhq.com/${slug}/${j.id}`,
      description: (j.descriptionHtml ?? j.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 3000),
      salary:
        comp?.minValue
          ? { min: comp.minValue, max: comp.maxValue ?? comp.minValue, currency: comp.currency ?? "USD" }
          : undefined,
      postedAt: j.publishedDate ? new Date(j.publishedDate).toISOString() : undefined,
      source: "Ashby",
    };
  });
}
