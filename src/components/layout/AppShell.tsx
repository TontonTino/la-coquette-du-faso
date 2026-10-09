"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { STYLISTS } from "@/lib/catalog";
import { demoActions } from "@/store/demo-store";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { IconCalendar, IconCalendarPlus, IconChart, IconClock, IconHome, IconList, IconScissors, IconTag, IconUser, IconUsers } from "@/components/ui/icons";
import { Logo } from "./Logo";

type Space = "cliente" | "coiffeuse" | "gerante";
type NavItem = { href: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; exact?: boolean };

const SPACES: { id: Space; label: string; href: string }[] = [
  { id: "cliente", label: "Cliente", href: "/" },
  { id: "coiffeuse", label: "Coiffeuse", href: "/espace-coiffeuse" },
  { id: "gerante", label: "Gérante", href: "/espace-gerante" },
];

const NAV: Record<Space, NavItem[]> = {
  cliente: [
    { href: "/", label: "Accueil", icon: IconHome, exact: true },
    { href: "/prestations", label: "Prestations", icon: IconScissors },
    { href: "/reserver", label: "Réserver", icon: IconCalendarPlus },
    { href: "/equipe", label: "Équipe", icon: IconUsers },
    { href: "/mes-rendez-vous", label: "Mes RDV", icon: IconCalendar },
  ],
  coiffeuse: [
    { href: "/espace-coiffeuse", label: "Profils", icon: IconUsers, exact: true },
    ...STYLISTS.map((s) => ({ href: `/espace-coiffeuse/${s.id}`, label: s.name, icon: IconUser })),
  ],
  gerante: [
    { href: "/espace-gerante", label: "Tableau", icon: IconChart, exact: true },
    { href: "/espace-gerante/rendez-vous", label: "Rendez-vous", icon: IconList },
    { href: "/espace-gerante/disponibilites", label: "Dispos", icon: IconClock },
    { href: "/espace-gerante/prestations", label: "Tarifs", icon: IconTag },
    { href: "/espace-gerante/equipe", label: "Équipe", icon: IconUsers },
  ],
};

function spaceOf(pathname: string): Space {
  if (pathname.startsWith("/espace-coiffeuse")) return "coiffeuse";
  if (pathname.startsWith("/espace-gerante")) return "gerante";
  return "cliente";
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const space = spaceOf(pathname);
  const nav = NAV[space];
  const [confirmReset, setConfirmReset] = useState(false);
  const toast = useToast();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="texture-noire sticky top-0 z-40 border-b border-or/25 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="La Coquette du Faso, accueil">
            <Logo size={40} priority />
            <span className="hidden min-w-0 leading-tight whitespace-nowrap sm:block">
              <span className="block font-display text-lg font-semibold tracking-wide text-or">La Coquette du Faso</span>
              <span className="block text-[10px] tracking-[0.22em] text-white/60 uppercase">Salon de beauté · Ouagadougou</span>
            </span>
            <span className="font-display text-base leading-tight font-semibold text-or sm:hidden">
              La Coquette
              <br />
              du Faso
            </span>
          </Link>
          <nav aria-label="Espaces" className="ml-auto flex rounded-full border border-or/30 bg-white/5 p-0.5 text-xs sm:text-sm">
            {SPACES.map((s) => (
              <Link
                key={s.id}
                href={s.href}
                aria-current={space === s.id ? "page" : undefined}
                className={`rounded-full px-2.5 py-1.5 transition-colors sm:px-4 ${space === s.id ? "bg-or font-medium text-noir" : "text-white/75 hover:text-white"}`}
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>
        {/* Navigation secondaire sur ordinateur */}
        <nav aria-label="Navigation de l'espace" className="hidden border-t border-white/10 md:block">
          <ul className="mx-auto flex max-w-6xl gap-1 px-6">
            {nav.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative block px-3 py-2.5 text-sm transition-colors ${active ? "text-or" : "text-white/70 hover:text-white"}`}
                  >
                    {item.label}
                    {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-or" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 md:pb-12">{children}</main>

      <footer className="border-t border-trait bg-white pb-24 md:pb-0">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-sourdine sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            <span className="font-medium text-encre">Démonstration.</span> Coiffeuses, clientes, horaires et rendez-vous sont fictifs. Les
            données sont enregistrées uniquement dans ce navigateur et ne sont pas partagées entre appareils.
          </p>
          <button type="button" onClick={() => setConfirmReset(true)} className="shrink-0 self-start rounded-full border border-trait px-3 py-1.5 text-encre hover:border-or sm:self-auto">
            Réinitialiser la démo
          </button>
        </div>
      </footer>

      {/* Barre de navigation mobile */}
      <nav aria-label="Navigation de l'espace" className="fixed inset-x-0 bottom-0 z-40 border-t border-or/25 bg-noir/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 px-1 pt-2 pb-2.5 text-[10.5px] ${active ? "text-or" : "text-white/60"}`}
                >
                  <Icon width={22} height={22} />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <ConfirmSheet
        open={confirmReset}
        title="Réinitialiser la démo ?"
        confirmLabel="Réinitialiser"
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          demoActions.reset();
          setConfirmReset(false);
          toast("succes", "Démo réinitialisée", "Les rendez-vous de démonstration ont été régénérés.");
        }}
      >
        Tous les rendez-vous et créneaux bloqués de ce navigateur seront remplacés par le jeu de données de démonstration initial.
      </ConfirmSheet>
    </div>
  );
}
