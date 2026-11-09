import { getCurrentUser } from "@/lib/auth";
import { cardsToCsv, listCards } from "@/lib/cards";

export async function GET() {
  if (!(await getCurrentUser())) return Response.json({ error: "Connecte-toi pour continuer." }, { status: 401 });
  return new Response(cardsToCsv(listCards().filter((c) => !c.suspended)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="learnee-vocabulaire.csv"',
    },
  });
}
