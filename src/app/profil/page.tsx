import { Target } from "lucide-react";
import Link from "next/link";
import { TierTimeline } from "@/components/dashboard";
import { EmptyState, IconBadge, PageHeader, Panel } from "@/components/page";
import { ProfileSummary } from "@/components/profile-summary";
import { Button } from "@/components/ui/button";
import { WeekPlanForm } from "@/components/week-plan-form";
import { requireUser } from "@/lib/auth";
import { pointLabel } from "@/lib/grammar-programme";
import { getProfile, isExamGoal } from "@/lib/profile";
import { listDonePlacements } from "@/lib/repo/placements";
import { getWeekPlan } from "@/lib/repo/week-plan";
import { tierProgress } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default async function ProfilPage() {
  const user = await requireUser();
  const placements = listDonePlacements();
  const profile = getProfile();

  return (
    <div className="space-y-10">
      <PageHeader title="Profil" description="Ton objectif, ton palier, tes tests de positionnement et ta semaine type." />

      <Panel
        id="objectif"
        title="Ton objectif"
        description="Changer de langue garde tes mots dans les révisions ; la grammaire repart sur le programme de la nouvelle langue."
        actions={
          user.role === "student" ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/objectif">Modifier</Link>
            </Button>
          ) : undefined
        }
      >
        <ProfileSummary profile={profile} />
      </Panel>

      <TierTimeline tier={tierProgress()} exam={isExamGoal(profile)} />

      <Panel
        title="Tests de positionnement"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/positionnement">Voir le test</Link>
          </Button>
        }
      >
        {placements.length > 0 ? (
          <ul className="-mx-6 -mb-6 divide-y border-t">
            {placements.map((p) => (
              <li key={p.id} className="flex items-start gap-4 px-6 py-3">
                <IconBadge icon={Target} tone="muted" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {day(p.finishedAt!)} : palier {p.result!.tier}
                  </p>
                  <p className="text-sm break-words text-muted-foreground">
                    Priorités : {p.result!.priorities.map((pt) => pointLabel(pt)).join(", ") || "aucune"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Target} title="Aucun test pour l’instant" description="Le test règle ton palier et tes priorités de grammaire." />
        )}
      </Panel>

      <Panel
        id="semaine"
        title="Ta semaine type"
        description="Le planning est un repère, pas une obligation. La révision du vocabulaire reste proposée chaque jour."
      >
        <WeekPlanForm initial={getWeekPlan()} canAct={user.role === "student"} />
      </Panel>

      <nav aria-label="Autres liens" className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-sm">
        <Link href="/bilan" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Bilan de la semaine</Link>
        <Link href="/historique" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Historique</Link>
      </nav>
    </div>
  );
}
