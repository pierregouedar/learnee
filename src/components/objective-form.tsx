"use client";
import { Plus, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GenerationStatus } from "@/components/generation-status";
import { Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Progress } from "@/lib/generation-progress";
import { postWithProgress } from "@/lib/post-progress";
import type { GoalPreset, Profile } from "@/lib/profile";
import { cn } from "@/lib/utils";

type Interest = { key: string; label: string };

const LEVELS: { level: Profile["level"]; hint: string }[] = [
  { level: "B1", hint: "Te débrouiller dans les situations courantes et écrire des textes simples et clairs." },
  { level: "B2", hint: "Comprendre l’essentiel d’un texte complexe et argumenter avec aisance." },
  { level: "C1", hint: "T’exprimer couramment et avec précision, même sur des sujets pointus." },
];

const SUGGESTIONS: Interest[] = [
  { key: "comm", label: "Comm" },
  { key: "ia", label: "IA" },
  { key: "auto", label: "Auto" },
  { key: "economie", label: "Économie" },
  { key: "sport", label: "Sport" },
  { key: "culture", label: "Culture" },
  { key: "cinema", label: "Cinéma" },
  { key: "musique", label: "Musique" },
  { key: "sciences", label: "Sciences" },
  { key: "environnement", label: "Environnement" },
  { key: "voyage", label: "Voyage" },
  { key: "sante", label: "Santé" },
];
const MAX_INTERESTS = 4;
const OTHER = "other";

const slug = (label: string) =>
  label.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "theme";

// Nom français d'un code saisi à la main ; null s'il n'est pas reconnu.
function codeName(code: string): string | null {
  if (!/^[a-z]{2,3}$/.test(code)) return null;
  try {
    return new Intl.DisplayNames("fr", { type: "language", fallback: "none" }).of(code)?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Petite carte à choix unique (objectif, niveau) : le bouton radio reste visible. */
function Choice({ name, checked, onChange, title, hint }: { name: string; checked: boolean; onChange: () => void; title: string; hint: string }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted",
        checked && "border-primary bg-accent/50 hover:bg-accent/50",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-1 size-4 shrink-0 accent-primary" />
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

export function ObjectiveForm({
  initial, languages, presets,
}: {
  initial: Profile | null;
  languages: { code: string; name: string }[];
  presets: { key: GoalPreset; label: string; hint: string }[];
}) {
  const router = useRouter();
  const listed = (code: string) => languages.some((l) => l.code === code);
  const startCode = initial?.target.code ?? "en";
  const [choice, setChoice] = useState(listed(startCode) ? startCode : OTHER);
  const [otherCode, setOtherCode] = useState(listed(startCode) ? "" : startCode);
  const [preset, setPreset] = useState<GoalPreset | null>(initial?.goal.preset ?? null);
  const [description, setDescription] = useState(initial?.goal.description ?? "");
  const [level, setLevel] = useState<Profile["level"]>(initial?.level ?? "B2");
  const [interests, setInterests] = useState<Interest[]>(initial?.interests.map(({ key, label }) => ({ key, label })) ?? []);
  const [newLabel, setNewLabel] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = choice === OTHER ? otherCode.trim().toLowerCase() : choice;
  const otherName = choice === OTHER ? codeName(code) : null;
  const languageChanged = initial !== null && code !== initial.target.code;
  const chips = [...SUGGESTIONS, ...interests.filter((i) => !SUGGESTIONS.some((s) => s.key === i.key))];
  const selected = (key: string) => interests.some((i) => i.key === key);
  const full = interests.length >= MAX_INTERESTS;

  const missing = [
    choice === OTHER && !otherName && "une langue",
    !preset && "un objectif",
    preset === "custom" && !description.trim() && "la description de ton objectif",
    interests.length === 0 && "au moins un thème",
  ].filter(Boolean) as string[];

  const toggle = (i: Interest) => setInterests(selected(i.key) ? interests.filter((x) => x.key !== i.key) : full ? interests : [...interests, i]);

  function addInterest() {
    const label = newLabel.trim().slice(0, 40);
    if (!label || full) return;
    const key = slug(label);
    if (!selected(key)) setInterests([...interests, { key, label }]);
    setNewLabel("");
  }

  async function save() {
    if (missing.length > 0 || !preset) return;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      await postWithProgress(
        "/api/profile",
        { code, goal: { preset, ...(preset === "custom" ? { description: description.trim() } : {}) }, level, interests },
        setProgress,
      );
      // refresh : le layout (langue étudiée, visite guidée) est relu avec le nouveau profil.
      router.push("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Panel id="langue" title="Langue étudiée" description="L’interface et les consignes restent en français.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="language" className="text-sm font-medium">Langue</label>
            <select
              id="language"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              disabled={busy}
              className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name.charAt(0).toUpperCase() + l.name.slice(1)}
                </option>
              ))}
              <option value={OTHER}>Autre langue</option>
            </select>
          </div>
          {choice === OTHER && (
            <div className="grid gap-2">
              <label htmlFor="language-code" className="text-sm font-medium">Code de la langue</label>
              <Input
                id="language-code"
                value={otherCode}
                onChange={(e) => setOtherCode(e.target.value)}
                maxLength={3}
                autoComplete="off"
                disabled={busy}
                aria-describedby="language-code-hint"
                aria-invalid={otherCode.trim() !== "" && !otherName}
                className="h-9"
              />
              <p id="language-code-hint" className="text-sm text-muted-foreground">
                {otherName ? `Langue reconnue : ${otherName}.` : "Code ISO à 2 ou 3 lettres, par exemple « sw » pour le swahili."}
              </p>
            </div>
          )}
        </div>
        {code !== "en" && (
          <p className="text-sm text-muted-foreground">
            Pour une nouvelle langue, Learnee prépare d’abord ton programme de grammaire : compte une minute environ.
          </p>
        )}
        {languageChanged && (
          <div role="note" className="flex gap-3 rounded-lg border border-primary/40 bg-accent/50 p-3 text-sm">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              Tu changes de langue. Les mots déjà gardés restent dans tes révisions, et ta progression en grammaire repart sur le
              programme de la nouvelle langue.
            </p>
          </div>
        )}
      </Panel>

      <Panel id="objectif" title="Ton objectif" description="Il règle le type de textes à écrire et le ton de la correction.">
        <fieldset aria-labelledby="objectif-title" className="grid gap-2 sm:grid-cols-2" disabled={busy}>
          {presets.map((p) => (
            <Choice key={p.key} name="goal" checked={preset === p.key} onChange={() => setPreset(p.key)} title={p.label} hint={p.hint} />
          ))}
        </fieldset>
        {preset === "custom" && (
          <div className="grid gap-2">
            <label htmlFor="goal-description" className="text-sm font-medium">Ton objectif en une phrase</label>
            <Textarea
              id="goal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={2}
              disabled={busy}
              aria-describedby="goal-description-hint"
            />
            <p id="goal-description-hint" className="text-sm text-muted-foreground">Par exemple : partir travailler six mois à Madrid.</p>
          </div>
        )}
      </Panel>

      <Panel id="niveau" title="Niveau visé" description="Le niveau que tu veux atteindre, pas celui que tu as aujourd’hui.">
        <fieldset aria-labelledby="niveau-title" className="grid gap-2 md:grid-cols-3" disabled={busy}>
          {LEVELS.map((l) => (
            <Choice key={l.level} name="level" checked={level === l.level} onChange={() => setLevel(l.level)} title={l.level} hint={l.hint} />
          ))}
        </fieldset>
      </Panel>

      <Panel
        id="themes"
        title="Thèmes d’actualité"
        description="De 1 à 4 thèmes. Les actualités de l’accueil et des sujets écrits viennent de là, dans la langue étudiée."
        actions={<span className="text-sm tabular-nums text-muted-foreground">{interests.length} sur {MAX_INTERESTS}</span>}
      >
        <div role="group" aria-labelledby="themes-title" className="flex flex-wrap gap-2">
          {chips.map((i) => {
            const on = selected(i.key);
            return (
              <Button
                key={i.key}
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={on}
                disabled={busy || (!on && full)}
                onClick={() => toggle(i)}
                className={cn(on && "border-primary bg-accent text-accent-foreground hover:bg-accent")}
              >
                {i.label}
                {on && <X aria-hidden className="size-3.5" />}
              </Button>
            );
          })}
        </div>
        <div className="grid gap-2">
          <label htmlFor="new-theme" className="text-sm font-medium">Autre thème</label>
          <div className="flex gap-2">
            <Input
              id="new-theme"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addInterest();
                }
              }}
              maxLength={40}
              disabled={busy || full}
              className="h-9"
            />
            <Button type="button" variant="outline" onClick={addInterest} disabled={busy || full || !newLabel.trim()}>
              <Plus aria-hidden className="size-4" />
              Ajouter
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {full ? "4 thèmes au maximum : retire-en un pour en ajouter un autre." : "En français, par exemple « Jeux vidéo » ou « Gastronomie »."}
          </p>
        </div>
      </Panel>

      {busy && <GenerationStatus progress={progress} fallback="Enregistrement" />}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || missing.length > 0}>
          Enregistrer
        </Button>
        {initial && !busy && (
          <Button asChild variant="ghost">
            <Link href="/profil">Annuler</Link>
          </Button>
        )}
        {missing.length > 0 && <p className="text-sm text-muted-foreground">Il manque {missing.join(", ")}.</p>}
      </div>
    </form>
  );
}
