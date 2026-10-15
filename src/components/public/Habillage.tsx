import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";
import { themeDuSalon, variablesCss } from "@/lib/salon/theme";
import { vitrineDuSalon } from "@/lib/salon/vitrine";
import { identiteSalonEnCache } from "@/server/salon/identite";

/**
 * En-tête et pied de page des pages clientes (publiques) d'un salon : son nom, son logo, ses couleurs.
 * `base` est le début des adresses du salon (vide à la racine du site, « /s/<identifiant> » sinon).
 */
export async function HabillagePublic({ slug, base, children, plein = false }: { slug: string; base: string; children: ReactNode; plein?: boolean }) {
  const id = await identiteSalonEnCache(slug);
  const nom = id?.nom ?? "Salon";
  const logo = vitrineDuSalon(slug, id?.vitrine).logo;
  return (
    <div className="pages-clientes flex min-h-dvh flex-col bg-lin text-encre" style={variablesCss(themeDuSalon(slug, id?.theme))}>
      <header className="surface-sombre sticky top-0 z-30 border-b border-or/20 bg-noir text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <Link href={base || "/"} className="flex min-w-0 items-center gap-2.5" aria-label={`${nom}, accueil`}>
            <Logo logo={logo} size={36} priority />
            <span className="truncate font-display text-xl leading-none font-semibold text-or">{nom}</span>
          </Link>
          <Link href={`${base}/reserver`} className="shrink-0 rounded-full border border-or/50 px-4 py-2 text-sm font-medium text-or hover:bg-or hover:text-noir">
            Réserver
          </Link>
        </div>
      </header>
      <main className={plein ? "w-full flex-1" : "mx-auto w-full max-w-3xl flex-1 px-4 py-6"}>{children}</main>
      <footer className="surface-sombre border-t border-white/10 bg-noir text-white/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 text-xs">
          <span className="flex min-w-0 items-center gap-2">
            <Logo logo={logo} size={24} />
            <span className="truncate font-display text-base text-or">{nom}</span>
          </span>
          <Link href="/connexion" className="shrink-0 underline underline-offset-4 hover:text-white">
            Espace salon
          </Link>
        </div>
      </footer>
    </div>
  );
}
