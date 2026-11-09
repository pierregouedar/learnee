import { db } from "@/lib/db";
import type { Tier } from "@/lib/tiers";

// Clé d'un thème d'intérêt du profil ("comm", "ia"…) ou "libre".
export type Domain = string;
export type SubjectSource = "rss" | "paste" | "topic";
export type Keyword = { word: string; definition: string };

export type Subject = {
  id: string;
  domain: Domain;
  source: SubjectSource;
  sourceRef?: string; // URL ou thème
  tier: Tier;
  title: string;
  article: string;
  task: string; // consigne en français
  guideQuestions: string[];
  keywords: Keyword[];
  structure?: string;
  status: "ready" | "used" | "expired";
  createdAt: string;
};

export type NewSubject = Omit<Subject, "id" | "status" | "createdAt">;

type Row = {
  id: string;
  domain: Domain;
  source: SubjectSource;
  source_ref: string | null;
  tier: number;
  title: string;
  article: string;
  task: string;
  guide_questions: string;
  keywords: string;
  structure: string | null;
  status: Subject["status"];
  created_at: string;
};

const toSubject = (r: Row): Subject => ({
  id: r.id,
  domain: r.domain,
  source: r.source,
  sourceRef: r.source_ref ?? undefined,
  tier: r.tier as Tier,
  title: r.title,
  article: r.article,
  task: r.task,
  guideQuestions: JSON.parse(r.guide_questions),
  keywords: JSON.parse(r.keywords),
  structure: r.structure ?? undefined,
  status: r.status,
  createdAt: r.created_at,
});

export function insertSubject(s: NewSubject): Subject {
  const id = crypto.randomUUID();
  db()
    .prepare(
      `INSERT INTO subjects (id, domain, source, source_ref, tier, title, article, task, guide_questions, keywords, structure, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      s.domain,
      s.source,
      s.sourceRef ?? null,
      s.tier,
      s.title,
      s.article,
      s.task,
      JSON.stringify(s.guideQuestions),
      JSON.stringify(s.keywords),
      s.structure ?? null,
      new Date().toISOString(),
    );
  return getSubject(id)!;
}

export function getSubject(id: string): Subject | undefined {
  const row = db().prepare(`SELECT * FROM subjects WHERE id = ?`).get(id) as Row | undefined;
  return row && toSubject(row);
}

export function listReadySubjects(domain?: Domain): Subject[] {
  const rows = domain
    ? db().prepare(`SELECT * FROM subjects WHERE status = 'ready' AND domain = ? ORDER BY created_at DESC`).all(domain)
    : db().prepare(`SELECT * FROM subjects WHERE status = 'ready' ORDER BY created_at DESC`).all();
  return (rows as Row[]).map(toSubject);
}

export function markSubjectUsed(id: string) {
  db().prepare(`UPDATE subjects SET status = 'used' WHERE id = ?`).run(id);
}
