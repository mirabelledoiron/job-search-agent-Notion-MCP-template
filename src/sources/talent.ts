import * as cheerio from "cheerio";
import type { Job } from "../types.js";

const URL = "https://www.talent.com/jobs?k=software+engineer&l=remote&radius=100";

export async function fetchTalent(): Promise<Job[]> {
  const res = await fetch(URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "text/html",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Talent.com: HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const jobs: Job[] = [];

  $(".card__job, [class*='card'][class*='job'], .js_jobs_collection .c-card").each((_, el) => {
    const $el = $(el);
    const title = $el.find("[class*='title'], h2, h3").first().text().trim();
    const company = $el.find("[class*='company'], [class*='employer']").first().text().trim();
    const location = $el.find("[class*='location']").first().text().trim();
    const href = $el.find("a").attr("href") ?? "";
    const url = href.startsWith("http") ? href : `https://www.talent.com${href}`;
    const salaryText = $el.find("[class*='salary']").first().text().trim();
    const salary = parseSalary(salaryText);

    if (title && url && url !== "https://www.talent.com") {
      jobs.push({
        id: `talent-${url}`,
        title,
        company,
        location: location || "Remote",
        remote: location.toLowerCase().includes("remote") || !location,
        url,
        description: $el.text().slice(0, 1000),
        salary,
        source: "Talent.com",
      });
    }
  });

  return jobs;
}

function parseSalary(text: string): Job["salary"] {
  if (!text) return undefined;
  const nums = text.replace(/[$,K]/gi, (m) => m.toUpperCase() === "K" ? "000" : "").match(/\d+/g);
  if (!nums) return undefined;
  return { min: parseInt(nums[0], 10), max: parseInt(nums[1] ?? nums[0], 10) };
}
