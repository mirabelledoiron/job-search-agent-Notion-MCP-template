import type { Job } from "../types.js";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  candidate_required_location: string;
  salary: string;
  description: string;
  tags: string[];
  publication_date: string;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
}

// Customize these search terms for your job search.
const SEARCH_TERMS = ["software engineer", "full stack developer", "frontend engineer"];

export async function fetchRemotive(): Promise<Job[]> {
  const results: Job[] = [];
  const seen = new Set<number>();

  for (const term of SEARCH_TERMS) {
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(term)}&limit=50`;
    const response = await fetch(url);
    if (!response.ok) continue;

    const data = (await response.json()) as RemotiveResponse;

    for (const job of data.jobs) {
      if (seen.has(job.id)) continue;
      seen.add(job.id);

      results.push({
        id: `remotive-${job.id}`,
        title: job.title,
        company: job.company_name,
        location: job.candidate_required_location || "Remote",
        remote: true,
        url: job.url,
        description: job.description,
        salary: parseSalary(job.salary),
        postedAt: job.publication_date,
        source: "Remotive",
        tags: job.tags,
      });
    }
  }

  return results;
}

function parseSalary(raw: string): Job["salary"] | undefined {
  if (!raw) return undefined;
  const numbers = raw.match(/\d[\d,]*/g);
  if (!numbers) return undefined;
  const parsed = numbers
    .map((n) => parseInt(n.replace(/,/g, ""), 10))
    .filter((n) => n > 10_000);
  if (parsed.length === 0) return undefined;
  return { min: parsed[0], max: parsed[1] ?? parsed[0], currency: "USD" };
}
