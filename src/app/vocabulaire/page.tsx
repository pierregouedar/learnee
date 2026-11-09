import { BookMarked, Download } from "lucide-react";
import { StatTile } from "@/components/dashboard";
import { EmptyState, PageHeader } from "@/components/page";
import { VocabList, type VocabItemView } from "@/components/vocab-list";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listCards } from "@/lib/cards";
import { reviewStats } from "@/lib/review";

export const dynamic = "force-dynamic";

export default async function VocabulairePage() {
  const user = await requireUser();
  const cards = listCards();
  const items: VocabItemView[] = cards.map((c) => ({
    id: c.id,
    term: c.term,
    definition: c.definition,
    example: c.example,
    fr: c.fr,
    suspended: c.suspended,
    origin: c.origin,
    context: c.contexts[0] && { sentence: c.contexts[0].sentence, sourceTitle: c.contexts[0].sourceTitle },
  }));
  const active = cards.filter((c) => !c.suspended).length;

  const acquired = reviewStats().acquired;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Vocabulaire"
        description="Les mots gardés depuis le dictionnaire et ceux proposés par tes corrections. Ceux qui sont dans tes révisions reviennent en cartes."
        actions={
          active > 0 && (
            <Button asChild variant="outline">
              <a href="/api/vocab.csv" download>
                <Download aria-hidden />
                Exporter pour Anki
              </a>
            </Button>
          )
        }
      />
      {cards.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="Aucun mot pour l’instant."
          description="Touche ou sélectionne un mot dans un article pour le garder, ou termine une copie pour recevoir du vocabulaire."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Mots gardés" value={String(cards.length)} hint="au total" />
            <StatTile label="Dans tes révisions" value={String(active)} hint={`${cards.length - active} mis de côté`} />
            <div className="col-span-2 sm:col-span-1 [&>div]:h-full">
              <StatTile label="Mots acquis" value={String(acquired)} hint="retenus pour plus de trois semaines" />
            </div>
          </div>
          <VocabList items={items} readOnly={user.role !== "student"} />
        </>
      )}
    </div>
  );
}
