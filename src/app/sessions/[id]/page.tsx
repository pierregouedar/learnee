import { notFound, redirect } from "next/navigation";
import { ResultView } from "@/components/ecrit/result-view";
import { requireUser } from "@/lib/auth";
import { latestRewrite } from "@/lib/repo/rewrites";
import { getSession } from "@/lib/repo/sessions";
import { getSubject } from "@/lib/repo/subjects";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const session = getSession((await params).id);
  if (!session) notFound();
  if (session.status === "draft" || session.status === "correcting") redirect("/rediger");
  if (!session.result) notFound();
  const subject = getSubject(session.subjectId)!;
  const r = session.result;
  const rewrite = latestRewrite(session.id);
  const canRewrite = user.role === "student" && r.expression.erreurs.length > 0;

  return <ResultView session={session} subject={subject} result={r} rewrite={rewrite} canRewrite={canRewrite} />;
}
