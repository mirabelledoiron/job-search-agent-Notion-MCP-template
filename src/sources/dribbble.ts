// Dribbble Jobs — HTML scraper.
// Each job card: li > a[href^="/jobs/"] > img, div (company), h4 (title), div (location)
import * as cheerio from "cheerio";
import type { Job } from "../types.js";

// Customize these search terms for your job search.
const SEARCH_TERMS = [
  "software engineer",
  "frontend engineer",
  "full stack developer",
];

const BASE = "https://dribbble.com";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

export async function fetchDribbble(): Promise<Job[]> {
  const results: Job[] = [];
  const seen = new Set<string>();

  for (const term of SEARCH_TERMS) {
    const pageUrl = `${BASE}/jobs?q=${encodeURIComponent(term)}&location=Anywhere&remote=true`;

    let response: Response;
    try {
      response = await fetch(pageUrl, { headers: HEADERS });
    } catch {
      continue;
    }

    if (!response.ok) continue;

    const html = await response.text();
    const $ = cheerio.load(html);

    $('li a[href^="/jobs/"]').each((_, el) => {
      const card = $(el);
      const href = card.attr("href")?.split("?")[0] ?? "";
      if (!href || seen.has(href)) return;
      seen.add(href);

      const title = card.find("h4").first().text().trim();
      if (!title) return;

      // div elements in order: company name, location
      const divs = card.find("div").map((_, d) => $(d).text().trim()).get().filter(Boolean);
      const company = divs[0] ?? "Unknown";
      const location = divs[1] ?? "Remote";

      const isRemote = location.toLowerCase().includes("remote") || location.toLowerCase() === "anywhere";
      const jobId = href.split("/jobs/")[1]?.split("-")[0] ?? href.slice(-8);

      results.push({
        id: `dribbble-${jobId}`,
        title,
        company,
        location,
        remote: isRemote,
        url: `${BASE}${href}`,
        description: "",
        source: "Dribbble",
      });
    });
  }

  return results;
}
