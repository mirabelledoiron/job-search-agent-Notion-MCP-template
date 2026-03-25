// Dice.com — uses their internal search API (same one the site frontend uses)
import type { Job } from "../types.js";

const DICE_API_KEY = process.env.DICE_API_KEY;

interface DiceJob {
  id: string;
  title: string;
  companyPageUrl: string;
  employerName: string;
  workplaceTypes: string[];
  employmentType: string;
  postedDate: string;
  applyUrl: string;
  location: string;
  salary?: {
    salaryMin?: number;
    salaryMax?: number;
    currency?: string;
  };
  jobDescription: string;
}

interface DiceResponse {
  data: DiceJob[];
}

// Customize these search terms for your job search.
const SEARCH_TERMS = ["software engineer", "full stack developer", "frontend engineer"];

export async function fetchDice(): Promise<Job[]> {
  if (!DICE_API_KEY) {
    console.log("[Dice] Skipping — DICE_API_KEY not set");
    return [];
  }

  const results: Job[] = [];
  const seen = new Set<string>();

  for (const term of SEARCH_TERMS) {
    const params = new URLSearchParams({
      q: term,
      countryCode2: "US",
      pageSize: "50",
      "filters.workplaceTypes": "Remote",
      "filters.postedDate": "ONE_WEEK",
      language: "en",
    });

    const url = `https://job-search-api.svc.dhigroupinc.com/v1/dice/jobs/search?${params}`;
    const response = await fetch(url, {
      headers: {
        "x-api-key": DICE_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) continue;

    const data = (await response.json()) as DiceResponse;

    for (const job of data.data ?? []) {
      if (seen.has(job.id)) continue;
      seen.add(job.id);

      const isRemote = job.workplaceTypes?.some((t) =>
        t.toLowerCase().includes("remote")
      );

      results.push({
        id: `dice-${job.id}`,
        title: job.title,
        company: job.employerName,
        location: job.location || "Remote",
        remote: isRemote ?? false,
        url: job.applyUrl || `https://www.dice.com/jobs/detail/${job.id}`,
        description: job.jobDescription ?? "",
        salary: job.salary?.salaryMin
          ? {
              min: job.salary.salaryMin,
              max: job.salary.salaryMax,
              currency: job.salary.currency ?? "USD",
            }
          : undefined,
        postedAt: job.postedDate,
        source: "Dice",
      });
    }
  }

  return results;
}
