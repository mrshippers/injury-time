/**
 * Static seed data for the demo club.
 * Kilburn Athletic is FICTIONAL (no real player gets invented health data).
 * Opponents are real clubs from the Spartan South Midlands Premier Division
 * and Southern League Division One Central, used as fixture names only.
 */

export const DEMO_CLUB = {
  name: "Kilburn Athletic",
  league: "Spartan South Midlands Premier Division",
};

export type SeedPlayer = {
  name: string;
  position: "GK" | "DF" | "MF" | "FW";
  squadNumber: number;
};

export const SQUAD: SeedPlayer[] = [
  { name: "Marcus Oyelaran", position: "GK", squadNumber: 1 },
  { name: "Tommy Feather", position: "GK", squadNumber: 13 },
  { name: "Dre Mensah-Cole", position: "DF", squadNumber: 2 },
  { name: "Callum Brice", position: "DF", squadNumber: 3 },
  { name: "Sol Adjei", position: "DF", squadNumber: 4 },
  { name: "Liam Costigan", position: "DF", squadNumber: 5 },
  { name: "Reece Whittaker", position: "DF", squadNumber: 6 },
  { name: "Jayden Okafor", position: "DF", squadNumber: 12 },
  { name: "Pat Halloran", position: "DF", squadNumber: 15 },
  { name: "Kofi Asante", position: "MF", squadNumber: 7 },
  { name: "Danny Szymanski", position: "MF", squadNumber: 8 },
  { name: "Theo Braithwaite", position: "MF", squadNumber: 10 },
  { name: "Yusuf Diallo", position: "MF", squadNumber: 11 },
  { name: "Charlie Renshaw", position: "MF", squadNumber: 14 },
  { name: "Milo Fagbenle", position: "MF", squadNumber: 16 },
  { name: "Stevie Doyle", position: "MF", squadNumber: 17 },
  { name: "Nathan Quao", position: "MF", squadNumber: 20 },
  { name: "Bobby Ashworth", position: "FW", squadNumber: 9 },
  { name: "Emeka Nwosu", position: "FW", squadNumber: 18 },
  { name: "Harvey Lindqvist", position: "FW", squadNumber: 19 },
  { name: "Andre Baptiste-Small", position: "FW", squadNumber: 21 },
  { name: "Ryan Tavares", position: "FW", squadNumber: 22 },
];

export type SeedFixture = {
  /** days before "today" the match happened (positive = past) */
  daysAgo: number;
  opponent: string;
  venue: "H" | "A";
  competition: string;
};

/** ~6 weeks of match history, newest first. */
export const FIXTURES: SeedFixture[] = [
  { daysAgo: 2, opponent: "London Colney", venue: "H", competition: "Spartan South Midlands Premier" },
  { daysAgo: 6, opponent: "Leverstock Green", venue: "A", competition: "Spartan South Midlands Premier" },
  { daysAgo: 9, opponent: "New Salamis", venue: "H", competition: "Spartan South Midlands Premier" },
  { daysAgo: 13, opponent: "Aylesbury United", venue: "A", competition: "FA Cup Preliminary" },
  { daysAgo: 16, opponent: "Crawley Green", venue: "A", competition: "Spartan South Midlands Premier" },
  { daysAgo: 20, opponent: "Harpenden Town", venue: "H", competition: "Spartan South Midlands Premier" },
  { daysAgo: 23, opponent: "Leighton Town", venue: "A", competition: "FA Cup Preliminary replay" },
  { daysAgo: 27, opponent: "Baldock Town", venue: "H", competition: "Spartan South Midlands Premier" },
  { daysAgo: 30, opponent: "Stotfold", venue: "A", competition: "Spartan South Midlands Premier" },
  { daysAgo: 34, opponent: "Codicote", venue: "H", competition: "Spartan South Midlands Premier" },
  { daysAgo: 37, opponent: "Winslow United", venue: "A", competition: "Spartan South Midlands Premier" },
  { daysAgo: 41, opponent: "Tring Athletic", venue: "H", competition: "Spartan South Midlands Premier" },
];

/** Training nights: Tuesdays and Thursdays between fixtures. */
export const TRAINING_DAYS_AGO: number[] = [
  1, 4, 8, 11, 15, 18, 22, 25, 29, 32, 36, 39, 42,
];
