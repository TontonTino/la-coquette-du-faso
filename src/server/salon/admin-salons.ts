import type postgres from "postgres";
import { hashPassword, passwordProblem } from "../password.ts";
import { THEME_PAR_DEFAUT, lireSurchargeTheme, verifierTheme, type ThemeSalon } from "../../lib/salon/theme.ts";
import { lireTextesVitrine } from "../../lib/salon/vitrine.ts";
import { motDePasseAleatoire, numeroBurkina } from "./ouverture.ts";

// Gestion des salons par l'opérateur MIA (espace /admin). Tout reçoit la connexion `sql` : testable avec une vraie base.

export interface SalonResume {
  id: string;
  slug: string;
  nom: string;
  cree_le: string;
  aLogo: boolean;
  services: number;
  coiffeuses: number;
  demandes: number;
}

export async function listerSalons(sql: postgres.Sql): Promise<SalonResume[]> {
  const l = await sql<(Omit<SalonResume, "aLogo"> & { a_logo: boolean })[]>`
    SELECT s.id, s.slug, s.nom, s.cree_le::text AS cree_le, (s.logo IS NOT NULL) AS a_logo,
           (SELECT count(*)::int FROM categorie c WHERE c.salon_id = s.id) AS services,
           (SELECT count(*)::int FROM coiffeuse c WHERE c.salon_id = s.id) AS coiffeuses,
           (SELECT count(*)::int FROM prestation p WHERE p.salon_id = s.id) AS demandes
    FROM salon s WHERE s.slug IS NOT NULL ORDER BY s.cree_le DESC`;
  return l.map(({ a_logo, ...r }) => ({ ...r, aLogo: a_logo }));
}

export interface SalonDetail {
  id: string;
  slug: string;
  nom: string;
  telephone: string | null;
  whatsapp: string | null;
  email: string | null;
  adresse: string | null;
  horaires: string | null;
  carteUrl: string | null;
  theme: Partial<ThemeSalon>;
  textes: { titre?: string; etiquette?: string; accroche?: string };
  aLogo: boolean;
  logoV: string | null;
  services: { nom: string; famille: string }[];
  comptes: { role: string; identifiant: string; actif: boolean }[];
}

export async function salonAdmin(sql: postgres.Sql, id: string): Promise<SalonDetail | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [s] = await sql`
    SELECT id, slug, nom, telephone, whatsapp, email, adresse, horaires, carte_url, theme, vitrine, (logo IS NOT NULL) AS a_logo,
           (extract(epoch from logo_maj) * 1000)::bigint::text AS logo_v
    FROM salon WHERE id = ${id} AND slug IS NOT NULL`;
  if (!s) return null;
  const services = await sql<{ nom: string; famille: string }[]>`SELECT nom, famille FROM categorie WHERE salon_id = ${id} ORDER BY nom`;
  const comptes = await sql<{ role: string; identifiant: string; actif: boolean }[]>`
    SELECT role, identifiant, actif FROM utilisateur WHERE salon_id = ${id} ORDER BY role`;
  return {
    id: s.id,
    slug: s.slug,
    nom: s.nom,
    telephone: s.telephone,
    whatsapp: s.whatsapp,
    email: s.email,
    adresse: s.adresse,
    horaires: s.horaires,
    carteUrl: s.carte_url,
    theme: lireSurchargeTheme(s.theme),
    textes: lireTextesVitrine(s.vitrine),
    aLogo: s.a_logo,
    logoV: s.logo_v,
    services,
    comptes,
  };
}

export interface ModifSalon {
  nom: string;
  telephone?: string;
  whatsapp?: string;
  email?: string;
  adresse?: string;
  horaires?: string;
  carteUrl?: string;
  theme?: Partial<ThemeSalon>;
  textes?: { titre?: string; etiquette?: string; accroche?: string };
}

/** Modifie l'identité d'un salon (jamais son identifiant d'adresse ni ses données de travail). */
export async function modifierSalon(sql: postgres.Sql, id: string, m: ModifSalon): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const nom = m.nom.trim();
  if (nom.length < 2 || nom.length > 80) return { ok: false, erreur: "Le nom du salon doit faire entre 2 et 80 caractères." };
  const tel = m.telephone?.trim() ? numeroBurkina(m.telephone) : null;
  if (m.telephone?.trim() && !tel) return { ok: false, erreur: "Téléphone invalide : 8 chiffres, par exemple 70 12 34 56." };
  const wa = m.whatsapp?.trim() ? numeroBurkina(m.whatsapp) : null;
  if (m.whatsapp?.trim() && !wa) return { ok: false, erreur: "WhatsApp invalide : 8 chiffres, par exemple 70 12 34 56." };
  const carte = m.carteUrl?.trim() || null;
  if (carte && !/^https:\/\/\S+$/.test(carte)) return { ok: false, erreur: "Le lien de la carte doit commencer par https://" };
  if ((m.adresse?.length ?? 0) > 200) return { ok: false, erreur: "Adresse trop longue (200 caractères maximum)." };
  if ((m.horaires?.length ?? 0) > 120) return { ok: false, erreur: "Horaires trop longs (120 caractères maximum)." };
  if (m.email && !/^\S+@\S+\.\S+$/.test(m.email.trim())) return { ok: false, erreur: "Adresse e-mail invalide." };
  let theme: Partial<ThemeSalon> | null = null;
  if (m.theme && Object.keys(m.theme).length > 0) {
    theme = lireSurchargeTheme(m.theme);
    if (Object.keys(theme).length !== Object.keys(m.theme).length) return { ok: false, erreur: "Couleur invalide : utilisez le format #rrggbb." };
    const p = verifierTheme({ ...THEME_PAR_DEFAUT, ...theme });
    if (p.length > 0) return { ok: false, erreur: `Ces couleurs ne sont pas assez lisibles : ${p.join(" ; ")}` };
  }
  let textes: Record<string, string> | null = null;
  if (m.textes && Object.values(m.textes).some((v) => v?.trim())) {
    const donnees = Object.fromEntries(Object.entries(m.textes).filter(([, v]) => v?.trim()));
    const lus = lireTextesVitrine(donnees);
    if (Object.keys(lus).length !== Object.keys(donnees).length) return { ok: false, erreur: "Textes invalides : titre (80 caractères), étiquette (60), accroche (220)." };
    textes = lus as Record<string, string>;
  }
  const r = await sql`
    UPDATE salon SET nom = ${nom}, telephone = ${tel}, whatsapp = ${wa}, email = ${m.email?.trim() || null},
           adresse = ${m.adresse?.trim() || null}, horaires = ${m.horaires?.trim() || null}, carte_url = ${carte},
           theme = ${theme ? sql.json(theme as Record<string, string>) : null}, vitrine = ${textes ? sql.json(textes) : null}
    WHERE id = ${id} AND slug IS NOT NULL RETURNING id`;
  return r.length ? { ok: true } : { ok: false, erreur: "Salon introuvable." };
}

export async function definirLogo(sql: postgres.Sql, id: string, logo: { octets: Uint8Array; type: string } | null): Promise<boolean> {
  const r = await sql`
    UPDATE salon SET logo = ${logo ? Buffer.from(logo.octets) : null}, logo_type = ${logo?.type ?? null}, logo_maj = ${logo ? new Date() : null}
    WHERE id = ${id} AND slug IS NOT NULL RETURNING id`;
  return r.length > 0;
}

export async function logoDuSalon(sql: postgres.Sql, slug: string): Promise<{ octets: Buffer; type: string } | null> {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const [s] = await sql<{ logo: Buffer | null; logo_type: string | null }[]>`SELECT logo, logo_type FROM salon WHERE slug = ${slug}`;
  return s?.logo && s.logo_type ? { octets: s.logo, type: s.logo_type } : null;
}

/** Nouveau mot de passe tiré au hasard pour un compte du salon ; toutes ses sessions sont fermées. Affiché une seule fois. */
export async function reinitialiserMotDePasse(sql: postgres.Sql, salonId: string, role: "gerante" | "secretaire"): Promise<{ identifiant: string; motDePasse: string } | null> {
  const mdp = motDePasseAleatoire();
  if (passwordProblem(mdp)) throw new Error("Mot de passe généré invalide.");
  const hash = await hashPassword(mdp);
  return sql.begin(async (tx) => {
    const [u] = await tx`UPDATE utilisateur SET mot_de_passe_hash = ${hash} WHERE salon_id = ${salonId} AND role = ${role} RETURNING id, identifiant`;
    if (!u) return null;
    await tx`DELETE FROM session WHERE utilisateur_id = ${u.id}`;
    return { identifiant: u.identifiant as string, motDePasse: mdp };
  });
}
