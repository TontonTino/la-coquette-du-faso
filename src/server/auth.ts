import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/lib/salon/types";
import { db } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/password";
import type { Ctx } from "@/server/salon/service";

/**
 * Connexion et sessions (SEC-001, SEC-002).
 * - Jeton aléatoire de 32 octets dans un cookie httpOnly ; la base ne garde que son empreinte SHA-256.
 * - L'autorisation est revérifiée côté serveur à chaque page et à chaque action.
 */
const COOKIE = "mia_session";
const DUREE_SESSION_JOURS = 30;

export interface Utilisatrice {
  id: string;
  nom: string;
  role: Role;
  salonId: string;
  salonNom: string;
  salonSlug: string | null;
  /** Version du logo enregistré en base (null = pas de logo envoyé). */
  salonLogoV: string | null;
}

const empreinte = (jeton: string) => createHash("sha256").update(jeton).digest("hex");

// Empreinte factice : même coût de calcul quand l'identifiant n'existe pas (pas d'indice sur les comptes).
let empreinteFactice: Promise<string> | null = null;

export async function seConnecter(identifiant: string, motDePasse: string): Promise<boolean> {
  const id = identifiant.trim().toLowerCase();
  const [u] = id
    ? await db()<{ id: string; mot_de_passe_hash: string; actif: boolean }[]>`
        SELECT id, mot_de_passe_hash, actif FROM utilisateur WHERE identifiant = ${id}`
    : [];
  empreinteFactice ??= hashPassword("mot-de-passe-factice");
  const valide = await verifyPassword(motDePasse, u?.mot_de_passe_hash ?? (await empreinteFactice));
  if (!u || !u.actif || !valide) {
    await new Promise((r) => setTimeout(r, 400)); // freine les essais en série
    return false;
  }
  const jeton = randomBytes(32).toString("base64url");
  const expire = new Date(Date.now() + DUREE_SESSION_JOURS * 86_400_000);
  await db()`INSERT INTO session (jeton_hash, utilisateur_id, expire_le) VALUES (${empreinte(jeton)}, ${u.id}, ${expire})`;
  await db()`DELETE FROM session WHERE utilisateur_id = ${u.id} AND expire_le < now()`;
  (await cookies()).set(COOKIE, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expire,
  });
  return true;
}

export async function seDeconnecter() {
  const store = await cookies();
  const jeton = store.get(COOKIE)?.value;
  if (jeton) await db()`DELETE FROM session WHERE jeton_hash = ${empreinte(jeton)}`;
  store.delete(COOKIE);
}

/** Utilisatrice connectée, ou null. Une seule requête par rendu grâce à cache(). */
export const utilisatriceCourante = cache(async (): Promise<Utilisatrice | null> => {
  const jeton = (await cookies()).get(COOKIE)?.value;
  if (!jeton || jeton.length > 100) return null;
  const [u] = await db()<{ id: string; nom: string; role: Role; salon_id: string; salon_nom: string; salon_slug: string | null; logo_v: string | null }[]>`
    SELECT u.id, u.nom, u.role, u.salon_id, s.nom AS salon_nom, s.slug AS salon_slug, (extract(epoch from s.logo_maj) * 1000)::bigint::text AS logo_v
    FROM session se
    JOIN utilisateur u ON u.id = se.utilisateur_id
    JOIN salon s ON s.id = u.salon_id
    WHERE se.jeton_hash = ${empreinte(jeton)} AND se.expire_le > now() AND u.actif`;
  return u ? { id: u.id, nom: u.nom, role: u.role, salonId: u.salon_id, salonNom: u.salon_nom, salonSlug: u.salon_slug, salonLogoV: u.logo_v } : null;
});

export const ctxDe = (u: Utilisatrice): Ctx => ({ salonId: u.salonId, utilisateurId: u.id, role: u.role });

/** Pour une page : redirige vers la connexion (ou l'accueil du salon) si l'accès n'est pas permis. */
export async function exigerPage(roles: Role[] = ["gerante", "secretaire"]): Promise<Utilisatrice> {
  const u = await utilisatriceCourante();
  if (!u) redirect("/connexion");
  if (!roles.includes(u.role)) redirect("/salon");
  return u;
}

export class NonAutorise extends Error {}

/** Pour une action serveur : lève une erreur si l'accès n'est pas permis (jamais de confiance dans l'écran). */
export async function exigerAction(roles: Role[] = ["gerante", "secretaire"]): Promise<Ctx> {
  const u = await utilisatriceCourante();
  if (!u || !roles.includes(u.role)) throw new NonAutorise("Session expirée ou accès refusé. Reconnectez-vous.");
  return ctxDe(u);
}
