"use client";
import { Volume2 } from "lucide-react";
import { useTargetLanguage } from "@/components/profile-provider";
import { Button } from "@/components/ui/button";

function speakWithBrowser(word: string, lang: string) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(word);
  u.lang = lang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/** Audio ElevenLabs mis en cache côté serveur ; à défaut (pas de clé, hors ligne, compte lecture seule), voix du navigateur. */
export function speakWord(word: string, lang: string) {
  const audio = new Audio(`/api/pronounce?word=${encodeURIComponent(word)}`);
  audio.play().catch(() => speakWithBrowser(word, lang));
}

// serverAudio permet d'éviter un fetch voué à l'échec quand la page sait déjà qu'ElevenLabs n'est pas configuré
// (hasElevenLabs() côté serveur) : on parle directement avec la voix du navigateur.
export function PronounceButton({ word, serverAudio = true }: { word: string; serverAudio?: boolean }) {
  const { bcp47 } = useTargetLanguage();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => (serverAudio ? speakWord(word, bcp47) : speakWithBrowser(word, bcp47))}
      aria-label={`Écouter la prononciation de « ${word} »`}
    >
      <Volume2 className="size-4" />
    </Button>
  );
}
