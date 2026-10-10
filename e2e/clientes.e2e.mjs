/**
 * Parcours de bout en bout phase B : une cliente demande un rendez-vous en ligne, la secrétaire
 * confirme (ou refuse), la cliente voit la réponse. Format téléphone (390 px).
 *
 * Prérequis : base initialisée avec `npm run db:seed -- --demo`, application lancée (`npm start -- -p 3200`).
 * Usage : BASE_URL=http://localhost:3200 MDP_SECRETAIRE=... MDP_GERANTE=... npm run test:e2e:clientes
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const SHOTS = process.env.SHOTS ?? "e2e/captures/clientes";
const { MDP_SECRETAIRE, MDP_GERANTE } = process.env;
if (!MDP_SECRETAIRE || !MDP_GERANTE) {
  console.error("MDP_SECRETAIRE et MDP_GERANTE sont requis.");
  process.exit(1);
}

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: process.env.BROWSER ?? "msedge" },
);
const nouveauTelephone = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" });
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && erreurs.push(m.text()));
  p.on("pageerror", (e) => erreurs.push(e.message));
  return p;
};
const erreurs = [];
const cliente = await nouveauTelephone();
const secretaire = await nouveauTelephone();

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
    await cliente.screenshot({ path: `${SHOTS}/echec-${ok + ko}-cliente.png`, fullPage: true }).catch(() => {});
    await secretaire.screenshot({ path: `${SHOTS}/echec-${ok + ko}-secretaire.png`, fullPage: true }).catch(() => {});
  }
}
const visible = (p) => p.locator("main:visible").innerText();
async function largeurOk(p, nom) {
  const [sw, cw] = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  if (sw > cw) throw new Error(`${nom} : défilement horizontal (${sw}px > ${cw}px)`);
}
const capture = (p, nom) => p.screenshot({ path: `${SHOTS}/${nom}.png`, fullPage: true });
const SUFFIXE = Date.now().toString(36).slice(-4);
const NOM = `Aminata ${SUFFIXE}`;
const NOM2 = `Rokia ${SUFFIXE}`;
// Numéro différent à chaque lancement (limite de 3 demandes en attente par numéro).
const TEL = `7${String(Date.now()).slice(-7)}`;
let reference = "";
let coiffeuseSouhaitee = "";

await verifier("Accueil public : présentation et types de coiffure", async () => {
  await cliente.goto(`${BASE}/`);
  await cliente.getByRole("link", { name: "Demander un rendez-vous" }).first().waitFor();
  await cliente.getByRole("heading", { name: "Nos coiffures" }).waitFor();
  await largeurOk(cliente, "accueil");
  await capture(cliente, "01-accueil");
});

await verifier("Formulaire : le nom et le numéro sont obligatoires", async () => {
  await cliente.getByRole("link", { name: "Demander un rendez-vous" }).first().click();
  await cliente.waitForURL(`${BASE}/reserver`);
  await cliente.getByRole("button", { name: "Envoyer ma demande" }).click();
  await cliente.getByText("Indiquez votre nom.").waitFor();
  await cliente.getByText(/numéro WhatsApp \(8 chiffres\)/).waitFor();
});

await verifier("La cliente envoie sa demande (FR-B01, FR-B02)", async () => {
  await cliente.getByRole("button", { name: "Tresses", exact: true }).click();
  await cliente.getByRole("button", { name: "Demain", exact: true }).click();
  await cliente.getByRole("button", { name: /^Matin/ }).click();
  const groupe = cliente.getByRole("group", { name: "Coiffeuse souhaitée" });
  const premiere = groupe.getByRole("button").nth(1);
  coiffeuseSouhaitee = (await premiere.innerText()).trim();
  await premiere.click();
  await cliente.getByLabel(/^Votre nom/).fill(NOM);
  await cliente.getByLabel("Votre numéro WhatsApp").fill(TEL);
  await cliente.getByLabel("Précisions (facultatif)").fill("Longues, couleur naturelle");
  await largeurOk(cliente, "formulaire");
  await capture(cliente, "02-formulaire");
  await cliente.getByRole("button", { name: "Envoyer ma demande" }).click();
  await cliente.waitForURL(/\/demande\/[A-Z2-9]{8}$/);
  reference = cliente.url().split("/").pop();
  await cliente.getByRole("heading", { name: "Demande envoyée" }).waitFor();
});

await verifier("La page de suivi n'affiche pas le numéro de téléphone (SEC-B02)", async () => {
  const t = await visible(cliente);
  if (t.includes(TEL.slice(-4))) throw new Error("numéro visible");
  if (!t.includes(reference)) throw new Error("référence absente");
  await largeurOk(cliente, "suivi");
  await capture(cliente, "03-suivi-attente");
});

await verifier("La secrétaire voit la demande (FR-B04)", async () => {
  await secretaire.goto(`${BASE}/connexion`);
  await secretaire.getByLabel("Identifiant").fill("secretaire");
  await secretaire.getByLabel("Mot de passe").fill(MDP_SECRETAIRE);
  await secretaire.getByRole("button", { name: "Se connecter" }).click();
  await secretaire.waitForURL(`${BASE}/salon`);
  await secretaire.getByRole("heading", { name: /Demandes en ligne/ }).waitFor();
  await secretaire.getByText(NOM, { exact: true }).waitFor();
  await capture(secretaire, "04-salon-demandes");
});

await verifier("Confirmation avec la coiffeuse souhaitée et message WhatsApp prêt (FR-B05)", async () => {
  const carte = secretaire.locator("div.rounded-xl", { hasText: NOM }).filter({ has: secretaire.getByRole("button", { name: "Confirmer" }) });
  await carte.getByRole("button", { name: "Confirmer" }).click();
  await secretaire.getByRole("heading", { name: "Confirmer la demande" }).waitFor();
  await secretaire.getByLabel("Heure exacte").selectOption("10:00");
  await secretaire.waitForTimeout(800);
  const choisie = secretaire.getByRole("button", { name: coiffeuseSouhaitee, exact: true });
  if ((await choisie.getAttribute("aria-pressed")) !== "true") throw new Error(`${coiffeuseSouhaitee} n'est pas présélectionnée`);
  await largeurOk(secretaire, "confirmer");
  await capture(secretaire, "05-confirmer");
  await secretaire.getByRole("button", { name: "Confirmer le rendez-vous" }).click();
  const lien = secretaire.getByRole("link", { name: "Envoyer sur WhatsApp" });
  await lien.waitFor();
  const href = await lien.getAttribute("href");
  if (!href.startsWith(`https://wa.me/226${TEL}`)) throw new Error(`lien inattendu : ${href.slice(0, 40)}`);
  if (!decodeURIComponent(href).includes(`/demande/${reference}`)) throw new Error("le lien de suivi manque dans le message");
  await capture(secretaire, "06-prevenir");
});

await verifier("La cliente voit son rendez-vous confirmé (FR-B03)", async () => {
  await cliente.reload();
  await cliente.getByRole("heading", { name: "Rendez-vous confirmé" }).waitFor();
  const t = await visible(cliente);
  if (!t.includes("10 h 00")) throw new Error("heure absente");
  if (!t.includes(coiffeuseSouhaitee)) throw new Error("coiffeuse absente");
  await capture(cliente, "07-suivi-confirme");
});

await verifier("Le rendez-vous apparaît chez la secrétaire et n'est plus une demande", async () => {
  await secretaire.getByRole("button", { name: "Retour au salon" }).click();
  await secretaire.getByRole("button", { name: "+ Rendez-vous" }).waitFor();
  const t = await visible(secretaire);
  if (t.includes("Demandes en ligne à traiter") && t.includes(NOM)) throw new Error("toujours dans les demandes");
});

let reference2 = "";
await verifier("Refus avec motif, visible par la cliente (FR-B06)", async () => {
  await cliente.goto(`${BASE}/reserver`);
  await cliente.getByLabel(/^Votre nom/).fill(NOM2);
  await cliente.getByLabel("Votre numéro WhatsApp").fill(TEL);
  await cliente.getByRole("button", { name: "Envoyer ma demande" }).click();
  await cliente.waitForURL(/\/demande\/[A-Z2-9]{8}$/);
  reference2 = cliente.url().split("/").pop();
  await secretaire.reload();
  const carte = secretaire.locator("div.rounded-xl", { hasText: NOM2 }).filter({ has: secretaire.getByRole("button", { name: "Refuser" }) });
  await carte.getByRole("button", { name: "Refuser" }).click();
  await secretaire.getByRole("button", { name: "Complet ce jour-là" }).click();
  await secretaire.getByRole("button", { name: "Refuser la demande" }).click();
  await secretaire.getByRole("link", { name: "Envoyer sur WhatsApp" }).waitFor();
  await cliente.reload();
  await cliente.getByRole("heading", { name: "Demande non acceptée" }).waitFor();
  await cliente.getByText("Motif : Complet ce jour-là.").waitFor();
  await cliente.getByRole("link", { name: "Faire une nouvelle demande" }).waitFor();
});

await verifier("La gérante renseigne le WhatsApp du salon ; l'accueil le propose", async () => {
  await secretaire.goto(`${BASE}/salon`);
  await secretaire.getByRole("button", { name: "Se déconnecter" }).click();
  await secretaire.waitForURL(`${BASE}/connexion`);
  await secretaire.getByLabel("Identifiant").fill("gerante");
  await secretaire.getByLabel("Mot de passe").fill(MDP_GERANTE);
  await secretaire.getByRole("button", { name: "Se connecter" }).click();
  await secretaire.waitForURL(`${BASE}/salon`);
  await secretaire.goto(`${BASE}/salon/equipe`);
  await secretaire.getByLabel("Numéro WhatsApp du salon").fill("56 46 58 88");
  await secretaire.getByRole("button", { name: "Enregistrer" }).first().click();
  await secretaire.getByText("Numéro WhatsApp du salon enregistré").waitFor();
  await cliente.goto(`${BASE}/`);
  await cliente.getByRole("link", { name: "Écrire au salon" }).waitFor();
});

// Le suivi est rendu en streaming : le statut HTTP part avant la recherche (200), mais la page
// « introuvable » est bien affichée et marquée noindex. On vérifie donc ce que voit la cliente.
const PHOTO = process.env.PHOTO_MODELE;
if (PHOTO) {
  await verifier("La gérante ajoute un modèle photo (FR-C02)", async () => {
    await secretaire.goto(`${BASE}/salon/modeles`);
    await secretaire.getByRole("button", { name: "+ Ajouter un modèle" }).click();
    await secretaire.locator('input[type="file"]').setInputFiles(PHOTO);
    await secretaire.getByAltText("Aperçu du modèle").waitFor();
    await secretaire.getByLabel("Nom du modèle").fill(`Nattes et vanilles ${SUFFIXE}`);
    await secretaire.getByRole("group", { name: "Type de coiffure" }).getByRole("button", { name: "Tresses", exact: true }).click();
    await secretaire.getByLabel("Prix min. (FCFA)").fill("5000");
    await secretaire.getByLabel("Prix max. (FCFA)").fill("12000");
    await secretaire.getByLabel("Durée min.").selectOption("180");
    await largeurOk(secretaire, "modèle");
    await capture(secretaire, "08-nouveau-modele");
    await secretaire.getByRole("button", { name: "Ajouter au catalogue" }).click();
    await secretaire.getByText(`Nattes et vanilles ${SUFFIXE}`).first().waitFor();
    await capture(secretaire, "09-catalogue");
  });

  await verifier("La cliente choisit le modèle sur l'accueil et l'envoie (FR-C04, FR-C05)", async () => {
    await cliente.goto(`${BASE}/`);
    await cliente.getByRole("heading", { name: "Nos réalisations" }).waitFor();
    await capture(cliente, "10-accueil-modeles");
    await cliente.getByRole("link", { name: new RegExp(`Nattes et vanilles ${SUFFIXE}`) }).click();
    await cliente.waitForURL(/\/reserver\?modele=/);
    const choisi = cliente.getByRole("button", { name: new RegExp(`Nattes et vanilles ${SUFFIXE}`) });
    if ((await choisi.getAttribute("aria-pressed")) !== "true") throw new Error("modèle non présélectionné");
    await cliente.getByLabel(/^Votre nom/).fill(`Fanta ${SUFFIXE}`);
    await cliente.getByLabel("Votre numéro WhatsApp").fill(TEL);
    await largeurOk(cliente, "formulaire avec modèles");
    await capture(cliente, "11-formulaire-modele");
    await cliente.getByRole("button", { name: "Envoyer ma demande" }).click();
    await cliente.waitForURL(/\/demande\/[A-Z2-9]{8}$/);
    await cliente.getByText("Modèle choisi").waitFor();
  });

  await verifier("Le salon voit la photo du modèle et la durée proposée", async () => {
    await secretaire.goto(`${BASE}/salon`);
    await secretaire.getByAltText(`Nattes et vanilles ${SUFFIXE}`).first().waitFor();
    const carte = secretaire.locator("div.rounded-xl", { hasText: `Fanta ${SUFFIXE}` }).filter({ has: secretaire.getByRole("button", { name: "Confirmer" }) });
    await carte.getByRole("button", { name: "Confirmer" }).click();
    const troisH = secretaire.getByRole("group", { name: "Durée estimée" }).getByRole("button", { name: "3 h", exact: true });
    if ((await troisH.getAttribute("aria-pressed")) !== "true") throw new Error("durée du modèle non reprise");
    await capture(secretaire, "12-confirmer-modele");
  });
}

await verifier("Une référence inconnue affiche « Page introuvable »", async () => {
  await cliente.goto(`${BASE}/demande/ZZZZZZZZ`);
  await cliente.getByText("Page introuvable").waitFor();
});

await verifier("La démo est toujours disponible sur /demo", async () => {
  await cliente.goto(`${BASE}/demo`);
  await cliente.locator("h1").first().waitFor();
});

await verifier("Aucune erreur dans la console", async () => {
  const vraies = erreurs.filter((e) => !/favicon|status of 404/.test(e));
  if (vraies.length) throw new Error(vraies.join(" | "));
});

await browser.close();
console.log(`\n${ok}/${ok + ko} vérifications réussies (références ${reference}, ${reference2})`);
process.exit(ko ? 1 : 0);
