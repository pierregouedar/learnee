"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { GrammarPoint } from "@/lib/grammar-programme";
import { postJson } from "@/lib/post-json";

type Props = { point: GrammarPoint; label: string; variant?: "default" | "outline" | "ghost" };

export function StartGrammarButton({ point, label, variant = "default" }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await postJson<{ id: string }>("/api/grammar/attempts", { point });
      router.push(`/grammaire/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant={variant} size={variant === "default" ? "default" : "sm"} disabled={busy} onClick={start}>
        {label}
      </Button>
      {busy && (
        <p role="status" className="animate-pulse text-sm text-muted-foreground motion-reduce:animate-none">
          Préparation de la série, jusqu’à une minute si elle doit être créée…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
