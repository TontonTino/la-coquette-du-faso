import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { utilisatriceCourante } from "@/server/auth";

/**
 * Téléversement des vidéos du salon vers Vercel Blob, directement depuis le téléphone de la gérante
 * (le fichier ne passe pas par notre serveur : pas de limite de taille de 4,5 Mo).
 * Ce point d'entrée ne délivre un jeton qu'à une gérante connectée, pour de courtes vidéos seulement.
 */
const TYPES_ACCEPTES = ["video/mp4", "video/webm", "video/quicktime"];
const TAILLE_MAX = 40 * 1024 * 1024; // 40 Mo : une vidéo verticale de 15 à 30 s

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Le stockage des vidéos n'est pas encore activé." }, { status: 503 });
  }
  const corps = (await request.json()) as HandleUploadBody;
  try {
    const reponse = await handleUpload({
      request,
      body: corps,
      onBeforeGenerateToken: async () => {
        const u = await utilisatriceCourante();
        if (!u || u.role !== "gerante") throw new Error("Réservé à la gérante connectée.");
        return { allowedContentTypes: TYPES_ACCEPTES, maximumSizeInBytes: TAILLE_MAX, addRandomSuffix: true };
      },
    });
    return NextResponse.json(reponse);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
