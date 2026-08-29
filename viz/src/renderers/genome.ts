import type { Portfolio, RepoDatum, Theme } from "../types.js";
import { CATEGORY_ORDER, tierOf, visible } from "../categories.js";
import { linear, sqrtScale } from "../lib/scales.js";
import { document, el, line, round, roundedRect, truncateMono } from "../lib/svg.js";

const W = 880;
const GUTTER = 158;
const PLOT_R = W - 24;
const LANE_H = 18;
const MAX_LANES = 8;

const WEEK_MS = 7 * 24 * 3600 * 1000;

interface MonthBin {
  key: string;
  label: string;
  start: number;
  end: number;
}

function monthBins(t0: number, t1: number): MonthBin[] {
  const bins: MonthBin[] = [];
  const d = new Date(t0);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  while (d.getTime() < t1) {
    const start = d.getTime();
    const m = d.getUTCMonth();
    const next = new Date(d);
    next.setUTCMonth(m + 1);
    bins.push({
      key: `${d.getUTCFullYear()}-${m}`,
      label: names[m],
      start: Math.max(start, t0),
      end: Math.min(next.getTime(), t1),
    });
    d.setUTCMonth(m + 1);
  }
  return bins;
}

// Week i (oldest first, 52 total) ends at anchor - (51 - i) weeks.
function weekTime(anchor: number, i: number): number {
  return anchor - (51 - i) * WEEK_MS;
}

function monthlyCommits(r: RepoDatum, anchor: number, bins: MonthBin[]): number[] {
  return bins.map((b) => {
    let sum = 0;
    for (let i = 0; i < 52; i++) {
      const t = weekTime(anchor, i);
      if (t >= b.start && t < b.end) sum += r.weeklyCommits[i];
    }
    return sum;
  });
}

export function renderGenome(data: Portfolio, theme: Theme): string {
  const repos = data.repos.filter(
    (r) => visible(r),
  );
  const anchor = data.calendar.length
    ? new Date(data.calendar[data.calendar.length - 1].date).getTime()
    : Date.now();
  const t0 = weekTime(anchor, 0) - WEEK_MS;
  const bins = monthBins(t0, anchor + 24 * 3600 * 1000);
  const x = linear([t0, anchor + 24 * 3600 * 1000], [GUTTER, PLOT_R]);

  const total = (r: RepoDatum) => r.weeklyCommits.reduce((a, b) => a + b, 0);

  // Group and sort lanes per category. Spotlighted repos always get a lane,
  // even in quiet weeks; only unspotlighted quiet repos collapse to a count.
  const groups = CATEGORY_ORDER.map((cat) => {
    const inCat = repos.filter((r) => r.category === cat);
    const eligible = inCat
      .filter((r) => tierOf(r.name) >= 2 || total(r) > 0)
      .sort(
        (a, b) =>
          tierOf(b.name) - tierOf(a.name) ||
          total(b) - total(a) ||
          a.name.localeCompare(b.name),
      );
    return {
      cat,
      lanes: eligible.slice(0, MAX_LANES),
      dormant: inCat.length - Math.min(eligible.length, MAX_LANES),
    };
  }).filter((g) => g.lanes.length > 0 || g.dormant > 0);

  // Vertical layout
  const titleH = 56;
  const covH = 64;
  const covGap = 18;
  let cursorY = titleH + covH + covGap;
  const groupTops: number[] = [];
  for (const g of groups) {
    groupTops.push(cursorY);
    cursorY += 20 + g.lanes.length * LANE_H + (g.dormant > 0 ? 15 : 6);
  }
  const axisY = cursorY + 6;
  const H = axisY + 34;

  const parts: string[] = [];

  // Month gridlines spanning tracks
  for (const b of bins) {
    const gx = x(b.start);
    if (b.start > t0) {
      parts.push(
        line(gx, titleH, gx, axisY, { stroke: theme.grid, "stroke-width": 1 }),
      );
    }
    parts.push(
      el(
        "text",
        {
          x: round((x(b.start) + x(b.end)) / 2),
          y: axisY + 16,
          "font-size": 10,
          "text-anchor": "middle",
          class: "faint",
        },
        b.label,
      ),
    );
  }
  parts.push(
    line(GUTTER, axisY, PLOT_R, axisY, { stroke: theme.inkMuted, "stroke-width": 1 }),
  );

  // Coverage track from the contribution calendar, summed per week
  const weeks: { t: number; count: number }[] = [];
  for (let i = 0; i < data.calendar.length; i += 7) {
    const chunk = data.calendar.slice(i, i + 7);
    weeks.push({
      t: new Date(chunk[0].date).getTime(),
      count: chunk.reduce((a, d) => a + d.count, 0),
    });
  }
  const covMax = Math.max(...weeks.map((w) => w.count), 1);
  // sqrt scale keeps quiet weeks visible next to spike weeks
  const covY = sqrtScale([0, covMax], [titleH + covH, titleH + 6]);
  const covPts = weeks
    .filter((w) => w.t >= t0)
    .map((w) => `${round(x(w.t))},${round(covY(w.count))}`);
  if (covPts.length) {
    const first = covPts[0].split(",")[0];
    const last = covPts[covPts.length - 1].split(",")[0];
    const base = round(titleH + covH);
    parts.push(
      el("path", {
        d: `M ${first},${base} L ${covPts.join(" L ")} L ${last},${base} Z`,
        fill: theme.accents.pink,
        opacity: 0.16,
      }),
      el("path", {
        d: `M ${covPts.join(" L ")}`,
        fill: "none",
        stroke: theme.accents.pink,
        "stroke-width": 1.5,
      }),
    );
  }
  parts.push(
    el(
      "text",
      {
        x: GUTTER - 8,
        y: titleH + covH / 2,
        "font-size": 10,
        "text-anchor": "end",
        class: "muted",
      },
      "contributions / wk",
    ),
    el(
      "text",
      { x: GUTTER - 8, y: titleH + 12, "font-size": 9, "text-anchor": "end", class: "faint" },
      `max ${covMax}`,
    ),
  );

  // Chromosome tracks
  groups.forEach((g, gi) => {
    const top = groupTops[gi];
    const color = theme.categoryColors[g.cat] ?? theme.inkFaint;
    parts.push(
      el(
        "text",
        { x: 24, y: top + 12, "font-size": 11, fill: color, "font-weight": "bold" },
        `chr · ${g.cat}`,
      ),
      line(GUTTER, top + 8, PLOT_R, top + 8, {
        stroke: color,
        "stroke-width": 1,
        opacity: 0.35,
      }),
    );
    g.lanes.forEach((r, li) => {
      const laneY = top + 20 + li * LANE_H;
      const mid = laneY + LANE_H / 2 - 2;
      const monthly = monthlyCommits(r, anchor, bins);
      const repoMax = Math.max(...monthly, 1);
      const activeIdx = monthly
        .map((m, i) => (m > 0 ? i : -1))
        .filter((i) => i >= 0);
      if (activeIdx.length === 0) {
        // Spotlighted but quiet this year: faint dashed baseline, no exons
        parts.push(
          line(GUTTER + 2, mid, PLOT_R - 2, mid, {
            stroke: color,
            "stroke-width": 1,
            opacity: 0.25,
            "stroke-dasharray": "2 4",
          }),
          el(
            "text",
            {
              x: GUTTER - 8,
              y: mid + 3.5,
              "font-size": 10,
              "text-anchor": "end",
              class: "muted",
            },
            truncateMono(r.name, 10, GUTTER - 40),
          ),
        );
        return;
      }
      const first = bins[activeIdx[0]];
      const last = bins[activeIdx[activeIdx.length - 1]];
      // Intron baseline
      parts.push(
        line(x(first.start) + 1, mid, x(last.end) - 1, mid, {
          stroke: color,
          "stroke-width": 1,
          opacity: 0.5,
        }),
      );
      // Exon blocks per active month
      monthly.forEach((m, i) => {
        if (m <= 0) return;
        const b = bins[i];
        const frac = m / repoMax;
        const opacity = frac > 0.66 ? 1 : frac > 0.33 ? 0.65 : 0.35;
        parts.push(
          roundedRect(x(b.start) + 1.5, mid - 5, x(b.end) - x(b.start) - 3, 10, 2, {
            fill: color,
            opacity,
          }),
        );
      });
      parts.push(
        el(
          "text",
          {
            x: GUTTER - 8,
            y: mid + 3.5,
            "font-size": 10,
            "text-anchor": "end",
          },
          truncateMono(r.name, 10, GUTTER - 40),
        ),
      );
    });
    if (g.dormant > 0) {
      parts.push(
        el(
          "text",
          {
            x: GUTTER - 8,
            y: top + 20 + g.lanes.length * LANE_H + 6,
            "font-size": 9,
            "text-anchor": "end",
            class: "faint",
          },
          `+ ${g.dormant} dormant`,
        ),
      );
    }
  });

  // Title block
  parts.push(
    el(
      "text",
      { x: 24, y: 26, "font-size": 15, class: "title" },
      "# portfolio genome browser",
    ),
    el(
      "text",
      { x: 24, y: 44, "font-size": 10.5, class: "muted" },
      "repos as gene models · exons = monthly commit activity, shaded by intensity · coverage = contributions",
    ),
  );

  return document(W, H, theme, parts.join("\n"));
}
