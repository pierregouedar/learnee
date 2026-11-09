"use client";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconBadge } from "@/components/page";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/post-json";
import type { TierProposal } from "@/lib/tier-rules";
import type { Tier } from "@/lib/tiers";

type Props = { proposal: NonNullable<TierProposal>; tier: Tier; canAct: boolean };

export function TierBanner({ proposal, tier, canAct }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const up = proposal.direction === "up";

  async function decide(action: "accept" | "decline") {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/tier", { action });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="tier-banner-title" className="flex flex-wrap items-start gap-4 border-l-2 border-primary py-1 pl-5">
      <IconBadge icon={up ? TrendingUp : TrendingDown} tone="primary" />
      <div className="min-w-0 flex-1 basis-64 space-y-3">
        <div className="space-y-1">
          <h2 id="tier-banner-title" className="font-article text-xl font-normal">
            {up ? `On passe au palier ${proposal.to} ?` : `Revenir au palier ${proposal.to} ?`}
          </h2>
          <p className="measure text-sm">
            {up
              ? `Tes trois dernières copies du palier ${tier} ont obtenu 12/20 ou plus. Tu peux passer au palier ${proposal.to}, ou rester au palier ${tier} encore un peu.`
              : `Tes trois dernières copies ont obtenu moins de 8/20. Revenir au palier ${proposal.to} peut t’aider à consolider les bases. C’est toi qui décides.`}
          </p>
        </div>
        {canAct && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => decide("accept")}>
              {up ? `Passer au palier ${proposal.to}` : `Revenir au palier ${proposal.to}`}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => decide("decline")}>
              Rester au palier {tier}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
