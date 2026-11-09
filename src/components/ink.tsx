import { cn } from "@/lib/utils";

/** Signature « copie corrigée » : un cercle tracé à l'encre verte autour d'une note ou du jour. */
export function InkCircle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-grid place-items-center", className)}>
      <svg aria-hidden viewBox="0 0 100 70" preserveAspectRatio="none" className="pointer-events-none absolute -top-[30%] -left-[20%] h-[160%] w-[140%] overflow-visible text-primary">
        <path
          d="M86 14C70 3 30 4 14 18C0 31 6 55 34 63C62 70 96 60 97 38C98 26 90 16 76 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}
