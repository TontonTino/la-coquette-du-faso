// Ouvre un nouveau salon, VIDE : le salon, un compte gérante, un compte secrétaire, et ses services si vous les donnez.
// Aucune donnée fictive. Les mots de passe sont générés au hasard et affichés UNE SEULE FOIS : notez-les.
//
// Usage (PowerShell) :
//   $env:DATABASE_URL="..."
//   npm run salon:creer -- --nom "Black Roots Salon" --whatsapp "70 12 34 56" --adresse "Ouaga 2000" `
//        --horaires "Lun-Sam, 8 h - 19 h" --services "Tresses, Tissage, Manucure:ongles"
//
// Options : --nom (obligatoire) --slug --telephone --whatsapp --email --adresse --horaires --carte (lien https)
//           --services "A, B, C:ongles" --marque "#3e2a22" --action "#a44e3a" --titre "..." --accroche "..."
import postgres from "postgres";
import { lireServices, ouvrirSalon, type DemandeOuverture } from "./lib/ouverture.mts";

function lireArguments(argv: string[]): Record<string, string> {
  const sortie: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new Error(`Argument inattendu : ${a}`);
    const valeur = argv[i + 1];
    if (valeur === undefined || valeur.startsWith("--")) throw new Error(`La valeur de ${a} manque.`);
    sortie[a.slice(2)] = valeur;
    i++;
  }
  return sortie;
}

/** Neon ajoute « channel_binding=require », que le pilote « postgres » refuse : on le retire. */
function nettoyerUrl(url: string): string {
  const u = new URL(url);
  u.searchParams.delete("channel_binding");
  return u.toString();
}

try {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant : indiquez l'adresse de la base.");
  const a = lireArguments(process.argv.slice(2));
  if (!a.nom) throw new Error('--nom est obligatoire, par exemple --nom "Black Roots Salon".');
  const connues = new Set(["nom", "slug", "telephone", "whatsapp", "email", "adresse", "horaires", "carte", "services", "marque", "action", "titre", "accroche", "etiquette"]);
  for (const cle of Object.keys(a)) if (!connues.has(cle)) throw new Error(`Option inconnue : --${cle}`);

  const demande: DemandeOuverture = {
    nom: a.nom,
    slug: a.slug,
    telephone: a.telephone,
    whatsapp: a.whatsapp,
    email: a.email,
    adresse: a.adresse,
    horaires: a.horaires,
    carteUrl: a.carte,
    services: a.services ? lireServices(a.services) : [],
    theme: {
      ...(a.marque ? { marque: a.marque } : {}),
      ...(a.action ? { action: a.action, accentTexte: a.action } : {}),
    },
    textes: { ...(a.titre ? { titre: a.titre } : {}), ...(a.etiquette ? { etiquette: a.etiquette } : {}), ...(a.accroche ? { accroche: a.accroche } : {}) },
  };

  const sql = postgres(nettoyerUrl(url), { max: 1, onnotice: () => {} });
  try {
    const r = await ouvrirSalon(sql, demande);
    console.log(`\n✔ Salon « ${a.nom} » créé, vide (aucune coiffeuse, aucun modèle, aucune vidéo).`);
    console.log(`  Page des clientes : /s/${r.slug}`);
    console.log(`  Services créés    : ${r.services}`);
    console.log("\n  Comptes de connexion (à noter maintenant : les mots de passe ne seront plus affichés) :");
    for (const c of r.comptes) console.log(`   - ${c.role.padEnd(10)} identifiant : ${c.identifiant}   mot de passe : ${c.motDePasse}`);
    console.log("\n  Étape suivante : la gérante se connecte sur /connexion, ajoute ses coiffeuses (onglet Équipe) et ses photos.");
  } finally {
    await sql.end();
  }
} catch (e) {
  console.error(`✘ ${(e as Error).message}`);
  process.exitCode = 1;
}
