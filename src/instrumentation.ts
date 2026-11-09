export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recoverInterruptedCorrections } = await import("./lib/repo/sessions");
  recoverInterruptedCorrections();
  const { recoverInterruptedListeningCorrections } = await import("./lib/repo/listenings");
  recoverInterruptedListeningCorrections();

  // Rattrape les copies corrigées avant le plan 2 ; idempotent, doit tourner même JOBS_ENABLED=false.
  try {
    const { importAllCorrectionVocab } = await import("./lib/cards");
    importAllCorrectionVocab();
  } catch (e) {
    console.error("[vocab]", e);
  }

  if (process.env.JOBS_ENABLED === "false") return;
  const { startJobs } = await import("./lib/jobs");
  startJobs();
}
