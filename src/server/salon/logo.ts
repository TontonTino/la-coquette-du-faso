import { typeImage } from "@/lib/salon/regles";

export const LOGO_OCTETS_MIN = 200;
export const LOGO_OCTETS_MAX = 300_000;

/** Logo envoyé par le navigateur (data URL) → octets vérifiés (format réel, taille) ou message d'erreur. */
export function lireLogo(b64: unknown): { octets: Buffer; type: string } | { erreur: string } {
  if (typeof b64 !== "string" || b64.length > 500_000) return { erreur: "Logo illisible ou trop lourd." };
  const brut = b64.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(brut)) return { erreur: "Logo illisible." };
  const octets = Buffer.from(brut, "base64");
  if (octets.length < LOGO_OCTETS_MIN) return { erreur: "Logo trop petit ou vide." };
  if (octets.length > LOGO_OCTETS_MAX) return { erreur: "Logo trop lourd (300 Ko maximum après réduction)." };
  const type = typeImage(octets);
  if (!type) return { erreur: "Format non accepté : utilisez un logo JPEG, PNG ou WebP." };
  return { octets, type };
}
