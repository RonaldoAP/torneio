"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Regulamento" },
  { href: "/participantes", label: "Participantes" },
  { href: "/confrontos", label: "Confrontos" },
  { href: "/classificacao", label: "Classificação" },
  { href: "/mata-mata", label: "Mata-mata" },
  { href: "/goleadores", label: "Goleadores" },
];

export function TabBar() {
  const pathname = usePathname();

  // Rota TV/Projetor é fullscreen — sem barra.
  if (pathname?.startsWith("/tv")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-base/90 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-3 py-2.5 sm:px-4">
        <div className="mb-2 flex items-center gap-2">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gremio/15 font-display text-lg text-gremio">
              C
            </span>
            <span className="font-display text-xl tracking-wide text-ink">COPA COSTELA</span>
          </Link>
        </div>

        {/* Abas como toggles: todas visíveis, sem scroll (quebram em linhas). */}
        <nav className="flex flex-wrap gap-1.5" aria-label="Seções">
          {TABS.map((t) => {
            const active =
              t.href === "/" ? pathname === "/" : pathname?.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`grow basis-24 rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors ${
                  active
                    ? "border-transparent bg-gremio text-base shadow-[0_0_20px_rgba(27,157,224,0.25)]"
                    : "border-line bg-white/5 text-ink-muted hover:bg-white/10 hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
