"use client";
import { BookmarkPlus, Check, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cleanSelection, sentenceAround } from "@/lib/lookup";
import { useTargetLanguage } from "@/components/profile-provider";

type Definition = { definition: string; exemple: string; fr: string };

/** Mot sous le doigt : position du curseur de texte au point touché, étendue aux lettres voisines. */
function wordAtPoint(x: number, y: number): { word: string; text: string; start: number; range: Range } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const pos = doc.caretPositionFromPoint?.(x, y);
  const legacy = pos ? null : doc.caretRangeFromPoint?.(x, y);
  const node = pos?.offsetNode ?? legacy?.startContainer;
  const offset = pos?.offset ?? legacy?.startOffset ?? 0;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent ?? "";
  const isLetter = (c: string | undefined) => !!c && /[\p{L}'’-]/u.test(c);
  let start = offset;
  let end = offset;
  while (start > 0 && isLetter(text[start - 1])) start--;
  while (end < text.length && isLetter(text[end])) end++;
  if (start === end) return null;
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return { word: text.slice(start, end), text, start, range };
}

// Éléments qui gardent leur propre rôle au toucher (bouton, lien, phrase à réécouter…).
const INTERACTIVE = "button, a, input, textarea, select, label, [role='button'], [data-radix-popper-content-wrapper]";
type Target = { word: string; sentence: string; x: number; y: number };
type Props = {
  children: React.ReactNode;
  sourceType: "reading" | "listening";
  sourceId: string;
  sourceTitle: string;
  disabled?: boolean;
};

export function WordLookup({ children, sourceType, sourceId, sourceTitle, disabled = false }: Props) {
  const language = useTargetLanguage();
  const lang = language.code;
  const box = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const lastKey = useRef("");
  const [target, setTarget] = useState<Target | null>(null);
  const [definition, setDefinition] = useState<Definition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFr, setShowFr] = useState(false);
  const [keep, setKeep] = useState<"idle" | "saving" | "kept">("idle");

  useEffect(() => {
    if (disabled) return;

    const open = async (t: Target) => {
      const id = ++requestId.current;
      setTarget(t);
      setDefinition(null);
      setError(null);
      setShowFr(false);
      setKeep("idle");
      try {
        const res = await fetch("/api/define", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: t.word, sentence: t.sentence }),
        });
        const body = await res.json().catch(() => ({}));
        if (id !== requestId.current) return;
        if (res.ok) setDefinition(body as Definition);
        else setError(body.error ?? "Définition indisponible pour le moment. Réessaie.");
      } catch {
        if (id === requestId.current) setError("Définition indisponible : vérifie ta connexion.");
      }
    };

    const readSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !box.current) return;
      const range = sel.getRangeAt(0);
      if (!box.current.contains(range.commonAncestorContainer)) return;
      const word = cleanSelection(sel.toString());
      if (!word) return;
      const sentence = sentenceAround(range.startContainer.textContent ?? "", range.startOffset);
      const key = `${word}\n${sentence}`;
      if (key === lastKey.current) return;
      lastKey.current = key;
      const rect = range.getBoundingClientRect();
      const base = box.current.getBoundingClientRect();
      void open({ word, sentence, x: rect.left - base.left + rect.width / 2, y: rect.bottom - base.top });
    };

    // Sur écran tactile, toucher un mot suffit (surligner au doigt est pénible) ; la sélection reste possible
    // pour plusieurs mots. Souris : on garde la sélection (ou le double-clic), un simple clic ne fait rien.
    let pointerType = "";
    const onPointerDown = (e: PointerEvent) => {
      pointerType = e.pointerType;
    };
    const onTap = (e: MouseEvent) => {
      if (pointerType !== "touch" && pointerType !== "pen") return;
      if (!box.current || (e.target as Element).closest(INTERACTIVE)) return;
      if (window.getSelection()?.isCollapsed === false) return;
      const hit = wordAtPoint(e.clientX, e.clientY);
      if (!hit || !box.current.contains(hit.range.startContainer)) return;
      const word = cleanSelection(hit.word);
      if (!word) return;
      const sentence = sentenceAround(hit.text, hit.start);
      lastKey.current = `${word}\n${sentence}`;
      const rect = hit.range.getBoundingClientRect();
      const base = box.current.getBoundingClientRect();
      void open({ word, sentence, x: rect.left - base.left + rect.width / 2, y: rect.bottom - base.top });
    };
    const el = box.current;
    el?.addEventListener("pointerdown", onPointerDown);
    el?.addEventListener("click", onTap);

    // selectionchange couvre souris et poignées de sélection sur téléphone ; on attend la fin du geste.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(readSelection, 400);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
      el?.removeEventListener("pointerdown", onPointerDown);
      el?.removeEventListener("click", onTap);
    };
  }, [disabled]);

  function close() {
    requestId.current++;
    lastKey.current = "";
    setTarget(null);
  }

  function speak() {
    if (!target) return;
    if (!("speechSynthesis" in window)) {
      setError("La prononciation n'est pas disponible sur cet appareil.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(target.word);
    utterance.lang = language.bcp47;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function keepWord() {
    if (!target || !definition) return;
    setKeep("saving");
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        term: target.word,
        definition: definition.definition,
        example: definition.exemple || undefined,
        fr: definition.fr,
        context: { sentence: target.sentence, sourceType, sourceId, sourceTitle },
      }),
    }).catch(() => null);
    if (res?.ok) setKeep("kept");
    else {
      setKeep("idle");
      setError("Le mot n'a pas pu être gardé. Réessaie.");
    }
  }

  return (
    <div ref={box} className="relative">
      {children}
      <Popover open={!!target} onOpenChange={(o) => { if (!o) close(); }}>
        {target && (
          <PopoverAnchor asChild>
            <span aria-hidden className="pointer-events-none absolute size-0" style={{ left: target.x, top: target.y }} />
          </PopoverAnchor>
        )}
        <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4" onOpenAutoFocus={(e) => e.preventDefault()}>
          {target && (
            <>
              <div className="flex items-center justify-between gap-2 border-b pb-2">
                <p lang={lang} className="font-article text-lg font-normal break-words">{target.word}</p>
                <Button variant="ghost" size="icon-sm" aria-label="Écouter la prononciation" onClick={speak}>
                  <Volume2 />
                </Button>
              </div>
              {!definition && !error && (
                <div role="status" className="space-y-2">
                  <p className="text-sm text-muted-foreground">Recherche de la définition… Cela peut prendre jusqu&apos;à une minute.</p>
                  <div aria-hidden className="space-y-1.5 motion-safe:animate-pulse">
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="h-3 w-4/5 rounded bg-muted" />
                  </div>
                </div>
              )}
              {definition && (
                <>
                  <p lang={lang} className="leading-relaxed break-words">{definition.definition}</p>
                  {definition.exemple && <p lang={lang} className="font-article text-sm italic break-words text-muted-foreground">{definition.exemple}</p>}
                  {showFr ? (
                    <p className="rounded-md bg-muted px-2.5 py-1.5 text-sm break-words"><span className="text-muted-foreground">Traduction : </span>{definition.fr}</p>
                  ) : (
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setShowFr(true)}>
                      Voir la traduction
                    </Button>
                  )}
                  <div className="border-t pt-3">
                    <Button size="sm" className="w-full" onClick={keepWord} disabled={keep !== "idle"}>
                      {keep === "kept" ? <Check aria-hidden /> : <BookmarkPlus aria-hidden />}
                      {keep === "kept" ? "Gardé" : keep === "saving" ? "Enregistrement…" : "Garder"}
                    </Button>
                  </div>
                </>
              )}
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
