// Built In — server-rendered HTML scraper.
// Job cards use data-id attributes; attribute metadata (work type, location, salary)
// lives in .bounded-attribute-section spans in a consistent order.
import * as cheerio from "cheerio";
import type { Job } from "../types.js";

const URLS = [
  "https://builtin.com/jobs/dev-engineering",
  "https://builtin.com/jobs/design-ux",
  "https://builtin.com/jobs/remote",
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

// Span order inside .bounded-attribute-section (after skipping timing/saved noise):
// [0] work type: "Remote" | "Hybrid" | "In-Office"
// [1] location:  "Chicago, IL, USA" | "6 Locations"
// [2] salary:    "110K-130K Annually"
// [3] level:     "Senior level"
const SKIP_PATTERNS = /^(saved|reposted|posted|days? ago|\d+ days?)/i;

export async function fetchBuiltIn(): Promise<Job[]> {
  const results: Job[] = [];
  const seen = new Set<string>();

  for (const pageUrl of URLS) {
    try {
      const response = await fetch(pageUrl, { headers: HEADERS });
      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);

      $('[data-id="job-card"]').each((_, card) => {
        const id = $(card)
          .find("[data-builtin-track-job-id]")
          .first()
          .attr("data-builtin-track-job-id");
        if (!id || seen.has(id)) return;
        seen.add(id);

        const titleEl = $(card).find('[data-id="job-card-title"]');
        const title = titleEl.text().trim();
        const company = $(card).find('[data-id="company-title"]').text().trim();
        if (!title || !company) return;

        const href = titleEl.attr("href") ?? "";
        const url = href ? `https://builtin.com${href}` : pageUrl;

        const attrs = $(card)
          .find(".bounded-attribute-section span")
          .map((_, el) => $(el).text().trim())
          .get()
          .filter((t) => t.length > 1 && !SKIP_PATTERNS.test(t));

        const workType = attrs[0] ?? "";
        const location = attrs[1] ?? "";
        const salaryRaw = attrs[2] ?? "";
        const isRemote = workType.toLowerCase() === "remote";

        results.push({
          id: `builtin-${id}`,
          title,
          company,
          location: location || workType || "Unknown",
          remote: isRemote,
          url,
          description: "",
          salary: parseSalary(salaryRaw),
          source: "Built In",
        });
      });
    } catch {
      // skip this URL on error
    }
  }

  return results;
}

function parseSalary(raw: string): Job["salary"] | undefined {
  // "110K-130K Annually" or "110,000-130,000"
  const numbers = raw.match(/[\d,]+k?/gi);
  if (!numbers || numbers.length < 1) return undefined;
  const parse = (s: string) => {
    const n = parseFloat(s.replace(/,/g, ""));
    return s.toLowerCase().includes("k") ? n * 1000 : n;
  };
  const min = parse(numbers[0]);
  const max = numbers[1] ? parse(numbers[1]) : min;
  if (min < 10_000) return undefined;
  return { min, max, currency: "USD" };
}
