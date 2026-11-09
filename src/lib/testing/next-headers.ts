// Remplace next/headers dans les tests : vi.mock("next/headers", () => import("@/lib/testing/next-headers"));
export const testCookies = new Map<string, string>();

export async function cookies() {
  return {
    get: (name: string) => (testCookies.has(name) ? { name, value: testCookies.get(name)! } : undefined),
    has: (name: string) => testCookies.has(name),
    set: (name: string, value: string) => void testCookies.set(name, value),
    delete: (name: string) => void testCookies.delete(name),
  };
}
