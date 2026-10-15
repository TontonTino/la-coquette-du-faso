import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { HabillagePublic } from "@/components/public/Habillage";
import { baseDuSalon, SALON_PUBLIC } from "@/server/salon/public-config";
import { Alerte, Squelette } from "@/components/public/formulaire";
import { buttonClasses } from "@/components/ui/Button";
import { IconCheck, IconWhatsApp } from "@/components/ui/icons";
import { libelleMoment } from "@/lib/salon/regles";
import { lienWhatsApp } from "@/lib/salon/whatsapp";
import { capitalize, formatDateLong, formatFcfa } from "@/lib/time";
import { acomptePourSuivi } from "@/server/salon/acompte";
import { suiviDemande } from "@/server/salon/service";
import { Actualiser } from "./Actualiser";
import { NoterCoiffeuses } from "./NoterCoiffeuses";
import { PayerAcompte } from "./PayerAcompte";

export const metadata: Metadata = { title: "Suivi de ma demande", robots: { index: false, follow: false } };

export default function PageSuivi({ params }: PageProps<"/demande/[ref]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-lin px-4 py-6"><Squelette className="mx-auto h-72 max-w-3xl rounded-[1.75rem]" /></div>}>
      <Suivi params={params} />
    </Suspense>
  );
}

/** `etiquette` dit l'état en toutes lettres : il ne repose jamais sur la couleur seule. */
const ETATS: Record<string, { titre: string; texte: string; ton: "attente" | "ok" | "ko"; etiquette: string }> = {
  demandee: { titre: "Demande envoyée", texte: "Le salon va vous confirmer l'heure exacte sur WhatsApp.", ton: "attente", etiquette: "En attente de la réponse du salon" },
  prevue: { titre: "Rendez-vous confirmé", texte: "Le salon vous attend.", ton: "ok", etiquette: "Confirmé par le salon" },
  en_attente: { titre: "Vous êtes arrivée", texte: "Le salon vous a bien enregistrée.", ton: "ok", etiquette: "Au salon" },
  en_cours: { titre: "Prestation en cours", texte: "", ton: "ok", etiquette: "Au salon" },
  terminee: { titre: "Merci de votre visite !", texte: "À bientôt au salon.", ton: "ok", etiquette: "Terminé" },
  refusee: { titre: "Demande non acceptée", texte: "", ton: "ko", etiquette: "Non acceptée" },
  annulee: { titre: "Rendez-vous annulé", texte: "Vous pouvez faire une nouvelle demande.", ton: "ko", etiquette: "Annulé" },
  absente: { titre: "Rendez-vous manqué", texte: "Vous pouvez faire une nouvelle demande.", ton: "ko", etiquette: "Manqué" },
  partie: { titre: "Rendez-vous clôturé", texte: "", ton: "ko", etiquette: "Clôturé" },
};

async function Suivi({ params }: { params: PageProps<"/demande/[ref]">["params"] }) {
  await connection();
  const { ref } = await params;
  const d = await suiviDemande(ref.toUpperCase());
  if (!d) notFound();
  const slug = d.salonSlug ?? SALON_PUBLIC;
  const base = baseDuSalon(slug);
  const e = ETATS[d.statut] ?? ETATS.demandee;
  const ac = await acomptePourSuivi(d.reference);
  const acompteOuvert = ["demandee", "prevue"].includes(d.statut);
  const photo = d.salonWhatsapp ? lienWhatsApp(d.salonWhatsapp, `Bonjour, voici la photo du modèle pour ma demande ${d.reference} (${d.prenom}).`) : null;
  const etape = d.statut === "demandee" ? 0 : ["prevue"].includes(d.statut) ? 1 : ["en_attente", "en_cours", "terminee"].includes(d.statut) ? 2 : -1;
  const contact = d.salonWhatsapp ? lienWhatsApp(d.salonWhatsapp, `Bonjour, c'est ${d.prenom}, au sujet de ma demande ${d.reference}.`) : null;
  const fond = e.ton === "ok" ? "bg-marque text-white" : e.ton === "ko" ? "bg-rouge-pale text-encre" : "bg-white text-encre shadow-carte";

  return (
    <HabillagePublic slug={slug} base={base}>
    <div>
      {(d.statut === "demandee" || (acompteOuvert && ac.enAttente)) && <Actualiser />}
      <p className="text-sm text-sourdine">
        Bonjour {d.prenom}, voici où en est votre demande à <span className="font-medium text-encre">{d.salonNom}</span>.
      </p>
      <div className={`relative mt-3 overflow-hidden rounded-[1.75rem] p-6 ${fond}`}>
        {d.statut === "prevue" && (
          <span
            className="absolute top-6 right-5 flex size-16 animate-tampon items-center justify-center rounded-full border-2 border-detail text-detail"
            style={{ transform: "rotate(-4deg)" }}
            aria-hidden
          >
            <IconCheck width={30} height={30} strokeWidth={2.2} />
          </span>
        )}
        <p className={`mb-2 flex items-center gap-2 text-xs font-medium tracking-wide uppercase ${d.statut === "prevue" ? "pr-20" : ""} ${e.ton === "ok" ? "text-white/80" : e.ton === "ko" ? "text-rouge" : "text-accent-texte"}`}>
          {e.ton === "attente" && <span className="size-2 animate-pulse rounded-full bg-action" aria-hidden />}
          {e.etiquette}
        </p>
        <h1 className={`font-display text-[2.4rem] leading-[0.95] font-bold ${d.statut === "prevue" ? "pr-20" : ""} ${e.ton === "ok" ? "text-detail" : ""}`}>{e.titre}</h1>
        {(d.statut === "refusee" ? d.motifRefus : e.texte) && (
          <p className={`mt-3 ${e.ton === "ok" ? "text-white/85" : e.ton === "ko" ? "text-rouge" : "text-sourdine"}`}>
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
                  <span className={`h-1.5 rounded-full ${fait ? (clair ? "bg-detail" : "bg-action") : clair ? "bg-white/20" : "bg-trait"}`} aria-hidden />
                  <span className={`text-xs ${fait ? (clair ? "font-medium text-white" : "font-medium text-encre") : clair ? "text-white/70" : "text-sourdine"}`}>
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
      <dl className="mt-4 divide-y divide-trait rounded-2xl bg-white shadow-carte" aria-label="Récapitulatif de votre demande">
        <Ligne terme="Jour" valeur={capitalize(formatDateLong(d.jour))} />
        <Ligne terme="Heure" valeur={d.heure ? d.heure.replace(":", " h ") : d.moment ? `${libelleMoment(d.moment)}, heure exacte à confirmer` : "Heure exacte à confirmer par le salon"} fort={!!d.heure} />
        {d.categorie && <Ligne terme="Service" valeur={d.categorie} />}
        {d.coiffeuses.length > 0 && <Ligne terme="Avec" valeur={d.coiffeuses.join(" et ")} />}
        <Ligne terme="Référence" valeur={d.reference} />
      </dl>

      {ac.actif && (ac.paye || acompteOuvert) && (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-carte" aria-label="Acompte">
          {ac.mode === "test" && (
            <p className="mb-3 rounded-xl bg-accent-pale px-3 py-2 text-xs font-medium text-accent-texte">Mode test : aucun argent réel n&apos;est prélevé.</p>
          )}
          {ac.paye ? (
            <Alerte ton="succes">Acompte de {formatFcfa(ac.paye.montant)} reçu. Merci !</Alerte>
          ) : ac.enAttente ? (
            <>
              <Alerte ton="info">Nous vérifions votre paiement. Si vous venez de payer, patientez un instant : cette page se met à jour.</Alerte>
              <PayerAcompte reference={d.reference} libelle="Payer à nouveau l'acompte" />
            </>
          ) : (
            <>
              <p className="text-sm">
                Le salon demande un acompte de <span className="font-semibold">{formatFcfa(ac.montant)}</span> pour garder votre créneau.
              </p>
              <PayerAcompte reference={d.reference} libelle={`Payer l'acompte · ${formatFcfa(ac.montant)}`} />
            </>
          )}
        </section>
      )}

      {d.statut === "demandee" && photo && (
        <a href={photo} className={buttonClasses("action", "md", "mt-5 w-full")}>
          <IconWhatsApp width={20} height={20} />
          Envoyer la photo sur WhatsApp
        </a>
      )}
      {contact && ["demandee", "prevue", "en_attente"].includes(d.statut) && (
        <a href={contact} className={buttonClasses("contour", "md", "mt-3 w-full")}>
          <IconWhatsApp width={18} height={18} />
          Écrire au salon
        </a>
      )}
      {d.statut === "terminee" && d.aNoter.length > 0 && <NoterCoiffeuses reference={d.reference} coiffeuses={d.aNoter} />}
      {(e.ton === "ko" || d.statut === "terminee") && (
        <Link href={`${base}/reserver`} className={buttonClasses("action", "lg", "mt-5 w-full")}>
          Faire une nouvelle demande
        </Link>
      )}
      <p className="mt-5 text-center text-xs text-sourdine">
        {d.statut === "demandee"
          ? "Cette page se met à jour toute seule toutes les 30 secondes. Gardez-la ouverte, ou notez votre référence."
          : "Gardez ce lien : il montre l'état de votre rendez-vous."}
      </p>
    </div>
    </HabillagePublic>
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
