import * as cheerio from "cheerio";
import type { Job } from "../types.js";

const URL = "https://www.workatastartup.com/jobs?remote=true&role=eng";

export async function fetchWorkAtAStartup(): Promise<Job[]> {
  const res = await fetch(URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; job-search-agent/1.0)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`YC Work at a Startup: HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const jobs: Job[] = [];

  $(".job").each((_, el) => {
    const $el = $(el);
    const title = $el.find(".title, .job-name, h2").first().text().trim();
    const company = $el.find(".company-name, .name").first().text().trim();
    const href = $el.find("a").first().attr("href") ?? "";
    const url = href.startsWith("http") ? href : `https://www.workatastartup.com${href}`;
    const location = $el.find(".job-location, .location").first().text().trim();

    if (title && url) {
      jobs.push({
        id: `watas-${url}`,
        title,
        company,
        location: location || "Remote",
        remote: true,
        url,
        description: $el.text().slice(0, 1000),
        source: "YC Work at a Startup",
      });
    }
  });

  return jobs;
}
