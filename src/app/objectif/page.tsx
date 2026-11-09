import Link from "next/link";
import { ObjectiveForm } from "@/components/objective-form";
import { PageHeader, Panel } from "@/components/page";
import { ProfileSummary } from "@/components/profile-summary";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getProfile, GOAL_PRESET_KEYS, GOAL_PRESETS, hasSavedProfile, languageFr } from "@/lib/profile";

export const dynamic = "force-dynamic";

// Langues proposées dans la liste (les éditions Google News les plus courantes) ; les autres par leur code.
const LANGUAGES = ["en", "es", "de", "it", "pt", "nl", "sv", "da", "no", "fi", "pl", "cs", "el", "ru", "uk", "tr", "ar", "he", "hi", "zh", "ja", "ko"];

export default async function ObjectifPage() {
  const user = await requireUser();
  const saved = hasSavedProfile();
  const profile = getProfile();

  if (user.role !== "student") {
    return (
      <div className="space-y-8">
        <PageHeader title="Objectif" description="La langue étudiée, l’objectif et les thèmes d’actualité choisis par l’élève." />
        <Panel
          title="Objectif actuel"
          actions={
            <Button asChild size="sm" variant="outline">
              <Link href="/profil">Retour au profil</Link>
            </Button>
          }
        >
          <ProfileSummary profile={profile} />
          <p className="text-sm text-muted-foreground">Lecture seule : seul le compte élève peut changer l’objectif.</p>
        </Panel>
      </div>
    );
  }

  const languages = LANGUAGES.map((code) => ({ code, name: languageFr(code) })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const presets = GOAL_PRESET_KEYS.map((key) => ({ key, label: GOAL_PRESETS[key].label, hint: GOAL_PRESETS[key].hint }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={saved ? undefined : "Bienvenue sur Learnee"}
        title="Ton objectif"
        description="Choisis ta langue, ton objectif et tes thèmes : les sujets, la grammaire et les actualités s’y adaptent."
      />
      <ObjectiveForm initial={saved ? profile : null} languages={languages} presets={presets} />
    </div>
  );
}
