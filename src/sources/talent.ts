// Talent.com — HTML scraper.
// Each job card is an <a href="/view?id=..."> containing h3 (title) and spans (company, location).
import * as cheerio from "cheerio";
import type { Job } from "../types.js";

// Customize these search terms for your job search.
const SEARCH_TERMS = [
  "software engineer",
  "full stack developer",
  "frontend engineer",
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

export async function fetchTalent(): Promise<Job[]> {
  const results: Job[] = [];
  const seen = new Set<string>();

  for (const term of SEARCH_TERMS) {
    const pageUrl = `https://www.talent.com/jobs?k=${encodeURIComponent(term)}&l=remote`;

    let response: Response;
    try {
      response = await fetch(pageUrl, { headers: HEADERS });
    } catch {
      continue;
    }

    if (!response.ok) continue;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Each job card is an anchor tag with /view?id= in the href
    $('a[href*="/view?id="]').each((_, el) => {
      const card = $(el);
      const href = card.attr("href") ?? "";
      if (!href || seen.has(href)) return;

      // Skip pagination/nav links that don't contain a job title
      const title = card.find("h3").first().text().trim();
      if (!title) return;

      seen.add(href);

      const spans = card.find("span").map((_, s) => $(s).text().trim()).get().filter(Boolean);
      // Span order: company, location, job type, date
      const company = spans[0] ?? "Unknown";
      const location = spans[1] ?? "Remote";

      const isRemote =
        location.toLowerCase().includes("remote") ||
        location.toLowerCase() === "us" ||
        location.toLowerCase() === "united states";

      const fullUrl = href.startsWith("http") ? href : `https://www.talent.com${href}`;
      const id = new URL(fullUrl).searchParams.get("id") ?? href.slice(-12);

      results.push({
        id: `talent-${id}`,
        title,
        company,
        location,
        remote: isRemote,
        url: fullUrl,
        description: "",
        source: "Talent.com",
      });
    });
  }

  return results;
}
