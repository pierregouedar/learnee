import { StatTile } from "@/components/dashboard";
import { PageHeader } from "@/components/page";
import { ReviewSession } from "@/components/review-session";
import { hasElevenLabs } from "@/lib/audio/elevenlabs";
import { requireUser } from "@/lib/auth";
import { dueCards, reviewStats } from "@/lib/review";

export const dynamic = "force-dynamic";

export default async function RevisionsPage() {
  const user = await requireUser();
  const now = new Date();
  const cards = dueCards(now);
  const stats = reviewStats(now);
  const rate = stats.successRate7d === null ? "" : `${Math.round(stats.successRate7d * 100)} %`;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Révisions"
        description="Une session par jour, 10 à 15 minutes. Réponds honnêtement : les cartes difficiles reviendront plus tôt."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="À revoir aujourd’hui" value={String(cards.length)} hint={cards.length > 1 ? "cartes prêtes" : "carte prête"} />
        <StatTile label="Mots acquis" value={String(stats.acquired)} hint="retenus pour plus de trois semaines" />
        <div className="col-span-2 sm:col-span-1 [&>div]:h-full">
          <StatTile
            label="Réussite sur 7 jours"
            value={rate}
            hint={stats.reviews7d ? `${stats.reviews7d} cartes, cible 85 à 90 %` : "cible 85 à 90 %"}
          />
        </div>
      </div>

      <div id="review-session">
        <ReviewSession initial={cards} readOnly={user.role !== "student"} serverAudio={hasElevenLabs()} />
      </div>
    </div>
  );
}
