import { XMLParser } from "fast-xml-parser";
import type { Job } from "../types.js";

const FEEDS = [
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-design-jobs.rss",
  "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
];

export async function fetchWeWorkRemotely(): Promise<Job[]> {
  const parser = new XMLParser({ ignoreAttributes: false });
  const results = await Promise.allSettled(
    FEEDS.map(async (url) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`WWR: HTTP ${res.status}`);
      const xml = await res.text();
      const data = parser.parse(xml);
      const items = data?.rss?.channel?.item ?? [];
      return Array.isArray(items) ? items : [items];
    })
  );

  const allItems: any[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") allItems.push(...r.value);
  }

  return allItems.map((item: any): Job => {
    const title = (item.title ?? "").replace(/^[^:]+:\s*/, "");
    const company = (item.title ?? "").split(":")[0]?.trim() ?? "";
    return {
      id: `wwr-${item.guid ?? item.link}`,
      title,
      company,
      location: "Remote",
      remote: true,
      url: item.link ?? "",
      description: (item.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 3000),
      postedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
      source: "We Work Remotely",
    };
  });
}
