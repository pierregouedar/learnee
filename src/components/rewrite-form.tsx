"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WordCounter } from "@/components/word-counter";
import { postJson } from "@/lib/post-json";
import { countWords } from "@/lib/text";
import { useTargetLanguage } from "@/components/profile-provider";

// pas de sauvegarde automatique, la réécriture prend une dizaine de minutes ; l'ajouter si elle perd un texte.
export function RewriteForm({ sessionId, initial }: { sessionId: string; initial: string }) {
  const { code: lang, nameFr } = useTargetLanguage();
  const router = useRouter();
  const [pe, setPe] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/sessions/${sessionId}/rewrite`, { pe });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <label htmlFor="rewrite" className="font-semibold">
            Ta nouvelle version en {nameFr}
          </label>
          <WordCounter count={countWords(pe)} target={null} />
        </div>
        <Textarea
          id="rewrite"
          rows={12}
          value={pe}
          onChange={(e) => setPe(e.target.value)}
          disabled={busy}
          lang={lang}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          className="font-article px-3 py-2.5 text-lg leading-relaxed md:text-lg"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            Envoyer ma réécriture
          </Button>
          {busy && (
            <p role="status" className="text-sm text-muted-foreground motion-safe:animate-pulse">
              Vérification en cours, environ une minute…
            </p>
          )}
        </div>
      </form>
    </Panel>
  );
}
