/**
 * Parcours de bout en bout : un SECOND salon, créé par `npm run salon:creer`, est propre et isolé.
 * Vérifie : page publique à /s/<identifiant> sans aucune trace de La Coquette du Faso (nom, logo, photos),
 * liens qui restent dans le salon, demande d'une cliente, connexion du personnel du nouveau salon,
 * salon inconnu = page introuvable, la racine = page MIA, et La Coquette du Faso inchangé sous /s/la-coquette-du-faso.
 * Prérequis : base de démo (La Coquette du Faso), application sur :3200, DATABASE_URL = la même base.
 * Usage : DATABASE_URL=... BASE_URL=http://localhost:3200 npm run test:e2e:multi
 */
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const SHOTS = process.env.SHOTS ?? "e2e/captures/multi";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant : la même base que l'application.");
await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: process.env.BROWSER ?? "msedge" },
);
const erreurs = [];
let ok = 0;
let ko = 0;
async function verifier(nom, fn) {
  try {
    await fn();
    ok++;
    console.log(`✔ ${nom}`);
  } catch (e) {
    ko++;
    console.log(`✘ ${nom}\n   ${e.message.split("\n")[0]}`);
  }
}
async function nouvellePage(largeur = 390) {
  const ctx = await browser.newContext({ viewport: { width: largeur, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" });
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && erreurs.push(m.text()));
  p.on("pageerror", (e) => erreurs.push(e.message));
  p.on("response", (r) => r.status() >= 400 && erreurs.push(`HTTP ${r.status()} ${r.url()}`));
  return p;
}
const visible = (p) => p.locator("main:visible").innerText();
const debordement = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// Création du salon par le vrai script.
const SUFFIXE = Date.now().toString(36).slice(-5);
const SLUG = `atelier-soleil-${SUFFIXE}`;
const NOM_SALON = `Atelier Soleil ${SUFFIXE}`;
const sortie = execFileSync(
  "node",
  ["--no-warnings", "scripts/salon-creer.mts", "--nom", NOM_SALON, "--slug", SLUG, "--whatsapp", "70 11 22 33", "--adresse", "Rue de test, Ouagadougou", "--horaires", "Lun-Sam, 8 h - 19 h", "--services", "Tresses, Tissage, Manucure:ongles"],
  { env: process.env, encoding: "utf8" },
);
const compte = (role) => {
  const m = sortie.match(new RegExp(`${role}\\s+identifiant : (\\S+)\\s+mot de passe : (\\S+)`));
  if (!m) throw new Error(`compte ${role} introuvable dans la sortie du script`);
  return { identifiant: m[1], mdp: m[2] };
};
const GERANTE = compte("gerante");
const SECRETAIRE = compte("secretaire");

const p = await nouvellePage();
let reference = "";

await verifier("Le script crée un salon vide : aucune coiffeuse, aucun modèle, aucune vidéo", async () => {
  if (!/Services créés\s+: 3/.test(sortie)) throw new Error("les 3 services demandés ne sont pas annoncés");
  if (!/aucune coiffeuse, aucun modèle, aucune vidéo/.test(sortie)) throw new Error("le script n'annonce pas un salon vide");
});

await verifier("La page du salon porte son nom, ses services, et aucune trace de La Coquette du Faso", async () => {
  await p.goto(`${BASE}/s/${SLUG}`);
  await p.getByRole("heading", { name: "Choisissez votre service" }).waitFor();
  const html = await p.content();
  if (/coquette/i.test(html)) throw new Error("« Coquette » apparaît dans la page du nouveau salon");
  if (/\/salons\/la-coquette-du-faso|\/brand\/logo/.test(html)) throw new Error("une image de La Coquette du Faso est utilisée");
  const t = await p.locator("body").innerText();
  if (!t.includes(NOM_SALON)) throw new Error("le nom du salon n'apparaît pas");
  for (const type of ["Tresses", "Tissage", "Manucure"]) if (!t.includes(type)) throw new Error(`service « ${type} » absent`);
  if (!t.includes("Rue de test, Ouagadougou") || !t.includes("Lun-Sam, 8 h - 19 h")) throw new Error("adresse ou horaires absents");
  if (!(await p.title()).includes(NOM_SALON)) throw new Error(`titre d'onglet : « ${await p.title()} »`);
  if (await debordement(p)) throw new Error("débordement horizontal");
  await p.screenshot({ path: `${SHOTS}/01-accueil-nouveau-salon.png`, fullPage: true });
});

await verifier("Salon vide : aucune section d'équipe, de réalisations ni de vidéos, pas d'invention", async () => {
  const t = await p.locator("body").innerText();
  for (const interdit of ["Notre équipe", "Nos réalisations", "Deux équipes se relaient", "Vidéos"]) if (t.includes(interdit)) throw new Error(`« ${interdit} » ne devrait pas apparaître`);
  if ((await p.locator("img").count()) > 0) {
    const srcs = await p.locator("img").evaluateAll((els) => els.map((e) => e.getAttribute("src")));
    throw new Error(`images inattendues : ${srcs.slice(0, 3).join(", ")}`);
  }
});

await verifier("Tous les liens de la page restent dans ce salon", async () => {
  const liens = await p.locator("a[href^='/']").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const mauvais = liens.filter((h) => !(h === `/s/${SLUG}` || h.startsWith(`/s/${SLUG}/`) || h === "/connexion"));
  if (mauvais.length) throw new Error(`liens qui sortent du salon : ${[...new Set(mauvais)].join(", ")}`);
  if (!liens.includes(`/s/${SLUG}/reserver`)) throw new Error("pas de lien de réservation");
});

await verifier("Une cliente demande un rendez-vous dans le nouveau salon", async () => {
  await p.goto(`${BASE}/s/${SLUG}/reserver`);
  await p.getByRole("button", { name: "Envoyer ma demande" }).waitFor();
  await p.getByRole("button", { name: "Tresses", exact: true }).click();
  await p.getByRole("button", { name: "Demain", exact: true }).click();
  await p.getByRole("button", { name: /^Matin/ }).click();
  await p.getByLabel(/^Votre nom/).fill("Cliente Soleil");
  await p.getByLabel("Votre numéro WhatsApp").fill("70 55 66 77");
  await p.screenshot({ path: `${SHOTS}/02-reserver-nouveau-salon.png`, fullPage: true });
  await p.getByRole("button", { name: "Envoyer ma demande" }).click();
  await p.waitForURL(/\/demande\/[A-Z2-9]{8}$/);
  reference = p.url().split("/").pop();
  await p.getByRole("heading", { name: "Demande envoyée" }).waitFor();
});

await verifier("Le suivi de la cliente porte le nom et les liens du nouveau salon", async () => {
  const html = await p.content();
  if (/coquette/i.test(html)) throw new Error("« Coquette » apparaît dans le suivi");
  if (!(await p.locator("body").innerText()).includes(NOM_SALON)) throw new Error("nom du salon absent du suivi");
  await p.screenshot({ path: `${SHOTS}/03-suivi-nouveau-salon.png`, fullPage: true });
});

await verifier("Le personnel du nouveau salon se connecte et ne voit que sa demande", async () => {
  const s = await nouvellePage();
  await s.goto(`${BASE}/connexion`);
  await s.getByLabel("Identifiant").fill(SECRETAIRE.identifiant);
  await s.getByLabel("Mot de passe").fill(SECRETAIRE.mdp);
  await s.getByRole("button", { name: "Se connecter" }).click();
  await s.waitForURL(`${BASE}/salon`);
  await s.getByRole("button", { name: "+ Rendez-vous" }).waitFor();
  const entete = await s.locator("header").first().innerText();
  if (!entete.includes(NOM_SALON)) throw new Error(`en-tête du personnel : « ${entete.replace(/\n/g, " ")} »`);
  if (/coquette/i.test(await s.content())) throw new Error("« Coquette » apparaît chez le personnel du nouveau salon");
  const t = await visible(s);
  if (!t.includes("Cliente Soleil")) throw new Error("la demande de la cliente n'apparaît pas");
  if ((t.match(/En ligne/g) ?? []).length !== 1) throw new Error("une autre demande que la sienne est visible");
  await s.screenshot({ path: `${SHOTS}/04-secretaire-nouveau-salon.png`, fullPage: true });
  await s.context().close();
});

await verifier("La gérante du nouveau salon voit une équipe vide, pas celle de La Coquette", async () => {
  const g = await nouvellePage();
  await g.goto(`${BASE}/connexion`);
  await g.getByLabel("Identifiant").fill(GERANTE.identifiant);
  await g.getByLabel("Mot de passe").fill(GERANTE.mdp);
  await g.getByRole("button", { name: "Se connecter" }).click();
  await g.waitForURL(`${BASE}/salon`);
  await g.goto(`${BASE}/salon/equipe`);
  await g.waitForLoadState("networkidle");
  const t = await g.locator("main:visible").innerText();
  if (/Awa K\.|Fatim O\.|Mariam S\./.test(t)) throw new Error("des coiffeuses de la démo apparaissent");
  await g.screenshot({ path: `${SHOTS}/05-equipe-vide.png`, fullPage: true });
  await g.context().close();
});

await verifier("Un salon inconnu donne « Page introuvable »", async () => {
  // Page à part : le navigateur note le statut 404 comme une « erreur de console », attendue ici.
  const q = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await q.goto(`${BASE}/s/salon-qui-nexiste-pas`);
  await q.getByText("Page introuvable").waitFor();
  await q.goto(`${BASE}/s/Pas Valide`);
  await q.getByText("Page introuvable").waitFor();
  await q.context().close();
});

await verifier("La racine du site est la page MIA, sans trace d'un salon", async () => {
  await p.goto(`${BASE}/`);
  await p.getByRole("heading", { name: /Les rendez-vous de votre salon/ }).waitFor();
  const t = await p.locator("body").innerText();
  if (/Coquette/i.test(t) || (NOM_SALON && t.includes(NOM_SALON))) throw new Error("un salon apparaît sur la page MIA");
});

await verifier("La Coquette du Faso est inchangé sous /s/la-coquette-du-faso (nom, logo)", async () => {
  await p.goto(`${BASE}/s/la-coquette-du-faso`);
  await p.getByRole("heading", { name: "Choisissez votre service" }).waitFor();
  const t = await p.locator("body").innerText();
  if (!t.includes("La Coquette du Faso")) throw new Error("nom absent");
  if (NOM_SALON && t.includes(NOM_SALON)) throw new Error("le nouveau salon apparaît chez La Coquette");
  if ((await p.locator("img[src*='logo']").count()) === 0) throw new Error("logo absent");
});

await verifier("les anciennes adresses /reserver et /videos mènent à La Coquette, requête conservée", async () => {
  await p.goto(`${BASE}/reserver?modele=abc`);
  await p.waitForURL(`${BASE}/s/la-coquette-du-faso/reserver?modele=abc`);
  await p.goto(`${BASE}/videos`);
  await p.waitForURL(`${BASE}/s/la-coquette-du-faso/videos`);
});

await verifier("Aucune erreur dans la console", async () => {
  if (erreurs.length) throw new Error(erreurs.slice(0, 3).join(" | "));
});

console.log(`${ok}/${ok + ko} vérifications réussies (salon ${SLUG}, référence ${reference})`);
await browser.close();
process.exit(ko ? 1 : 0);
