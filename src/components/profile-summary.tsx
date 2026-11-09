import { GOAL_PRESETS, languageFr, type Profile } from "@/lib/profile";

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Résumé du profil d'apprentissage (profil, lecture seule de « Ton objectif »). */
export function ProfileSummary({ profile }: { profile: Profile }) {
  const goal = GOAL_PRESETS[profile.goal.preset].label;
  const rows: [string, string][] = [
    ["Langue étudiée", capital(languageFr(profile.target.code))],
    ["Objectif", profile.goal.preset === "custom" && profile.goal.description ? `${goal} : ${profile.goal.description}` : goal],
    ["Niveau visé", profile.level],
    ["Thèmes d’actualité", profile.interests.map((i) => i.label).join(", ")],
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col-reverse rounded-lg bg-muted px-3 py-2">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
