import type { Theme } from "../types.js";

// Palette follows the Risograph theme on samuelbharti.com:
// paper #FCFBF7, ink #1A1620, fluoro pink #CE2A6E, riso blue #2444C8, green #1F9A56.
// Dark accents are lightened by hand for contrast against the ink background.

const FONT =
  '"Space Grotesk", -apple-system, "Segoe UI", system-ui, sans-serif';
const MONO = '"Space Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export const light: Theme = {
  name: "light",
  bg: "#FCFBF7",
  ink: "#1A1620",
  inkMuted: "#4A4552",
  inkFaint: "#8A8494",
  grid: "#E7E4DC",
  accents: { pink: "#CE2A6E", blue: "#2444C8", green: "#1F9A56" },
  categoryColors: {
    "agentic-ai": "#CE2A6E",
    "shiny-apps": "#2444C8",
    packages: "#1F9A56",
    "web-viz": "#D97706",
    databases: "#0E7C86",
    teaching: "#7C5CBF",
    misc: "#8A8494",
  },
  languageColors: {
    TypeScript: "#2444C8",
    R: "#CE2A6E",
    Python: "#1F9A56",
  },
  font: FONT,
  mono: MONO,
};

export const dark: Theme = {
  name: "dark",
  bg: "#1A1620",
  ink: "#FCFBF7",
  inkMuted: "#C2BDCB",
  inkFaint: "#847E90",
  grid: "#332E3C",
  accents: { pink: "#E5568D", blue: "#5C77E8", green: "#3FBF7A" },
  categoryColors: {
    "agentic-ai": "#E5568D",
    "shiny-apps": "#5C77E8",
    packages: "#3FBF7A",
    "web-viz": "#F09A3E",
    databases: "#3FB9C4",
    teaching: "#A08BE0",
    misc: "#A9A3B3",
  },
  languageColors: {
    TypeScript: "#5C77E8",
    R: "#E5568D",
    Python: "#3FBF7A",
  },
  font: FONT,
  mono: MONO,
};

export const themes = [light, dark];
