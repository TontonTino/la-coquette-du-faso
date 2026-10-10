/**
 * Parcours de bout en bout dans un vrai navigateur (Microsoft Edge ou Chrome
 * installé sur le poste, piloté par playwright-core).
 *
 * Prérequis : application lancée (npm run build && npm start -- -p 3100).
 * Usage : npm run test:e2e   (variables : BASE_URL, BROWSER=msedge|chrome, SHOTS=dossier)
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS ?? "e2e/captures";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const consoleErrors = [];
function check(label, ok, detail = "") {
  results.push({ label, ok, detail });
  console.log(`${ok ? "✔" : "✘"} ${label}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ channel: process.env.BROWSER ?? "msedge" });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "fr-FR",
  timezoneId: "Africa/Ouagadougou",
});
const page = await context.newPage();
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
const noHorizontalScroll = async (label) => {
  // On compare à la largeur configurée : sur mobile, un débordement élargit `innerWidth` lui-même.
  const w = page.viewportSize().width;
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`Pas de défilement horizontal : ${label}`, sw <= w, `${sw}px / ${w}px`);
};
const slot = (t) => page.getByRole("button", { name: new RegExp(`^${t.replace(/ /g, "\\s")}$`) });

try {
  // 1. Accueil
  await page.goto(BASE + "/demo");
  await page.getByRole("link", { name: "Lancer le scénario" }).waitFor();
  check("Accueil affiché", await page.getByRole("heading", { name: /L'élégance/ }).isVisible());
  await noHorizontalScroll("accueil");
  await shot("01-accueil-mobile");

  // 2. Scénario principal
  await page.getByRole("link", { name: "Lancer le scénario" }).click();
  await page.waitForURL(/reserver/);
  await slot("15 h 30").waitFor();
  check("Créneau 15 h 30 pré-sélectionné", (await slot("15 h 30").getAttribute("aria-pressed")) === "true");
  await noHorizontalScroll("réservation");
  await shot("02-creneau");
  await page.getByRole("button", { name: /Continuer/ }).click();
  await page.getByRole("button", { name: "Voir le récapitulatif" }).click();
  check("Validation : erreurs affichées", await page.getByText("Indiquez votre nom").isVisible());
  await page.getByLabel("Nom et prénom").fill("Cliente Démo");
  await page.getByLabel("Téléphone").fill("70 00 00 00");
  await page.getByRole("button", { name: "Voir le récapitulatif" }).click();
  const recap = (await page.locator("main").innerText()).replace(/\u00a0/g, " ");
  check("Récapitulatif complet", ["Tresses Fulani", "Aïcha K.", "Mercredi 23 décembre 2026", "15 h 30", "2 h 30", "15 000 FCFA"].every((t) => recap.includes(t)));
  await shot("03-recapitulatif");
  await page.getByRole("button", { name: "Confirmer la réservation" }).click();
  await page.getByRole("heading", { name: /Merci, Cliente/ }).waitFor();
  check("Confirmation affichée", true);
  check("Notification de succès", await page.getByText("Réservation enregistrée").isVisible());
  await shot("04-confirmation");

  // 3. Mes rendez-vous
  await page.goto(BASE + "/demo/mes-rendez-vous");
  await page.getByText("Tresses Fulani").first().waitFor();
  check("Rendez-vous listé dans « Mes rendez-vous »", (await page.getByText("En attente").count()) > 0);
  await shot("05-mes-rendez-vous");

  // 4. Double réservation : le scénario relancé propose des alternatives
  await page.goto(BASE + "/demo/reserver?prestation=tresses-fulani&coiffeuse=aicha-k&date=2026-12-23&heure=15:30");
  await page.getByRole("heading", { name: "Nos propositions" }).waitFor();
  check("Créneau réservé non reproposé", (await slot("15 h 30").count()) === 0);
  check("Alternative : Salimata B. à la même heure", await page.getByRole("button", { name: /Salimata B\./ }).first().isVisible());
  await noHorizontalScroll("alternatives");
  await shot("06-alternatives");

  // 5. Espace coiffeuse : confirmation + blocage
  await page.goto(BASE + "/demo/espace-coiffeuse/aicha-k");
  await page.getByLabel("Choisir une date").fill("2026-12-23");
  await page.getByRole("button", { name: /Tresses Fulani/ }).waitFor();
  check("Le RDV apparaît dans le planning d'Aïcha", await page.getByText("Cliente Démo · jusqu").isVisible());
  await shot("07-planning-coiffeuse");
  await page.getByRole("button", { name: /Tresses Fulani/ }).click();
  await page.getByRole("button", { name: "Confirmer le rendez-vous" }).click();
  check("Confirmation par la coiffeuse", await page.getByText("Rendez-vous confirmé").isVisible());
  await page.getByRole("button", { name: /18\sh\s:\slibre/ }).click();
  check("Blocage d'un créneau", await page.getByText(/Créneau de 18\sh bloqué/).isVisible());
  await page.getByRole("button", { name: /18\sh\s:\sbloqué/ }).click();
  check("Déblocage d'un créneau", await page.getByText(/Créneau de 18\sh débloqué/).isVisible());
  await noHorizontalScroll("espace coiffeuse");

  // 6. Espace gérante
  await page.goto(BASE + "/demo/espace-gerante");
  await page.getByRole("heading", { name: "Tableau de bord" }).waitFor();
  await noHorizontalScroll("tableau de bord");
  await shot("08-tableau-de-bord");
  await page.goto(BASE + "/demo/espace-gerante/rendez-vous");
  await page.getByLabel("Choisir une date").fill("2026-12-23");
  const aicha = page.getByRole("region", { name: "Rendez-vous de Aïcha K." });
  await aicha.getByText("Cliente Démo").waitFor();
  check("Gérante : RDV confirmé visible chez Aïcha", await aicha.getByText("Confirmé").first().isVisible());
  await noHorizontalScroll("rendez-vous gérante");
  await shot("09-rendez-vous-gerante");
  for (const p of ["disponibilites", "prestations", "equipe"]) {
    await page.goto(`${BASE}/demo/espace-gerante/${p}`);
    await page.locator("h1").waitFor();
    await noHorizontalScroll(`gérante/${p}`);
  }
  await shot("10-equipe-gerante");

  // 7. Annulation par la cliente : le créneau redevient libre
  await page.goto(BASE + "/demo/mes-rendez-vous");
  await page.getByRole("button", { name: /Tresses Fulani/ }).first().click();
  await page.getByRole("button", { name: "Annuler le rendez-vous" }).click();
  await page.getByRole("button", { name: "Oui, annuler" }).click();
  check("Annulation confirmée", await page.getByText("Rendez-vous annulé").isVisible());
  await page.goto(BASE + "/demo/reserver?prestation=tresses-fulani&coiffeuse=aicha-k&date=2026-12-23&heure=15:30");
  await slot("15 h 30").waitFor();
  check("Créneau libéré après annulation", (await slot("15 h 30").getAttribute("aria-pressed")) === "true");

  // 8. Persistance après rechargement
  await page.goto(BASE + "/demo/mes-rendez-vous");
  await page.reload();
  await page.getByText("Annulé").first().waitFor();
  check("Données conservées après rechargement", true);

  // 9. Ordinateur
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(BASE + "/demo");
  await page.getByRole("link", { name: "Lancer le scénario" }).waitFor();
  await shot("11-accueil-ordinateur");
  await page.goto(BASE + "/demo/espace-gerante");
  await page.getByRole("heading", { name: "Tableau de bord" }).waitFor();
  await shot("12-tableau-de-bord-ordinateur");

  // 10. Page inconnue
  const res = await page.goto(BASE + "/page-inexistante");
  check("Page 404 en français", res?.status() === 404 && (await page.getByText("Page introuvable").isVisible()));
} catch (e) {
  check("Exécution du scénario", false, String(e).split("\n")[0]);
  await shot("erreur").catch(() => {});
} finally {
  await browser.close();
}

const ignored = consoleErrors.filter((e) => !e.includes("404"));
check("Aucune erreur dans la console", ignored.length === 0, ignored.slice(0, 3).join(" | "));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies`);
process.exit(failed.length ? 1 : 0);
