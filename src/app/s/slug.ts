import { notFound } from "next/navigation";
import { identiteSalonEnCache } from "@/server/salon/identite";

/** Identifiant public d'un salon dans l'adresse (« /s/<identifiant> ») : lettres minuscules, chiffres et tirets. */
export const slugValide = (slug: string) => /^[a-z0-9-]{3,60}$/.test(slug);

/** Page d'un salon : « page introuvable » si l'identifiant est mal écrit ou si le salon n'existe pas. */
export async function exigerSalon(slug: string): Promise<void> {
  if (!slugValide(slug) || !(await identiteSalonEnCache(slug))) notFound();
}
