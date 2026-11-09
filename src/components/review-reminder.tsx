import Link from "next/link";
import { ACTIVITY_ICONS } from "@/components/dashboard";
import { IconBadge } from "@/components/page";
import { Button } from "@/components/ui/button";
import { countDue } from "@/lib/review";

/** « 18 cartes à revoir » dès l'accueil (spec §16.1). */
export function ReviewReminder() {
  const n = countDue();
  if (n === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border bg-card p-4">
      <IconBadge icon={ACTIVITY_ICONS.review} />
      <div className="min-w-0 flex-1 basis-48">
        <p className="font-medium">
          <span className="tabular-nums">{n}</span> {n > 1 ? "cartes à revoir" : "carte à revoir"} aujourd’hui
        </p>
        <p className="text-sm text-muted-foreground">Quelques minutes avant d’écrire, pour garder tes mots en tête.</p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href="/revisions">Réviser</Link>
      </Button>
    </div>
  );
}
