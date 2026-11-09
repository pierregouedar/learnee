import { createEmptyCard } from "ts-fsrs";
import { db } from "@/lib/db";
import type { IrregularVerb } from "@/lib/grammar/irregular-verbs";
import { getProgramme } from "@/lib/grammar-programme";

const DAY_MS = 86_400_000;
export const VERBS_PER_BATCH = 10;

export const verbKey = (base: string) => `verb:${base}`;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Recto : la phrase d'exemple avec un trou à la place du prétérit / participe (ne donne pas la réponse).
export function gapSentence(v: IrregularVerb): string {
  const forms = [...v.past.split(" / "), ...v.participle.split(" / ")].sort((a, b) => b.length - a.length);
  for (const form of forms) {
    const re = new RegExp(`\\b${escape(form)}\\b`, "i");
    if (re.test(v.example)) return v.example.replace(re, "___");
  }
  return v.example;
}

export function addIrregularVerbCards(now = new Date(), batch = VERBS_PER_BATCH): number {
  const conn = db();
  const last = conn.prepare(`SELECT MAX(created_at) AS at FROM cards WHERE source_kind = 'irregular_verb'`).get() as { at: string | null };
  if (last.at && now.getTime() - Date.parse(last.at) < 7 * DAY_MS) return 0;

  const existing = new Set(
    (conn.prepare(`SELECT term_key FROM cards WHERE source_kind = 'irregular_verb'`).all() as { term_key: string }[]).map((r) => r.term_key),
  );
  const next = getProgramme().verbs.filter((v) => !existing.has(verbKey(v.base))).slice(0, batch);
  const t = now.toISOString();
  const insertCard = conn.prepare(
    `INSERT INTO cards (id, term, term_key, definition, example, fr, fsrs, suspended, source_kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'irregular_verb', ?)`,
  );
  // Contexte « Verbes irréguliers » : c'est la phrase que la révision (plan 3) affiche au recto.
  const insertContext = conn.prepare(
    `INSERT INTO card_contexts (card_id, sentence, source_type, source_id, source_title, created_at)
     VALUES (?, ?, 'reading', 'irregular-verbs', 'Verbes irréguliers', ?)`,
  );
  conn.transaction(() => {
    for (const v of next) {
      const id = crypto.randomUUID();
      insertCard.run(id, v.base, verbKey(v.base), `${v.base} – ${v.past} – ${v.participle}`, v.example, v.fr, JSON.stringify(createEmptyCard(now)), t);
      insertContext.run(id, gapSentence(v), t);
    }
  })();
  return next.length;
}
