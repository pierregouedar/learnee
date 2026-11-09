import { z } from "zod";
import { learningContext } from "@/lib/profile";
import type { ErrorItem } from "@/lib/schemas";

export const RewriteCheckSchema = z.object({
  erreurs: z.array(z.object({ index: z.number().int(), statut: z.enum(["corrigee", "restante"]), commentaire: z.string() })),
  nouvelles: z.array(z.object({ extrait: z.string(), correction: z.string(), explication: z.string() })),
  conseil: z.string(),
});

export function buildRewritePrompt(input: { task: string; first: string; errors: ErrorItem[]; rewrite: string }): string {
  const ctx = learningContext();
  return `A ${ctx.native} student (target level ${ctx.level}, goal: ${ctx.goalLine}) rewrote her ${ctx.target} text after
a correction, without seeing any model answer. Write ALL comments in simple French.

TASK: ${input.task}

FIRST DRAFT:
"""${input.first}"""

ERRORS FOUND IN THE FIRST DRAFT (index. "extract" → expected correction):
${input.errors.map((e, i) => `${i}. "${e.extrait}" → ${e.correction}`).join("\n")}

REWRITE:
"""${input.rewrite}"""

For each numbered error, say whether it is now corrected ("corrigee") or still
there ("restante"), with a short comment. A different but correct wording counts as
corrected. Then list the NEW errors introduced in the rewrite ("extrait" copied
exactly from the rewrite). Do not grade: no mark.
Reply with only JSON:
{"erreurs": [{"index": 0, "statut": "corrigee", "commentaire": "..."}],
 "nouvelles": [{"extrait": "...", "correction": "...", "explication": "..."}],
 "conseil": "one sentence of advice IN FRENCH"}`;
}
