import type { ListeningFormat, ListeningLevel } from "./schemas";

export type ListeningPeriod = {
  level: ListeningLevel;
  paceRule: string;
  minutes: string;
  chars: number;
  formats: readonly ListeningFormat[];
};

// Spec §15.3 : la difficulté dépend de la date, jamais d'un choix de l'élève.
const AUTUMN: ListeningPeriod = {
  level: "B1",
  paceRule: "Keep sentences short and vocabulary at B1 level; avoid idioms.",
  minutes: "1.5 to 2",
  chars: 1600,
  formats: ["news", "interview"],
};
const WINTER: ListeningPeriod = {
  level: "B1+",
  paceRule: "Use a natural pace and B1+ to B2 vocabulary, with a few common business expressions.",
  minutes: "2 to 3",
  chars: 2300,
  formats: ["interview", "podcast"],
};
const SPRING: ListeningPeriod = {
  level: "B2",
  paceRule: "Use natural pace and B2 vocabulary, including some idioms and business expressions.",
  minutes: "3",
  chars: 2800,
  formats: ["debate", "podcast", "radio_ad"],
};

export function listeningPeriod(d: Date): ListeningPeriod {
  const m = d.getMonth(); // 0 = janvier
  if (m >= 8) return AUTUMN; // sept.-déc.
  if (m <= 2) return WINTER; // janv.-mars
  return SPRING; // avr.-examen (et l'été)
}

// Vitesse 0,85x : disponible jusqu'en décembre, puis masquée. Réglage `listening_slow_speed` = "on" | "off" pour forcer.
export function slowSpeedAvailable(d: Date, override?: string): boolean {
  if (override === "on") return true;
  if (override === "off") return false;
  return d.getMonth() >= 8;
}

export const FORMAT_BRIEFS: Record<ListeningFormat, { description: string; speakers: number }> = {
  news: { description: "a short radio news bulletin read by one presenter", speakers: 1 },
  interview: { description: "a radio interview between a host and one guest", speakers: 2 },
  podcast: { description: "an extract from a podcast with two hosts chatting", speakers: 2 },
  debate: { description: "a short radio debate: a host and two guests with opposite views", speakers: 3 },
  radio_ad: { description: "a radio ad break: a presenter and two or three short commercials", speakers: 2 },
};
