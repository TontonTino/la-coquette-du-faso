import type { Metadata } from "next";
import { logoEnBase, vitrineDuSalon } from "@/lib/salon/vitrine";
import { identiteSalonEnCache } from "@/server/salon/identite";

/** Titre d'onglet d'une page publique : « <page> · <nom du salon> ». */
export async function metadonneesSalon(slug: string, titre: string): Promise<Metadata> {
  const id = await identiteSalonEnCache(slug);
  const icone = (logoEnBase(slug, id?.nom ?? "", id?.logoV) ?? vitrineDuSalon(slug, id?.vitrine).logo)?.icone;
  return { title: { absolute: id ? `${titre} · ${id.nom}` : titre }, ...(icone ? { icons: { icon: icone } } : {}) };
}
