/**
 * Parcours de bout en bout : formulaire de réservation et page de suivi (design « Warm beauty, bold digital »).
 * Vérifie les messages d'erreur, la mise au point du premier champ à corriger, le suivi, et l'absence de
 * débordement horizontal à 360, 390, 768 et 1280 px. Prérequis : base de démo, application sur :3200.
 * Usage : BASE_URL=http://localhost:3200 npm run test:e2e:design
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const SHOTS = process.env.SHOTS ?? "e2e/captures/design";
await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: process.env.BROWSER ?? "msedge" },
);
const LARGEURS = [360, 390, 768, 1280];
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
async function page(largeur) {
  const ctx = await browser.newContext({ viewport: { width: largeur, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" });
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && erreurs.push(m.text()));
  p.on("pageerror", (e) => erreurs.push(e.message));
  return p;
}
const debordement = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const p = await page(390);

await verifier("Formulaire : sans service ni heure, la cliente est guidée ; sans nom ni numéro, les erreurs s'affichent et le curseur va dans le premier champ", async () => {
  await p.goto(`${BASE}/s/la-coquette-du-faso/reserver`);
  await p.getByRole("button", { name: "Confirmer mon rendez-vous" }).waitFor();
  await p.getByRole("button", { name: "Confirmer mon rendez-vous" }).click();
  await p.getByRole("alert").filter({ hasText: "Choisissez d'abord un service." }).waitFor();
  await p.getByRole("button", { name: "Tresses", exact: true }).click();
  await p.getByRole("button", { name: "Demain", exact: true }).click();
  await p.getByRole("button", { name: "Confirmer mon rendez-vous" }).click();
  await p.getByRole("alert").filter({ hasText: "Choisissez un créneau libre." }).waitFor();
  await p.locator("button[data-heure]").first().click();
  await p.getByRole("button", { name: "Confirmer mon rendez-vous" }).click();
  await p.getByRole("alert").filter({ hasText: "Indiquez votre nom." }).waitFor();
  await p.getByRole("alert").filter({ hasText: /numéro WhatsApp/ }).waitFor();
  const nom = p.getByLabel("Votre nom", { exact: true });
  if ((await nom.getAttribute("aria-invalid")) !== "true") throw new Error("champ nom non marqué invalide");
  if (!(await nom.evaluate((el) => el === document.activeElement))) throw new Error("le curseur n'est pas dans le champ nom");
  if (!((await nom.getAttribute("aria-describedby")) ?? "").includes("erreur")) throw new Error("erreur non reliée au champ");
});

await verifier("Formulaire : corriger le nom efface son erreur, le numéro reste signalé", async () => {
  await p.getByLabel("Votre nom", { exact: true }).fill("Test Design");
  await p.getByRole("alert").filter({ hasText: "Indiquez votre nom." }).waitFor({ state: "detached" });
  if ((await p.getByLabel(/Votre numéro WhatsApp/).getAttribute("aria-invalid")) !== "true") throw new Error("le numéro n'est plus signalé");
});

await verifier("Formulaire : la bordure des champs est lisible (contraste de 3:1 minimum)", async () => {
  const [bord, fond] = await p.getByLabel("Précisions (facultatif)").evaluate((el) => {
    const c = getComputedStyle(el);
    return [c.borderTopColor, c.backgroundColor];
  });
  const rgb = (s) => s.match(/\d+/g).slice(0, 3).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
  const [a, b] = [lum(rgb(bord)), lum(rgb(fond))];
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  if (ratio < 3) throw new Error(`contraste de bordure ${ratio.toFixed(2)}:1`);
});

let reference = "";
await verifier("Formulaire : une réservation complète est confirmée tout de suite et mène à la page de suivi", async () => {
  await p.getByLabel(/Votre numéro WhatsApp/).fill(`7${String(Date.now()).slice(-7)}`);
  const envoi = p.getByRole("button", { name: /Confirmer mon rendez-vous|Réservation en cours/ });
  await envoi.click();
  await p.waitForURL(/\/demande\/[A-Z0-9]{8}$/, { timeout: 15000 });
  reference = p.url().split("/").pop();
});

await verifier("Suivi : l'état est écrit en toutes lettres, avec le salon et un moyen d'écrire au salon", async () => {
  await p.getByRole("heading", { name: "Rendez-vous confirmé" }).waitFor();
  await p.getByText("Confirmé", { exact: true }).waitFor();
  await p.getByText(/voici votre rendez-vous à/).waitFor();
  const lien = p.getByRole("link", { name: "Écrire au salon" });
  const href = await lien.getAttribute("href");
  if (!href?.includes("wa.me") || !decodeURIComponent(href).includes(reference)) throw new Error(`lien WhatsApp inattendu : ${href}`);
  await p.getByText(/Gardez ce lien/).waitFor();
  await p.getByRole("list", { name: "Étapes de votre rendez-vous" }).waitFor();
  await p.screenshot({ path: `${SHOTS}/suivi-390.png`, fullPage: true });
});

for (const l of LARGEURS) {
  await verifier(`Largeur ${l} px : /reserver et le suivi sans débordement horizontal`, async () => {
    const q = await page(l);
    await q.goto(`${BASE}/s/la-coquette-du-faso/reserver`);
    await q.getByRole("button", { name: "Confirmer mon rendez-vous" }).waitFor();
    let d = await debordement(q);
    if (d > 0) throw new Error(`/reserver déborde de ${d}px`);
    await q.screenshot({ path: `${SHOTS}/reserver-${l}.png`, fullPage: true });
    await q.goto(`${BASE}/demande/${reference}`);
    await q.getByRole("heading", { name: "Rendez-vous confirmé" }).waitFor();
    d = await debordement(q);
    if (d > 0) throw new Error(`le suivi déborde de ${d}px`);
    await q.screenshot({ path: `${SHOTS}/suivi-${l}.png`, fullPage: true });
    await q.context().close();
  });
}

await verifier("Aucune erreur dans la console", async () => {
  if (erreurs.length) throw new Error(erreurs.slice(0, 3).join(" | "));
});

console.log(`${ok}/${ok + ko} vérifications réussies`);
await browser.close();
process.exit(ko ? 1 : 0);
