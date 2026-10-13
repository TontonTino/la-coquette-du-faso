import "server-only";

/**
 * Client PayDunya (API HTTP/JSON, « checkout-invoice »). Ne sait rien de MIA : il crée une facture et lit son état.
 * Les clés ne viennent QUE de l'environnement (jamais du code ni du dépôt) :
 *   PAYDUNYA_MASTER_KEY (« Clé principale »), PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN,
 *   PAYDUNYA_MODE = « production » pour de vrais paiements ; toute autre valeur (ou rien) = mode test sans argent réel,
 *   ACOMPTE_FCFA = montant de l'acompte (500 à 100 000) ; sans lui, la fonction est éteinte.
 */
export type ModePaydunya = "test" | "production";

export interface ConfigPaydunya {
  masterKey: string;
  privateKey: string;
  token: string;
  mode: ModePaydunya;
  base: string;
}

type Env = Record<string, string | undefined>;

export function configPaydunya(env: Env = process.env): ConfigPaydunya | null {
  const masterKey = env.PAYDUNYA_MASTER_KEY?.trim();
  const privateKey = env.PAYDUNYA_PRIVATE_KEY?.trim();
  const token = env.PAYDUNYA_TOKEN?.trim();
  if (!masterKey || !privateKey || !token) return null;
  const mode: ModePaydunya = env.PAYDUNYA_MODE?.trim() === "production" ? "production" : "test";
  return { masterKey, privateKey, token, mode, base: mode === "production" ? "https://app.paydunya.com/api/v1" : "https://app.paydunya.com/sandbox-api/v1" };
}

/** Montant de l'acompte en FCFA ; 0 = pas d'acompte. */
export function montantAcompte(env: Env = process.env): number {
  const n = Number(env.ACOMPTE_FCFA);
  return Number.isInteger(n) && n >= 500 && n <= 100_000 ? n : 0;
}

export class ErreurPaiement extends Error {}

const entetes = (c: ConfigPaydunya) => ({
  "Content-Type": "application/json",
  "PAYDUNYA-MASTER-KEY": c.masterKey,
  "PAYDUNYA-PRIVATE-KEY": c.privateKey,
  "PAYDUNYA-TOKEN": c.token,
});

type Fetch = typeof fetch;
const DELAI_MS = 10_000;

export interface NouvelleFacture {
  montant: number;
  description: string;
  nomBoutique: string;
  /** Nos références, renvoyées par PayDunya dans l'état de la facture (contrôle supplémentaire). */
  reference: string;
  retourUrl: string;
  annulationUrl: string;
}

export async function creerFacture(c: ConfigPaydunya, f: NouvelleFacture, appel: Fetch = fetch): Promise<{ url: string; jeton: string }> {
  let reponse: Response;
  try {
    reponse = await appel(`${c.base}/checkout-invoice/create`, {
      method: "POST",
      headers: entetes(c),
      signal: AbortSignal.timeout(DELAI_MS),
      body: JSON.stringify({
        invoice: { total_amount: f.montant, description: f.description },
        store: { name: f.nomBoutique },
        actions: { return_url: f.retourUrl, cancel_url: f.annulationUrl },
        custom_data: { reference: f.reference },
      }),
    });
  } catch {
    throw new ErreurPaiement("PayDunya injoignable");
  }
  const j = (await reponse.json().catch(() => null)) as { response_code?: string; response_text?: string; token?: string } | null;
  if (!j || j.response_code !== "00" || typeof j.token !== "string" || typeof j.response_text !== "string") {
    // Le message de PayDunya (ex. « Invalid Masterkey Specified ») va dans les journaux du serveur, jamais chez la cliente.
    throw new ErreurPaiement(`PayDunya a refusé la facture : ${j?.response_code ?? "?"} ${j?.response_text ?? ""}`.trim());
  }
  // L'adresse de paiement doit être en https : on ne redirige jamais une cliente vers autre chose.
  if (!/^https:\/\/[^\s]+$/.test(j.response_text)) throw new ErreurPaiement("Adresse de paiement inattendue");
  return { url: j.response_text, jeton: j.token };
}

export type EtatPaydunya = "pending" | "completed" | "cancelled" | "failed";

export interface EtatFacture {
  statut: EtatPaydunya;
  /** Montant de la facture chez PayDunya, s'il est renvoyé. */
  montant: number | null;
  /** Notre référence renvoyée dans custom_data, si elle est présente. */
  reference: string | null;
}

export async function etatFacture(c: ConfigPaydunya, jeton: string, appel: Fetch = fetch): Promise<EtatFacture> {
  let reponse: Response;
  try {
    reponse = await appel(`${c.base}/checkout-invoice/confirm/${encodeURIComponent(jeton)}`, { headers: entetes(c), signal: AbortSignal.timeout(DELAI_MS) });
  } catch {
    throw new ErreurPaiement("PayDunya injoignable");
  }
  const j = (await reponse.json().catch(() => null)) as {
    response_code?: string;
    status?: string;
    invoice?: { total_amount?: number | string };
    custom_data?: { reference?: unknown };
  } | null;
  if (!j || j.response_code !== "00") throw new ErreurPaiement(`État de facture illisible : ${j?.response_code ?? "?"}`);
  const statut: EtatPaydunya = j.status === "completed" || j.status === "cancelled" || j.status === "failed" ? j.status : "pending";
  const m = Number(j.invoice?.total_amount);
  return { statut, montant: Number.isFinite(m) ? m : null, reference: typeof j.custom_data?.reference === "string" ? j.custom_data.reference : null };
}
