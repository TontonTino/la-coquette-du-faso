/**
 * Page d'accueil (refonte « Warm beauty, bold digital ») : titre, photo de couverture, parcours vers la
 * réservation, images chargées, défilement automatique des réalisations, pas de débordement horizontal
 * à 360, 390, 768 et 1280 px, aucune erreur dans la console.
 * Prérequis : base de démo, application sur :3200. Usage : BASE_URL=http://localhost:3200 npm run test:e2e:accueil
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const SHOTS = process.env.SHOTS ?? "e2e/captures/accueil";
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
async function ouvrir(largeur, hauteur = 844) {
  const ctx = await browser.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, locale: "fr-FR" });
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && erreurs.push(m.text()));
  p.on("pageerror", (e) => erreurs.push(e.message));
  await p.goto(`${BASE}/s/la-coquette-du-faso`);
  await p.locator("#titre-services").waitFor(); // le reste de la page arrive après l'enveloppe (rendu progressif)
  return p;
}
async function toutParcourir(p) {
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 400) {
    await p.evaluate((y) => window.scrollTo(0, y), y);
    await p.waitForTimeout(120);
  }
  await p.evaluate(() => window.scrollTo(0, 0));
}

const p = await ouvrir(390);

await verifier("Couverture : titre, photo de l'intérieur et bouton de réservation dans la première vue", async () => {
  const h1 = p.getByRole("heading", { level: 1 });
  await h1.waitFor();
  if (!/Là où vous vous sentez belle/.test(await h1.innerText())) throw new Error("titre inattendu");
  await p.getByRole("img", { name: /intérieur lumineux du salon/ }).waitFor();
  const bouton = p.getByRole("link", { name: "Demander un rendez-vous" }).first();
  const r = await bouton.boundingBox();
  if (!r || r.y + r.height > 844) throw new Error("le bouton principal n'est pas dans la première vue");
  await p.screenshot({ path: `${SHOTS}/01-couverture-390.png` });
});

await verifier("Sections : prestations, réalisations, salon, équipe, étapes, adresse, appel final", async () => {
  for (const nom of ["Choisissez votre service", "Nos réalisations", "Derrière chaque coiffure, une équipe", "Notre équipe", "Comment ça marche", "Nous trouver", /nouveau look/]) {
    await p.getByRole("heading", { name: nom }).waitFor({ timeout: 5000 });
  }
});

await verifier("Toutes les images se chargent (photos du salon, portraits, façade)", async () => {
  await toutParcourir(p);
  await p.waitForTimeout(800);
  const cassees = await p.evaluate(() => [...document.images].filter((i) => i.loading !== "lazy" || i.getBoundingClientRect().top < innerHeight * 3).filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
  if (cassees.length > 0) throw new Error(`images cassées : ${cassees[0]}`);
  for (const alt of [/équipe de|coiffeuses de La Coquette du Faso réunies/, /façade du salon/]) await p.getByRole("img", { name: alt }).first().waitFor();
});

await verifier("Les 3 portraits sont ronds, avec un texte alternatif", async () => {
  const formes = await p.evaluate(() =>
    [...document.querySelectorAll("[aria-labelledby='titre-salon'] ul img")].map((e) => {
      const r = e.getBoundingClientRect();
      return Math.abs(r.width - r.height) < 1 && parseFloat(getComputedStyle(e).borderTopLeftRadius) >= r.width / 2 - 1 && e.alt.length > 10;
    }),
  );
  if (formes.length !== 3 || formes.includes(false)) throw new Error(`portraits : ${JSON.stringify(formes)}`);
});

await verifier("Réalisations : le défilement automatique avance, puis s'arrête quand on touche", async () => {
  const liste = p.locator("[aria-labelledby='titre-modeles'] ul").first();
  await liste.scrollIntoViewIfNeeded();
  const avant = await liste.evaluate((e) => e.scrollLeft);
  await p.waitForTimeout(2500);
  const apres = await liste.evaluate((e) => e.scrollLeft);
  if (!(apres > avant + 20)) throw new Error(`pas de défilement (${avant} → ${apres})`);
  await liste.hover();
  const a = await liste.evaluate((e) => e.scrollLeft);
  await p.waitForTimeout(700);
  const b = await liste.evaluate((e) => e.scrollLeft);
  if (Math.abs(b - a) > 3) throw new Error("le défilement ne s'arrête pas au toucher");
  await p.mouse.move(5, 5);
});

await verifier("Parcours : une carte de service mène à la réservation avec le type choisi", async () => {
  await p.getByRole("link", { name: "Tresses", exact: true }).click();
  await p.waitForURL(/\/reserver\?type=/);
  await p.getByRole("button", { name: "Envoyer ma demande" }).waitFor();
});

await verifier("Parcours : « Tout voir » ouvre la bibliothèque, qui montre aussi les photos du salon", async () => {
  await p.goto(`${BASE}/s/la-coquette-du-faso`);
  await p.getByRole("link", { name: "Tout voir" }).click();
  await p.waitForURL(/\/realisations$/);
  await p.getByRole("heading", { name: "Nos réalisations" }).waitFor();
  await p.getByRole("img", { name: /Coiffure tressée en motif/ }).first().waitFor({ timeout: 10000 });
});

for (const [w, h] of [[360, 780], [390, 844], [768, 1024], [1280, 800]]) {
  await verifier(`Largeur ${w} px : aucun débordement horizontal`, async () => {
    const q = await ouvrir(w, h);
    const d = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (d > 0) throw new Error(`débordement de ${d}px`);
    await q.screenshot({ path: `${SHOTS}/02-couverture-${w}.png` });
    await q.close();
  });
}

await verifier("Aucune erreur dans la console", async () => {
  if (erreurs.length > 0) throw new Error(erreurs[0]);
});

await browser.close();
console.log(`\n${ok}/${ok + ko} vérifications réussies`);
process.exit(ko > 0 ? 1 : 0);
