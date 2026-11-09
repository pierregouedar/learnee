"use client";
import { FileText, Newspaper, RotateCw, Sparkles, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GenerationStatus } from "@/components/generation-status";
import { EmptyState, IconBadge, Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Progress } from "@/lib/generation-progress";
import { postWithProgress } from "@/lib/post-progress";
import type { Headline } from "@/lib/news/headlines";
import type { Domain, Subject } from "@/lib/repo/subjects";
import { useTargetLanguage } from "@/components/profile-provider";

const SOURCE_ICONS: Record<Subject["source"], LucideIcon> = { rss: Newspaper, topic: Sparkles, paste: FileText };
const ARTICLE_MIN = 200;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue. Réessaie.");
  return data as T;
}

const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

function host(ref?: string) {
  try {
    return ref ? new URL(ref).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

function meta(s: Subject, labels: Record<string, string>) {
  const from = s.source === "rss" ? host(s.sourceRef) : s.source === "paste" ? "article collé" : "thème proposé";
  return [labels[s.domain] ?? s.domain, from, `ajouté le ${day(s.createdAt)}`].filter(Boolean).join(", ");
}

function headlineMeta(h: Headline, labels: Record<string, string>) {
  const date = h.publishedAt && !Number.isNaN(Date.parse(h.publishedAt)) ? day(h.publishedAt) : null;
  return [labels[h.domain] ?? h.domain, h.source, date].filter(Boolean).join(", ");
}

function SubjectRow({ s, labels, featured, action }: { s: Subject; labels: Record<string, string>; featured?: boolean; action?: React.ReactNode }) {
  const { code: lang } = useTargetLanguage();
  return (
    <li className={"flex flex-wrap items-center gap-x-4 gap-y-3 py-4"}>
      <IconBadge icon={SOURCE_ICONS[s.source]} tone={featured ? "primary" : "accent"} />
      <div className="min-w-0 flex-1 basis-56">
        {featured && <p className="text-xs font-medium text-primary">Le plus récent</p>}
        <p lang={lang} className="font-article text-lg leading-snug break-words">{s.title}</p>
        <p className="text-sm text-muted-foreground">{meta(s, labels)}</p>
      </div>
      {action}
    </li>
  );
}

/** `domains` : libellés des domaines (thèmes du profil et "libre"), clé → libellé. */
export function SubjectPicker({ ready, domains, readOnly = false }: { ready: Subject[]; domains: Record<string, string>; readOnly?: boolean }) {
  const { code: lang, nameFr } = useTargetLanguage();
  const router = useRouter();
  const [domain, setDomain] = useState<Domain | "all">("all");
  const [topic, setTopic] = useState("");
  const [article, setArticle] = useState("");
  const [examMode, setExamMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [headlines, setHeadlines] = useState<Headline[] | null>(null);
  const [headlinesError, setHeadlinesError] = useState(false);

  // Titres lus dans les flux à l'ouverture (gratuit) ; l'article n'est rédigé (payant) que pour le titre choisi.
  const loadHeadlines = useCallback(async (refresh: boolean) => {
    try {
      const res = await fetch(`/api/news${refresh ? "?refresh=1" : ""}`);
      if (!res.ok) throw new Error();
      setHeadlines((await res.json()) as Headline[]);
      setHeadlinesError(false);
    } catch {
      setHeadlinesError(true);
      setHeadlines((h) => h ?? []);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    fetch("/api/news")
      .then((res) => (res.ok ? (res.json() as Promise<Headline[]>) : Promise.reject(new Error())))
      .then((list) => alive && setHeadlines(list))
      .catch(() => {
        if (!alive) return;
        setHeadlinesError(true);
        setHeadlines([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const shownHeadlines = (headlines ?? []).filter((h) => domain === "all" || h.domain === domain);
  const shown = ready.filter((s) => domain === "all" || s.domain === domain);
  const news = shown.filter((s) => s.source === "rss");
  const others = shown.filter((s) => s.source !== "rss");

  async function start(getSubject: () => Promise<Subject>, isGenerating = false) {
    setBusy(true);
    setGenerating(isGenerating);
    setProgress(null);
    setError(null);
    try {
      const subject = await getSubject();
      await postJson("/api/sessions", { subjectId: subject.id, examMode });
      router.push("/rediger");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const pick = (s: Subject, primary: boolean) =>
    readOnly ? undefined : (
      <Button size="sm" variant={primary ? "default" : "outline"} disabled={busy} onClick={() => start(async () => s)}>
        Choisir<span className="sr-only"> : {s.title}</span>
      </Button>
    );

  const filters = (
    <div role="group" aria-label="Filtrer par domaine" className="flex flex-wrap gap-1">
      {["all", ...Object.keys(domains).filter((k) => k !== "libre")].map((d) => (
        <Button
          key={d}
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={domain === d}
          className={cn(domain === d && "bg-accent text-accent-foreground hover:bg-accent")}
          onClick={() => setDomain(d)}
        >
          {d === "all" ? "Tous" : domains[d]}
        </Button>
      ))}
    </div>
  );

  const lists = (
    <div className="space-y-8">
      <section aria-labelledby="news-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="space-y-1">
            <h2 id="news-title" className="font-article text-xl font-normal">Actualités du jour</h2>
            <p className="text-sm text-muted-foreground">Choisis un titre : l’article en {nameFr} est rédigé à ce moment-là, en 20 secondes environ.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {filters}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={headlines === null || busy}
              onClick={() => {
                setHeadlines(null);
                void loadHeadlines(true);
              }}
            >
              <RotateCw aria-hidden className={cn("size-4", headlines === null && "motion-safe:animate-spin")} />
              {headlines === null ? "Actualisation…" : "Actualiser"}
            </Button>
          </div>
        </div>
        {news.length > 0 && (
          <ul className="divide-y border-y">
            {news.map((s, i) => (
              <SubjectRow key={s.id} s={s} labels={domains} featured={i === 0} action={pick(s, i === 0)} />
            ))}
          </ul>
        )}
        {headlines === null ? (
          <ul aria-busy="true" aria-label="Chargement des actualités" className="divide-y border-y">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-4 py-4">
                <span className="size-10 shrink-0 rounded-lg bg-muted motion-safe:animate-pulse" />
                <span className="flex-1 space-y-2">
                  <span className="block h-4 w-4/5 rounded bg-muted motion-safe:animate-pulse" />
                  <span className="block h-3 w-1/3 rounded bg-muted motion-safe:animate-pulse" />
                </span>
              </li>
            ))}
          </ul>
        ) : shownHeadlines.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title={headlinesError ? "Actualités indisponibles pour le moment" : "Pas de nouveau titre pour l’instant"}
            description={headlinesError ? "Réessaie avec « Actualiser », ou propose un thème en attendant." : "Reviens plus tard, ou propose un thème ou un article."}
          />
        ) : (
          <ul className="divide-y border-y">
            {shownHeadlines.map((h, i) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
                <IconBadge icon={Newspaper} tone={i === 0 && news.length === 0 ? "primary" : "accent"} />
                <div className="min-w-0 flex-1 basis-56">
                  <p lang={lang} className="font-article text-lg leading-snug break-words">{h.title}</p>
                  <p className="text-sm text-muted-foreground">{headlineMeta(h, domains)}</p>
                </div>
                {!readOnly && (
                  <Button
                    size="sm"
                    variant={i === 0 && news.length === 0 ? "default" : "outline"}
                    disabled={busy}
                    onClick={() => start(() => postWithProgress<Subject>(`/api/news/${h.id}`, {}, setProgress), true)}
                  >
                    Écrire dessus<span className="sr-only"> : {h.title}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 && (
        <section aria-labelledby="others-title" className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="others-title" className="font-article text-xl font-normal">Autres sujets prêts</h2>
            <p className="text-sm tabular-nums text-muted-foreground">{others.length}</p>
          </div>
          <ul className="divide-y border-y">
            {others.map((s) => (
              <SubjectRow key={s.id} s={s} labels={domains} action={pick(s, false)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );

  if (readOnly) {
    return (
      <div className="space-y-6">
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Compte en lecture seule : tu peux consulter les sujets prêts et l’historique, pas démarrer un sujet.
        </p>
        {lists}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {busy &&
        (generating ? (
          <GenerationStatus progress={progress} fallback="Préparation du sujet…" />
        ) : (
          <div role="status" className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm">
            <span className="size-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden />
            Ouverture du sujet…
          </div>
        ))}
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid items-start gap-x-8 gap-y-6 lg:grid-cols-5 lg:grid-rows-[auto_1fr]">
        <label className="flex lg:col-span-2 lg:col-start-4 lg:row-start-1 cursor-pointer items-start gap-3 rounded-xl border bg-card p-5 transition-colors has-[:checked]:border-primary/50 has-[:checked]:bg-accent/50">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-primary"
            checked={examMode}
            onChange={(e) => setExamMode(e.target.checked)}
          />
          <span className="space-y-1">
            <span className="block font-medium">Mode examen</span>
            <span className="block text-sm text-muted-foreground">Chrono de 2 h, sans dictionnaire ni mots clés.</span>
          </span>
        </label>

        <div className="lg:col-span-3 lg:col-start-1 lg:row-span-2 lg:row-start-1">{lists}</div>

        <Panel id="own-subject" className="lg:col-span-2 lg:col-start-4 lg:row-start-2" title="Ton propre sujet" description="Pas d’inspiration dans la liste ? Crée un sujet à partir d’un thème ou d’un article.">
          <Tabs defaultValue="theme">
            <TabsList className="w-full">
              <TabsTrigger value="theme">Un thème</TabsTrigger>
              <TabsTrigger value="coller">Coller un article</TabsTrigger>
            </TabsList>

            <TabsContent value="theme" className="pt-4">
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  start(() => postWithProgress<Subject>("/api/subjects", { mode: "topic", topic }, setProgress), true);
                }}
              >
                <div className="space-y-2">
                  <label htmlFor="topic" className="text-sm font-medium">
                    Thème
                  </label>
                  <Input
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ex. : les influenceurs virtuels dans la mode"
                    minLength={3}
                    maxLength={200}
                    required
                  />
                  <p className="text-sm text-muted-foreground">On écrit un article sur ce thème, environ 20 secondes.</p>
                </div>
                <Button type="submit" disabled={busy}>
                  Générer le sujet
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="coller" className="space-y-3 pt-4">
              <div className="space-y-2">
                <label htmlFor="article" className="text-sm font-medium">
                  Article en {nameFr}
                </label>
                <Textarea
                  id="article"
                  value={article}
                  onChange={(e) => setArticle(e.target.value)}
                  lang={lang}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  rows={8}
                  className="max-h-96 font-article md:text-base"
                  placeholder={`Colle ici un article en ${nameFr} (200 caractères minimum).`}
                />
                <p className={cn("text-sm tabular-nums text-muted-foreground", article.trim().length >= ARTICLE_MIN && "text-primary")}>
                  {article.trim().length} / {ARTICLE_MIN} caractères minimum
                </p>
              </div>
              <Button
                disabled={busy || article.trim().length < ARTICLE_MIN}
                onClick={() => start(() => postWithProgress<Subject>("/api/subjects", { mode: "paste", article }, setProgress), true)}
              >
                Créer le sujet
              </Button>
            </TabsContent>
          </Tabs>
        </Panel>
      </div>
    </div>
  );
}
