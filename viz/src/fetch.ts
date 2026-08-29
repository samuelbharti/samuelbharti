// Fetches all portfolio data from GitHub and caches it to data/portfolio.json.
// This is the only script that touches the network; render.ts reads the cache.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { categoryOf, EXCLUDE } from "./categories.js";
import { graphql, pooled, rest } from "./lib/github.js";
import type { DayCount, Portfolio, RepoDatum } from "./types.js";

const USER = "samuelbharti";
const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, "..", "data", "portfolio.json");

interface RestRepo {
  name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  created_at: string;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
  language: string | null;
}

async function fetchCalendar(): Promise<DayCount[]> {
  const data = await graphql<{
    user: {
      contributionsCollection: {
        contributionCalendar: {
          weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
        };
      };
    };
  }>(`{
    user(login: "${USER}") {
      contributionsCollection {
        contributionCalendar {
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }`);
  return data.user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount }));
}

function normalizeWeekly(body: unknown): number[] {
  if (!Array.isArray(body)) return new Array(52).fill(0);
  const weeks = body as { total?: number }[];
  const out = weeks.map((w) => w.total ?? 0);
  while (out.length < 52) out.unshift(0);
  return out.slice(-52);
}

async function main() {
  console.log(`Fetching repos for ${USER}...`);
  const { body } = await rest(`/users/${USER}/repos?per_page=100&sort=pushed`);
  const all = body as RestRepo[];
  console.log(`  ${all.length} repos`);

  const kept = all.filter((r) => !EXCLUDE.has(r.name));

  console.log("Fetching languages and commit activity...");
  const repos: RepoDatum[] = await pooled(kept, 4, async (r) => {
    const langRes = await rest(`/repos/${USER}/${r.name}/languages`);
    const statsRes = await rest(`/repos/${USER}/${r.name}/stats/commit_activity`, {
      retries202: 5,
    });
    return {
      name: r.name,
      description: r.description,
      stars: r.stargazers_count,
      forks: r.forks_count,
      createdAt: r.created_at,
      pushedAt: r.pushed_at,
      isFork: r.fork,
      archived: r.archived,
      primaryLanguage: r.language,
      languages: (langRes.body ?? {}) as Record<string, number>,
      weeklyCommits: normalizeWeekly(statsRes.body),
      category: categoryOf(r.name),
    };
  });

  console.log("Fetching contribution calendar...");
  const calendar = await fetchCalendar();

  const portfolio: Portfolio = {
    fetchedAt: new Date().toISOString(),
    user: USER,
    calendar,
    repos,
  };

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(portfolio, null, 2));
  console.log(`Wrote ${outFile}`);

  const unmapped = repos.filter((r) => r.category === "misc" && !r.isFork);
  if (unmapped.length) {
    console.error(
      `Unmapped repos (add to categories.ts or EXCLUDE): ${unmapped
        .map((r) => r.name)
        .join(", ")}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
