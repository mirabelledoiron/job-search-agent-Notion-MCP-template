import type { Job, Requirements } from "../types.js";

// Broad keyword list — catches adjacent titles without over-matching generic roles.
const TITLE_KEYWORDS = [
  "ux engineer",
  "design engineer",
  "design system",
  "design technologist",
  "ui engineer",
  "frontend design",
  "product design engineer",
  "design frontend",
  "interaction engineer",
  "creative engineer",
  "ui developer",
  "ux developer",
  "design developer",
  "interface engineer",
  "front-end design",
  "design infrastructure",
  "component engineer",
  "design platform",
  "full stack",
  "fullstack",
  "backend engineer",
  "software engineer",
  "frontend engineer",
];

// For Greenhouse jobs from curated companies, also allow broader frontend/design matches.
const TRUSTED_SOURCE_KEYWORDS = [
  ["frontend", "engineer"],
  ["front-end", "engineer"],
  ["design", "engineer"],
  ["full", "stack"],
  ["backend", "engineer"],
];

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

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

    if (DATE_FILTERED_SOURCES.has(job.source) && job.postedAt) {
      const posted = new Date(job.postedAt).getTime();
      if (!isNaN(posted) && now - posted > FOURTEEN_DAYS_MS) return false;
    }

    const titleMatch =
      prefs.titles.some((t) => titleLower.includes(t.toLowerCase())) ||
      TITLE_KEYWORDS.some((k) => titleLower.includes(k));

    const trustedMatch =
      job.source === "Greenhouse" &&
      TRUSTED_SOURCE_KEYWORDS.some(([a, b]) => titleLower.includes(a) && titleLower.includes(b));

    const excluded = prefs.excludeTitleExact.some((k) => titleLower === k.toLowerCase());

    const locationLower = (job.location ?? "").toLowerCase();
    const locationMatch =
      job.remote || prefs.locations.some((l) => locationLower.includes(l));

    return (titleMatch || trustedMatch) && !excluded && locationMatch;
  });
}
