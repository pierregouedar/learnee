import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { z } from "zod";
import { hasElevenLabs, ttsMp3, voicePool } from "@/lib/audio/elevenlabs";
import { AudioError, NO_KEY_MESSAGE } from "@/lib/audio/errors";
import { audioFile, serveFile } from "@/lib/audio/files";
import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/profile";

// Lettres (toutes langues), espaces, apostrophes, tirets uniquement ; 1 à 4 mots, 60 caractères max.
const Word = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[\p{L}\p{M}'’ -]+$/u, "Mot invalide.")
  .refine((w) => w.split(/\s+/).length <= 4, "Mot invalide.");

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Connecte-toi pour continuer." }, { status: 401 });

  const word = Word.safeParse(new URL(req.url).searchParams.get("word"));
  if (!word.success) return Response.json({ error: "Mot invalide." }, { status: 400 });

  // Normalisé avant hachage : minuscules, espaces internes réduits à un seul, bords retirés.
  const normalized = word.data.toLowerCase().trim().replace(/\s+/g, " ");
  // Le nom de fichier vient du hash du mot normalisé, jamais de l'entrée brute.
  // Autre langue que l'anglais : le code entre dans le hash, un même mot ne se prononce pas pareil partout.
  const code = getProfile().target.code;
  const hash = createHash("sha1").update(code === "en" ? normalized : `${code}:${normalized}`).digest("hex");
  const file = audioFile(`pronounce/${hash}.mp3`);

  if (!fs.existsSync(file)) {
    // Générer coûte des crédits ElevenLabs : seuls les comptes étudiants déclenchent une génération,
    // les comptes lecture seule n'ont accès qu'au cache déjà présent.
    if (user.role !== "student") {
      return Response.json({ error: "Ce compte peut seulement consulter, pas générer d'audio." }, { status: 403 });
    }
    if (!hasElevenLabs()) return Response.json({ error: NO_KEY_MESSAGE }, { status: 503 });
    const voice = voicePool()[0];
    // Le client bascule alors sur la synthèse vocale du navigateur.
    if (!voice) return Response.json({ error: "Prononciation audio indisponible." }, { status: 503 });
    // Écrit dans un fichier temporaire puis renomme : le renommage est atomique sur le même système de
    // fichiers, donc des requêtes concurrentes pour le même mot s'écrasent avec un contenu identique
    // au lieu de laisser un lecteur voir un mp3 tronqué en cours d'écriture.
    const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await fs.promises.writeFile(tmp, await ttsMp3(normalized, voice));
      await fs.promises.rename(tmp, file);
    } catch (e) {
      await fs.promises.unlink(tmp).catch(() => {});
      if (e instanceof AudioError) return Response.json({ error: e.message }, { status: 502 });
      throw e;
    }
  }

  return serveFile(req, file, "audio/mpeg");
}
