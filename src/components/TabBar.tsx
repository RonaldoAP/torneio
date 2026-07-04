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
    <header className="sticky top-0 z-40 border-b border-line bg-base/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-grass/15 font-display text-lg text-grass">
            F
          </span>
          <span className="hidden font-display text-xl tracking-wide text-ink sm:block">
            FIFA 26 · TORNEIO
          </span>
        </Link>

        <nav className="no-scrollbar -mx-1 flex flex-1 items-center gap-1 overflow-x-auto px-1">
          {TABS.map((t) => {
            const active =
              t.href === "/" ? pathname === "/" : pathname?.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-grass/15 text-grass"
                    : "text-ink-muted hover:bg-white/5 hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/admin"
          className="hidden shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-muted hover:text-ink sm:inline-block"
        >
          Admin
        </Link>
      </div>
    </header>
  );
}
