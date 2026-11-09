"use client";
import { ArrowRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { annotate } from "@/lib/annotate";
import type { ErrorItem } from "@/lib/schemas";
import { useTargetLanguage } from "@/components/profile-provider";

export function AnnotatedText({ text, errors }: { text: string; errors: ErrorItem[] }) {
  const { code: lang } = useTargetLanguage();
  const { segments, missing } = annotate(text, errors.map((e) => e.extrait));
  return (
    <div className="space-y-4">
      <p lang={lang} className="ruled font-article measure whitespace-pre-wrap break-words leading-8">
        {segments.map((seg, i) => {
          if (seg.errorIndex === undefined) return <span key={i}>{seg.text}</span>;
          const err = errors[seg.errorIndex];
          // span et pas button : un bouton ne se coupe pas en fin de ligne, le texte deviendrait haché.
          return (
            <Popover key={i}>
              <PopoverTrigger asChild>
                <span
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}
                  className="cursor-pointer rounded-sm text-left transition-colors hover:bg-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <del className="text-muted-foreground decoration-primary decoration-[1.5px]">{seg.text}</del>{" "}
                  <ins className="text-primary no-underline decoration-primary/60 decoration-dotted underline-offset-4 hover:underline">{err.correction}</ins>
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-1 text-sm">
                <p className="text-xs font-medium text-muted-foreground first-letter:uppercase">{err.type}</p>
                <p>{err.explication}</p>
              </PopoverContent>
            </Popover>
          );
        })}
      </p>
      {missing.length > 0 && (
        <section className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-medium">Autres remarques</h3>
          <ul className="divide-y text-sm">
            {missing.map((i) => (
              <li key={i} className="py-2 first:pt-0 last:pb-0">
                <span lang={lang} className="break-words">
                  <del className="text-muted-foreground decoration-primary decoration-[1.5px]">{errors[i].extrait}</del>
                  <ArrowRight aria-label="devient" className="mx-1.5 inline size-3.5 text-muted-foreground" />
                  <ins className="font-medium text-primary no-underline">{errors[i].correction}</ins>
                </span>
                <span className="block text-muted-foreground">{errors[i].explication}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
