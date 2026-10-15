/**
 * Écran « Réglages » de la gérante : horaires, pause, durée et prix d'un service ; la secrétaire n'y a pas accès.
 * Prérequis : application sur :3200 avec la base de démo. Usage : MDP_SECRETAIRE=... MDP_GERANTE=... node e2e/reglages.e2e.mjs
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const SHOTS = process.env.SHOTS ?? "e2e/captures/reglages";
const { MDP_SECRETAIRE, MDP_GERANTE } = process.env;
if (!MDP_SECRETAIRE || !MDP_GERANTE) throw new Error("MDP_SECRETAIRE et MDP_GERANTE sont requis.");
await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: process.env.BROWSER ?? "msedge" });
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
async function session(identifiant, mdp) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" });
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && erreurs.push(m.text()));
  p.on("pageerror", (e) => erreurs.push(e.message));
  await p.goto(`${BASE}/connexion`);
  await p.fill('input[name="identifiant"]', identifiant);
  await p.fill('input[name="motDePasse"]', mdp);
  await p.click('button[type="submit"]');
  await p.waitForURL("**/salon");
  return p;
}
const visible = (p) => p.locator("main:visible").innerText();

const g = await session("gerante", MDP_GERANTE);

await verifier("la gérante ouvre Réglages depuis la navigation", async () => {
  await g.getByRole("link", { name: "Réglages" }).click();
  await g.waitForURL("**/salon/reglages");
  await g.getByRole("heading", { name: "Réglages" }).waitFor();
  if (!(await visible(g)).includes("Horaires d'ouverture")) throw new Error("section horaires absente");
  await g.screenshot({ path: `${SHOTS}/1-reglages.png`, fullPage: true });
});

await verifier("horaires et pause enregistrés, toujours là après rechargement", async () => {
  await g.getByLabel("Samedi : ouverture").fill("09:00");
  await g.getByLabel("Samedi : fermeture").fill("17:30");
  await g.getByLabel("Dimanche").first().uncheck();
  await g.locator("select").first().selectOption("45");
  await g.getByRole("button", { name: "Enregistrer les horaires" }).click();
  await g.getByText("Horaires enregistrés").waitFor();
  await g.reload();
  if ((await g.getByLabel("Samedi : ouverture").inputValue()) !== "09:00") throw new Error("ouverture non conservée");
  if ((await g.getByLabel("Samedi : fermeture").inputValue()) !== "17:30") throw new Error("fermeture non conservée");
  if (await g.getByLabel("Dimanche : ouverture").count()) throw new Error("le dimanche devrait être fermé");
  if ((await g.locator("select").first().inputValue()) !== "45") throw new Error("pause non conservée");
});

await verifier("des horaires incohérents sont refusés avec un message", async () => {
  await g.waitForLoadState("networkidle"); // la page doit être « réveillée » (hydratée) avant de saisir
  await g.getByLabel("Samedi : fermeture").fill("08:00");
  if ((await g.getByLabel("Samedi : fermeture").inputValue()) !== "08:00") throw new Error("la saisie n'a pas été prise en compte");
  await g.getByRole("button", { name: "Enregistrer les horaires" }).click();
  await g.getByText(/Samedi : la fermeture doit être après l'ouverture/).waitFor();
});

await verifier("durée et prix d'un service enregistrés", async () => {
  await g.reload();
  await g.waitForLoadState("networkidle");
  const service = g.locator("main:visible").getByText("Tresses", { exact: true }).first().locator("xpath=ancestor::div[contains(@class,'shadow-carte')][1]");
  await service.locator("select").selectOption({ label: "3 h" });
  await service.locator("input").fill("15000");
  await service.getByRole("button", { name: "Enregistrer" }).click();
  await g.getByText(/« Tresses » enregistré/).waitFor();
  await g.reload();
  const apres = g.locator("main:visible").getByText("Tresses", { exact: true }).first().locator("xpath=ancestor::div[contains(@class,'shadow-carte')][1]");
  if ((await apres.locator("select").inputValue()) !== "180") throw new Error("durée non conservée");
  if ((await apres.locator("input").inputValue()) !== "15000") throw new Error("prix non conservé");
  await g.screenshot({ path: `${SHOTS}/2-services.png`, fullPage: true });
});

await verifier("la secrétaire n'a ni l'onglet ni l'accès à la page", async () => {
  const s = await session("secretaire", MDP_SECRETAIRE);
  if (await s.getByRole("link", { name: "Réglages" }).count()) throw new Error("l'onglet est visible pour la secrétaire");
  await s.goto(`${BASE}/salon/reglages`);
  await s.waitForURL((u) => u.pathname === "/salon");
});

await verifier("aucune erreur dans la console", async () => {
  if (erreurs.length) throw new Error(erreurs.slice(0, 3).join(" | "));
});

await browser.close();
console.log(`\n${ok}/${ok + ko} vérifications réussies`);
process.exit(ko ? 1 : 0);
