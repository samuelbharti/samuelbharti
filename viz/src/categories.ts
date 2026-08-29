// Hand-maintained map of repos to categories. This is the curation knob:
// it decides which chromosome, arc group, or locus a repo lands in.
// The fetch script prints any unmapped repo so this stays current.

// Ring order, clockwise from the top: current and important work first,
// archive material last.
export const CATEGORY_ORDER = [
  "agentic-ai",
  "web-viz",
  "shiny-apps",
  "packages",
  "teaching",
  "databases",
] as const;

export const CATEGORIES: Record<string, string[]> = {
  "agentic-ai": ["genescout", "biobouncer", "gene-list-builder", "RAPTOR"],
  "shiny-apps": [
    "variant-reviewer",
    "tahoe-explorer",
    "recount-explorer",
    "draft-reviewer",
    "plotomics-live",
    "BioDivPortalPoland",
    "SEAS",
    "ptc-explorer",
    "clinicalViz",
  ],
  packages: [
    "peacock",
    "biohttp",
    "bioclients",
    "RShiny_template",
    "RShiny_LLM_Module",
  ],
  "web-viz": ["plotomics", "OnDemand-html-renderer"],
  databases: ["PepEngine", "VIRdb", "PluriMetNet"],
  teaching: [
    "r-for-beginners",
    "starter-kits",
    "AWS_R-Shiny_Workshop",
    "AWS_workshop_stemaway",
  ],
};

// Editorial control: prominence in every visualization is driven by this
// tier, not by commit counts. 3 = flagship, 2 = solid, unlisted = archive.
// Activity only fine-tunes within a tier.
export const SPOTLIGHT: Record<string, number> = {
  plotomics: 3,
  genescout: 3,
  biobouncer: 3,
  bioclients: 3,
  biohttp: 3,
  "variant-reviewer": 3,
  "tahoe-explorer": 3,
  "plotomics-live": 3,
  "recount-explorer": 2,
  "draft-reviewer": 2,
  "gene-list-builder": 2,
  peacock: 2,
  RShiny_template: 2,
  "r-for-beginners": 2,
  SEAS: 2,
  "ptc-explorer": 2,
};

export function tierOf(repoName: string): number {
  return SPOTLIGHT[repoName] ?? 1;
}

// Shared visibility rule for all renderers. Forks are hidden unless
// spotlighted (work that lives in org repos, like SEAS and ptc-explorer).
export function visible(r: {
  name: string;
  isFork: boolean;
  archived: boolean;
  category: string;
}): boolean {
  return (
    (!r.isFork || tierOf(r.name) >= 2) &&
    !r.archived &&
    r.category !== "misc"
  );
}

// Repos that should never appear in any visualization.
export const EXCLUDE = new Set([
  "samuelbharti",
  "samuelbharti.r-universe.dev",
  "skills-copilot-codespaces-vscode",
  "vcpi-prediction-contest-2026",
  "2023-11-02-samuelbharti",
  "test-sites",
  "Epidimeology-Model-Covid-19",
]);

export function categoryOf(repoName: string): string {
  for (const [cat, names] of Object.entries(CATEGORIES)) {
    if (names.includes(repoName)) return cat;
  }
  return "misc";
}
