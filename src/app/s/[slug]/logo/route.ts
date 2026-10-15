import { db } from "@/server/db";
import { logoDuSalon } from "@/server/salon/admin-salons";

/**
 * Logo public d'un salon (envoyé depuis l'espace MIA). L'adresse contient ?v=<date d'envoi> :
 * le navigateur peut le garder un an sans risque de montrer un ancien logo.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const logo = await logoDuSalon(db(), slug);
  if (!logo) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(logo.octets), {
    headers: { "Content-Type": logo.type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
