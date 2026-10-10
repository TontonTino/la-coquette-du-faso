"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavSalon({ gerante }: { gerante: boolean }) {
  const pathname = usePathname();
  const liens = [
    { href: "/salon", label: "Salon" },
    { href: "/salon/coiffeuses", label: "Coiffeuses" },
    ...(gerante
      ? [
          { href: "/salon/modeles", label: "Modèles" },
          { href: "/salon/bilan", label: "Bilan" },
          { href: "/salon/equipe", label: "Équipe" },
        ]
      : []),
  ];
  return (
    <nav aria-label="Navigation de l'espace salon" className="fixed inset-x-0 bottom-0 z-30 border-t border-trait bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-xl">
        {liens.map((l) => {
          const actif = l.href === "/salon" ? pathname === "/salon" : pathname.startsWith(l.href);
          return (
            <li key={l.href} className="flex-1">
              <Link
                href={l.href}
                aria-current={actif ? "page" : undefined}
                className={`flex min-h-15 items-center justify-center text-sm ${
                  actif ? "font-semibold text-noir shadow-[inset_0_3px_0_var(--color-or)]" : "text-sourdine"
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
