// Ouverture d'un nouveau salon : le salon, ses comptes et (si on les donne) ses services. RIEN d'autre :
// aucune coiffeuse, aucun modèle, aucune vidéo, aucune donnée fictive. Le salon commence vide et propre.
//
// Ce fichier n'importe que du code sans alias « @/ » : il sert au script `npm run salon:creer` et aux tests.
import { randomInt } from "node:crypto";
import type postgres from "postgres";
import { hashPassword, passwordProblem } from "../../src/server/password.ts";
import { THEME_PAR_DEFAUT, lireSurchargeTheme, verifierTheme, type ThemeSalon } from "../../src/lib/salon/theme.ts";
import { lireTextesVitrine } from "../../src/lib/salon/vitrine.ts";

export type Famille = "coiffure" | "ongles";

export interface DemandeOuverture {
  nom: string;
  /** Identifiant dans l'adresse (/s/<slug>) ; déduit du nom si absent. */
  slug?: string;
  telephone?: string;
  whatsapp?: string;
  email?: string;
  adresse?: string;
  horaires?: string;
  carteUrl?: string;
  services?: { nom: string; famille: Famille }[];
  theme?: Partial<ThemeSalon>;
  textes?: { titre?: string; etiquette?: string; accroche?: string };
  /** Mots de passe imposés (tests) ; sinon générés au hasard. */
  motsDePasse?: { gerante?: string; secretaire?: string };
}

export interface SalonOuvert {
  salonId: string;
  slug: string;
  comptes: { role: "gerante" | "secretaire"; identifiant: string; motDePasse: string }[];
  services: number;
}

const SANS_AMBIGUITE = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const motDePasseAleatoire = (longueur = 14) => Array.from({ length: longueur }, () => SANS_AMBIGUITE[randomInt(SANS_AMBIGUITE.length)]).join("");

export function slugDepuisNom(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Numéro burkinabè → « +226 70 12 34 56 » ; null si invalide. */
export function numeroBurkina(brut: string): string | null {
  let d = brut.replace(/[\s.\-()]/g, "");
  if (d.startsWith("+226")) d = d.slice(4);
  else if (d.startsWith("00226")) d = d.slice(5);
  return /^\d{8}$/.test(d) ? `+226 ${d.replace(/(\d{2})(?=\d)/g, "$1 ")}` : null;
}

/** « Tresses, Tissage, Manucure:ongles » → liste de services (famille « coiffure » par défaut). */
export function lireServices(texte: string): { nom: string; famille: Famille }[] {
  return texte
    .split(/[,;\n]/)
    .map((m) => m.trim())
    .filter(Boolean)
    .map((m) => {
      const [nom, famille] = m.split(":").map((x) => x.trim());
      if (famille && famille !== "coiffure" && famille !== "ongles") throw new Error(`Famille inconnue pour « ${nom} » : ${famille} (coiffure ou ongles).`);
      return { nom, famille: (famille as Famille | undefined) ?? "coiffure" };
    });
}

function verifier(d: DemandeOuverture): { slug: string; tel: string | null; wa: string | null; theme: Partial<ThemeSalon> | null; textes: Record<string, string> | null } {
  const nom = d.nom.trim();
  if (nom.length < 2 || nom.length > 80) throw new Error("Le nom du salon doit faire entre 2 et 80 caractères.");
  const slug = d.slug?.trim() || slugDepuisNom(nom);
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) throw new Error(`Identifiant « ${slug} » invalide : 3 à 60 lettres minuscules, chiffres ou tirets.`);
  const tel = d.telephone ? numeroBurkina(d.telephone) : null;
  if (d.telephone && !tel) throw new Error("Téléphone invalide : 8 chiffres, par exemple 70 12 34 56.");
  const wa = d.whatsapp ? numeroBurkina(d.whatsapp) : null;
  if (d.whatsapp && !wa) throw new Error("WhatsApp invalide : 8 chiffres, par exemple 70 12 34 56.");
  if (d.carteUrl && !/^https:\/\/\S+$/.test(d.carteUrl)) throw new Error("Le lien de la carte doit commencer par https://");
  if (d.adresse && d.adresse.length > 200) throw new Error("Adresse trop longue (200 caractères maximum).");
  if (d.horaires && d.horaires.length > 120) throw new Error("Horaires trop longs (120 caractères maximum).");
  let theme: Partial<ThemeSalon> | null = null;
  if (d.theme && Object.keys(d.theme).length > 0) {
    theme = lireSurchargeTheme(d.theme);
    if (Object.keys(theme).length !== Object.keys(d.theme).length) throw new Error("Couleur invalide : utilisez le format #rrggbb.");
    const problemes = verifierTheme({ ...THEME_PAR_DEFAUT, ...theme });
    if (problemes.length > 0) throw new Error(`Ces couleurs ne sont pas assez lisibles :\n- ${problemes.join("\n- ")}`);
  }
  const textes = d.textes && Object.keys(d.textes).length > 0 ? lireTextesVitrine(d.textes) : null;
  if (d.textes && Object.keys(d.textes).length > 0 && Object.keys(textes ?? {}).length !== Object.keys(d.textes).length) {
    throw new Error("Textes invalides : titre (80 caractères), étiquette (60), accroche (220).");
  }
  return { slug, tel, wa, theme, textes };
}

export async function ouvrirSalon(sql: postgres.Sql, d: DemandeOuverture): Promise<SalonOuvert> {
  const { slug, tel, wa, theme, textes } = verifier(d);
  const court = slug.slice(0, 29).replace(/-+$/g, "");
  const ids = { gerante: `gerante.${court}`, secretaire: `secretaire.${court}` };
  const mdp = { gerante: d.motsDePasse?.gerante ?? motDePasseAleatoire(), secretaire: d.motsDePasse?.secretaire ?? motDePasseAleatoire() };
  for (const [role, m] of Object.entries(mdp)) {
    const p = passwordProblem(m);
    if (p) throw new Error(`Mot de passe ${role} : ${p}`);
  }
  const services = (d.services ?? []).map((s) => ({ ...s, nom: s.nom.trim() }));
  for (const s of services) if (s.nom.length < 2 || s.nom.length > 60) throw new Error(`Nom de service invalide : « ${s.nom} ».`);
  if (new Set(services.map((s) => s.nom.toLowerCase())).size !== services.length) throw new Error("Un service est écrit deux fois.");

  const hashes = { gerante: await hashPassword(mdp.gerante), secretaire: await hashPassword(mdp.secretaire) };
  return sql.begin(async (tx) => {
    const [existe] = await tx`SELECT 1 FROM salon WHERE slug = ${slug}`;
    if (existe) throw new Error(`Un salon avec l'identifiant « ${slug} » existe déjà.`);
    const [pris] = await tx`SELECT 1 FROM utilisateur WHERE identifiant IN (${ids.gerante}, ${ids.secretaire})`;
    if (pris) throw new Error("Les identifiants de connexion de ce salon existent déjà : choisissez un autre identifiant de salon.");
    const [salon] = await tx`
      INSERT INTO salon (nom, slug, telephone, whatsapp, email, adresse, horaires, carte_url, theme, vitrine)
      VALUES (${d.nom.trim()}, ${slug}, ${tel}, ${wa}, ${d.email?.trim() || null}, ${d.adresse?.trim() || null}, ${d.horaires?.trim() || null},
              ${d.carteUrl?.trim() || null}, ${theme ? tx.json(theme as Record<string, string>) : null}, ${textes ? tx.json(textes) : null})
      RETURNING id`;
    await tx`INSERT INTO utilisateur (salon_id, identifiant, nom, role, mot_de_passe_hash) VALUES
      (${salon.id}, ${ids.gerante}, 'Gérante', 'gerante', ${hashes.gerante}),
      (${salon.id}, ${ids.secretaire}, 'Secrétaire', 'secretaire', ${hashes.secretaire})`;
    for (const s of services) await tx`INSERT INTO categorie (salon_id, nom, famille) VALUES (${salon.id}, ${s.nom}, ${s.famille})`;
    return {
      salonId: salon.id as string,
      slug,
      comptes: [
        { role: "gerante" as const, identifiant: ids.gerante, motDePasse: mdp.gerante },
        { role: "secretaire" as const, identifiant: ids.secretaire, motDePasse: mdp.secretaire },
      ],
      services: services.length,
    };
  });
}
