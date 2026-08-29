export interface DayCount {
  date: string;
  count: number;
}

export interface RepoDatum {
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  createdAt: string;
  pushedAt: string;
  isFork: boolean;
  archived: boolean;
  primaryLanguage: string | null;
  languages: Record<string, number>;
  weeklyCommits: number[];
  category: string;
}

export interface Portfolio {
  fetchedAt: string;
  user: string;
  calendar: DayCount[];
  repos: RepoDatum[];
}

export interface Theme {
  name: "light" | "dark";
  bg: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  grid: string;
  accents: { pink: string; blue: string; green: string };
  categoryColors: Record<string, string>;
  languageColors: Record<string, string>;
  font: string;
  mono: string;
}
