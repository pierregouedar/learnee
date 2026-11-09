import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser, safeNextPath } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  return <LoginForm next={safeNextPath(next)} />;
}
