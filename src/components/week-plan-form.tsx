"use client";
import { Check } from "lucide-react";
import { useState } from "react";
import { ACTIVITY_ICONS } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/post-json";
import { DAY_LABELS, DEFAULT_WEEK_PLAN, PLAN_TASKS, TASK_LABELS, WEEK_DAYS, type DayKey, type PlanTask, type WeekPlan } from "@/lib/week-plan";
import { cn } from "@/lib/utils";

export function WeekPlanForm({ initial, canAct }: { initial: WeekPlan; canAct: boolean }) {
  const [plan, setPlan] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const toggle = (day: DayKey, task: PlanTask) => {
    setState("idle");
    setPlan({ ...plan, [day]: plan[day].includes(task) ? plan[day].filter((t) => t !== task) : [...plan[day], task] });
  };

  async function save() {
    setState("saving");
    setError(null);
    try {
      await postJson("/api/week-plan", plan, "PUT");
      setState("saved");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  return (
    <div className="space-y-4">
      {/* Grille tâches × jours : une case par tâche et par jour. */}
      <table className="w-full table-fixed border-separate border-spacing-y-1 text-sm">
        <caption className="sr-only">Tâches prévues pour chaque jour de la semaine</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[30%] sm:w-[34%]">
              <span className="sr-only">Tâche</span>
            </th>
            {WEEK_DAYS.map((day) => {
              const rest = plan[day].length === 0;
              return (
                <th key={day} scope="col" className="pb-1 text-center font-medium">
                  <span className="sr-only">{DAY_LABELS[day]}</span>
                  <span aria-hidden title={DAY_LABELS[day]}>
                    <span className="sm:hidden">{DAY_LABELS[day].slice(0, 1)}</span>
                    <span className="hidden sm:inline">{DAY_LABELS[day].slice(0, 3)}.</span>
                  </span>
                  <span className={cn("block text-[11px] font-normal text-muted-foreground", !rest && "invisible")}>repos</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {PLAN_TASKS.map((task) => {
            const Icon = ACTIVITY_ICONS[task];
            return (
              <tr key={task}>
                <th scope="row" className="py-1 pr-2 text-left font-normal">
                  <span className="flex items-center gap-2">
                    <Icon aria-hidden className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
                    <span className="break-words">{TASK_LABELS[task]}</span>
                  </span>
                </th>
                {WEEK_DAYS.map((day) => {
                  const on = plan[day].includes(task);
                  return (
                    <td key={day} className="p-0 text-center sm:p-0.5">
                      <label
                        className={cn(
                          "mx-auto grid size-7 place-items-center rounded-lg border transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring sm:size-10",
                          on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-transparent",
                          canAct ? "cursor-pointer" : "opacity-70",
                          canAct && !on && "hover:bg-muted",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          aria-label={`${TASK_LABELS[task]}, ${DAY_LABELS[day].toLowerCase()}`}
                          checked={on}
                          onChange={() => toggle(day, task)}
                          disabled={!canAct}
                        />
                        <Check aria-hidden className="size-4" />
                      </label>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="measure text-sm text-muted-foreground">
        Un jour sans case cochée est un jour de repos. À partir de janvier, un samedi par mois devient un examen blanc
        (tous les quinze jours à partir d’avril).
      </p>
      {canAct && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button onClick={save} disabled={state === "saving"}>
            {state === "saving" ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setPlan(DEFAULT_WEEK_PLAN);
              setState("idle");
            }}
          >
            Revenir à la semaine type
          </Button>
          {state === "saved" && (
            <p role="status" className="flex items-center gap-1.5 text-sm text-primary">
              <Check aria-hidden className="size-4" />
              Semaine enregistrée.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
