"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTargetLanguage } from "@/components/profile-provider";

type Filter = "all" | "active" | "off";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "active", label: "En révision" },
  { value: "off", label: "Mis de côté" },
];

export type VocabItemView = {
  id: string;
  term: string;
  definition: string;
  example?: string;
  fr: string;
  suspended: boolean;
  origin: "kept" | "correction";
  context?: { sentence: string; sourceTitle: string };
};

export function VocabList({ items, readOnly }: { items: VocabItemView[]; readOnly: boolean }) {
  const { code: lang } = useTargetLanguage();
  const [suspended, setSuspended] = useState(() => new Map(items.map((i) => [i.id, i.suspended])));
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  async function toggle(id: string, value: boolean) {
    setError(null);
    setSuspended((prev) => new Map(prev).set(id, value));
    const res = await fetch(`/api/cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: value }),
    }).catch(() => null);
    if (!res?.ok) {
      setSuspended((prev) => new Map(prev).set(id, !value));
      setError("La modification n'a pas pu être enregistrée. Réessaie.");
    }
  }

  const q = query.trim().toLowerCase();
  const shown = items.filter((i) => {
    const off = suspended.get(i.id) ?? false;
    if (filter === "active" && off) return false;
    if (filter === "off" && !off) return false;
    return !q || i.term.toLowerCase().includes(q) || i.fr.toLowerCase().includes(q) || i.definition.toLowerCase().includes(q);
  });

  return (
    <section aria-labelledby="words-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid w-full gap-2 sm:w-72">
          <label htmlFor="vocab-search" className="text-sm font-medium">
            Chercher un mot
          </label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="vocab-search" type="search" className="h-9 pl-8" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          </div>
        </div>
        <div role="group" aria-label="Filtrer les mots" className="inline-flex rounded-lg border bg-card p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                filter === f.value ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <h2 id="words-title" className="font-article text-xl font-normal">
          Tes mots
        </h2>
        <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
          {shown.length} {shown.length > 1 ? "mots" : "mot"}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Aucun mot ne correspond. Essaie une autre recherche ou un autre filtre.</p>
      ) : (
        <ul className="divide-y border-y">
          {shown.map((i) => {
            const off = suspended.get(i.id) ?? false;
            return (
              <li key={i.id} className={cn("flex flex-wrap items-start gap-x-6 gap-y-3 py-4", off && "bg-muted/40")}>
                <div className="min-w-0 flex-1 basis-64 space-y-1">
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span lang={lang} className={cn("font-article text-lg font-normal break-words", off && "text-muted-foreground")}>
                      {i.term}
                    </span>
                    <span className="break-words">{i.fr}</span>
                  </p>
                  {i.definition && (
                    <p lang={lang} className="text-sm break-words text-muted-foreground">
                      {i.definition}
                    </p>
                  )}
                  {i.context && (
                    <p className="text-sm break-words text-muted-foreground">
                      <span lang={lang} className="font-article italic">« {i.context.sentence} »</span>
                      {i.context.sourceTitle && <span className="text-xs">{`, ${i.context.sourceTitle}`}</span>}
                    </p>
                  )}
                  {i.origin === "correction" && <p className="text-xs text-muted-foreground">Proposé par une correction</p>}
                </div>
                <div className="shrink-0">
                  {i.origin === "correction" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={!off}
                        disabled={readOnly}
                        onChange={(e) => toggle(i.id, !e.target.checked)}
                      />
                      Ajouter à mes révisions
                    </label>
                  ) : off ? (
                    <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      Mis de côté
                      {!readOnly && (
                        <Button variant="ghost" size="sm" onClick={() => toggle(i.id, false)}>
                          Réviser à nouveau
                        </Button>
                      )}
                    </span>
                  ) : (
                    !readOnly && (
                      <Button variant="outline" size="sm" onClick={() => toggle(i.id, true)}>
                        Je connais déjà
                      </Button>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
