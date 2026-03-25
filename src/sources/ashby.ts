// Ashby ATS — public job board API
// These companies are on Ashby. Returns 0 when they have no open roles,
// activates automatically when they start hiring.
// Company slugs are loaded from config.json.
import type { Job } from "../types.js";
import { loadAtsConfig } from "../config/requirements.js";

interface AshbyPosting {
  id: string;
  title: string;
  publishedAt: string;
  isRemote: boolean;
  workplaceType: string;
  location?: string;
  address?: { city?: string; region?: string; countryCode?: string };
  secondaryLocations?: { isRemote?: boolean }[];
  jobUrl: string;
  applyUrl: string;
  descriptionPlain: string;
  compensation?: {
    summaryComponents?: { label: string; compensationTierSummary: string }[];
  };
}

interface AshbyResponse {
  jobPostings: AshbyPosting[];
}

export async function fetchAshby(): Promise<Job[]> {
  const { ashby: companySlugs } = loadAtsConfig();

  if (Object.keys(companySlugs).length === 0) {
    return [];
  }

  const results: Job[] = [];

  await Promise.allSettled(
    Object.entries(companySlugs).map(async ([company, slug]) => {
      const res = await fetch(
        `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`
      );
      if (!res.ok) return;

      const text = await res.text();
      if (!text.startsWith("{")) return;

      const data = JSON.parse(text) as AshbyResponse;

      for (const posting of data.jobPostings ?? []) {
        const isRemote =
          posting.isRemote ||
          posting.workplaceType?.toLowerCase() === "remote" ||
          posting.secondaryLocations?.some((l) => l.isRemote) ||
          false;

        const location =
          posting.address?.city
            ? `${posting.address.city}, ${posting.address.region ?? ""}`.trim()
            : isRemote
            ? "Remote"
            : "Unknown";

        const salary = parseSalary(posting.compensation);

        results.push({
          id: `ashby-${posting.id}`,
          title: posting.title,
          company,
          location,
          remote: isRemote,
          url: posting.jobUrl ?? posting.applyUrl,
          description: posting.descriptionPlain ?? "",
          salary,
          postedAt: posting.publishedAt,
          source: "Ashby",
        });
      }
    })
  );

  return results;
}

function parseSalary(
  comp: AshbyPosting["compensation"]
): Job["salary"] | undefined {
  const summary = comp?.summaryComponents?.[0]?.compensationTierSummary ?? "";
  const numbers = summary.match(/[\d,]+/g);
  if (!numbers) return undefined;
  const vals = numbers.map((n) => parseInt(n.replace(/,/g, ""), 10)).filter((n) => n > 10_000);
  if (vals.length === 0) return undefined;
  return { min: vals[0], max: vals[1] ?? vals[0], currency: "USD" };
}
