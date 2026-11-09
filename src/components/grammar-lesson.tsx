import { Check, X } from "lucide-react";
import type { Lesson } from "@/lib/grammar/schema";
import { cn } from "@/lib/utils";

export function GrammarLesson({ lesson, lang }: { lesson: Lesson; lang: string }) {
  return (
    <article className="space-y-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">À retenir</p>
        <p className="measure font-article text-xl leading-snug font-normal text-balance sm:text-2xl">{lesson.summary}</p>
      </header>

      <div className={cn("grid gap-4", lesson.forms.length === 2 && "md:grid-cols-2")}>
        {lesson.forms.map((f, i) => (
          <section key={i} className="space-y-4 rounded-xl border bg-card p-5">
            <div className="space-y-2">
              <h3 className="font-article text-lg font-normal">{f.name}</h3>
              <p className="leading-relaxed text-muted-foreground">{f.use}</p>
            </div>
            <p className="inline-block rounded-md bg-accent px-2.5 py-1 text-sm font-medium break-words text-accent-foreground">{f.form}</p>
            {f.signals.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Mots repères</p>
                <ul className="flex flex-wrap gap-1.5">
                  {f.signals.map((s, k) => (
                    <li key={k} lang={lang} className="rounded-md border px-2 py-0.5 text-sm">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="space-y-3 border-t pt-4">
              {f.examples.map((ex, k) => (
                <li key={k}>
                  <p lang={lang} className="font-article break-words">{ex.en}</p>
                  <p className="text-sm text-muted-foreground">{ex.fr}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="space-y-4">
        <h3 className="font-article text-lg font-normal">Les pièges pour un francophone</h3>
        <ul className="grid gap-3">
          {lesson.pitfalls.map((p, i) => (
            <li key={i} className="space-y-2 rounded-xl bg-muted p-4">
              <p className="flex items-start gap-2">
                <X aria-hidden className="mt-1 size-4 shrink-0 text-destructive" />
                <span className="sr-only">Faux : </span>
                <span lang={lang} className="font-article break-words text-muted-foreground line-through decoration-destructive/60">
                  {p.wrong}
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Check aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
                <span className="sr-only">Juste : </span>
                <span lang={lang} className="font-article font-medium break-words">{p.right}</span>
              </p>
              <p className="pl-6 text-sm text-muted-foreground">{p.why}</p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
