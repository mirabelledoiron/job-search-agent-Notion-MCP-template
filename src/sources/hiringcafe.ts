// HiringCafe — https://hiring.cafe/
// Uses a GraphQL API. This fetches via their public search endpoint.
import type { Job } from "../types.js";

interface HiringCafeJob {
  _id: string;
  title: string;
  company_name: string;
  location: string;
  is_remote: boolean;
  apply_url: string;
  description: string;
  salary_range?: { min?: number; max?: number };
  posted_at: string;
}

interface HiringCafeResponse {
  jobs: HiringCafeJob[];
}

// Customize these search terms for your job search.
const SEARCH_TERMS = ["software engineer", "full stack developer", "frontend engineer"];

export async function fetchHiringCafe(): Promise<Job[]> {
  const results: Job[] = [];
  const seen = new Set<string>();

  for (const term of SEARCH_TERMS) {
    const response = await fetch("https://hiring.cafe/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: term,
        remote: true,
        country: "US",
        limit: 50,
      }),
    });

    if (!response.ok) continue;

    const data = (await response.json()) as HiringCafeResponse;

    for (const job of data.jobs ?? []) {
      if (seen.has(job._id)) continue;
      seen.add(job._id);

      results.push({
        id: `hiringcafe-${job._id}`,
        title: job.title,
        company: job.company_name,
        location: job.location || "Remote",
        remote: job.is_remote,
        url: job.apply_url,
        description: job.description ?? "",
        salary: job.salary_range?.min
          ? { min: job.salary_range.min, max: job.salary_range.max, currency: "USD" }
          : undefined,
        postedAt: job.posted_at,
        source: "HiringCafe",
      });
    }
  }

  return results;
}
