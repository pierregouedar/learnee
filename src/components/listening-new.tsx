"use client";
import { AudioLines, FileAudio, Newspaper, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/page";
import { Input } from "@/components/ui/input";
import { NO_AUDIO_MESSAGE } from "@/lib/audio/errors";
import type { Headline } from "@/lib/news/headlines";
import { useTargetLanguage } from "@/components/profile-provider";

const MAX_BYTES = 10_000_000; // miroir de services/upload-listening.ts (le serveur revalide)
// Miroir de ALLOWED_EXTENSIONS dans services/upload-listening.ts.
const ACCEPT_EXTENSIONS = ".mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.webm,.mp4,.mov,.flac";

type Router = ReturnType<typeof useRouter>;

async function send<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue. Réessaie.");
  return data as T;
}

async function openAttempt(router: Router, listeningId: string) {
  const attempt = await send<{ id: string }>(`/api/listening/${listeningId}/attempts`, { method: "POST" });
  router.push(`/ecoute/${attempt.id}`);
}

export function StartListening({ listeningId, variant = "default" }: { listeningId: string; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await openAttempt(router, listeningId);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant={variant} onClick={start} disabled={busy}>{busy ? "Ouverture…" : "Commencer"}</Button>
      {error && <p role="alert" className="max-w-56 text-right text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** `domains` : thèmes d'actualité du profil, clé → libellé. */
export function ListeningNew({ audioEnabled, domains }: { audioEnabled: boolean; domains: Record<string, string> }) {
  const { code: lang } = useTargetLanguage();
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [headlines, setHeadlines] = useState<Headline[] | null>(null);
  const [headlineId, setHeadlineId] = useState("");

  // Mêmes titres du jour que la page Écrit (flux RSS, gratuit) ; seul le script choisi est payant.
  useEffect(() => {
    if (!audioEnabled) return;
    let alive = true;
    fetch("/api/news")
      .then((res) => (res.ok ? (res.json() as Promise<Headline[]>) : Promise.reject(new Error())))
      .then((list) => alive && setHeadlines(list))
      .catch(() => alive && setHeadlines([]));
    return () => {
      alive = false;
    };
  }, [audioEnabled]);
  const [busy, setBusy] = useState<"generate" | "upload" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "generate" | "upload", create: () => Promise<{ id: string }>) {
    setBusy(kind);
    setError(null);
    try {
      const listening = await create();
      await openAttempt(router, listening.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  function generate(e: FormEvent) {
    e.preventDefault();
    void run("generate", () =>
      send("/api/listening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic }) }),
    );
  }

  function generateFromNews(e: FormEvent) {
    e.preventDefault();
    if (!headlineId) return;
    void run("generate", () =>
      send("/api/listening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headlineId: Number(headlineId) }),
      }),
    );
  }

  function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("Fichier trop lourd (10 Mo maximum).");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    void run("upload", () => send("/api/listening/upload", { method: "POST", body: form }));
  }

  const disabled = !audioEnabled || busy !== null;

  return (
    <Panel id="listening-new" title="Nouvel exercice" description="Crée ton audio à partir d’une actualité, d’un thème ou d’un enregistrement.">
      {!audioEnabled && (
        <div role="status" className="flex gap-3 rounded-lg bg-muted p-3 text-sm">
          <AudioLines aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-0.5">
            <p className="font-medium">Création d’audio indisponible</p>
            <p className="text-muted-foreground">{NO_AUDIO_MESSAGE}</p>
          </div>
        </div>
      )}
      {busy && (
        <div role="status" className="flex items-center gap-3 rounded-lg border bg-accent/50 p-3 text-sm">
          <span className="size-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden />
          {busy === "generate"
            ? "Création de l'audio en cours, cela peut prendre quelques minutes…"
            : "Transcription en cours, environ une minute…"}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="divide-y">
        <form onSubmit={generateFromNews} className="space-y-2 pb-4">
          <label htmlFor="listening-news" className="flex items-center gap-2 text-sm font-medium">
            <Newspaper aria-hidden className="size-4 text-muted-foreground" />
            À partir d’une actualité du jour
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              id="listening-news"
              value={headlineId}
              onChange={(e) => setHeadlineId(e.target.value)}
              disabled={disabled || !headlines?.length}
              className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm disabled:opacity-50"
            >
              <option value="">
                {headlines === null && audioEnabled ? "Chargement des actualités…" : headlines?.length ? "Choisis une actualité" : "Aucune actualité pour l’instant"}
              </option>
              {Object.entries(domains).map(([d, label]) => {
                const items = (headlines ?? []).filter((h) => h.domain === d);
                return items.length ? (
                  <optgroup key={d} label={label}>
                    {items.map((h) => (
                      <option key={h.id} value={h.id} lang={lang}>
                        {h.title}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
            <Button type="submit" variant="outline" disabled={disabled || !headlineId}>Générer</Button>
          </div>
        </form>

        <form onSubmit={generate} className="space-y-2 py-4">
          <label htmlFor="listening-topic" className="flex items-center gap-2 text-sm font-medium">
            <Sparkles aria-hidden className="size-4 text-muted-foreground" />
            Générer un audio sur un thème
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="listening-topic" value={topic} maxLength={200} onChange={(e) => setTopic(e.target.value)} disabled={disabled} />
            <Button type="submit" variant="outline" disabled={disabled || topic.trim().length < 3}>Générer</Button>
          </div>
        </form>

        <form onSubmit={upload} className="space-y-2 pt-4">
          <label htmlFor="listening-file" className="flex items-center gap-2 text-sm font-medium">
            <FileAudio aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            Importer un audio réel de 1 à 4 minutes
          </label>
          <p id="listening-file-hint" className="text-xs text-muted-foreground">
            Pub, podcast ou journal. Formats audio ou vidéo (mp3, m4a, aac, wav, ogg, opus, webm, mp4, mov, flac), 10 Mo maximum.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="listening-file"
              type="file"
              accept={ACCEPT_EXTENSIONS}
              aria-describedby="listening-file-hint"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={disabled}
              className="min-w-0"
            />
            <Button type="submit" variant="outline" disabled={disabled || !file}>Importer</Button>
          </div>
        </form>
      </div>
    </Panel>
  );
}
