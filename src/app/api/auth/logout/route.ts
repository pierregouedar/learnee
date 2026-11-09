import { cookies } from "next/headers";
import { SESSION_COOKIE, signOut } from "@/lib/auth";

export async function POST() {
  const jar = await cookies();
  signOut(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  return new Response(null, { status: 204 });
}
