/**
 * Fetches jobs from Greenhouse ATS for companies listed in config.json.
 *
 * In config.json, add a "greenhouse" object:
 *   "greenhouse": {
 *     "Figma": "figma",
 *     "Linear": "linear",
 *     "Vercel": "vercel"
 *   }
 *
 * The value is the slug from boards.greenhouse.io/{slug}.
 * No API key required — this is the public Greenhouse job board API.
 */
import type { Job } from "../types.js";
import { loadAtsConfig } from "../config/requirements.js";

const BASE_URL = "https://boards-api.greenhouse.io/v1/boards";

export async function fetchGreenhouse(): Promise<Job[]> {
  const { greenhouse: companies } = loadAtsConfig();

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
  const url = `${BASE_URL}/${slug}/jobs?content=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];

  const data = await res.json() as { jobs: any[] };
  return (data.jobs ?? []).map((j: any): Job => ({
    id: `greenhouse-${j.id}`,
    title: j.title ?? "",
    company: companyName,
    location: j.location?.name ?? "Remote",
    remote: (j.location?.name ?? "").toLowerCase().includes("remote"),
    url: j.absolute_url ?? "",
    description: (j.content ?? "").replace(/<[^>]+>/g, " ").slice(0, 3000),
    postedAt: j.updated_at ? new Date(j.updated_at).toISOString() : undefined,
    source: "Greenhouse",
  }));
}
