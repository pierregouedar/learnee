import { notFound } from "next/navigation";
import { RewriteView } from "@/components/ecrit/rewrite-view";
import { requireUser } from "@/lib/auth";
import { latestRewrite } from "@/lib/repo/rewrites";
import { getSession } from "@/lib/repo/sessions";
import { getSubject } from "@/lib/repo/subjects";

export const dynamic = "force-dynamic";

export default async function RewritePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const session = getSession(id);
  if (!session?.result) notFound();
  const subject = getSubject(session.subjectId)!;
  const errors = session.result.expression.erreurs;
  const last = latestRewrite(id);

  return (
    <RewriteView
      sessionId={id}
      subject={subject}
      errors={errors}
      last={last}
      initial={last?.pe ?? session.pe}
      canAct={user.role === "student"}
    />
  );
}
