// Avancement d'une génération lu dans le JSON partiel renvoyé en flux par le modèle.
export type Progress = { label: string; pct: number };

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Valeur (même inachevée) du dernier champ texte `key` dans un JSON en cours d'écriture. */
export function partialField(json: string, key: string): string | undefined {
  const i = json.lastIndexOf(`"${key}"`);
  if (i < 0) return undefined;
  return json.slice(i).match(/^"[^"]+"\s*:\s*"((?:[^"\\]|\\.)*)/)?.[1];
}

export function placementProgress(json: string, grammarCount: number): Progress {
  if (json.includes('"listening"')) return { label: "Questions d’écoute", pct: 92 };
  if (json.includes('"writing"')) return { label: "Sujet d’expression écrite", pct: 86 };
  const reading = json.indexOf('"reading"');
  if (reading >= 0) {
    const questions = count(json.slice(reading), /"question"/g);
    if (questions) return { label: `Questions de lecture : ${questions} sur 4`, pct: 68 + 4 * questions };
    const w = words(partialField(json, "text") ?? "");
    return { label: `Texte de lecture : ${w} mots`, pct: 45 + Math.min(20, w / 15) };
  }
  const n = Math.min(count(json, /"prompt"/g), grammarCount);
  return { label: `Questions de grammaire : ${n} sur ${grammarCount}`, pct: 5 + (40 * n) / grammarCount };
}

export function subjectProgress(json: string, targetWords: number): Progress {
  if (/"(guide_questions|keywords|structure)"/.test(json)) return { label: "Questions guides et mots clés", pct: 90 };
  if (json.includes('"task"')) return { label: "Consigne d’écriture", pct: 80 };
  const article = partialField(json, "article");
  if (article !== undefined) {
    const w = words(article);
    return { label: `Article : ${w} mots sur environ ${targetWords}`, pct: 10 + Math.min(65, (65 * w) / targetWords) };
  }
  return { label: "Titre de l’article", pct: 5 };
}

/** Programme de grammaire d'une nouvelle langue : points écrits, puis verbes à retenir. */
export function programmeProgress(json: string): Progress {
  const verbs = json.indexOf('"verbs"');
  if (verbs >= 0) {
    const n = count(json.slice(verbs), /"base"/g);
    return { label: n ? `Verbes à retenir : ${n}` : "Verbes à retenir", pct: 65 + Math.min(30, n / 2) };
  }
  const n = count(json, /"key"/g);
  return { label: `Programme de grammaire : ${n} point${n > 1 ? "s" : ""}`, pct: 20 + Math.min(45, 2.25 * n) };
}
