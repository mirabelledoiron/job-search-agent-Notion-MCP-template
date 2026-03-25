import type { Job } from "../types.js";

const DICE_API_KEY = process.env.DICE_API_KEY;
const SEARCH_TERMS = ["software engineer", "full stack developer", "frontend engineer"];

export async function fetchDice(): Promise<Job[]> {
  if (!DICE_API_KEY) {
    console.log("[Dice] Skipping — DICE_API_KEY not set");
    return [];
  }

  const results = await Promise.allSettled(
    SEARCH_TERMS.map((term) => fetchTerm(term))
  );

  const jobs: Job[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const job of r.value) {
        if (!seen.has(job.id)) {
          seen.add(job.id);
          jobs.push(job);
        }
      }
    }
  }
  return jobs;
}

async function fetchTerm(query: string): Promise<Job[]> {
  const params = new URLSearchParams({
    q: query,
    countryCode: "US",
    radius: "30",
    radiusUnit: "mi",
    page: "1",
    pageSize: "20",
    filters.postedDate: "ONE_WEEK",
    filters.workplaceTypes: "Remote",
    language: "en",
    eid: "search",
  });

  const url = `https://job-search-api.svc.dhigroupinc.com/v1/dice/jobs/search?${params}`;
  const res = await fetch(url, {
    headers: {
      "x-api-key": DICE_API_KEY!,
      "User-Agent": "Mozilla/5.0",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Dice: HTTP ${res.status}`);

  const data = await res.json() as { data: any[] };

  return (data.data ?? []).map((j: any): Job => {
    const salary = parseSalary(j.salary);
    return {
      id: `dice-${j.id}`,
      title: j.title ?? "",
      company: j.companyPageUrl ? j.companyPageUrl.split("/").pop() ?? "" : (j.advertiserName ?? ""),
      location: j.location ?? "Remote",
      remote: (j.workplaceTypes ?? []).includes("Remote") || (j.location ?? "").toLowerCase().includes("remote"),
      url: j.applyDataRequired ? `https://www.dice.com/job-detail/${j.id}` : (j.applyUrl ?? `https://www.dice.com/job-detail/${j.id}`),
      description: (j.descriptionFragment ?? j.summary ?? "").slice(0, 3000),
      salary,
      postedAt: j.postedDate ? new Date(j.postedDate).toISOString() : undefined,
      source: "Dice",
    };
  });
}

function parseSalary(raw: string | undefined): Job["salary"] {
  if (!raw) return undefined;
  const nums = raw.replace(/[$,K]/gi, (m) => m === "K" ? "000" : "").match(/\d+/g);
  if (!nums) return undefined;
  return { min: parseInt(nums[0], 10), max: parseInt(nums[1] ?? nums[0], 10) };
}
