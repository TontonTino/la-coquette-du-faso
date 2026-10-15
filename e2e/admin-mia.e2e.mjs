/**
 * Parcours de l'espace MIA (opérateur) : connexion protégée, création d'un salon par formulaire avec son logo,
 * page publique du salon avec ce logo, connexion de la gérante, réglage, nouveau mot de passe.
 * Prérequis : application sur :3200 lancée avec MIA_ADMIN_IDENTIFIANT et MIA_ADMIN_MOT_DE_PASSE (voir ADMIN_ID / ADMIN_MDP).
 * Usage : LOGO=chemin.png ADMIN_ID=... ADMIN_MDP=... BASE_URL=http://localhost:3200 node e2e/admin-mia.e2e.mjs
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const SHOTS = process.env.SHOTS ?? "e2e/captures/admin";
const { ADMIN_ID, ADMIN_MDP, LOGO } = process.env;
if (!ADMIN_ID || !ADMIN_MDP || !LOGO) throw new Error("ADMIN_ID, ADMIN_MDP et LOGO sont requis.");
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" });
const p = await ctx.newPage();
p.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && erreurs.push(m.text()));
p.on("pageerror", (e) => erreurs.push(e.message));
p.on("response", (r) => r.status() >= 400 && ![401, 404].includes(r.status()) && erreurs.push(`HTTP ${r.status()} ${r.url()}`));
const debordement = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const SUFFIXE = Date.now().toString(36).slice(-5);
const NOM = `Maison Rubis ${SUFFIXE}`;
const SLUG = `maison-rubis-${SUFFIXE}`;
let gerante;

await verifier("sans connexion, /admin renvoie vers la connexion MIA", async () => {
  await p.goto(`${BASE}/admin`);
  await p.waitForURL("**/admin/connexion");
  if (!(await p.locator("main:visible").innerText()).includes("Espace opérateur")) throw new Error("page de connexion MIA absente");
  await p.goto(`${BASE}/admin/nouveau`);
  await p.waitForURL("**/admin/connexion");
});

await verifier("un faux cookie ne donne pas accès", async () => {
  await ctx.addCookies([{ name: "mia_admin", value: "faux-jeton", url: BASE }]);
  await p.goto(`${BASE}/admin`);
  await p.waitForURL("**/admin/connexion");
  await ctx.clearCookies();
});

await verifier("un mauvais mot de passe est refusé", async () => {
  await p.goto(`${BASE}/admin/connexion`);
  await p.fill('input[name="identifiant"]', ADMIN_ID);
  await p.fill('input[name="motDePasse"]', "mauvais-mot-de-passe-123");
  await p.click('button[type="submit"]');
  await p.locator('form [role="alert"]').waitFor();
  if (!(await p.locator('form [role="alert"]').innerText()).includes("incorrect")) throw new Error("message attendu absent");
});

await verifier("le bon couple ouvre la liste des salons", async () => {
  await p.fill('input[name="identifiant"]', ADMIN_ID);
  await p.fill('input[name="motDePasse"]', ADMIN_MDP);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => u.pathname === "/admin");
  await p.getByRole("heading", { name: "Salons" }).waitFor();
  await p.screenshot({ path: `${SHOTS}/1-liste.png` });
});

await verifier("la connexion des salons ne donne pas accès à l'espace MIA", async () => {
  const autre = await browser.newContext();
  await autre.addCookies([{ name: "mia_session", value: "x", url: BASE }]);
  const q = await autre.newPage();
  await q.goto(`${BASE}/admin`);
  await q.waitForURL("**/admin/connexion");
  await autre.close();
});

await verifier("création d'un salon par le formulaire, avec son logo", async () => {
  await p.getByRole("link", { name: "Nouveau salon" }).click();
  await p.waitForURL("**/admin/nouveau");
  await p.fill('input[name="nom"]', NOM);
  await p.fill('input[name="slug"]', SLUG);
  await p.setInputFiles('input[name="fichierLogo"]', LOGO);
  await p.locator('img[alt="Aperçu du logo"]').waitFor();
  await p.fill('input[name="whatsapp"]', "70 11 22 33");
  await p.fill('input[name="adresse"]', "Rue de test, Ouagadougou");
  await p.fill('input[name="horaires"]', "Lun-Sam, 8 h - 19 h");
  await p.fill('textarea[name="services"]', "Tresses, Tissage, Manucure:ongles");
  await p.uncheck('input[name="couleursDefaut"]');
  await p.fill('input[name="marque"]', "#4a1428");
  await p.fill('input[name="action"]', "#7a1f3d");
  await p.fill('input[name="detail"]', "#e0b84d");
  await p.screenshot({ path: `${SHOTS}/2-formulaire.png`, fullPage: true });
  if ((await debordement(p)) > 0) throw new Error("débordement horizontal sur le formulaire");
  await p.getByRole("button", { name: "Créer le salon" }).click();
  await p.getByText(`Salon créé : ${NOM}`).waitFor();
  const texte = await p.locator("main:visible").innerText();
  const m = (role) => texte.match(new RegExp(`${role}\\s+Identifiant : (\\S+)\\s+Mot de passe : (\\S+)`));
  const g = m("Gérante");
  if (!g) throw new Error("identifiants de la gérante introuvables");
  gerante = { id: g[1], mdp: g[2] };
  await p.screenshot({ path: `${SHOTS}/3-cree.png`, fullPage: true });
});

await verifier("un second salon du même nom est refusé avec un message clair", async () => {
  await p.goto(`${BASE}/admin/nouveau`);
  await p.fill('input[name="nom"]', NOM);
  await p.fill('input[name="slug"]', SLUG);
  await p.getByRole("button", { name: "Créer le salon" }).click();
  await p.locator('form [role="alert"]').waitFor();
  if (!(await p.locator('form [role="alert"]').innerText()).includes("existe déjà")) throw new Error("message de doublon absent");
});

await verifier("couleurs illisibles refusées", async () => {
  await p.goto(`${BASE}/admin/nouveau`);
  await p.fill('input[name="nom"]', `Salon Pale ${SUFFIXE}`);
  await p.uncheck('input[name="couleursDefaut"]');
  await p.fill('input[name="marque"]', "#ffff00");
  await p.getByRole("button", { name: "Créer le salon" }).click();
  await p.locator('form [role="alert"]').waitFor();
  if (!(await p.locator('form [role="alert"]').innerText()).includes("pas assez lisibles")) throw new Error("message de contraste absent");
});

await verifier("la page publique du salon montre son logo et rien de La Coquette", async () => {
  const q = await ctx.newPage();
  const res = await q.goto(`${BASE}/s/${SLUG}`);
  if (res.status() !== 200) throw new Error(`statut ${res.status()}`);
  const img = q.locator(`header img[alt="Logo ${NOM}"]`).first();
  await img.waitFor();
  const { w, src } = await img.evaluate((i) => ({ w: i.naturalWidth, src: i.getAttribute("src") }));
  if (!w) throw new Error("le logo ne s'affiche pas");
  if (!src.startsWith(`/s/${SLUG}/logo?v=`)) throw new Error(`adresse inattendue : ${src}`);
  const texte = await q.locator("body").innerText();
  if (/Coquette/i.test(texte)) throw new Error("trace de La Coquette du Faso");
  await q.screenshot({ path: `${SHOTS}/4-page-salon.png` });
  const r = await q.request.get(`${BASE}/s/${SLUG}/logo?v=1`);
  if (r.status() !== 200 || r.headers()["content-type"] !== "image/png") throw new Error(`logo servi : ${r.status()} ${r.headers()["content-type"]}`);
  if ((await q.request.get(`${BASE}/s/introuvable-xyz/logo`)).status() !== 404) throw new Error("logo d'un salon inconnu devrait être 404");
  await q.close();
});

await verifier("la gérante du nouveau salon se connecte et voit son logo", async () => {
  const autre = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const q = await autre.newPage();
  await q.goto(`${BASE}/connexion`);
  await q.fill('input[name="identifiant"]', gerante.id);
  await q.fill('input[name="motDePasse"]', gerante.mdp);
  await q.click('button[type="submit"]');
  await q.waitForURL("**/salon");
  await q.locator(`header img[alt="Logo ${NOM}"]`).waitFor();
  if (!(await q.locator("header").innerText()).includes(NOM)) throw new Error("nom du salon absent de l'en-tête");
  await q.screenshot({ path: `${SHOTS}/5-espace-salon.png` });
  await autre.close();
});

await verifier("réglage : nom changé, logo retiré", async () => {
  await p.goto(`${BASE}/admin`);
  await p.getByRole("link", { name: "Régler" }).first().click();
  await p.waitForURL(/\/admin\/salons\//);
  await p.fill('input[name="nom"]', `${NOM} Bis`);
  await p.getByRole("button", { name: "Retirer le logo" }).click();
  await p.getByRole("button", { name: "Enregistrer" }).click();
  await p.getByRole("status").filter({ hasText: "Enregistré" }).waitFor();
  await p.reload();
  if ((await p.locator('input[name="nom"]').inputValue()) !== `${NOM} Bis`) throw new Error("nom non enregistré");
  if (await p.locator('img[alt="Aperçu du logo"]').count()) throw new Error("le logo est encore là");
  await p.screenshot({ path: `${SHOTS}/6-reglage.png`, fullPage: true });
});

await verifier("nouveau mot de passe : l'ancien est refusé, le nouveau accepté", async () => {
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: /Nouveau mot de passe : la gérante/ }).click();
  await p.getByText("Notez-les maintenant").waitFor();
  const t = await p.locator("main:visible").innerText();
  const m = t.match(/Mot de passe : (\S+)/);
  if (!m) throw new Error("nouveau mot de passe absent");
  const autre = await browser.newContext();
  const q = await autre.newPage();
  await q.goto(`${BASE}/connexion`);
  await q.fill('input[name="identifiant"]', gerante.id);
  await q.fill('input[name="motDePasse"]', gerante.mdp);
  await q.click('button[type="submit"]');
  await q.getByText("incorrect").waitFor();
  await q.fill('input[name="identifiant"]', gerante.id); // React vide le formulaire après une action
  await q.fill('input[name="motDePasse"]', m[1]);
  await q.click('button[type="submit"]');
  await q.waitForURL("**/salon");
  await autre.close();
});

await verifier("déconnexion de l'espace MIA", async () => {
  await p.goto(`${BASE}/admin`);
  await p.getByRole("button", { name: "Se déconnecter" }).click();
  await p.waitForURL("**/admin/connexion");
  await p.goto(`${BASE}/admin`);
  await p.waitForURL("**/admin/connexion");
});

await verifier("aucune erreur dans la console", async () => {
  if (erreurs.length) throw new Error(erreurs.slice(0, 3).join(" | "));
});

await browser.close();
console.log(`\n${ok} réussies, ${ko} en échec`);
process.exit(ko ? 1 : 0);
