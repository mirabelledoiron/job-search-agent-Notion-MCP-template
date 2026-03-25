import { XMLParser } from "fast-xml-parser";
import type { Job } from "../types.js";

const RSS_FEEDS = [
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-design-jobs.rss",
];

interface RSSItem {
  title: string;
  link: string | string[];
  "company-name"?: string;
  region?: string;
  description?: string;
  pubDate?: string;
}

interface RSSChannel {
  item: RSSItem | RSSItem[];
}

interface RSSRoot {
  rss: { channel: RSSChannel };
}

export async function fetchWeWorkRemotely(): Promise<Job[]> {
  const parser = new XMLParser({ ignoreAttributes: false });
  const results: Job[] = [];

  for (const feedUrl of RSS_FEEDS) {
    const response = await fetch(feedUrl);
    if (!response.ok) continue;

    const xml = await response.text();
    const parsed = parser.parse(xml) as RSSRoot;
    const rawItems = parsed?.rss?.channel?.item;
    const items: RSSItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

    for (const item of items) {
      // WWR title format: "Company Name: Job Title"
      const parts = item.title?.split(": ") ?? [];
      const company = item["company-name"] ?? parts[0] ?? "Unknown";
      const title = parts.slice(1).join(": ") || item.title || "";

      results.push({
        id: `wwr-${Buffer.from(item.title ?? "").toString("base64").slice(0, 16)}`,
        title,
        company,
        location: item.region || "Worldwide",
        remote: true,
        url: extractLink(item.link),
        description: item.description ?? "",
        postedAt: item.pubDate,
        source: "We Work Remotely",
      });
    }
  }

  return results;
}

function extractLink(link: string | string[] | undefined): string {
  if (Array.isArray(link)) return link[0] ?? "";
  return link ?? "";
}
