/**
 * Parcours de bout en bout : une cliente réserve un créneau libre en ligne et le rendez-vous est confirmé
 * immédiatement ; un créneau pris n'est plus proposé ; deux clientes ne peuvent pas prendre le même créneau. Format téléphone (390 px).
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
// Numéro différent à chaque lancement (limite de 3 rendez-vous à venir par numéro).
const TEL = `7${String(Date.now()).slice(-7)}`;
let reference = "";
let coiffeuseSouhaitee = "";

await verifier("Accueil public : présentation et services", async () => {
  await cliente.goto(`${BASE}/s/la-coquette-du-faso`);
  await cliente.getByRole("link", { name: "Réserver un rendez-vous" }).first().waitFor();
  await cliente.getByRole("heading", { name: "Choisissez votre service" }).waitFor();
  await largeurOk(cliente, "accueil");
  await capture(cliente, "01-accueil");
});

await verifier("Formulaire : sans service ni créneau, on est guidée ; le nom et le numéro sont obligatoires", async () => {
  await cliente.getByRole("link", { name: "Réserver un rendez-vous" }).first().click();
  await cliente.waitForURL(`${BASE}/s/la-coquette-du-faso/reserver`);
  await cliente.getByRole("button", { name: "Confirmer mon rendez-vous" }).click();
  await cliente.getByText("Choisissez d'abord un service.").first().waitFor();
  await cliente.getByRole("button", { name: "Tresses", exact: true }).click();
  await cliente.getByRole("button", { name: "Demain", exact: true }).click();
  await cliente.locator("button[data-heure]").first().waitFor();
  await cliente.getByRole("button", { name: "Confirmer mon rendez-vous" }).click();
  await cliente.getByText("Choisissez un créneau libre.").first().waitFor();
  await cliente.locator("button[data-heure]").first().click();
  await cliente.getByRole("button", { name: "Confirmer mon rendez-vous" }).click();
  await cliente.getByText("Indiquez votre nom.").waitFor();
  await cliente.getByText(/numéro WhatsApp \(8 chiffres\)/).waitFor();
});

let heureReservee = "";
await verifier("La cliente réserve un créneau libre et il est confirmé tout de suite", async () => {
  const groupe = cliente.getByRole("group", { name: "Coiffeuse souhaitée" });
  const premiere = groupe.getByRole("button").nth(1);
  coiffeuseSouhaitee = (await premiere.getAttribute("data-nom")).trim();
  await premiere.click();
  const creneau = cliente.locator("button[data-heure]").nth(2);
  await creneau.waitFor();
  heureReservee = await creneau.getAttribute("data-heure");
  await creneau.click();
  await cliente.getByLabel(/^Votre nom/).fill(NOM);
  await cliente.getByLabel("Votre numéro WhatsApp").fill(TEL);
  await cliente.getByLabel("Précisions (facultatif)").fill("Longues, couleur naturelle");
  await largeurOk(cliente, "formulaire");
  await capture(cliente, "02-formulaire");
  await cliente.getByRole("button", { name: "Confirmer mon rendez-vous" }).click();
  await cliente.waitForURL(/\/demande\/[A-Z2-9]{8}$/);
  reference = cliente.url().split("/").pop();
  await cliente.getByRole("heading", { name: "Rendez-vous confirmé" }).waitFor();
});

await verifier("La page de suivi montre l'heure, la coiffeuse et la durée, sans le numéro de téléphone (SEC-B02)", async () => {
  const t = await visible(cliente);
  if (t.includes(TEL.slice(-4))) throw new Error("numéro visible");
  if (!t.includes(reference)) throw new Error("référence absente");
  if (!t.includes(heureReservee.replace(":", " h "))) throw new Error(`heure ${heureReservee} absente`);
  if (!t.includes(coiffeuseSouhaitee)) throw new Error("coiffeuse absente");
  if (!t.includes("3 h")) throw new Error("durée prévue absente");
  await largeurOk(cliente, "suivi");
  await capture(cliente, "03-suivi-confirme");
});

await verifier("Le créneau pris n'est plus proposé avec la même coiffeuse (pause de 30 min comprise)", async () => {
  const autre = await nouveauTelephone();
  await autre.goto(`${BASE}/s/la-coquette-du-faso/reserver`);
  await autre.getByRole("button", { name: "Tresses", exact: true }).click();
  await autre.getByRole("button", { name: "Demain", exact: true }).click();
  await autre.locator("button[data-heure]").first().waitFor();
  await autre.locator(`button[data-nom="${coiffeuseSouhaitee}"]`).click();
  await autre.locator("button[data-heure]").first().waitFor();
  const heures = await autre.locator("button[data-heure]").evaluateAll((els) => els.map((e) => e.getAttribute("data-heure")));
  const min = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
  const debut = min(heureReservee);
  const fin = debut + 180;
  const genants = heures.filter((h) => min(h) < fin + 30 && min(h) + 180 + 30 > debut);
  if (genants.length) throw new Error(`créneaux qui chevauchent ou sans pause : ${genants.join(", ")}`);
  await autre.context().close();
});

await verifier("Deux clientes sur le même créneau : la seconde est prévenue et voit d'autres heures", async () => {
  const a = await nouveauTelephone();
  const b = await nouveauTelephone();
  const choisir = async (p, nom, tel) => {
    await p.goto(`${BASE}/s/la-coquette-du-faso/reserver`);
    await p.getByRole("button", { name: "Tresses", exact: true }).click();
    await p.getByRole("button", { name: "Demain", exact: true }).click();
    await p.locator("button[data-heure]").first().waitFor();
    await p.locator(`button[data-nom="${coiffeuseSouhaitee}"]`).click();
    await p.locator("button[data-heure]").first().waitFor();
    const h = await p.locator("button[data-heure]").last().getAttribute("data-heure");
    await p.locator(`button[data-heure="${h}"]`).click();
    await p.getByLabel(/^Votre nom/).fill(nom);
    await p.getByLabel("Votre numéro WhatsApp").fill(tel);
    return h;
  };
  const h1 = await choisir(a, `Awa ${SUFFIXE}`, `7${String(Date.now() + 1).slice(-7)}`);
  const h2 = await choisir(b, `Bintou ${SUFFIXE}`, `7${String(Date.now() + 2).slice(-7)}`);
  if (h1 !== h2) throw new Error("les deux clientes n'ont pas visé le même créneau");
  await a.getByRole("button", { name: "Confirmer mon rendez-vous" }).click();
  await a.waitForURL(/\/demande\/[A-Z2-9]{8}$/);
  await b.getByRole("button", { name: "Confirmer mon rendez-vous" }).click();
  await b.getByRole("alert").filter({ hasText: /plus libre|vient d'être pris/ }).waitFor();
  await b.waitForURL(/\/reserver/);
  await b.locator("button[data-heure]").first().waitFor();
  const restantes = await b.locator(`button[data-heure="${h2}"]`).count();
  if (restantes) throw new Error("le créneau pris est toujours proposé");
  await capture(b, "04-creneau-pris");
  await a.context().close();
  await b.context().close();
});

await verifier("La secrétaire ne trouve plus rien à confirmer : plus de demandes en ligne", async () => {
  await secretaire.goto(`${BASE}/connexion`);
  await secretaire.getByLabel("Identifiant").fill("secretaire");
  await secretaire.getByLabel("Mot de passe").fill(MDP_SECRETAIRE);
  await secretaire.getByRole("button", { name: "Se connecter" }).click();
  await secretaire.waitForURL(`${BASE}/salon`);
  await secretaire.getByRole("button", { name: "+ Rendez-vous" }).waitFor();
  const t = await visible(secretaire);
  if (t.includes("Demandes en ligne à traiter")) throw new Error("une demande en attente est affichée");
  await capture(secretaire, "05-salon");
});

await verifier("La gérante renseigne le WhatsApp du salon ; l'accueil le propose", async () => {
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
  await cliente.goto(`${BASE}/s/la-coquette-du-faso`);
  await cliente.getByRole("link", { name: "Écrire au salon" }).first().waitFor();
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
    await secretaire.getByRole("group", { name: "Type de service" }).getByRole("button", { name: "Tresses", exact: true }).click();
    await secretaire.getByLabel("Prix min. (FCFA)").fill("5000");
    await secretaire.getByLabel("Prix max. (FCFA)").fill("12000");
    await secretaire.getByLabel("Durée min.").selectOption("180");
    await largeurOk(secretaire, "modèle");
    await capture(secretaire, "08-nouveau-modele");
    await secretaire.getByRole("button", { name: "Ajouter au catalogue" }).click();
    await secretaire.getByText(`Nattes et vanilles ${SUFFIXE}`).first().waitFor();
    await capture(secretaire, "09-catalogue");
  });

  await verifier("La cliente choisit le modèle sur l'accueil et réserve (FR-C04, FR-C05)", async () => {
    await cliente.goto(`${BASE}/s/la-coquette-du-faso`);
    await cliente.getByRole("heading", { name: "Nos réalisations" }).waitFor();
    await capture(cliente, "10-accueil-modeles");
    await cliente.getByRole("link", { name: new RegExp(`Nattes et vanilles ${SUFFIXE}`) }).click();
    await cliente.waitForURL(/\/reserver\?modele=/);
    const choisi = cliente.getByRole("button", { name: new RegExp(`Nattes et vanilles ${SUFFIXE}`) });
    if ((await choisi.getAttribute("aria-pressed")) !== "true") throw new Error("modèle non présélectionné");
    await cliente.getByRole("button", { name: "Demain", exact: true }).click();
    await cliente.locator("button[data-heure]").first().click();
    await cliente.getByLabel(/^Votre nom/).fill(`Fanta ${SUFFIXE}`);
    await cliente.getByLabel("Votre numéro WhatsApp").fill(`7${String(Date.now() + 3).slice(-7)}`);
    await largeurOk(cliente, "formulaire avec modèles");
    await capture(cliente, "11-formulaire-modele");
    await cliente.getByRole("button", { name: "Confirmer mon rendez-vous" }).click();
    await cliente.waitForURL(/\/demande\/[A-Z2-9]{8}$/);
    await cliente.getByText("Modèle choisi").waitFor();
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
console.log(`\n${ok}/${ok + ko} vérifications réussies (référence ${reference})`);
process.exit(ko ? 1 : 0);
