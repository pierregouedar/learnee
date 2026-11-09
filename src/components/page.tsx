import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Haut de page commun : petit contexte (date, palier…), titre, phrase d'aide, actions à droite. */
export function PageHeader({
  eyebrow, title, description, actions,
}: {
  eyebrow?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
      <div className="min-w-0 space-y-2">
        {eyebrow && <p className="text-sm text-muted-foreground first-letter:uppercase">{eyebrow}</p>}
        <h1 className="font-article text-4xl font-normal tracking-tight break-words sm:text-5xl">{title}</h1>
        {description && <p className="measure pt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Feuille de contenu avec en-tête optionnel : surface papier, titre serif. */
export function Panel({
  title, description, actions, className, children, id,
}: {
  title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string; children?: React.ReactNode; id?: string;
}) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={title ? titleId : undefined} className={cn("space-y-4 rounded-xl border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 space-y-1">
            {title && <h2 id={titleId} className="font-article text-xl font-normal">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Titre de section hors carte, avec un lien ou un compteur à droite. */
export function SectionTitle({ id, children, aside }: { id?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="font-article text-xl font-normal">{children}</h2>
      {aside && <div className="text-sm text-muted-foreground">{aside}</div>}
    </div>
  );
}

/** Icône des listes (tâches, sujets, écoutes…), sans pastille : `primary` = encre verte (fait, conseillé), `muted` = estompée. */
export function IconBadge({ icon: Icon, tone = "accent", className }: { icon: LucideIcon; tone?: "accent" | "primary" | "muted"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid w-6 shrink-0 place-items-center self-start pt-0.5",
        tone === "primary" && "text-primary",
        tone === "accent" && "text-foreground",
        tone === "muted" && "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

/** État vide : dit ce qui manque et comment le remplir. */
export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 border-y border-dashed py-6">
      {Icon && <Icon aria-hidden className="size-5 text-muted-foreground" />}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="measure text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
