import { createEmptyCard, type Card as FsrsCard } from "ts-fsrs";
import { db } from "@/lib/db";
import { getSession, listCorrected } from "@/lib/repo/sessions";
import { getSubject } from "@/lib/repo/subjects";
import { normalizeKey } from "@/lib/text";

export type CardContext = { sentence: string; sourceType: "reading" | "listening"; sourceId: string; sourceTitle: string };
export type CardOrigin = "kept" | "correction";
export type Card = {
  id: string;
  term: string;
  termKey: string;
  definition: string; // anglais simple ; vide pour un mot venu d'une correction tant qu'il n'a pas été gardé
  example?: string;
  fr: string;
  audioPath?: string;
  fsrs: FsrsCard; // état ts-fsrs (plan 3 planifie les révisions)
  suspended: boolean;
  sourceKind: "word" | "irregular_verb";
  origin: CardOrigin;
  createdAt: string;
  contexts: CardContext[];
};
export type KeepWordInput = { term: string; definition: string; example?: string; fr: string; context: CardContext };

type Row = {
  id: string;
  term: string;
  term_key: string;
  definition: string;
  example: string | null;
  fr: string;
  audio_path: string | null;
  fsrs: string;
  suspended: number;
  source_kind: Card["sourceKind"];
  origin: CardOrigin;
  created_at: string;
};
type ContextRow = { card_id: string; sentence: string; source_type: CardContext["sourceType"]; source_id: string; source_title: string };

function parseFsrs(json: string): FsrsCard {
  const f = JSON.parse(json);
  return { ...f, due: new Date(f.due), last_review: f.last_review ? new Date(f.last_review) : undefined };
}

function toCards(rows: Row[]): Card[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const contexts = db()
    .prepare(`SELECT * FROM card_contexts WHERE card_id IN (${ids.map(() => "?").join(",")}) ORDER BY id`)
    .all(...ids) as ContextRow[];
  return rows.map((r) => ({
    id: r.id,
    term: r.term,
    termKey: r.term_key,
    definition: r.definition,
    example: r.example ?? undefined,
    fr: r.fr,
    audioPath: r.audio_path ?? undefined,
    fsrs: parseFsrs(r.fsrs),
    suspended: r.suspended === 1,
    sourceKind: r.source_kind,
    origin: r.origin,
    createdAt: r.created_at,
    contexts: contexts
      .filter((c) => c.card_id === r.id)
      .map((c) => ({ sentence: c.sentence, sourceType: c.source_type, sourceId: c.source_id, sourceTitle: c.source_title })),
  }));
}

export function getCard(id: string): Card | undefined {
  const row = db().prepare(`SELECT * FROM cards WHERE id = ?`).get(id) as Row | undefined;
  return row && toCards([row])[0];
}

export function listCards(): Card[] {
  return toCards(db().prepare(`SELECT * FROM cards ORDER BY created_at DESC, rowid DESC`).all() as Row[]);
}

function upsertCard(input: KeepWordInput, origin: CardOrigin): Card {
  const key = normalizeKey(input.term);
  if (!key) throw new Error("Mot vide.");
  const conn = db();
  const id = conn.transaction(() => {
    const now = new Date();
    const existing = conn.prepare(`SELECT id FROM cards WHERE term_key = ?`).get(key) as { id: string } | undefined;
    let cardId: string;
    if (existing) {
      cardId = existing.id;
      // Garder explicitement un mot le remet en révision et complète ce qui manquait.
      if (origin === "kept") {
        conn
          .prepare(
            `UPDATE cards SET origin = 'kept', suspended = 0,
               definition = CASE WHEN definition = '' THEN ? ELSE definition END,
               example = COALESCE(example, ?)
             WHERE id = ?`,
          )
          .run(input.definition, input.example ?? null, cardId);
      }
    } else {
      cardId = crypto.randomUUID();
      conn
        .prepare(
          `INSERT INTO cards (id, term, term_key, definition, example, fr, fsrs, origin, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(cardId, input.term.trim(), key, input.definition, input.example ?? null, input.fr, JSON.stringify(createEmptyCard(now)), origin, now.toISOString());
    }
    const sentence = input.context.sentence.trim();
    if (sentence) {
      conn
        .prepare(
          `INSERT OR IGNORE INTO card_contexts (card_id, sentence, source_type, source_id, source_title, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(cardId, sentence, input.context.sourceType, input.context.sourceId, input.context.sourceTitle, now.toISOString());
    }
    return cardId;
  })();
  return getCard(id)!;
}

export function keepWord(input: KeepWordInput): Card {
  return upsertCard(input, "kept");
}

// Idempotent : rejouer l'import n'ajoute ni carte ni contexte, et ne réactive pas une carte décochée.
export function importCorrectionVocab(sessionId: string) {
  const session = getSession(sessionId);
  if (!session?.result) return;
  const title = getSubject(session.subjectId)?.title ?? "";
  for (const v of session.result.vocabulaire) {
    if (!normalizeKey(v.en)) continue;
    upsertCard(
      { term: v.en, definition: "", example: v.exemple, fr: v.fr, context: { sentence: v.exemple ?? "", sourceType: "reading", sourceId: sessionId, sourceTitle: title } },
      "correction",
    );
  }
}

export function importAllCorrectionVocab() {
  for (const s of listCorrected()) importCorrectionVocab(s.id);
}

export function setSuspended(id: string, suspended: boolean): boolean {
  return db().prepare(`UPDATE cards SET suspended = ? WHERE id = ?`).run(suspended ? 1 : 0, id).changes === 1;
}

const csvField = (s: string) => `"${s.replace(/"/g, '""')}"`;

// En-têtes reconnus par Anki (2.1.55+) à l'import d'un fichier texte.
export function cardsToCsv(cards: Card[]): string {
  const header = "#separator:Comma\n#html:false\n#columns:Mot,Définition,Exemple,Traduction,Phrase,Source\n";
  const rows = cards.map((c) =>
    [c.term, c.definition, c.example ?? "", c.fr, c.contexts[0]?.sentence ?? "", c.contexts[0]?.sourceTitle ?? ""].map(csvField).join(","),
  );
  return header + rows.map((r) => `${r}\n`).join("");
}
