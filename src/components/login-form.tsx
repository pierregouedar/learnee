"use client";
import { GraduationCap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: form.get("login"), password: form.get("password") }),
      });
      if (res.ok) {
        // Rechargement complet : le layout (menu, visite guidée) est rendu à nouveau avec l'utilisateur connecté.
        // `next` est déjà assaini côté serveur (safeNextPath).
        window.location.replace(next);
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Connexion impossible. Réessaie.");
    } catch {
      setError("Connexion impossible. Vérifie ta connexion internet.");
    }
    setBusy(false);
  }

  return (
    <div className="flex justify-center pt-4 sm:pt-12">
      <form onSubmit={submit} className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 sm:p-8">
        <div className="space-y-4">
          <span aria-hidden className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Learnee</p>
            <h1 className="font-article text-3xl font-normal">Connexion</h1>
            <p className="text-sm text-muted-foreground">Entre ton identifiant et ton mot de passe.</p>
          </div>
        </div>
        <div className="grid gap-2">
          <label htmlFor="login" className="text-sm font-medium">Identifiant</label>
          <Input id="login" name="login" className="h-10" autoComplete="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} required aria-invalid={error ? true : undefined} />
        </div>
        <div className="grid gap-2">
          <label htmlFor="password" className="text-sm font-medium">Mot de passe</label>
          <Input id="password" name="password" type="password" className="h-10" autoComplete="current-password" required aria-invalid={error ? true : undefined} aria-describedby={error ? "login-error" : undefined} />
          {error && <p id="login-error" role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <Button type="submit" size="lg" className="h-10 w-full" disabled={busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </div>
  );
}
