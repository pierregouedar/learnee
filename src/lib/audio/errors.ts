export class AudioError extends Error {
  constructor(
    readonly code: "unavailable" | "provider" | "invalid",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export const NO_KEY_MESSAGE = "L'audio n'est pas disponible : la clé ElevenLabs n'est pas configurée.";

// Message affiché sur /ecoute quand la clé manque (les exercices existants restent jouables).
export const NO_AUDIO_MESSAGE =
  "La synthèse et la transcription audio ne sont pas configurées (clé ElevenLabs manquante). Les exercices déjà prêts restent disponibles.";
