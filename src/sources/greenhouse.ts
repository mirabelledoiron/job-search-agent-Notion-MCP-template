import type { Job } from "../types.js";
import { loadAtsConfig } from "../config/requirements.js";

// Company slugs are loaded from config.json.
// To find a slug: visit boards.greenhouse.io/{slug} or check the company's careers page URL.
// Example config.json entry: "greenhouse": { "Figma": "figma", "Stripe": "stripe" }

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location: { name: string };
  content: string;
  updated_at: string;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

export async function fetchGreenhouse(): Promise<Job[]> {
  const { greenhouse: companySlugs } = loadAtsConfig();

  if (Object.keys(companySlugs).length === 0) {
    return [];
  }

  const results: Job[] = [];

  await Promise.allSettled(
    Object.entries(companySlugs).map(async ([company, slug]) => {
      const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
      const response = await fetch(url);
      if (!response.ok) return;

      const data = (await response.json()) as GreenhouseResponse;

      for (const job of data.jobs) {
        const locationLower = job.location.name.toLowerCase();
        const isRemote =
          locationLower.includes("remote") || locationLower.includes("anywhere");

        results.push({
          id: `greenhouse-${job.id}`,
          title: job.title,
          company,
          location: job.location.name,
          remote: isRemote,
          url: job.absolute_url,
          description: job.content ?? "",
          postedAt: job.updated_at,
          source: "Greenhouse",
        });
      }
    })
  );

  return results;
}
