"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { IconChart, IconClock, IconHome, IconImage, IconScissors, IconUsers } from "@/components/ui/icons";

export function NavSalon({ gerante }: { gerante: boolean }) {
  const pathname = usePathname();
  const liens: { href: string; label: string; icone: ReactNode }[] = [
    { href: "/salon", label: "Salon", icone: <IconHome /> },
    { href: "/salon/coiffeuses", label: "Coiffeuses", icone: <IconScissors /> },
    ...(gerante
      ? [
          { href: "/salon/modeles", label: "Modèles", icone: <IconImage /> },
          { href: "/salon/bilan", label: "Bilan", icone: <IconChart /> },
          { href: "/salon/equipe", label: "Équipe", icone: <IconUsers /> },
          { href: "/salon/reglages", label: "Réglages", icone: <IconClock /> },
        ]
      : []),
  ];
  return (
    <nav
      aria-label="Navigation de l'espace salon"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-noir/5 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-barre backdrop-blur"
    >
      <ul className="mx-auto flex max-w-xl px-1">
        {liens.map((l) => {
          const actif = l.href === "/salon" ? pathname === "/salon" : pathname.startsWith(l.href);
          return (
            <li key={l.href} className="flex-1">
              <Link
                href={l.href}
                aria-current={actif ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] ${actif ? "font-semibold text-noir" : "text-sourdine"}`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${actif ? "bg-noir text-or" : ""}`}
                  aria-hidden
                >
                  {l.icone}
                </span>
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
