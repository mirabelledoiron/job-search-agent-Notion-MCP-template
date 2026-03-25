import type { Job } from "../types.js";

export function deduplicateJobs(jobs: Job[]): Job[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
