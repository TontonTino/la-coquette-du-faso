import Link from "next/link";
import { IconSortie } from "@/components/ui/icons";
import { deconnexionAdminAction } from "./actions";

export function EnteteAdmin({ retour }: { retour?: { href: string; libelle: string } }) {
  return (
    <header className="bg-noir text-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/admin" className="font-display text-2xl leading-none font-bold text-or">
            MIA
          </Link>
          <span className="truncate text-sm text-white/60">{retour ? <Link href={retour.href} className="underline underline-offset-4 hover:text-white">{retour.libelle}</Link> : "Espace opérateur"}</span>
        </div>
        <form action={deconnexionAdminAction}>
          <button type="submit" aria-label="Se déconnecter" title="Se déconnecter" className="flex size-11 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
            <IconSortie />
          </button>
        </form>
      </div>
    </header>
  );
}
