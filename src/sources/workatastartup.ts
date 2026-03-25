// YC Work at a Startup — HTML scraper
// Job cards: .company-jobs > .jobs-list > div, job title in .job-name a
import * as cheerio from "cheerio";
import type { Job } from "../types.js";

const URLS = [
  "https://www.workatastartup.com/jobs?remote=true",
  "https://www.workatastartup.com/jobs/l/designer?remote=true",
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html",
  "Accept-Language": "en-US,en;q=0.9",
};

export async function fetchWorkAtAStartup(): Promise<Job[]> {
  const results: Job[] = [];
  const seen = new Set<string>();

  for (const pageUrl of URLS) {
    try {
      const response = await fetch(pageUrl, { headers: HEADERS });
      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);

      $(".company-jobs").each((_, companyBlock) => {
        const companyName = $(companyBlock)
          .find(".company-details a span.font-bold")
          .first()
          .text()
          .replace(/\([^)]*\)/g, "") // strip "(W16)" batch tags
          .trim();

        $(companyBlock)
          .find(".job-name a")
          .each((_, jobEl) => {
            const jobId = $(jobEl).attr("data-jobid") ?? $(jobEl).attr("href")?.split("/").pop();
            if (!jobId || seen.has(jobId)) return;
            seen.add(jobId);

            const title = $(jobEl).text().trim();
            const url = $(jobEl).attr("href") ?? pageUrl;
            if (!title) return;

            const detailsText = $(jobEl)
              .closest("div")
              .siblings(".job-details")
              .text()
              .toLowerCase();

            const isRemote =
              detailsText.includes("remote") || pageUrl.includes("remote=true");

            results.push({
              id: `yc-${jobId}`,
              title,
              company: companyName || "YC Startup",
              location: isRemote ? "Remote" : "Unknown",
              remote: isRemote,
              url: url.startsWith("http") ? url : `https://www.ycombinator.com${url}`,
              description: "",
              source: "YC Work at a Startup",
            });
          });
      });
    } catch {
      // skip on error
    }
  }

  return results;
}
