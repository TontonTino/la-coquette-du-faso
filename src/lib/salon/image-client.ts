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

/**
 * Réduction d'un logo dans le navigateur : 512 px au plus, PNG (la transparence est gardée) ; si le PNG reste
 * lourd (logo en photo), on le réduit encore puis on passe en JPEG. Résultat : moins de 300 Ko.
 */
export async function reduireLogo(fichier: File): Promise<string> {
  const bitmap = await createImageBitmap(fichier);
  try {
    for (const [cote, format, qualite] of [[512, "image/png", 1], [384, "image/png", 1], [512, "image/jpeg", 0.85], [384, "image/jpeg", 0.7]] as const) {
      const echelle = Math.min(1, cote / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * echelle));
      canvas.height = Math.max(1, Math.round(bitmap.height * echelle));
      const c = canvas.getContext("2d");
      if (!c) throw new Error("Impossible de préparer le logo.");
      if (format === "image/jpeg") {
        c.fillStyle = "#ffffff";
        c.fillRect(0, 0, canvas.width, canvas.height);
      }
      c.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL(format, qualite);
      if (url.length < 380_000) return url; // ≈ 280 Ko décodés
    }
  } finally {
    bitmap.close();
  }
  throw new Error("Logo trop lourd, même réduit.");
}
