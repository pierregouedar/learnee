"use client";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { TourStep } from "@/lib/tour-steps";

const key = (login: string) => `learnee:tour:${login}`;
const read = (login: string): string | null => {
  try {
    return localStorage.getItem(key(login));
  } catch {
    return null; // stockage bloqué : la visite marche, sans être mémorisée
  }
};
// L'étape en cours vit dans localStorage (survit aux changements de page) ; ce petit store prévient le composant.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const write = (login: string, value: string) => {
  try {
    localStorage.setItem(key(login), value);
  } catch {}
  listeners.forEach((l) => l());
};

// Coordonnées dans la page (pas l'écran) : bloc et bulle défilent ensemble. `card` absent = bulle calée en bas d'écran.
// `path` : la mise en lumière reste affichée d'une étape à l'autre sur la même page, pour glisser vers le bloc suivant.
type Rect = { top: number; left: number; width: number; height: number; step: number; path: string; card?: { top: number; left: number } };
const PAD = 8;
const GAP = 16;

/** Place la bulle à droite, à gauche, dessous ou dessus du bloc, là où elle tient sans le couvrir. */
function placeCard(r: DOMRect, cardW: number, cardH: number): { top: number; left: number } | undefined {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const clampTop = (t: number) => Math.min(Math.max(t, 72), H - cardH - GAP);
  const clampLeft = (l: number) => Math.min(Math.max(l, GAP), W - cardW - GAP);
  let v: { top: number; left: number } | undefined;
  if (r.right + PAD + GAP + cardW <= W - GAP) v = { top: clampTop(r.top), left: r.right + PAD + GAP };
  else if (r.left - PAD - GAP - cardW >= GAP) v = { top: clampTop(r.top), left: r.left - PAD - GAP - cardW };
  else if (H - r.bottom - PAD - GAP >= cardH + GAP) v = { top: r.bottom + PAD + GAP, left: clampLeft(r.left) };
  else if (r.top - PAD - GAP - 64 >= cardH) v = { top: r.top - PAD - GAP - cardH, left: clampLeft(r.left) };
  return v && { top: v.top + window.scrollY, left: v.left + window.scrollX };
}

export function AppTour({ login, steps }: { login: string; steps: TourStep[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const saved = useSyncExternalStore(subscribe, () => read(login), () => "done");
  const step = saved && saved !== "done" ? Math.min(Number(saved) || 0, steps.length - 1) : null;
  const [measured, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Vrai quand c'est la visite qui change de page (Suivant/Précédent). Sinon, l'utilisateur est parti ailleurs
  // (lien, URL tapée, retour, rechargement d'une autre page) : on arrête la visite au lieu de le ramener de force.
  const tourNav = useRef(false);
  const rect = measured && measured.path === pathname ? measured : null;

  // Démarrage : première visite sur l'accueil, ou lien « Revoir la présentation » (?visite=1).
  useEffect(() => {
    if (pathname !== "/") return;
    if (new URLSearchParams(window.location.search).get("visite") === "1") {
      window.history.replaceState(null, "", "/");
      write(login, "0");
    } else if (read(login) === null) write(login, "0");
  }, [login, pathname]);

  const current = step === null ? null : steps[step];

  // Mise en lumière du bloc, une fois la page arrivée (le bloc peut apparaître un peu après la navigation).
  const locate = useCallback(() => {
    if (step === null || !current?.target || pathname !== current.path) return setRect(null);
    const el = document.querySelector(current.target);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    const card = cardRef.current;
    setRect({
      top: r.top + window.scrollY - PAD, left: r.left + window.scrollX - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD,
      step, path: pathname, card: placeCard(r, card?.offsetWidth ?? 448, card?.offsetHeight ?? 260),
    });
  }, [current, pathname, step]);

  useEffect(() => {
    if (!current) return;
    if (pathname !== current.path) {
      if (tourNav.current) router.push(current.path);
      else write(login, "done");
      return;
    }
    tourNav.current = false;
    let tries = 0;
    const id = setInterval(() => {
      const el = current.target ? document.querySelector(current.target) : null;
      if (el || !current.target || ++tries > 20) {
        clearInterval(id);
        el?.scrollIntoView({ block: "center" }); // instantané : la mesure suivante doit voir la position finale
        requestAnimationFrame(locate);
      }
    }, 100);
    window.addEventListener("resize", locate);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", locate);
    };
  }, [current, pathname, router, locate, login]);

  const finish = useCallback(() => write(login, "done"), [login]);
  const go = (next: number) => {
    tourNav.current = true;
    write(login, String(next));
  };

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, finish]);

  if (!current || step === null || pathname !== current.path) return null;
  const last = step === steps.length - 1;

  return (
    <>
      {/* Bloque les clics pendant la visite ; l'assombrissement vient du halo autour du bloc (ou du fond s'il n'y en a pas). */}
      <div
        aria-hidden
        className={cn("fixed inset-0 z-40 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300", !rect && "bg-background/70 backdrop-blur-[2px]")}
      />
      {rect && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-40 rounded-xl motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300",
            // Le contour glisse d'un bloc à l'autre (même page) au lieu de sauter.
            "motion-safe:transition-[top,left,width,height] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]",
          )}
          // Contour vert puis voile sur tout le reste, dans la même ombre (une classe ring serait écrasée).
          style={{
            top: rect.top, left: rect.left, width: rect.width, height: rect.height,
            boxShadow: "0 0 0 2px var(--primary), 0 0 0 9999px color-mix(in oklch, var(--background) 75%, transparent)",
          }}
        >
          {/* Onde qui part du contour à chaque étape, pour guider l'œil vers le bloc présenté. */}
          <span key={rect.step} className="absolute inset-0 rounded-xl motion-safe:animate-[tour-pulse_1.1s_ease-out_0.3s_both]" />
        </div>
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        style={rect?.card ? { top: rect.card.top, left: rect.card.left } : undefined}
        className={cn(
          "z-50 w-[min(28rem,calc(100vw-2rem))] space-y-4 rounded-xl border bg-card p-5 text-card-foreground shadow-lg",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300",
          // La bulle suit le bloc en glissant.
          "motion-safe:transition-[top,left] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]",
          rect?.card ? "absolute" : rect ? "fixed inset-x-0 bottom-4 mx-auto" : "fixed inset-x-0 top-1/2 mx-auto -translate-y-1/2",
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs tabular-nums text-muted-foreground">
            Étape {step + 1} sur {steps.length}
          </p>
          <button type="button" onClick={finish} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Passer la visite
          </button>
        </div>
        <div key={step} className="space-y-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
          <h2 id="tour-title" className="font-article text-xl font-normal">{current.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{current.text}</p>
        </div>
        <div aria-hidden className="flex gap-1">
          {steps.map((_, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors duration-500", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => go(step - 1)}>
            Précédent
          </Button>
          <Button size="sm" autoFocus onClick={() => (last ? finish() : go(step + 1))}>
            {last ? "Terminer" : "Suivant"}
          </Button>
        </div>
      </div>
    </>
  );
}
