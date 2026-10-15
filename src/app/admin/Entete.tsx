import Link from "next/link";
import { SymboleMia } from "@/components/brand/LogoMia";
import { IconSortie } from "@/components/ui/icons";
import { deconnexionAdminAction } from "./actions";

export function EnteteAdmin({ retour }: { retour?: { href: string; libelle: string } }) {
  return (
    <header className="border-b border-trait bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/admin" aria-label="MIA, liste des salons" className="flex items-center gap-2">
            <SymboleMia taille={34} className="text-mia-terracotta" />
            <span className="font-display text-xl leading-none font-bold">MIA</span>
          </Link>
          <span className="truncate text-sm text-sourdine">
            {retour ? (
              <Link href={retour.href} className="underline underline-offset-4 hover:text-mia-cacao">
                {retour.libelle}
              </Link>
            ) : (
              "Espace opérateur"
            )}
          </span>
        </div>
        <form action={deconnexionAdminAction}>
          <button type="submit" aria-label="Se déconnecter" title="Se déconnecter" className="flex size-11 items-center justify-center rounded-full text-sourdine hover:bg-mia-sable hover:text-mia-cacao">
            <IconSortie />
          </button>
        </form>
      </div>
    </header>
  );
}
