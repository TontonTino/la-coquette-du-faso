import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Carte, ChargementListe, Pastille, Vide } from "@/app/salon/ui";
import { exigerAdminPage } from "@/server/admin";
import { db } from "@/server/db";
import { listerSalons } from "@/server/salon/admin-salons";
import { EnteteAdmin } from "./Entete";

export const metadata: Metadata = { title: "Salons" };

export default function PageAdmin() {
  return (
    <>
      <EnteteAdmin />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl leading-none font-bold">Salons</h1>
          <Link href="/admin/nouveau" className="inline-flex h-11 items-center rounded-full bg-noir px-5 text-sm font-medium text-white hover:bg-noir-doux">
            Nouveau salon
          </Link>
        </div>
        <Suspense fallback={<div className="mt-6"><ChargementListe /></div>}>
          <ListeSalons />
        </Suspense>
      </main>
    </>
  );
}

async function ListeSalons() {
  await exigerAdminPage();
  const salons = await listerSalons(db());
  if (salons.length === 0) return <div className="mt-6"><Vide>Aucun salon pour l&apos;instant. Créez le premier avec « Nouveau salon ».</Vide></div>;
  return (
    <ul className="mt-6 flex flex-col gap-2.5">
      {salons.map((s) => (
        <li key={s.id}>
          <Carte className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{s.nom}</p>
              <p className="mt-0.5 text-xs text-sourdine">
                /s/{s.slug} · {s.services} service{s.services > 1 ? "s" : ""} · {s.coiffeuses} coiffeuse{s.coiffeuses > 1 ? "s" : ""} · {s.demandes} demande{s.demandes > 1 ? "s" : ""}
              </p>
              <div className="mt-1.5">{s.aLogo ? <Pastille ton="vert">Logo</Pastille> : <Pastille ton="gris">Sans logo</Pastille>}</div>
            </div>
            <div className="flex gap-2">
              <Link href={`/s/${s.slug}`} className="inline-flex h-11 items-center rounded-full border border-noir/15 bg-white px-4 text-sm font-medium hover:border-or">
                Voir
              </Link>
              <Link href={`/admin/salons/${s.id}`} className="inline-flex h-11 items-center rounded-full bg-noir px-4 text-sm font-medium text-white hover:bg-noir-doux">
                Régler
              </Link>
            </div>
          </Carte>
        </li>
      ))}
    </ul>
  );
}
