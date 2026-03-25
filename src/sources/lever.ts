import type { Job } from "../types.js";
import { loadAtsConfig } from "../config/requirements.js";

// Lever board slugs are loaded from config.json.
// To find a slug: visit jobs.lever.co/{slug} or check the company's careers page URL.
// Example config.json entry: "lever": { "Notion": "notion", "Webflow": "webflow" }

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  categories: {
    location?: string;
    team?: string;
    commitment?: string;
  };
  descriptionPlain: string;
  createdAt: number;
}

export async function fetchLever(): Promise<Job[]> {
  const { lever: companySlugs } = loadAtsConfig();

  if (Object.keys(companySlugs).length === 0) {
    return [];
  }

  const results: Job[] = [];

  await Promise.allSettled(
    Object.entries(companySlugs).map(async ([company, slug]) => {
      const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
      const response = await fetch(url);
      if (!response.ok) return;

      const data = (await response.json()) as LeverPosting[];

      for (const posting of data) {
        const location = posting.categories?.location ?? "Remote";
        const commitment = posting.categories?.commitment?.toLowerCase() ?? "";
        const isRemote =
          location.toLowerCase().includes("remote") ||
          commitment.includes("remote");

        results.push({
          id: `lever-${posting.id}`,
          title: posting.text,
          company,
          location,
          remote: isRemote,
          url: posting.hostedUrl,
          description: posting.descriptionPlain ?? "",
          postedAt: new Date(posting.createdAt).toISOString(),
          source: "Lever",
        });
      }
    })
  );

  return results;
}
