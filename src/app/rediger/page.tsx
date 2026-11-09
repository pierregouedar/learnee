import { redirect } from "next/navigation";
import { Editor } from "@/components/editor";
import { requireUser } from "@/lib/auth";
import { getActiveSession } from "@/lib/repo/sessions";
import { getSubject } from "@/lib/repo/subjects";
import { TIERS } from "@/lib/tiers";

export const dynamic = "force-dynamic";

export default async function RedigerPage() {
  const user = await requireUser();
  const session = getActiveSession();
  if (!session) redirect("/ecrit");
  const subject = getSubject(session.subjectId)!;
  const tier = TIERS[session.tier];
  return <Editor session={session} subject={subject} tierLabel={tier.label} crTarget={tier.crWords} peTarget={tier.peWords} readOnly={user.role !== "student"} />;
}
