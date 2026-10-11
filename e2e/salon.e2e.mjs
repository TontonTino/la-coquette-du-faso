/**
 * Parcours de bout en bout de l'espace salon (secrétaire puis gérante), au format téléphone.
 *
 * Prérequis : une base migrée et initialisée avec `npm run db:seed -- --demo`, puis l'application
 * lancée sur cette base (`npm run build && npm start -- -p 3200`).
 * Usage : BASE_URL=http://localhost:3200 MDP_SECRETAIRE=... MDP_GERANTE=... npm run test:e2e:salon
 * Variables : BROWSER=msedge|chrome, CHROME_PATH (exécutable Chromium), SHOTS (dossier des captures).
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const SHOTS = process.env.SHOTS ?? "e2e/captures/salon";
const MDP_SECRETAIRE = process.env.MDP_SECRETAIRE;
const MDP_GERANTE = process.env.MDP_GERANTE;
if (!MDP_SECRETAIRE || !MDP_GERANTE) {
  console.error("MDP_SECRETAIRE et MDP_GERANTE sont requis.");
  process.exit(1);
}

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: process.env.BROWSER ?? "msedge" },
);
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" });
const page = await context.newPage();
const erreursConsole = [];
page.on("console", (m) => m.type() === "error" && erreursConsole.push(m.text()));
page.on("pageerror", (e) => erreursConsole.push(e.message));

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
    await page.screenshot({ path: `${SHOTS}/echec-${ok + ko}.png`, fullPage: true }).catch(() => {});
  }
}
const attendre = (cond, msg, ms = 8000) =>
  page.waitForFunction(cond, null, { timeout: ms }).catch(() => {
    throw new Error(msg);
  });
// Next.js garde la page précédente cachée dans le DOM : on ne lit que le <main> visible.
const texte = () => page.locator("main:visible").innerText();
async function pasDeDefilementHorizontal(nom) {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  if (sw > cw) throw new Error(`${nom} : ${sw}px > ${cw}px`);
}
async function capture(nom) {
  await page.screenshot({ path: `${SHOTS}/${nom}.png`, fullPage: true });
}
async function seConnecter(identifiant, mdp) {
  await page.goto(`${BASE}/connexion`);
  await page.getByLabel("Identifiant").fill(identifiant);
  await page.getByLabel("Mot de passe").fill(mdp);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(`${BASE}/salon`);
  await page.getByRole("button", { name: "+ Rendez-vous" }).waitFor();
}
const SUFFIXE = Date.now().toString(36).slice(-4);
const CLIENTE_SANS = `Odile ${SUFFIXE}`;
const CLIENTE_RDV = `Nadège ${SUFFIXE}`;

await verifier("Sans session, /salon redirige vers la connexion", async () => {
  await page.goto(`${BASE}/salon`);
  await page.waitForURL(`${BASE}/connexion`);
  await capture("01-connexion");
});

await verifier("Mauvais mot de passe refusé", async () => {
  await page.getByLabel("Identifiant").fill("secretaire");
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.getByRole("alert").filter({ hasText: "incorrect" }).waitFor();
});

await verifier("Connexion de la secrétaire", async () => {
  await seConnecter("secretaire", MDP_SECRETAIRE);
  await pasDeDefilementHorizontal("salon");
  await capture("02-salon-vide");
});

await verifier("La secrétaire ne voit ni Bilan ni Équipe", async () => {
  const nav = await page.getByRole("navigation", { name: /espace salon/ }).innerText();
  if (nav.includes("Bilan") || nav.includes("Équipe")) throw new Error(nav);
});

await verifier("Cliente sans rendez-vous ajoutée à la file d'attente (FR-008)", async () => {
  await page.getByRole("button", { name: "+ Sans rendez-vous" }).click();
  await page.getByLabel("Nom de la cliente").fill(CLIENTE_SANS);
  await page.getByLabel("Modèle ou remarque").fill("Nattes collées");
  await capture("03-sans-rdv");
  await page.getByRole("button", { name: "Ajouter à la file d'attente" }).click();
  await page.getByText(CLIENTE_SANS, { exact: true }).waitFor();
});

let coiffeuseDemarrage = "";
await verifier("Démarrage avec une coiffeuse libre (FR-010)", async () => {
  const carte = page.locator("div.rounded-xl", { hasText: CLIENTE_SANS }).filter({ has: page.getByRole("button", { name: "Démarrer" }) });
  await carte.getByRole("button", { name: "Démarrer" }).click();
  await page.getByRole("button", { name: "Démarrer la prestation" }).waitFor();
  const premiere = page.getByRole("button", { pressed: false }).filter({ hasText: /^[A-ZÉ][a-zéèï]+ [A-Z]\.$/ }).first();
  await premiere.waitFor();
  coiffeuseDemarrage = (await premiere.innerText()).trim();
  await premiere.click();
  await page.getByRole("button", { name: "2 h", exact: true }).click();
  await pasDeDefilementHorizontal("démarrer");
  await capture("04-demarrer");
  await page.getByRole("button", { name: "Démarrer la prestation" }).click();
  await page.getByRole("heading", { name: /En cours/ }).waitFor();
  await attendre(
    () => [...document.querySelectorAll("section")].some((s) => s.innerText.includes("EN COURS") || s.innerText.includes("En cours")),
    "section En cours absente",
  );
  if (!(await texte()).includes(coiffeuseDemarrage)) throw new Error(`${coiffeuseDemarrage} absente de la carte en cours`);
});

await verifier("Fin de prestation et encaissement (FR-011)", async () => {
  const carte = page.locator("div.rounded-xl", { hasText: CLIENTE_SANS }).filter({ has: page.getByRole("button", { name: "Terminer" }) });
  await carte.getByRole("button", { name: "Terminer" }).click();
  await page.getByLabel("Prix payé (FCFA)").fill("12000");
  await page.getByRole("button", { name: "Mobile money" }).click();
  await capture("05-terminer");
  await page.getByRole("button", { name: "Valider et libérer les coiffeuses" }).click();
  await page.getByRole("button", { name: "+ Rendez-vous" }).waitFor();
  await attendre(() => ![...document.querySelectorAll("main")].filter((m) => m.offsetParent !== null).map((m) => m.innerText).join(" ").includes("Terminer"), "la prestation est toujours en cours");
});

let coiffeuseRdv = "";
await verifier("Rendez-vous « Tresses » avec une coiffeuse compétente (FR-006, BR-009)", async () => {
  await page.getByRole("button", { name: "+ Rendez-vous" }).click();
  await page.getByLabel("Nom de la cliente").fill(CLIENTE_RDV);
  await page.getByLabel("Téléphone (WhatsApp)").fill("70 12 34 56");
  await page.getByLabel("Heure").selectOption("20:45");
  await page.getByRole("button", { name: "Tresses", exact: true }).click();
  await page.getByRole("button", { name: "Première disponible" }).waitFor();
  await page.waitForTimeout(600); // la liste des coiffeuses compétentes se met à jour
  const choix = page.getByRole("button", { pressed: false }).filter({ hasText: /^[A-ZÉ][a-zéèï]+ [A-Z]\.$/ }).first();
  coiffeuseRdv = (await choix.innerText()).trim();
  await choix.click();
  await pasDeDefilementHorizontal("nouveau rdv");
  await capture("06-nouveau-rdv");
  await page.getByRole("button", { name: "Enregistrer le rendez-vous" }).click();
  await page.getByText(CLIENTE_RDV, { exact: true }).waitFor();
});

await verifier("La coiffeuse prise n'est plus proposée sur le même créneau (BR-001)", async () => {
  await page.getByRole("button", { name: "+ Rendez-vous" }).click();
  await page.getByLabel("Heure").selectOption("20:45");
  await page.getByRole("button", { name: "Première disponible" }).waitFor();
  await page.waitForTimeout(800);
  const noms = await page.getByRole("button").allInnerTexts();
  if (noms.map((n) => n.trim()).includes(coiffeuseRdv)) throw new Error(`${coiffeuseRdv} encore proposée`);
  await page.getByRole("button", { name: "‹ Retour" }).click();
});

await verifier("Absence imprévue : le rendez-vous est signalé à réattribuer (FR-003)", async () => {
  await page.getByRole("link", { name: "Coiffeuses" }).click();
  await page.waitForURL(`${BASE}/salon/coiffeuses`);
  await pasDeDefilementHorizontal("coiffeuses");
  await capture("07-coiffeuses");
  const ligne = page.locator("div.rounded-xl", { hasText: coiffeuseRdv });
  await ligne.getByRole("button", { name: "Absente ?" }).click();
  await ligne.getByRole("button", { name: "Annuler l'absence" }).waitFor();
  await page.getByRole("link", { name: "Salon" }).click();
  await page.getByText("absente : à réattribuer").waitFor();
  await capture("08-a-reattribuer");
});

await verifier("Réattribution du rendez-vous à une autre coiffeuse (FR-012)", async () => {
  const carte = page.locator("div.rounded-xl", { hasText: CLIENTE_RDV });
  await carte.getByRole("button", { name: "Modifier" }).click();
  await page.getByRole("button", { name: "Première disponible" }).waitFor();
  const autre = page.getByRole("button", { pressed: false }).filter({ hasText: /^[A-ZÉ][a-zéèï]+ [A-Z]\.$/ }).first();
  await autre.click();
  await page.getByRole("button", { name: "Enregistrer les changements" }).click();
  await page.getByRole("button", { name: "+ Rendez-vous" }).waitFor();
  await attendre(() => ![...document.querySelectorAll("main")].filter((m) => m.offsetParent !== null).map((m) => m.innerText).join(" ").includes("à réattribuer"), "toujours à réattribuer");
});

await verifier("La secrétaire ne peut pas ouvrir le bilan (SEC-002)", async () => {
  await page.goto(`${BASE}/salon/bilan`);
  await page.waitForURL(`${BASE}/salon`);
});

await verifier("Bilan du soir de la gérante (FR-013)", async () => {
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL(`${BASE}/connexion`);
  await seConnecter("gerante", MDP_GERANTE);
  await page.getByRole("link", { name: "Bilan" }).click();
  await page.waitForURL(/\/salon\/bilan/);
  // Next.js garde l'écran précédent (caché) : on ne cherche que dans la page visible.
  await page.locator("main:visible").getByText(CLIENTE_SANS, { exact: true }).first().waitFor();
  const t = await texte();
  if (!/12\s000\sFCFA/.test(t)) throw new Error("12 000 FCFA introuvable dans le bilan");
  await pasDeDefilementHorizontal("bilan");
  await capture("09-bilan");
});

await verifier("Écran Équipe de la gérante", async () => {
  await page.getByRole("link", { name: "Équipe" }).click();
  await page.waitForURL(`${BASE}/salon/equipe`);
  await page.getByText("Coiffeuses actives").waitFor();
  await pasDeDefilementHorizontal("équipe");
  await capture("10-equipe");
});

await verifier("La démo de réservation existante fonctionne toujours", async () => {
  await page.goto(`${BASE}/`);
  await page.locator("h1").first().waitFor();
});

await verifier("Aucune erreur dans la console", async () => {
  const vraies = erreursConsole.filter((e) => !/favicon|Failed to load resource.*(401|403)/.test(e));
  if (vraies.length) throw new Error(vraies.join(" | "));
});

await browser.close();
console.log(`\n${ok}/${ok + ko} vérifications réussies`);
process.exit(ko ? 1 : 0);
