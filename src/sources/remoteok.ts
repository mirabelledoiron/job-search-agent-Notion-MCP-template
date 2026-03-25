import type { Job } from "../types.js";

interface RemoteOKJob {
  id: string;
  url: string;
  position: string;
  company: string;
  location: string;
  description: string;
  tags: string[];
  salary_min?: number;
  salary_max?: number;
  date: string;
  slug: string;
}

export async function fetchRemoteOK(): Promise<Job[]> {
  const response = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "job-search-agent/1.0 (personal job search tool)" },
  });

  if (!response.ok) return [];

  const data = (await response.json()) as RemoteOKJob[];
  const jobs = data.slice(1).filter((job) => job.position);

  return jobs.map((job) => ({
    id: `remoteok-${job.id}`,
    title: job.position,
    company: job.company,
    location: job.location || "Remote",
    remote: true,
    url: job.url || `https://remoteok.com/remote-jobs/${job.slug}`,
    description: job.description || "",
    salary: job.salary_min
      ? { min: job.salary_min, max: job.salary_max, currency: "USD" }
      : undefined,
    postedAt: job.date,
    source: "RemoteOK",
    tags: job.tags,
  }));
}
