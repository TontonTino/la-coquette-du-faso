import "server-only";
import { db } from "@/server/db";
import { estReference } from "@/lib/salon/regles";
import type { Resultat } from "@/lib/salon/types";
import { configPaydunya, creerFacture, ErreurPaiement, etatFacture, montantAcompte, type ConfigPaydunya, type EtatFacture, type NouvelleFacture } from "@/server/paiement/paydunya";

/**
 * Acompte en ligne. Le salon reste maître : la demande n'est confirmée que par la secrétaire ;
 * l'acompte prouve seulement que la cliente s'engage. Rien ne passe par MIA : l'argent va sur le compte PayDunya du salon.
 *
 * Une facture PayDunya est créée quand la cliente clique sur « Payer l'acompte » ; son paiement n'est JAMAIS cru sur
 * parole : on redemande l'état de la facture à PayDunya (serveur à serveur) avant de la marquer payée.
 */
type R<T = undefined> = Resultat<T>;
const ok = <T>(valeur: T): R<T> => ({ ok: true, valeur });
const ko = <T = never>(erreur: string): R<T> => ({ ok: false, erreur });

/** Dépendances remplaçables dans les tests (PayDunya simulé). */
export interface Dependances {
  config: ConfigPaydunya | null;
  montant: number;
  creer: (c: ConfigPaydunya, f: NouvelleFacture) => Promise<{ url: string; jeton: string }>;
  etat: (c: ConfigPaydunya, jeton: string) => Promise<EtatFacture>;
}
const reel = (): Dependances => ({ config: configPaydunya(), montant: montantAcompte(), creer: creerFacture, etat: etatFacture });

export interface AcompteVue {
  /** La fonction est allumée (clés + montant configurés). */
  actif: boolean;
  montant: number;
  /** Mode des clés configurées : « test » = aucun argent réel. */
  mode: "test" | "production";
  /** Acompte confirmé payé par PayDunya. */
  paye: { montant: number; mode: "test" | "production" } | null;
  /** Une facture a été créée et n'est pas encore confirmée. */
  enAttente: boolean;
}

const INACTIF: AcompteVue = { actif: false, montant: 0, mode: "test", paye: null, enAttente: false };
const STATUTS_OUVERTS = ["demandee", "prevue"];
const MAX_FACTURES_PAR_HEURE = 5;

interface LigneAcompte {
  id: string;
  prestation_id: string;
  montant: number;
  statut: string;
  mode: "test" | "production";
  jeton: string;
}

/**
 * Pour la page de suivi : vérifie auprès de PayDunya les factures en attente de cette demande, puis dit où en est l'acompte.
 */
export async function acomptePourSuivi(reference: string, dep: Dependances = reel()): Promise<AcompteVue> {
  if (!dep.config || dep.montant === 0 || !estReference(reference)) return INACTIF;
  const sql = db();
  const [p] = await sql<{ id: string }[]>`SELECT id FROM prestation WHERE reference = ${reference}`;
  if (!p) return INACTIF;
  await verifierFactures(p.id, reference, dep);
  const lignes = await sql<LigneAcompte[]>`SELECT id, prestation_id, montant, statut, mode, jeton FROM acompte WHERE prestation_id = ${p.id}`;
  const paye = lignes.find((l) => l.statut === "paye");
  return {
    actif: true,
    montant: dep.montant,
    mode: dep.config.mode,
    paye: paye ? { montant: paye.montant, mode: paye.mode } : null,
    enAttente: !paye && lignes.some((l) => l.statut === "en_attente"),
  };
}

/** Interroge PayDunya pour chaque facture encore en attente (récente) et enregistre le résultat. */
async function verifierFactures(prestationId: string, reference: string, dep: Dependances): Promise<void> {
  const sql = db();
  const attente = await sql<LigneAcompte[]>`
    SELECT id, prestation_id, montant, statut, mode, jeton FROM acompte
    WHERE prestation_id = ${prestationId} AND statut = 'en_attente' AND cree_le > now() - interval '48 hours'
    ORDER BY cree_le DESC LIMIT 5`;
  for (const a of attente) {
    // Une facture créée en test ne se vérifie pas avec les clés de production, et inversement.
    if (!dep.config || a.mode !== dep.config.mode) continue;
    let e;
    try {
      e = await dep.etat(dep.config, a.jeton);
    } catch (err) {
      console.error("[acompte] vérification impossible", err instanceof ErreurPaiement ? err.message : err);
      continue; // on réessaiera au prochain affichage
    }
    if (e.statut === "completed") {
      // Garde-fous : la facture doit porter notre référence et le bon montant ; sinon on ne la croit pas.
      if ((e.reference !== null && e.reference !== reference) || (e.montant !== null && e.montant !== a.montant)) {
        console.error("[acompte] facture payée mais incohérente, ignorée", { jeton: a.jeton });
        continue;
      }
      await sql.begin(async (tx) => {
        const [deja] = await tx`SELECT 1 FROM acompte WHERE prestation_id = ${prestationId} AND statut = 'paye' FOR UPDATE`;
        await tx`UPDATE acompte SET statut = ${deja ? "doublon" : "paye"}, paye_le = now() WHERE id = ${a.id} AND statut = 'en_attente'`;
      });
    } else if (e.statut === "cancelled" || e.statut === "failed") {
      await sql`UPDATE acompte SET statut = ${e.statut === "cancelled" ? "annule" : "echoue"} WHERE id = ${a.id} AND statut = 'en_attente'`;
    }
  }
}

/** La cliente clique sur « Payer l'acompte » : crée la facture PayDunya et renvoie l'adresse de paiement. */
export async function lancerAcompte(reference: string, siteUrl: string, dep: Dependances = reel()): Promise<R<{ url: string }>> {
  if (!dep.config || dep.montant === 0) return ko("Le paiement de l'acompte n'est pas disponible pour le moment.");
  if (!estReference(reference)) return ko("Référence inconnue.");
  const sql = db();
  const [p] = await sql<{ id: string; salon_id: string; statut: string; salon_nom: string }[]>`
    SELECT p.id, p.salon_id, p.statut, s.nom AS salon_nom FROM prestation p JOIN salon s ON s.id = p.salon_id WHERE p.reference = ${reference}`;
  if (!p) return ko("Référence inconnue.");
  if (!STATUTS_OUVERTS.includes(p.statut)) return ko("Cette demande n'est plus ouverte : l'acompte n'est plus possible.");
  await verifierFactures(p.id, reference, dep);
  const [{ paye, recentes }] = await sql<{ paye: number; recentes: number }[]>`
    SELECT count(*) FILTER (WHERE statut = 'paye')::int AS paye,
           count(*) FILTER (WHERE cree_le > now() - interval '1 hour')::int AS recentes
    FROM acompte WHERE prestation_id = ${p.id}`;
  if (paye > 0) return ko("L'acompte est déjà payé. Merci !");
  if (recentes >= MAX_FACTURES_PAR_HEURE) return ko("Trop d'essais. Réessayez dans une heure.");

  const suivi = `${siteUrl}/demande/${reference}`;
  let facture;
  try {
    facture = await dep.creer(dep.config, {
      montant: dep.montant,
      description: "Acompte de réservation",
      nomBoutique: p.salon_nom,
      reference,
      retourUrl: suivi,
      annulationUrl: suivi,
    });
  } catch (err) {
    console.error("[acompte] création de facture en échec", err instanceof ErreurPaiement ? err.message : err);
    return ko("Le paiement est momentanément indisponible. Réessayez dans un instant.");
  }
  await sql`
    INSERT INTO acompte (salon_id, prestation_id, montant, mode, jeton)
    VALUES (${p.salon_id}, ${p.id}, ${dep.montant}, ${dep.config.mode}, ${facture.jeton})`;
  return ok({ url: facture.url });
}
