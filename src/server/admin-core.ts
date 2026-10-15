// Connexion de l'opérateur MIA (vous) : cœur sans cookies ni alias, donc testable avec une vraie base.
// Le compte n'est PAS en base : identifiant et mot de passe viennent des variables d'environnement
// MIA_ADMIN_IDENTIFIANT et MIA_ADMIN_MOT_DE_PASSE. Sans elles (ou si le mot de passe a moins de 12 caractères),
// l'espace MIA est simplement éteint : personne ne peut s'y connecter.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type postgres from "postgres";

export const DUREE_SESSION_ADMIN_HEURES = 12;
export const ESSAIS_MAX = 8;
export const FENETRE_ESSAIS_MIN = 15;

export interface ConfigAdmin {
  identifiant: string;
  motDePasse: string;
}

export function configAdmin(env: Record<string, string | undefined> = process.env): ConfigAdmin | null {
  const identifiant = env.MIA_ADMIN_IDENTIFIANT?.trim().toLowerCase() ?? "";
  const motDePasse = env.MIA_ADMIN_MOT_DE_PASSE ?? "";
  if (identifiant.length < 3 || motDePasse.length < 12) return null;
  return { identifiant, motDePasse };
}

export const empreinteJeton = (jeton: string) => createHash("sha256").update(jeton).digest("hex");

/** Comparaison en temps constant (on compare des empreintes de même longueur). */
function memeTexte(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export type ResultatConnexionAdmin = { ok: true; jeton: string; expire: Date } | { ok: false; raison: "eteint" | "bloque" | "refuse" };

/** Vérifie l'identifiant et le mot de passe. Trop d'échecs récents = blocage temporaire (même avec le bon mot de passe). */
export async function connecterAdmin(sql: postgres.Sql, config: ConfigAdmin | null, identifiant: string, motDePasse: string): Promise<ResultatConnexionAdmin> {
  if (!config) return { ok: false, raison: "eteint" };
  await sql`DELETE FROM tentative_admin WHERE cree_le < now() - interval '1 day'`;
  const [{ n }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM tentative_admin WHERE cree_le > now() - make_interval(mins => ${FENETRE_ESSAIS_MIN})`;
  if (n >= ESSAIS_MAX) return { ok: false, raison: "bloque" };
  const bonId = memeTexte(identifiant.trim().toLowerCase(), config.identifiant);
  const bonMdp = memeTexte(motDePasse, config.motDePasse);
  if (!(bonId && bonMdp)) {
    await sql`INSERT INTO tentative_admin DEFAULT VALUES`;
    await new Promise((r) => setTimeout(r, 400));
    return { ok: false, raison: "refuse" };
  }
  const jeton = randomBytes(32).toString("base64url");
  const expire = new Date(Date.now() + DUREE_SESSION_ADMIN_HEURES * 3_600_000);
  await sql`INSERT INTO session_admin (jeton_hash, expire_le) VALUES (${empreinteJeton(jeton)}, ${expire})`;
  await sql`DELETE FROM session_admin WHERE expire_le < now()`;
  await sql`DELETE FROM tentative_admin`; // connexion réussie : le compteur repart de zéro
  return { ok: true, jeton, expire };
}

export async function sessionAdminValide(sql: postgres.Sql, config: ConfigAdmin | null, jeton: string | undefined): Promise<boolean> {
  if (!config || !jeton || jeton.length > 100) return false;
  const [s] = await sql`SELECT 1 FROM session_admin WHERE jeton_hash = ${empreinteJeton(jeton)} AND expire_le > now()`;
  return !!s;
}

export async function fermerSessionAdmin(sql: postgres.Sql, jeton: string | undefined): Promise<void> {
  if (jeton) await sql`DELETE FROM session_admin WHERE jeton_hash = ${empreinteJeton(jeton)}`;
}
