import Anthropic from "@anthropic-ai/sdk";
import type { Job, ScoredJob, Requirements, UserFeedback } from "../types.js";

const client = new Anthropic();

function buildRequirementsSummary(prefs: Requirements): string {
  return `
Target titles: ${prefs.titles.join(", ")}
Core skills: ${prefs.skills.join(", ")}
Salary floor: $${prefs.salary.floor.toLocaleString()}
Target salary: $${prefs.salary.targetMin.toLocaleString()}–$${prefs.salary.targetMax.toLocaleString()}
Work type: ${prefs.remote ? "Full remote" : "On-site or hybrid"}
Preferred locations: ${prefs.locations.join(", ")}
Industries: ${prefs.industryKeywords.target.join(", ")}
Avoid: ${prefs.industryKeywords.avoid.join(", ")}
`.trim();
}

function buildFeedbackContext(feedback: UserFeedback): string {
  if (feedback.relevant.length === 0 && feedback.notRelevant.length === 0) return "";
  const lines: string[] = [];
  if (feedback.relevant.length > 0) {
    lines.push(`Previously marked RELEVANT (good signals): ${feedback.relevant.slice(0, 5).join("; ")}`);
  }
  if (feedback.notRelevant.length > 0) {
    lines.push(`Previously marked NOT RELEVANT (noise to avoid): ${feedback.notRelevant.slice(0, 5).join("; ")}`);
  }
  return `\nUser feedback from past runs:\n${lines.join("\n")}`;
}

export async function scoreJob(
  job: Job,
  prefs: Requirements,
  feedback: UserFeedback = { relevant: [], notRelevant: [] }
): Promise<ScoredJob> {
  const reqSummary = buildRequirementsSummary(prefs);
  const feedbackCtx = buildFeedbackContext(feedback);

  const salaryLine = job.salary?.min
    ? `Salary: $${job.salary.min.toLocaleString()}–$${(job.salary.max ?? job.salary.min).toLocaleString()}`
    : "Salary: not listed";

  const prompt = `${reqSummary}${feedbackCtx}

Job posting:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
${salaryLine}
Description:
${job.description.slice(0, 2000)}

Score this job 0–100 for the candidate above. Return ONLY valid JSON, no other text:
{"score":<integer>,"reasoning":"<one sentence>","salaryFit":"<below_floor|at_floor|target|stretch|unknown>"}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 150,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "{}";

  let parsed: { score: number; reasoning: string; salaryFit: ScoredJob["salaryFit"] };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { score: 0, reasoning: "Failed to parse scorer response.", salaryFit: "unknown" };
  }

  return { ...job, ...parsed };
}

// Score all jobs in batches of 5 to respect rate limits, then sort best-first.
export async function scoreJobs(
  jobs: Job[],
  prefs: Requirements,
  feedback: UserFeedback = { relevant: [], notRelevant: [] }
): Promise<ScoredJob[]> {
  const BATCH = 5;
  const scored: ScoredJob[] = [];

  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH);
    const settled = await Promise.allSettled(batch.map((job) => scoreJob(job, prefs, feedback)));
    for (const result of settled) {
      if (result.status === "fulfilled") scored.push(result.value);
    }
  }

  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Generates a 2-3 sentence market intelligence summary from today's top matches.
 * Used as the opening callout in the daily Notion summary page.
 */
export async function generateMarketSummary(
  topJobs: ScoredJob[],
  prefs: Requirements
): Promise<string> {
  if (topJobs.length === 0) return "No top matches found today.";

  const jobList = topJobs
    .slice(0, 10)
    .map((j) => `${j.title} at ${j.company} (score ${j.score}, ${j.salaryFit})`)
    .join("\n");

  const prompt = `You are summarizing today's job market for someone searching for roles like ${prefs.titles.slice(0, 3).join(", ")}.

Today's top ${Math.min(topJobs.length, 10)} matches:
${jobList}

Write a 2-3 sentence market intelligence summary covering: what types of roles are trending today, salary signal, and one actionable insight. Be direct and specific — no filler phrases. Return plain text only.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    return message.content[0].type === "text" ? message.content[0].text.trim() : "";
  } catch {
    return "";
  }
}
