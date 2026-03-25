import { XMLParser } from "fast-xml-parser";
import type { Job } from "../types.js";

const FEED_URL = "https://remotive.com/remote-jobs/feed";

export async function fetchRemotive(): Promise<Job[]> {
  const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Remotive: HTTP ${res.status}`);

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(xml);

  const items = data?.rss?.channel?.item ?? [];
  const arr = Array.isArray(items) ? items : [items];

  return arr.map((item: any): Job => ({
    id: `remotive-${item.guid ?? item.link}`,
    title: item.title ?? "",
    company: item["job:company_name"] ?? item.author ?? "",
    location: item["job:job_type"] === "full_time" ? "Remote" : (item["job:candidate_required_location"] ?? "Remote"),
    remote: true,
    url: item.link ?? "",
    description: (item.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 3000),
    postedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
    source: "Remotive",
    tags: [],
  }));
}
