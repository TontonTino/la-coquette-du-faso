import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { HabillagePublic } from "@/components/public/Habillage";
import { buttonClasses } from "@/components/ui/Button";
import { IconCheck, IconWhatsApp } from "@/components/ui/icons";
import { libelleMoment } from "@/lib/salon/regles";
import { lienWhatsApp } from "@/lib/salon/whatsapp";
import { capitalize, formatDateLong } from "@/lib/time";
import { suiviDemande } from "@/server/salon/service";
import { Actualiser } from "./Actualiser";
import { NoterCoiffeuses } from "./NoterCoiffeuses";

export const metadata: Metadata = { title: "Suivi de ma demande", robots: { index: false, follow: false } };

export default function PageSuivi({ params }: PageProps<"/demande/[ref]">) {
  return (
    <HabillagePublic>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[1.75rem] bg-sable" />}>
        <Suivi params={params} />
      </Suspense>
    </HabillagePublic>
  );
}

const ETATS: Record<string, { titre: string; texte: string; ton: "attente" | "ok" | "ko" }> = {
  demandee: { titre: "Demande envoyée", texte: "Le salon va vous confirmer l'heure exacte sur WhatsApp.", ton: "attente" },
  prevue: { titre: "Rendez-vous confirmé", texte: "Le salon vous attend.", ton: "ok" },
  en_attente: { titre: "Vous êtes arrivée", texte: "Le salon vous a bien enregistrée.", ton: "ok" },
  en_cours: { titre: "Prestation en cours", texte: "", ton: "ok" },
  terminee: { titre: "Merci de votre visite !", texte: "À bientôt à La Coquette du Faso.", ton: "ok" },
  refusee: { titre: "Demande non acceptée", texte: "", ton: "ko" },
  annulee: { titre: "Rendez-vous annulé", texte: "Vous pouvez faire une nouvelle demande.", ton: "ko" },
  absente: { titre: "Rendez-vous manqué", texte: "Vous pouvez faire une nouvelle demande.", ton: "ko" },
  partie: { titre: "Rendez-vous clôturé", texte: "", ton: "ko" },
};

async function Suivi({ params }: { params: PageProps<"/demande/[ref]">["params"] }) {
  await connection();
  const { ref } = await params;
  const d = await suiviDemande(ref.toUpperCase());
  if (!d) notFound();
  const e = ETATS[d.statut] ?? ETATS.demandee;
  const photo = d.salonWhatsapp ? lienWhatsApp(d.salonWhatsapp, `Bonjour, voici la photo du modèle pour ma demande ${d.reference} (${d.prenom}).`) : null;
  const etape = d.statut === "demandee" ? 0 : ["prevue"].includes(d.statut) ? 1 : ["en_attente", "en_cours", "terminee"].includes(d.statut) ? 2 : -1;
  const fond = e.ton === "ok" ? "bg-noir text-white" : e.ton === "ko" ? "bg-rouge-pale text-encre" : "bg-white text-encre shadow-carte";

  return (
    <div>
      {d.statut === "demandee" && <Actualiser />}
      <p className="text-sm text-sourdine">Bonjour {d.prenom},</p>
      <div className={`relative mt-3 overflow-hidden rounded-[1.75rem] p-6 ${fond}`}>
        {d.statut === "prevue" && (
          <span
            className="absolute top-6 right-5 flex size-16 animate-tampon items-center justify-center rounded-full border-2 border-or text-or"
            style={{ transform: "rotate(-4deg)" }}
            aria-hidden
          >
            <IconCheck width={30} height={30} strokeWidth={2.2} />
          </span>
        )}
        <h1 className={`font-display text-[2.4rem] leading-[0.95] font-bold ${d.statut === "prevue" ? "pr-20" : ""} ${e.ton === "ok" ? "text-or" : ""}`}>{e.titre}</h1>
        {(d.statut === "refusee" ? d.motifRefus : e.texte) && (
          <p className={`mt-3 ${e.ton === "ok" ? "text-white/80" : e.ton === "ko" ? "text-rouge" : "text-sourdine"}`}>
            {d.statut === "refusee" ? `Motif : ${d.motifRefus}.` : e.texte}
          </p>
        )}
        {etape >= 0 && (
          <ol className="mt-6 grid grid-cols-3 gap-2" aria-label="Étapes de votre demande">
            {["Envoyée", "Confirmée", "Au salon"].map((t, i) => {
              const fait = i <= etape;
              const clair = e.ton === "ok";
              return (
                <li key={t} className="flex flex-col gap-1.5">
                  <span className={`h-1 rounded-full ${fait ? "bg-or" : clair ? "bg-white/15" : "bg-trait"}`} aria-hidden />
                  <span className={`text-xs ${fait ? (clair ? "text-white" : "font-medium text-encre") : clair ? "text-white/45" : "text-sourdine"}`}>
                    {t}
                    {i === etape ? <span className="sr-only"> (étape actuelle)</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {d.modele && (
        <div className="mt-4 flex items-center gap-4 rounded-2xl bg-white p-3 shadow-carte">
          {/* eslint-disable-next-line @next/next/no-img-element -- photo servie par l'application */}
          <img src={d.modele.photoUrl} alt="" className="h-20 w-16 rounded-xl object-cover" />
          <div>
            <p className="text-xs text-sourdine">Modèle choisi</p>
            <p className="font-display text-xl leading-tight font-bold">{d.modele.nom}</p>
          </div>
        </div>
      )}
      <dl className="mt-4 divide-y divide-trait rounded-2xl bg-white shadow-carte">
        <Ligne terme="Jour" valeur={capitalize(formatDateLong(d.jour))} />
        <Ligne terme="Heure" valeur={d.heure ? d.heure.replace(":", " h ") : `${libelleMoment(d.moment)}, heure exacte à confirmer`} fort={!!d.heure} />
        {d.categorie && <Ligne terme="Coiffure" valeur={d.categorie} />}
        {d.coiffeuses.length > 0 && <Ligne terme="Avec" valeur={d.coiffeuses.join(" et ")} />}
        <Ligne terme="Référence" valeur={d.reference} />
      </dl>

      {d.statut === "demandee" && photo && (
        <a href={photo} className={buttonClasses("or", "lg", "mt-5 w-full")}>
          <IconWhatsApp width={20} height={20} />
          Envoyer la photo du modèle sur WhatsApp
        </a>
      )}
      {d.statut === "terminee" && d.aNoter.length > 0 && <NoterCoiffeuses reference={d.reference} coiffeuses={d.aNoter} />}
      {(e.ton === "ko" || d.statut === "terminee") && (
        <Link href="/reserver" className={buttonClasses("noir", "lg", "mt-5 w-full")}>
          Faire une nouvelle demande
        </Link>
      )}
      <p className="mt-5 text-center text-xs text-sourdine">Gardez cette page : elle se met à jour quand le salon répond.</p>
    </div>
  );
}

function Ligne({ terme, valeur, fort = false }: { terme: string; valeur: string; fort?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3.5 text-sm">
      <dt className="text-sourdine">{terme}</dt>
      <dd className={`text-right ${fort ? "font-display text-2xl font-bold" : "font-medium"}`}>{valeur}</dd>
    </div>
  );
}
