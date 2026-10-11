import { photoCoiffeuse } from "@/server/salon/service";

/**
 * Photo publique d'une coiffeuse de l'équipe. L'adresse contient ?v=<date de modification> :
 * le navigateur peut la garder en cache un an sans risque de montrer une ancienne photo.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await photoCoiffeuse(id);
  if (!p) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(p.octets), {
    headers: {
      "Content-Type": p.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
