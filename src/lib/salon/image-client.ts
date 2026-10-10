/**
 * Réduction d'une photo dans le navigateur avant envoi (côté gérante) :
 * une photo de téléphone (3–6 Mo) devient un JPEG d'environ 900 px et 100–250 Ko.
 * Économise la connexion mobile et l'espace en base.
 */
export async function reduireImage(fichier: File, cote = 900): Promise<string> {
  const bitmap = await createImageBitmap(fichier);
  const echelle = Math.min(1, cote / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * echelle);
  canvas.height = Math.round(bitmap.height * echelle);
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Impossible de préparer la photo.");
  c.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const qualite of [0.82, 0.7, 0.55]) {
    const url = canvas.toDataURL("image/jpeg", qualite);
    if (url.length < 900_000) return url; // ≈ 650 Ko une fois décodé
  }
  throw new Error("Photo trop lourde, même réduite.");
}
