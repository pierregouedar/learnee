import { addIrregularVerbCards } from "@/lib/services/irregular-verbs";
import { sendWeeklyReport } from "@/lib/services/weekly-report";
import { registerJob, startJobs } from "./scheduler";

// Tâches planifiées (heure de Paris). Rien de payant ici : actualités, séries de grammaire et écoutes sont
// générées à la demande, au clic, pour ne payer que ce qui sert.
registerJob("irregular-verbs", "15 4 * * *", async () => {
  const added = addIrregularVerbCards();
  if (added) console.info(`[verbes] ${added} carte(s) ajoutée(s)`);
});
registerJob("weekly-report", "0 19 * * 0", () => sendWeeklyReport());

export { startJobs };
