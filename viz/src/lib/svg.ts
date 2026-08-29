import type { Theme } from "../types.js";
import { polar } from "./scales.js";

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESC[c]);
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function el(
  tag: string,
  attrs: Record<string, string | number | undefined>,
  ...children: string[]
): string {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${typeof v === "number" ? round(v) : esc(String(v))}"`)
    .join("");
  if (!children.length) return `<${tag}${a}/>`;
  return `<${tag}${a}>${children.join("")}</${tag}>`;
}

// Monospace advance is ~0.601em for Space Mono and its common fallbacks.
export function monoWidth(s: string, fontSize: number): number {
  return s.length * fontSize * 0.601;
}

export function truncateMono(s: string, fontSize: number, maxWidth: number): string {
  if (monoWidth(s, fontSize) <= maxWidth) return s;
  const maxChars = Math.max(1, Math.floor(maxWidth / (fontSize * 0.601)) - 1);
  return s.slice(0, maxChars) + "…";
}

export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  attrs: Record<string, string | number | undefined> = {},
): string {
  return el("line", { x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2), ...attrs });
}

export function roundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  attrs: Record<string, string | number | undefined> = {},
): string {
  return el("rect", {
    x: round(x),
    y: round(y),
    width: round(w),
    height: round(h),
    rx: round(r),
    ...attrs,
  });
}

// Annular sector between radii r0 < r1 spanning angles a0 to a1 (degrees, clockwise from 12 o'clock).
export function annularArc(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  const p1 = polar(cx, cy, r1, a0);
  const p2 = polar(cx, cy, r1, a1);
  const p3 = polar(cx, cy, r0, a1);
  const p4 = polar(cx, cy, r0, a0);
  return [
    `M ${round(p1.x)} ${round(p1.y)}`,
    `A ${round(r1)} ${round(r1)} 0 ${large} 1 ${round(p2.x)} ${round(p2.y)}`,
    `L ${round(p3.x)} ${round(p3.y)}`,
    `A ${round(r0)} ${round(r0)} 0 ${large} 0 ${round(p4.x)} ${round(p4.y)}`,
    "Z",
  ].join(" ");
}

// Ribbon connecting arc spans [a0,a1] and [b0,b1] at radius r, pulled toward the center.
export function ribbon(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): string {
  const pull = 0.25;
  const pA0 = polar(cx, cy, r, a0);
  const pA1 = polar(cx, cy, r, a1);
  const pB0 = polar(cx, cy, r, b0);
  const pB1 = polar(cx, cy, r, b1);
  const cA1 = polar(cx, cy, r * pull, a1);
  const cB0 = polar(cx, cy, r * pull, b0);
  const cB1 = polar(cx, cy, r * pull, b1);
  const cA0 = polar(cx, cy, r * pull, a0);
  const largeA = a1 - a0 > 180 ? 1 : 0;
  const largeB = b1 - b0 > 180 ? 1 : 0;
  const f = (n: number) => round(n);
  return [
    `M ${f(pA0.x)} ${f(pA0.y)}`,
    `A ${f(r)} ${f(r)} 0 ${largeA} 1 ${f(pA1.x)} ${f(pA1.y)}`,
    `C ${f(cA1.x)} ${f(cA1.y)} ${f(cB0.x)} ${f(cB0.y)} ${f(pB0.x)} ${f(pB0.y)}`,
    `A ${f(r)} ${f(r)} 0 ${largeB} 1 ${f(pB1.x)} ${f(pB1.y)}`,
    `C ${f(cB1.x)} ${f(cB1.y)} ${f(cA0.x)} ${f(cA0.y)} ${f(pA0.x)} ${f(pA0.y)}`,
    "Z",
  ].join(" ");
}

export function document(
  width: number,
  height: number,
  theme: Theme,
  body: string,
): string {
  const style = `
    text { font-family: ${theme.mono}; fill: ${theme.ink}; }
    .title { font-family: ${theme.font}; font-weight: 600; }
    .muted { fill: ${theme.inkMuted}; }
    .faint { fill: ${theme.inkFaint}; }
  `;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">`,
    `<style>${style.replace(/\s+/g, " ").trim()}</style>`,
    el("rect", { x: 0, y: 0, width, height, fill: theme.bg }),
    body,
    "</svg>",
  ].join("\n");
}
