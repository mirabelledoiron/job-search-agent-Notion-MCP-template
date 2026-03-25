// UX Engineer job board — https://uxengineer.com/jobs/
import * as cheerio from "cheerio";
import type { Job } from "../types.js";

export async function fetchUXEngineer(): Promise<Job[]> {
  const response = await fetch("https://uxengineer.com/jobs/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
  });

  if (!response.ok) return [];

  const html = await response.text();
  const $ = cheerio.load(html);
  const results: Job[] = [];

  $(".job-listing, .job_listing, article.job").each((i, el) => {
    const title = $(el).find(".job-title, h2, h3").first().text().trim();
    const company = $(el).find(".company, .company-name").first().text().trim();
    const location = $(el).find(".location, .job-location").first().text().trim();
    const href = $(el).find("a").first().attr("href");

    if (!title) return;

    results.push({
      id: `uxengineer-${i}`,
      title,
      company: company || "Unknown",
      location: location || "Remote",
      remote: true,
      url: href || "https://uxengineer.com/jobs/",
      description: "",
      source: "UX Engineer",
    });
  });

  return results;
}
