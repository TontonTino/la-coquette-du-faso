"use server";

import { redirect } from "next/navigation";
import { exigerAdminAction, NonAutoriseAdmin, seConnecterAdmin, seDeconnecterAdmin } from "@/server/admin";
import { db } from "@/server/db";
import { definirLogo, modifierSalon, reinitialiserMotDePasse } from "@/server/salon/admin-salons";
import { lireLogo } from "@/server/salon/logo";
import { lireServices, ouvrirSalon, type SalonOuvert } from "@/server/salon/ouverture";
import { themeDepuisCouleurs } from "@/lib/salon/theme";

/** Actions de l'espace MIA. Chacune revérifie la session de l'opérateur : l'écran n'est jamais une preuve. */

const texte = (v: FormDataEntryValue | null, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export interface EtatConnexionAdmin {
  erreur: string;
}

export async function connexionAdminAction(_prev: EtatConnexionAdmin | null, form: FormData): Promise<EtatConnexionAdmin | null> {
  const r = await seConnecterAdmin(texte(form.get("identifiant"), 60), texte(form.get("motDePasse"), 200));
  if (!r.ok) {
    if (r.raison === "eteint") return { erreur: "L'espace MIA n'est pas activé sur ce serveur (variables MIA_ADMIN_* absentes ou trop courtes)." };
    if (r.raison === "bloque") return { erreur: "Trop d'essais. Réessayez dans un quart d'heure." };
    return { erreur: "Identifiant ou mot de passe incorrect." };
  }
  redirect("/admin");
}

export async function deconnexionAdminAction() {
  await seDeconnecterAdmin();
  redirect("/admin/connexion");
}

/** Champs communs du formulaire salon → couleurs et textes. */
function lireIdentite(form: FormData) {
  const couleursParDefaut = form.get("couleursDefaut") === "on";
  const theme = couleursParDefaut
    ? {}
    : themeDepuisCouleurs({ marque: texte(form.get("marque"), 7), action: texte(form.get("action"), 7), detail: texte(form.get("detail"), 7) });
  const textes = { titre: texte(form.get("titre"), 200), etiquette: texte(form.get("etiquette"), 200), accroche: texte(form.get("accroche"), 400) };
  return { theme, textes: Object.fromEntries(Object.entries(textes).filter(([, v]) => v)) as { titre?: string; etiquette?: string; accroche?: string } };
}

export interface EtatCreation {
  erreur?: string;
  cree?: SalonOuvert & { nom: string };
}

export async function creerSalonAction(_prev: EtatCreation | null, form: FormData): Promise<EtatCreation | null> {
  try {
    await exigerAdminAction();
    let services: { nom: string; famille: "coiffure" | "ongles" }[] = [];
    try {
      services = lireServices(texte(form.get("services"), 1000));
    } catch (e) {
      return { erreur: (e as Error).message };
    }
    const fichier = texte(form.get("logo"), 500_000);
    const logo = fichier ? lireLogo(fichier) : null;
    if (logo && "erreur" in logo) return { erreur: logo.erreur };
    const { theme, textes } = lireIdentite(form);
    const nom = texte(form.get("nom"), 80);
    const r = await ouvrirSalon(db(), {
      nom,
      slug: texte(form.get("slug"), 60) || undefined,
      telephone: texte(form.get("telephone"), 30) || undefined,
      whatsapp: texte(form.get("whatsapp"), 30) || undefined,
      email: texte(form.get("email"), 120) || undefined,
      adresse: texte(form.get("adresse"), 200) || undefined,
      horaires: texte(form.get("horaires"), 120) || undefined,
      carteUrl: texte(form.get("carteUrl"), 300) || undefined,
      services,
      theme,
      textes,
      logo: logo ?? undefined,
    });
    return { cree: { ...r, nom } };
  } catch (e) {
    if (e instanceof NonAutoriseAdmin) return { erreur: e.message };
    // Les messages de ouvrirSalon sont écrits pour l'opérateur (doublon, couleur illisible…) ; le reste reste générique.
    const message = (e as Error).message;
    if (/^(Le nom|Identifiant|Téléphone|WhatsApp|Le lien|Adresse|Horaires|Couleur|Ces couleurs|Textes|Nom de service|Un service|Un salon|Les identifiants|Mot de passe)/.test(message)) return { erreur: message };
    console.error("[admin] création de salon en échec", e);
    return { erreur: "Une erreur est survenue. Réessayez." };
  }
}

export interface EtatModification {
  erreur?: string;
  ok?: string;
}

export async function modifierSalonAction(_prev: EtatModification | null, form: FormData): Promise<EtatModification | null> {
  try {
    await exigerAdminAction();
    const id = texte(form.get("id"), 40);
    const { theme, textes } = lireIdentite(form);
    const r = await modifierSalon(db(), id, {
      nom: texte(form.get("nom"), 80),
      telephone: texte(form.get("telephone"), 30),
      whatsapp: texte(form.get("whatsapp"), 30),
      email: texte(form.get("email"), 120),
      adresse: texte(form.get("adresse"), 200),
      horaires: texte(form.get("horaires"), 120),
      carteUrl: texte(form.get("carteUrl"), 300),
      theme,
      textes,
    });
    if (!r.ok) return { erreur: r.erreur };
    const fichier = texte(form.get("logo"), 500_000);
    if (fichier) {
      const logo = lireLogo(fichier);
      if ("erreur" in logo) return { erreur: logo.erreur };
      await definirLogo(db(), id, logo);
    } else if (form.get("logoRetire") === "1") {
      await definirLogo(db(), id, null);
    }
    return { ok: "Enregistré. Les pages des clientes se mettent à jour en moins d'une minute." };
  } catch (e) {
    if (e instanceof NonAutoriseAdmin) return { erreur: e.message };
    console.error("[admin] modification en échec", e);
    return { erreur: "Une erreur est survenue. Réessayez." };
  }
}

export interface EtatMotDePasse {
  erreur?: string;
  compte?: { identifiant: string; motDePasse: string };
}

export async function reinitialiserMotDePasseAction(_prev: EtatMotDePasse | null, form: FormData): Promise<EtatMotDePasse | null> {
  try {
    await exigerAdminAction();
    const role = texte(form.get("role"), 12);
    if (role !== "gerante" && role !== "secretaire") return { erreur: "Compte inconnu." };
    const c = await reinitialiserMotDePasse(db(), texte(form.get("id"), 40), role);
    return c ? { compte: c } : { erreur: "Compte introuvable." };
  } catch (e) {
    if (e instanceof NonAutoriseAdmin) return { erreur: e.message };
    console.error("[admin] réinitialisation en échec", e);
    return { erreur: "Une erreur est survenue. Réessayez." };
  }
}
