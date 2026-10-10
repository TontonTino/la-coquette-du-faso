import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { HabillagePublic } from "@/components/public/Habillage";
import { buttonClasses } from "@/components/ui/Button";
import { libelleMoment } from "@/lib/salon/regles";
import { lienWhatsApp } from "@/lib/salon/whatsapp";
import { capitalize, formatDateLong } from "@/lib/time";
import { suiviDemande } from "@/server/salon/service";
import { Actualiser } from "./Actualiser";

export const metadata: Metadata = { title: "Suivi de ma demande", robots: { index: false, follow: false } };

export default function PageSuivi({ params }: PageProps<"/demande/[ref]">) {
  return (
    <HabillagePublic>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" />}>
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
  const couleur = e.ton === "ok" ? "bg-vert-pale text-vert" : e.ton === "ko" ? "bg-rouge-pale text-rouge" : "bg-or-pale text-or-fonce";
  const photo = d.salonWhatsapp ? lienWhatsApp(d.salonWhatsapp, `Bonjour, voici la photo du modèle pour ma demande ${d.reference} (${d.prenom}).`) : null;

  return (
    <div>
      {d.statut === "demandee" && <Actualiser />}
      <p className="text-sm text-sourdine">Bonjour {d.prenom},</p>
      <div className={`mt-2 rounded-2xl p-5 ${couleur}`}>
        <h1 className="font-display text-3xl font-bold">{e.titre}</h1>
        {(d.statut === "refusee" ? d.motifRefus : e.texte) && <p className="mt-1">{d.statut === "refusee" ? `Motif : ${d.motifRefus}.` : e.texte}</p>}
      </div>

      {d.modele && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-trait bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- photo servie par l'application */}
          <img src={d.modele.photoUrl} alt="" className="size-16 rounded-xl object-cover" />
          <div>
            <p className="text-xs text-sourdine">Modèle choisi</p>
            <p className="font-semibold">{d.modele.nom}</p>
          </div>
        </div>
      )}
      <dl className="mt-4 divide-y divide-trait rounded-2xl border border-trait bg-white">
        <Ligne terme="Jour" valeur={capitalize(formatDateLong(d.jour))} />
        <Ligne terme="Heure" valeur={d.heure ? d.heure.replace(":", " h ") : `${libelleMoment(d.moment)} — heure exacte à confirmer`} />
        {d.categorie && <Ligne terme="Coiffure" valeur={d.categorie} />}
        {d.coiffeuses.length > 0 && <Ligne terme="Avec" valeur={d.coiffeuses.join(" et ")} />}
        <Ligne terme="Référence" valeur={d.reference} />
      </dl>

      {d.statut === "demandee" && photo && (
        <a href={photo} className={buttonClasses("or", "lg", "mt-5 w-full")}>
          Envoyer la photo du modèle sur WhatsApp
        </a>
      )}
      {(e.ton === "ko" || d.statut === "terminee") && (
        <Link href="/reserver" className={buttonClasses("noir", "lg", "mt-5 w-full")}>
          Faire une nouvelle demande
        </Link>
      )}
      <p className="mt-5 text-center text-xs text-sourdine">Gardez cette page : elle se met à jour quand le salon répond.</p>
    </div>
  );
}

function Ligne({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3 text-sm">
      <dt className="text-sourdine">{terme}</dt>
      <dd className="text-right font-medium">{valeur}</dd>
    </div>
  );
}
