"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GenerationStatus } from "@/components/generation-status";
import type { Progress } from "@/lib/generation-progress";
import { postWithProgress } from "@/lib/post-progress";

export function MockExamButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setProgress(null);
    setError(null);
    try {
      await postWithProgress("/api/mock-exams", {}, setProgress);
      router.push("/rediger");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={start} disabled={busy} variant={variant}>
        Commencer l’examen blanc
      </Button>
      {busy && <GenerationStatus progress={progress} fallback="Préparation du sujet…" />}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
