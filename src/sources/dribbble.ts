import * as cheerio from "cheerio";
import type { Job } from "../types.js";

const URL = "https://dribbble.com/jobs?location=Anywhere&specialization=front-end-engineering";

export async function fetchDribbble(): Promise<Job[]> {
  const res = await fetch(URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; job-search-agent/1.0)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Dribbble: HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const jobs: Job[] = [];

  $(".job-listing, [class*='job-board'] li, .listing-item").each((_, el) => {
    const $el = $(el);
    const title = $el.find("h2, h3, [class*='title']").first().text().trim();
    const company = $el.find("[class*='company'], [class*='studio']").first().text().trim();
    const location = $el.find("[class*='location']").first().text().trim();
    const href = $el.find("a").attr("href") ?? "";
    const url = href.startsWith("http") ? href : `https://dribbble.com${href}`;

    if (title && url && url !== "https://dribbble.com") {
      jobs.push({
        id: `dribbble-${url}`,
        title,
        company,
        location: location || "Anywhere",
        remote: location.toLowerCase().includes("anywhere") || location.toLowerCase().includes("remote") || !location,
        url,
        description: $el.text().slice(0, 1000),
        source: "Dribbble",
      });
    }
  });

  return jobs;
}
