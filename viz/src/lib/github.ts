import { execSync } from "node:child_process";

const API = "https://api.github.com";

let cachedToken: string | null = null;

export function token(): string {
  if (cachedToken) return cachedToken;
  if (process.env.GITHUB_TOKEN) {
    cachedToken = process.env.GITHUB_TOKEN.trim();
    return cachedToken;
  }
  try {
    cachedToken = execSync("gh auth token", { encoding: "utf8" }).trim();
    return cachedToken;
  } catch {
    throw new Error(
      "No GitHub token found. Set GITHUB_TOKEN or log in with `gh auth login`.",
    );
  }
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${token()}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET a REST endpoint. Returns { status, body }. Retries 202 responses,
// which the stats endpoints send while GitHub computes them in the background.
export async function rest(
  path: string,
  { retries202 = 0 }: { retries202?: number } = {},
): Promise<{ status: number; body: unknown }> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, { headers: headers() });
    if (res.status === 202 && attempt < retries202) {
      await sleep(3000);
      continue;
    }
    if (res.status === 403 || res.status === 429) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      throw new Error(
        `GitHub API ${res.status} on ${path} (x-ratelimit-remaining: ${remaining})`,
      );
    }
    if (res.status === 204) return { status: 204, body: null };
    const body = res.ok || res.status === 202 ? await res.json().catch(() => null) : null;
    if (!res.ok && res.status !== 202) {
      throw new Error(`GitHub API ${res.status} on ${path}`);
    }
    return { status: res.status, body };
  }
}

export async function graphql<T>(query: string): Promise<T> {
  const res = await fetch(`${API}/graphql`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  if (!json.data) throw new Error("GitHub GraphQL returned no data");
  return json.data;
}

// Run tasks with limited concurrency, preserving order of results.
export async function pooled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
