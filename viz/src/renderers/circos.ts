import type { Portfolio, RepoDatum, Theme } from "../types.js";
import { CATEGORY_ORDER, tierOf, visible } from "../categories.js";
import { polar } from "../lib/scales.js";
import { annularArc, document, el, ribbon, round } from "../lib/svg.js";

const W = 880;
const H = 880;
const CX = 440;
const CY = 450;
const R_LABEL = 296;
const R_HEAT: [number, number] = [258, 288];
const R_BAND: [number, number] = [215, 252];
const R_RIBBON = 210;
const GAP_DEG = 6;
const ARC_GAP = 1.2;

// One drawn arc: either a spotlighted repo or the collapsed archive of a category.
interface Arc {
  label: string;
  cat: string;
  tier: number;
  repo: RepoDatum | null;
  weight: number;
  a0: number;
  a1: number;
}

function activity(r: RepoDatum): number {
  return r.weeklyCommits.reduce((a, b) => a + b, 0) + 2 * r.stars;
}

export function renderCircos(data: Portfolio, theme: Theme): string {
  const repos = data.repos.filter(
    (r) => visible(r),
  );
  const cats = CATEGORY_ORDER.filter((c) => repos.some((r) => r.category === c));

  // Prominence is editorial: the spotlight tier dominates, activity fine-tunes.
  const arcs: Arc[] = [];
  for (const cat of cats) {
    const inCat = repos.filter((r) => r.category === cat);
    // Within a category: importance first, then most recently touched
    const shown = inCat
      .filter((r) => tierOf(r.name) >= 2)
      .sort(
        (a, b) =>
          tierOf(b.name) - tierOf(a.name) ||
          b.pushedAt.localeCompare(a.pushedAt) ||
          a.name.localeCompare(b.name),
      );
    for (const r of shown) {
      arcs.push({
        label: r.name,
        cat,
        tier: tierOf(r.name),
        repo: r,
        weight: 1.7 * tierOf(r.name) + 0.3 * Math.sqrt(activity(r)),
        a0: 0,
        a1: 0,
      });
    }
    const archived = inCat.length - shown.length;
    if (archived > 0) {
      arcs.push({
        label: `+${archived}`,
        cat,
        tier: 1,
        repo: null,
        weight: 1.4 + 0.25 * archived,
        a0: 0,
        a1: 0,
      });
    }
  }

  // Angular layout
  const perArcGap = ARC_GAP;
  const avail =
    360 - GAP_DEG * cats.length - perArcGap * (arcs.length - cats.length);
  const sumW = arcs.reduce((a, b) => a + b.weight, 0);
  let angle = 0;
  const catSpans: { cat: string; a0: number; a1: number }[] = [];
  for (const cat of cats) {
    const mine = arcs.filter((a) => a.cat === cat);
    const a0 = angle;
    mine.forEach((a, i) => {
      const d = (avail * a.weight) / sumW;
      a.a0 = angle;
      a.a1 = angle + d;
      angle += d + (i < mine.length - 1 ? perArcGap : 0);
    });
    catSpans.push({ cat, a0, a1: angle });
    angle += GAP_DEG;
  }

  const parts: string[] = [];

  // Ribbons (bottom layer): shared primary language across categories,
  // between spotlighted arcs only
  const RIBBON_LANGS = ["TypeScript", "R", "Python"];
  const drawnLangs = new Set<string>();
  for (const lang of RIBBON_LANGS) {
    const spans: { a0: number; a1: number }[] = [];
    for (const cat of cats) {
      const inLang = arcs.filter(
        (a) => a.cat === cat && a.repo?.primaryLanguage === lang,
      );
      if (!inLang.length) continue;
      const a0 = Math.min(...inLang.map((a) => a.a0));
      const a1 = Math.max(...inLang.map((a) => a.a1));
      const mid = (a0 + a1) / 2;
      const w = Math.min((a1 - a0) * 0.5, 20);
      spans.push({ a0: mid - w / 2, a1: mid + w / 2 });
    }
    for (let i = 0; i < spans.length; i++) {
      for (let j = i + 1; j < spans.length; j++) {
        drawnLangs.add(lang);
        parts.push(
          el("path", {
            d: ribbon(
              CX,
              CY,
              R_RIBBON,
              spans[i].a0,
              spans[i].a1,
              spans[j].a0,
              spans[j].a1,
            ),
            fill: theme.languageColors[lang] ?? theme.inkFaint,
            opacity: 0.12,
          }),
        );
      }
    }
  }

  // Main band and heat ring
  for (const a of arcs) {
    const color = theme.categoryColors[a.cat] ?? theme.inkFaint;
    const muted = a.repo === null;
    parts.push(
      el("path", {
        d: annularArc(CX, CY, R_BAND[0], R_BAND[1], a.a0, a.a1),
        fill: color,
        opacity: muted ? 0.22 : a.tier === 3 ? 0.95 : 0.62,
      }),
    );

    if (a.repo) {
      const monthly: number[] = [];
      for (let m = 0; m < 12; m++) {
        const from = Math.floor((m * 52) / 12);
        const to = Math.floor(((m + 1) * 52) / 12);
        monthly.push(
          a.repo.weeklyCommits.slice(from, to).reduce((x, y) => x + y, 0),
        );
      }
      const repoMax = Math.max(...monthly, 1);
      const span = a.a1 - a.a0;
      const cell = span / 12;
      monthly.forEach((m, i) => {
        const c0 = a.a0 + i * cell;
        const frac = m / repoMax;
        const opacity = m === 0 ? 0 : frac > 0.66 ? 0.95 : frac > 0.33 ? 0.6 : 0.3;
        parts.push(
          el("path", {
            d: annularArc(
              CX,
              CY,
              R_HEAT[0],
              R_HEAT[1],
              c0 + cell * 0.08,
              c0 + cell * 0.92,
            ),
            fill: opacity === 0 ? theme.grid : color,
            opacity: opacity === 0 ? 0.5 : opacity,
          }),
        );
      });
    }

    // Radial label, flipped on the left hemisphere so it reads outward-in
    const mid = (a.a0 + a.a1) / 2;
    const p = polar(CX, CY, a.repo ? R_LABEL : R_BAND[1] + 8, mid);
    const leftSide = mid > 180;
    const rot = leftSide ? mid + 90 : mid - 90;
    parts.push(
      el(
        "text",
        {
          x: 0,
          y: 3.5,
          "font-size": a.tier === 3 ? 11.5 : 10.5,
          "font-weight": a.tier === 3 ? "bold" : undefined,
          "text-anchor": leftSide ? "end" : "start",
          class: muted ? "faint" : undefined,
          transform: `translate(${round(p.x)} ${round(p.y)}) rotate(${round(rot)})`,
        },
        a.label,
      ),
    );
  }

  // Category underline markers
  for (const s of catSpans) {
    const color = theme.categoryColors[s.cat] ?? theme.inkFaint;
    parts.push(
      el("path", {
        d: annularArc(CX, CY, R_BAND[0] - 7, R_BAND[0] - 4, s.a0, s.a1),
        fill: color,
        opacity: 0.45,
      }),
    );
  }

  // Center summary
  const totalCommits = repos.reduce(
    (a, r) => a + r.weeklyCommits.reduce((x, y) => x + y, 0),
    0,
  );
  parts.push(
    el(
      "text",
      { x: CX, y: CY - 10, "font-size": 26, "text-anchor": "middle", class: "title" },
      String(repos.length),
    ),
    el(
      "text",
      { x: CX, y: CY + 10, "font-size": 10, "text-anchor": "middle", class: "muted" },
      "projects",
    ),
    el(
      "text",
      { x: CX, y: CY + 26, "font-size": 10, "text-anchor": "middle", class: "faint" },
      `${totalCommits} commits / 52w`,
    ),
  );

  // Legend: categories left, ribbon languages right
  let lx = 24;
  const ly = H - 22;
  for (const c of cats) {
    parts.push(
      el("rect", { x: lx, y: ly - 8, width: 9, height: 9, rx: 2, fill: theme.categoryColors[c] }),
      el("text", { x: lx + 14, y: ly, "font-size": 10, class: "muted" }, c),
    );
    lx += 14 + c.length * 10 * 0.601 + 16;
  }
  let rx = W - 24;
  for (const lang of [...RIBBON_LANGS].reverse().filter((l) => drawnLangs.has(l))) {
    const label = `${lang} ribbon`;
    const wTxt = label.length * 10 * 0.601;
    rx -= wTxt;
    parts.push(
      el("text", { x: rx, y: ly, "font-size": 10, class: "faint" }, label),
    );
    rx -= 14;
    parts.push(
      el("circle", { cx: rx + 5, cy: ly - 3.5, r: 4, fill: theme.languageColors[lang], opacity: 0.5 }),
    );
    rx -= 18;
  }

  // Title block
  parts.push(
    el(
      "text",
      { x: 24, y: 26, "font-size": 15, class: "title" },
      "# portfolio circos",
    ),
    el(
      "text",
      { x: 24, y: 44, "font-size": 10.5, class: "muted" },
      "arcs = featured projects · outer ring = monthly commit heat · ribbons = shared language",
    ),
  );

  return document(W, H, theme, parts.join("\n"));
}
