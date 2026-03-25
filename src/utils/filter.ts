import type { Job, Requirements } from "../types.js";

// Broad keyword list — catches adjacent titles without over-matching generic roles.
// Customize this list to match the kinds of roles you're looking for.
const TITLE_KEYWORDS = [
  "software engineer",
  "full stack",
  "fullstack",
  "frontend",
  "front-end",
  "backend",
  "back-end",
];

// For Greenhouse jobs (always from your curated target companies), also pass through
// broader title matches that Claude should evaluate.
const TRUSTED_SOURCE_KEYWORDS = [
  ["software", "engineer"],
  ["frontend", "engineer"],
  ["front-end", "engineer"],
  ["full", "stack"],
  ["backend", "engineer"],
];

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

// Sources that provide reliable postedAt dates.
const DATE_FILTERED_SOURCES = new Set([
  "Remotive",
  "RemoteOK",
  "Dice",
  "We Work Remotely",
  "Adzuna",
]);

export function filterByRequirements(jobs: Job[], prefs: Requirements): Job[] {
  const now = Date.now();

  return jobs.filter((job) => {
    const titleLower = job.title.toLowerCase();

    // Date filter: skip stale jobs from sources with reliable dates.
    if (DATE_FILTERED_SOURCES.has(job.source) && job.postedAt) {
      const posted = new Date(job.postedAt).getTime();
      if (!isNaN(posted) && now - posted > FOURTEEN_DAYS_MS) return false;
    }

    const titleMatch =
      prefs.titles.some((t) => titleLower.includes(t.toLowerCase())) ||
      TITLE_KEYWORDS.some((k) => titleLower.includes(k));

    // Pass-through for target company sources: broader title match.
    const trustedMatch =
      job.source === "Greenhouse" &&
      TRUSTED_SOURCE_KEYWORDS.some(([a, b]) => titleLower.includes(a) && titleLower.includes(b));

    const excluded = prefs.excludeTitleExact.some(
      (k) => titleLower === k.toLowerCase()
    );

    const locationLower = (job.location ?? "").toLowerCase();
    const locationMatch =
      job.remote ||
      prefs.locations.some((l) => locationLower.includes(l));

    return (titleMatch || trustedMatch) && !excluded && locationMatch;
  });
}
