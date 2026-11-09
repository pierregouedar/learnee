import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { changeTier, currentTierProposal, declineTierProposal } from "@/lib/repo/progression";
import { getTier } from "@/lib/repo/settings";

const Body = z.object({ action: z.enum(["accept", "decline"]) });

export async function POST(req: Request) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Action inconnue." }, { status: 400 });
  const proposal = currentTierProposal();
  if (!proposal) return Response.json({ error: "Aucun changement de palier n’est proposé." }, { status: 409 });
  if (body.data.action === "accept") changeTier(proposal.to);
  else declineTierProposal();
  return Response.json({ tier: getTier() });
}
