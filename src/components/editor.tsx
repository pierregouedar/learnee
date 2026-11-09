"use client";
import { Check, CloudOff, MousePointerClick } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExamTimer } from "@/components/exam-timer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WordCounter } from "@/components/word-counter";
import { WordLookup } from "@/components/word-lookup";
import type { Session } from "@/lib/repo/sessions";
import type { Subject } from "@/lib/repo/subjects";
import { countWords } from "@/lib/text";
import { useTargetLanguage } from "@/components/profile-provider";

const MIN_WORDS = 20; // miroir de services/correct-session.ts (le serveur revalide)

type Draft = { cr: string; pe: string };
type Props = {
  session: Session;
  subject: Subject;
  tierLabel: string;
  crTarget: readonly [number, number] | null;
  peTarget: readonly [number, number];
  readOnly?: boolean; // compte « lecture seule » : aucun envoi au serveur
};

export function Editor({ session, subject, tierLabel, crTarget, peTarget, readOnly = false }: Props) {
  const { code: lang, nameFr } = useTargetLanguage();
  const router = useRouter();
  const storageKey = `draft:${session.id}`;
  const [draft, setDraft] = useState<Draft>({ cr: session.cr, pe: session.pe });
  const [saveState, setSaveState] = useState<"saved" | "pending" | "offline">("saved");
  const [correcting, setCorrecting] = useState(session.status === "correcting");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(session.error ?? null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const latest = useRef<Draft>(draft);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const expiredRef = useRef(false);
  const correctingRef = useRef(correcting);
  useEffect(() => {
    correctingRef.current = correcting;
  }, [correcting]);
  const saveStateRef = useRef(saveState);
  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  const flush = useCallback(
    async (keepalive = false): Promise<boolean> => {
      clearTimeout(timer.current);
      try {
        const res = await fetch(`/api/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(latest.current),
          keepalive,
        });
        // 401 : session expirée, pas un problème de connexion. Le brouillon reste dans localStorage
        // (déjà écrit par update()), pas de message "hors ligne" trompeur.
        if (res.status === 401) {
          expiredRef.current = true;
          setSessionExpired(true);
          return false;
        }
        expiredRef.current = false;
        setSaveState(res.ok ? "saved" : "offline");
        return res.ok;
      } catch {
        expiredRef.current = false;
        setSaveState("offline");
        return false;
      }
    },
    [session.id],
  );

  const update = useCallback(
    (patch: Partial<Draft>) => {
      if (readOnly) return;
      const next = { ...latest.current, ...patch };
      latest.current = next;
      setDraft(next);
      setSaveState("pending");
      try {
        localStorage.setItem(storageKey, JSON.stringify({ ...next, savedAt: new Date().toISOString() }));
      } catch {}
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 1000);
    },
    [flush, readOnly, storageKey],
  );

  // Copie locale plus récente que le serveur (onglet fermé avant l'envoi) : on la reprend.
  useEffect(() => {
    if (readOnly) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const local = JSON.parse(raw) as Draft & { savedAt: string };
      if (local.savedAt > session.updatedAt && (local.cr !== session.cr || local.pe !== session.pe)) {
        update({ cr: local.cr, pe: local.pe });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retente l'envoi dès que la connexion revient si le dernier envoi n'a pas abouti.
  useEffect(() => {
    const onOnline = () => {
      if (!readOnly && saveStateRef.current !== "saved") void flush();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush, readOnly]);

  // Ne perd pas le texte tapé juste avant une navigation côté client : on force l'envoi.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void flush(true);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHide = () => {
      // pas de flush pendant la correction : la copie est verrouillée côté serveur (409) et le
      // message "hors ligne" induirait en erreur. Jamais d'envoi en lecture seule.
      if (document.visibilityState === "hidden" && !correctingRef.current && !readOnly) void flush(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush, readOnly]);

  useEffect(() => {
    if (!correcting) return;
    const poll = setInterval(async () => {
      const res = await fetch(`/api/sessions/${session.id}`);
      if (!res.ok) return;
      const s = (await res.json()) as Session;
      if (s.status === "corrected") {
        try { localStorage.removeItem(storageKey); } catch {}
        router.push(`/sessions/${session.id}`);
      } else if (s.status === "draft") {
        setCorrecting(false);
        setError(s.error ?? "La correction a échoué. Ton brouillon est conservé.");
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [correcting, router, session.id, storageKey]);

  async function correct() {
    if (starting || correcting) return;
    setStarting(true);
    setError(null);
    try {
      const ok = await flush();
      if (!ok) {
        // Session expirée : l'alerte dédiée suffit, pas le message "connexion".
        if (!expiredRef.current) {
          setError("Ton brouillon n'a pas pu être envoyé au serveur. Vérifie ta connexion et réessaie.");
        }
        return;
      }
      const res = await fetch(`/api/sessions/${session.id}/correct`, { method: "POST" });
      if (res.status === 202) {
        setCorrecting(true);
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Impossible de lancer la correction.");
    } catch {
      setError("Impossible de lancer la correction.");
    } finally {
      setStarting(false);
    }
  }

  async function abandon() {
    clearTimeout(timer.current);
    const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setError("Impossible d'abandonner ce sujet pour le moment. Réessaie.");
      return;
    }
    try { localStorage.removeItem(storageKey); } catch {}
    router.push("/ecrit");
    router.refresh();
  }

  const crWords = countWords(draft.cr);
  const peWords = countWords(draft.pe);
  const tooShort = crWords + peWords < MIN_WORDS;
  const lookupOn = !readOnly && !session.examMode;

  return (
    <div className="space-y-6">
      {sessionExpired && (
        <div role="alert" className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p>Ta session a expiré. Reconnecte-toi : ton texte est gardé sur cet appareil.</p>
          <Link href="/login?next=/rediger" className="font-medium underline underline-offset-2">
            Se reconnecter
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">Sujet en cours</p>
          <Badge variant="secondary">{tierLabel}</Badge>
          {session.examMode && <Badge variant="outline">Mode examen</Badge>}
          {session.isMock && <Badge>Examen blanc</Badge>}
        </div>
        {session.examMode && <ExamTimer startedAt={session.startedAt} />}
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <article className="space-y-5 rounded-xl border bg-card p-5 break-words sm:p-6 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
          <div className="space-y-2">
            <h1 lang={lang} className="font-article text-3xl leading-tight font-normal sm:text-4xl">{subject.title}</h1>
            {lookupOn && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MousePointerClick aria-hidden className="size-4 shrink-0" />
                Touche ou sélectionne un mot pour voir sa définition en {nameFr}.
              </p>
            )}
          </div>
          <WordLookup sourceType="reading" sourceId={session.id} sourceTitle={subject.title} disabled={!lookupOn}>
            <div lang={lang} className="font-article measure space-y-4 text-[1.075rem] leading-relaxed">
              {subject.article.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </WordLookup>
          {subject.keywords.length > 0 && !session.examMode && (
            <section aria-labelledby="keywords-title" className="space-y-3 border-t pt-5">
              <h2 id="keywords-title" className="font-article text-xl font-normal">Mots clés</h2>
              <dl lang={lang} className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {subject.keywords.map((k) => (
                  <div key={k.word}>
                    <dt className="font-medium">{k.word}</dt>
                    <dd className="text-muted-foreground">{k.definition}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </article>

        <div className="space-y-6">
          <Panel
            id="cr"
            title={<Step n={1}>Compte rendu en français</Step>}
            actions={<WordCounter count={crWords} target={crTarget} />}
          >
            {subject.guideQuestions.length > 0 && (
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                {subject.guideQuestions.map((q) => <li key={q}>{q}</li>)}
              </ol>
            )}
            <Textarea
              lang="fr"
              rows={8}
              aria-labelledby="cr-title"
              value={draft.cr}
              readOnly={readOnly}
              disabled={correcting || starting}
              onChange={(e) => update({ cr: e.target.value })}
              className="min-h-40 px-3 py-2.5 leading-relaxed md:text-base"
            />
          </Panel>

          <Panel
            id="pe"
            title={<Step n={2}>Écrit en {nameFr}</Step>}
            actions={<WordCounter count={peWords} target={peTarget} />}
          >
            <p className="text-sm whitespace-pre-line">{subject.task}</p>
            {subject.structure && (
              <details className="rounded-lg bg-muted px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium select-none">Modèle de structure</summary>
                <p className="pt-2 whitespace-pre-line text-muted-foreground">{subject.structure}</p>
              </details>
            )}
            <Textarea
              lang={lang}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
              rows={10}
              aria-labelledby="pe-title"
              value={draft.pe}
              readOnly={readOnly}
              disabled={correcting || starting}
              onChange={(e) => update({ pe: e.target.value })}
              className="min-h-72 font-article px-3 py-2.5 text-lg leading-relaxed md:text-lg"
            />
          </Panel>

          {correcting && (
            <div role="status" className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden />
              Correction en cours, cela peut prendre quelques minutes. Tu peux laisser la page ouverte.
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </p>
          )}

          {readOnly ? (
            <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Compte en lecture seule : tu peux suivre ce brouillon, pas le modifier.
            </p>
          ) : (
            <div className="space-y-3 rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={correct} disabled={correcting || starting || tooShort}>Corriger ma copie</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="ml-auto" disabled={correcting}>Abandonner</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Abandonner ce sujet ?</AlertDialogTitle>
                      <AlertDialogDescription>Tu ne pourras plus reprendre ce brouillon. Tu pourras choisir un autre sujet.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Continuer à écrire</AlertDialogCancel>
                      <AlertDialogAction onClick={abandon}>Abandonner</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span aria-live="polite" className="inline-flex items-center gap-1.5">
                  {saveState === "saved" && <><Check aria-hidden className="size-4 text-primary" />Brouillon enregistré</>}
                  {saveState === "pending" && "Enregistrement…"}
                  {saveState === "offline" && <><CloudOff aria-hidden className="size-4" />Enregistré sur cet appareil, envoi au serveur dès que possible</>}
                </span>
                {tooShort && <span>Au moins {MIN_WORDS} mots au total pour demander la correction.</span>}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className="grid size-6 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
        {n}
      </span>
      <span>
        <span className="sr-only">Étape {n} : </span>
        {children}
      </span>
    </span>
  );
}
