import { redirect } from "next/navigation";
import { domainLabels } from "@/lib/profile";
import { ACTIVITY_ICONS } from "@/components/dashboard";
import { MockExamButton } from "@/components/mock-exam-button";
import { IconBadge, PageHeader } from "@/components/page";
import { ReviewReminder } from "@/components/review-reminder";
import { SubjectPicker } from "@/components/subject-picker";
import { TierBanner } from "@/components/tier-banner";
import { requireUser } from "@/lib/auth";
import { currentTierProposal } from "@/lib/repo/progression";
import { getActiveSession } from "@/lib/repo/sessions";
import { getTier } from "@/lib/repo/settings";
import { listReadySubjects } from "@/lib/repo/subjects";
import { lastMockAt, mockExamDue } from "@/lib/services/mock-exam";
import { TIERS } from "@/lib/tiers";
import { targetLanguage } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function EcritPage() {
  const user = await requireUser();
  if (getActiveSession()) redirect("/rediger");
  const canAct = user.role === "student";
  const { nameFr } = targetLanguage();
  const tier = getTier();
  const proposal = currentTierProposal();
  const mockDue = mockExamDue(new Date(), lastMockAt());

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={TIERS[tier].label}
        title="Nouveau sujet écrit"
        description={`Lis un article en ${nameFr}, résume-le en français, puis réponds à la consigne en ${nameFr}. Commence par choisir ton sujet.`}
      />
      <ReviewReminder />
      {proposal && <TierBanner proposal={proposal} tier={tier} canAct={canAct} />}
      {canAct && mockDue && (
        <section aria-labelledby="mock-title" className="flex flex-wrap items-center gap-x-4 gap-y-3 border-l-2 border-primary py-1 pl-5">
          <IconBadge icon={ACTIVITY_ICONS.mock} tone="primary" />
          <div className="min-w-0 flex-1 basis-48">
            <h2 id="mock-title" className="font-medium">Examen blanc à faire</h2>
            <p className="text-sm text-muted-foreground">Format examen complet : 2 heures, sans les définitions.</p>
          </div>
          <MockExamButton />
        </section>
      )}
      <SubjectPicker ready={listReadySubjects().filter((s) => s.tier === tier)} domains={domainLabels()} readOnly={!canAct} />
    </div>
  );
}
