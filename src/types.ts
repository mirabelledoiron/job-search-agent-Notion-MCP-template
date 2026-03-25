export interface Requirements {
  titles: string[];
  excludeTitleExact: string[];
  salary: {
    floor: number;
    targetMin: number;
    targetMax: number;
    stretch: number;
  };
  remote: boolean;
  locations: string[];
  skills: string[];
  targetCompanies: string[];
  industryKeywords: {
    target: string[];
    avoid: string[];
  };
  minScore: number;
}

export interface AgentControl {
  shouldRun: boolean;
  mode: "daily" | "test" | "paused";
  lastRun?: string;
  pageId?: string;
}

export interface UserFeedback {
  relevant: string[];
  notRelevant: string[];
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  description: string;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  postedAt?: string;
  source: string;
  tags?: string[];
}

export interface ScoredJob extends Job {
  score: number;
  reasoning: string;
  salaryFit: "below_floor" | "at_floor" | "target" | "stretch" | "unknown";
}

export interface RunSummary {
  runAt: string;
  sourcesSearched: string[];
  totalFound: number;
  totalScored: number;
  topMatches: ScoredJob[];
  errors: { source: string; error: string }[];
  durationMs: number;
  marketSummary?: string;
  applyQueue?: string[];
  feedback?: UserFeedback;
  controlMode?: string;
  preferencesSource?: "notion" | "config" | "defaults";
}
