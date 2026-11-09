import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { MainNav, type NavLink } from "./main-nav";
import { ThemeToggle } from "./theme-toggle";

// Ordre final (contrats).
export const NAV_LINKS: readonly NavLink[] = [
  { href: "/", label: "Aujourd’hui" },
  { href: "/ecrit", label: "Écrit" },
  { href: "/ecoute", label: "Écoute" },
  { href: "/grammaire", label: "Grammaire" },
  { href: "/revisions", label: "Révisions" },
  { href: "/vocabulaire", label: "Vocabulaire" },
  { href: "/historique", label: "Historique" },
];

export async function AppHeader() {
  const user = await getCurrentUser();
  return (
    <header className="border-b bg-card/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 lg:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg font-article text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {/* Même tracé que docs/logo.svg et src/app/icon.svg, aux couleurs du thème. */}
          <svg aria-hidden viewBox="0 0 128 128" className="size-7">
            <rect width="128" height="128" rx="28" fill="var(--primary)" />
            <path d="M50 36V88H84" fill="none" stroke="var(--primary-foreground)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M104 36C88 18 40 16 24 38C10 58 20 92 54 104C88 114 116 96 112 64C110 50 102 40 90 34" fill="none" stroke="var(--primary-foreground)" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" />
          </svg>
          Learnee
        </Link>
        {user ? <MainNav links={NAV_LINKS} user={{ login: user.login, role: user.role }} /> : <div className="ml-auto" />}
        <ThemeToggle />
      </div>
    </header>
  );
}
