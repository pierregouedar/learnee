// Appel JSON côté navigateur : renvoie le corps, ou lève une Error avec le message français du serveur.
export async function postJson<T = unknown>(url: string, body: unknown = {}, method: "POST" | "PUT" = "POST"): Promise<T> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Une erreur est survenue. Réessaie.");
  return data as T;
}
