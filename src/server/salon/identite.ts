import { cacheLife } from "next/cache";
import { identiteSalon } from "./service";

/**
 * Identité d'un salon (nom, couleurs, textes), gardée une minute en mémoire : l'en-tête des pages publiques
 * s'affiche tout de suite, sans attendre la base. Une modification de couleurs apparaît donc sous une minute.
 */
export async function identiteSalonEnCache(slug: string) {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  return identiteSalon(slug);
}
