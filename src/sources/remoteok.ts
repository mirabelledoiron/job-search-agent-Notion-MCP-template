import type { Job } from "../types.js";

const API_URL = "https://remoteok.io/api";

export async function fetchRemoteOK(): Promise<Job[]> {
  const res = await fetch(API_URL, {
    headers: { "User-Agent": "job-search-agent/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`RemoteOK: HTTP ${res.status}`);

  const data = await res.json() as any[];
  // First item is a legal notice object — skip it
  const jobs = data.slice(1).filter((j: any) => j.position && j.company);

  return jobs.map((j: any): Job => ({
    id: `remoteok-${j.id ?? j.slug}`,
    title: j.position ?? "",
    company: j.company ?? "",
    location: "Remote",
    remote: true,
    url: j.url ?? `https://remoteok.io/l/${j.slug}`,
    description: (j.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 3000),
    salary: j.salary_min ? { min: Number(j.salary_min), max: Number(j.salary_max ?? j.salary_min) } : undefined,
    postedAt: j.date ? new Date(j.date * 1000).toISOString() : undefined,
    source: "RemoteOK",
    tags: Array.isArray(j.tags) ? j.tags : [],
  }));
}
