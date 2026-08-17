"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useEditions } from "@/lib/useTournament";

const TABS = [
  { href: "/", label: "Regulamento" },
  { href: "/participantes", label: "Participantes" },
  { href: "/confrontos", label: "Confrontos" },
  { href: "/classificacao", label: "Classificação" },
  { href: "/mata-mata", label: "Mata-mata" },
  { href: "/goleadores", label: "Goleadores" },
];

/**
 * Topo enxuto: escudo + nome à esquerda, hambúrguer à direita — no celular e no
 * desktop. As abas viravam duas linhas de botões e roubavam a tela do conteúdo;
 * agora só aparecem quando o menu é aberto.
 */
export function TabBar() {
  const pathname = usePathname();
  const { editions, current } = useEditions();
  const [aberto, setAberto] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // A aba Histórico só aparece quando existe alguma edição arquivada.
  const hasHistory = editions.some((e) => e.id !== current);
  const tabs = hasHistory ? [...TABS, { href: "/historico", label: "Histórico" }] : TABS;

  const ativo = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));
  const atual = tabs.find((t) => ativo(t.href));

  // Fecha ao trocar de página, com Esc ou ao clicar fora.
  useEffect(() => setAberto(false), [pathname]);
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAberto(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [aberto]);

  // Rota TV/Projetor é fullscreen — sem barra.
  if (pathname?.startsWith("/tv")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-base/70 backdrop-blur-xl">
      <div ref={boxRef} className="mx-auto max-w-5xl px-3 sm:px-4">
        <div className="flex items-center justify-between gap-3 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-azul/40 bg-azul/15 font-display text-xl text-azul">
              C
            </span>
            <span className="font-display text-2xl tracking-wide text-ink">Copa Costela</span>
          </Link>

          <div className="flex items-center gap-3">
            {atual && (
              <span className="hidden font-display text-sm tracking-[0.2em] text-ink-muted sm:inline">
                {atual.label}
              </span>
            )}
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
              aria-controls="menu-principal"
              aria-label={aberto ? "Fechar menu" : "Abrir menu"}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-ink transition-colors hover:bg-white/10"
            >
              <span className="relative block h-4 w-5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="absolute left-0 block h-0.5 w-5 rounded bg-current transition-all duration-200"
                    style={
                      aberto
                        ? {
                            top: 7,
                            transform:
                              i === 1 ? "scaleX(0)" : `rotate(${i === 0 ? 45 : -45}deg)`,
                          }
                        : { top: i * 7 }
                    }
                  />
                ))}
              </span>
            </button>
          </div>
        </div>

        {aberto && (
          <nav id="menu-principal" className="pb-3" aria-label="Seções">
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {tabs.map((t) => {
                const on = ativo(t.href);
                return (
                  <li key={t.href}>
                    <Link
                      href={t.href}
                      aria-current={on ? "page" : undefined}
                      className={`flex items-center justify-between rounded-lg border px-3.5 py-3 font-display text-xl tracking-wide transition-colors ${
                        on
                          ? "border-azul/50 bg-azul/15 text-branco"
                          : "border-white/10 bg-white/[0.03] text-ink-muted hover:bg-white/[0.07] hover:text-ink"
                      }`}
                    >
                      {t.label}
                      {on && <span className="h-2 w-2 rounded-full bg-azul" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
