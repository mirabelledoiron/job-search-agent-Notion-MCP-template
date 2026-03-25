import * as cheerio from "cheerio";
import type { Job } from "../types.js";

const SEARCH_URL = "https://builtin.com/jobs/remote/dev-engineering?experience=senior";

export async function fetchBuiltIn(): Promise<Job[]> {
  const res = await fetch(SEARCH_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Built In: HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const jobs: Job[] = [];

  $("[data-id], .job-card, article[class*='job']").each((_, el) => {
    const $el = $(el);
    const title = $el.find("[class*='title'], h2, h3").first().text().trim();
    const company = $el.find("[class*='company'], [class*='employer']").first().text().trim();
    const location = $el.find("[class*='location']").first().text().trim();
    const href = $el.find("a").first().attr("href") ?? "";
    const url = href.startsWith("http") ? href : `https://builtin.com${href}`;

    if (title && (company || url)) {
      jobs.push({
        id: `builtin-${url}`,
        title,
        company,
        location: location || "Remote",
        remote: location.toLowerCase().includes("remote") || !location,
        url,
        description: $el.text().slice(0, 1000),
        source: "Built In",
      });
    }
  });

  return jobs;
}
