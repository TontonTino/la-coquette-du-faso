import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { configAdmin, connecterAdmin, fermerSessionAdmin, sessionAdminValide, type ResultatConnexionAdmin } from "./admin-core";

/** Espace MIA (opérateur de la plateforme) : cookie « mia_admin », distinct de celui des salons. */
const COOKIE = "mia_admin";

/** Vrai si MIA_ADMIN_IDENTIFIANT et MIA_ADMIN_MOT_DE_PASSE (12 caractères minimum) sont configurés. */
export const adminActif = () => configAdmin() !== null;

export async function seConnecterAdmin(identifiant: string, motDePasse: string): Promise<ResultatConnexionAdmin> {
  const r = await connecterAdmin(db(), configAdmin(), identifiant, motDePasse);
  if (r.ok) {
    (await cookies()).set(COOKIE, r.jeton, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: r.expire,
    });
  }
  return r;
}

export async function seDeconnecterAdmin() {
  const store = await cookies();
  await fermerSessionAdmin(db(), store.get(COOKIE)?.value);
  store.delete(COOKIE);
}

export const adminConnecte = cache(async (): Promise<boolean> => sessionAdminValide(db(), configAdmin(), (await cookies()).get(COOKIE)?.value));

export async function exigerAdminPage(): Promise<void> {
  if (!(await adminConnecte())) redirect("/admin/connexion");
}

export class NonAutoriseAdmin extends Error {}

export async function exigerAdminAction(): Promise<void> {
  if (!(await adminConnecte())) throw new NonAutoriseAdmin("Session expirée. Reconnectez-vous.");
}
