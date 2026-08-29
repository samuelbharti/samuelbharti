import type { Portfolio, RepoDatum, Theme } from "../types.js";
import { CATEGORY_ORDER, tierOf, visible } from "../categories.js";
import { band, hash01, linear, sqrtScale } from "../lib/scales.js";
import { document, el, line, monoWidth, round } from "../lib/svg.js";

const W = 880;
const H = 460;
const M = { top: 64, right: 24, bottom: 52, left: 64 };

function score(r: RepoDatum): number {
  const commits = r.weeklyCommits.reduce((a, b) => a + b, 0);
  // The spotlight tier is the editorial term: flagship projects rank above
  // the threshold even in a quiet stretch
  return (
    1.4 * (tierOf(r.name) - 1) +
    Math.log2(1 + commits) +
    0.5 * Math.log2(1 + r.stars)
  );
}

function bytesOf(r: RepoDatum): number {
  return Object.values(r.languages).reduce((a, b) => a + b, 0);
}

export function renderVolcano(data: Portfolio, theme: Theme): string {
  const repos = data.repos.filter(
    (r) => visible(r),
  );
  const cats: string[] = CATEGORY_ORDER.filter((c) =>
    repos.some((r) => r.category === c),
  );

  const plotX: [number, number] = [M.left, W - M.right];
  const plotY: [number, number] = [M.top, H - M.bottom];
  const xBand = band(cats.length, plotX, 0.06);

  const scores = repos.map(score);
  const maxScore = Math.max(...scores, 1);
  const y = linear([0, maxScore * 1.12], [plotY[1], plotY[0]]);

  const maxBytes = Math.max(...repos.map(bytesOf), 1);
  const rScale = sqrtScale([0, maxBytes], [3.5, 9]);

  const nonzero = scores.filter((s) => s > 0).sort((a, b) => a - b);
  const threshold = nonzero.length
    ? nonzero[Math.floor(nonzero.length * 0.75)]
    : 0;

  const parts: string[] = [];

  // Category striping, alternate bands like Manhattan chromosomes
  cats.forEach((c, i) => {
    if (i % 2 === 0) return;
    parts.push(
      el("rect", {
        x: round(xBand.start(i) - xBand.step * 0.06),
        y: plotY[0] - 8,
        width: round(xBand.step),
        height: plotY[1] - plotY[0] + 8,
        fill: theme.grid,
        opacity: theme.name === "light" ? 0.45 : 0.35,
      }),
    );
  });

  // Gridlines
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = (maxScore * 1.12 * i) / ticks;
    const yy = y(v);
    parts.push(
      line(plotX[0], yy, plotX[1], yy, {
        stroke: theme.grid,
        "stroke-width": 1,
      }),
      el(
        "text",
        { x: plotX[0] - 8, y: yy + 3.5, "font-size": 10, "text-anchor": "end", class: "faint" },
        v.toFixed(1),
      ),
    );
  }

  // Threshold line
  const ty = y(threshold);
  parts.push(
    line(plotX[0], ty, plotX[1], ty, {
      stroke: theme.accents.pink,
      "stroke-width": 1.2,
      "stroke-dasharray": "5 4",
    }),
    el(
      "text",
      {
        x: plotX[1],
        y: ty - 6,
        "font-size": 10,
        "text-anchor": "end",
        fill: theme.accents.pink,
      },
      "significance threshold",
    ),
  );

  // Points, sorted for stable output
  const sorted = [...repos].sort((a, b) => a.name.localeCompare(b.name));
  interface Hit {
    name: string;
    x: number;
    y: number;
    color: string;
  }
  const hits: Hit[] = [];
  for (const r of sorted) {
    const ci = cats.indexOf(r.category);
    const jitter = (hash01(r.name) - 0.5) * 2 * 0.38 * xBand.width;
    const cx = xBand.center(ci) + jitter;
    const s = score(r);
    const cy = y(s);
    const color = theme.categoryColors[r.category] ?? theme.inkFaint;
    const above = (s >= threshold && s > 0) || tierOf(r.name) === 3;
    parts.push(
      el("circle", {
        cx: round(cx),
        cy: round(cy),
        r: round(rScale(bytesOf(r))),
        fill: color,
        opacity: above ? 0.95 : 0.4,
      }),
    );
    if (above) hits.push({ name: r.name, x: cx, y: cy, color });
  }

  // Labels for significant hits with a greedy collision pass
  const fs = 10;
  hits.sort((a, b) => a.x - b.x);
  const placed: { x0: number; x1: number; y: number }[] = [];
  for (const h of hits) {
    const w = monoWidth(h.name, fs);
    let lx = h.x + 8;
    if (lx + w > W - M.right) lx = h.x - 8 - w;
    let ly = h.y - 10;
    let collided = true;
    while (collided) {
      collided = placed.some(
        (p) => !(lx + w < p.x0 || lx > p.x1) && Math.abs(ly - p.y) < fs + 2,
      );
      if (collided) ly -= fs + 3;
    }
    placed.push({ x0: lx, x1: lx + w, y: ly });
    parts.push(
      line(h.x, h.y - 4, h.x, ly + 3, {
        stroke: theme.inkFaint,
        "stroke-width": 0.6,
      }),
      el(
        "text",
        { x: round(lx), y: round(ly), "font-size": fs, fill: h.color },
        h.name,
      ),
    );
  }

  // Axes
  parts.push(
    line(plotX[0], plotY[1], plotX[1], plotY[1], {
      stroke: theme.inkMuted,
      "stroke-width": 1,
    }),
  );
  cats.forEach((c, i) => {
    parts.push(
      el(
        "text",
        {
          x: round(xBand.center(i)),
          y: plotY[1] + 20,
          "font-size": 11,
          "text-anchor": "middle",
          fill: theme.categoryColors[c],
        },
        c,
      ),
    );
  });
  parts.push(
    el(
      "text",
      {
        x: 0,
        y: 0,
        "font-size": 10,
        "text-anchor": "middle",
        class: "muted",
        transform: `translate(20 ${round((plotY[0] + plotY[1]) / 2)}) rotate(-90)`,
      },
      "-log10(p_dormancy)",
    ),
  );

  // Title block
  parts.push(
    el(
      "text",
      { x: M.left, y: 26, "font-size": 15, class: "title" },
      "# repo manhattan plot",
    ),
    el(
      "text",
      { x: M.left, y: 44, "font-size": 10.5, class: "muted" },
      "every public repo as an association hit · y = commit + star signal over 52 weeks · size = codebase bytes",
    ),
  );

  return document(W, H, theme, parts.join("\n"));
}
