"use client";
import { LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type NavLink = { href: string; label: string };
type Props = { links: readonly NavLink[]; user: { login: string; role: "student" | "viewer" } };

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

export function MainNav({ links, user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  }

  const items = (stacked: boolean) =>
    links.map((l) => {
      const active = isActive(pathname, l.href);
      return (
        <Link
          key={l.href}
          href={l.href}
          aria-current={active ? "page" : undefined}
          onClick={() => setOpen(false)}
          className={cn(
            "rounded-lg text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            stacked ? "px-3 py-2" : "px-2.5 py-1.5",
            active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {l.label}
        </Link>
      );
    });

  const who = (
    <span className="flex min-w-0 items-center gap-2 text-sm">
      <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
        {user.login.charAt(0)}
      </span>
      <span className="truncate text-muted-foreground">{user.login}</span>
      {user.role === "viewer" && <Badge variant="outline">Lecture seule</Badge>}
    </span>
  );

  return (
    <>
      <nav aria-label="Navigation principale" className="hidden flex-1 items-center gap-1 lg:flex">
        {items(false)}
        <div className="ml-auto flex items-center gap-2 border-l pl-4">
          {who}
          <Button variant="ghost" size="icon" aria-label="Se déconnecter" title="Se déconnecter" onClick={logout}>
            <LogOut />
          </Button>
        </div>
      </nav>
      <div className="ml-auto lg:hidden">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Ouvrir le menu">
              <Menu />
              Menu
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 p-2">
            <nav aria-label="Navigation principale" className="flex flex-col gap-0.5">
              {items(true)}
            </nav>
            <div className="mt-2 space-y-1 border-t pt-2">
              <div className="px-3 py-1.5">{who}</div>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
                <LogOut />
                Se déconnecter
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
