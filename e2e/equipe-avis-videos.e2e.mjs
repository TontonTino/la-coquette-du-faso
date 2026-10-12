/**
 * Parcours de bout en bout : photos de l'équipe, services ongles, coordonnées du salon, vidéos courtes
 * et avis des clientes (notes sur 5 étoiles). Format téléphone (390 px).
 *
 * Prérequis : base initialisée avec `npm run db:seed -- --demo`, application lancée (`npm start -- -p 3200`).
 * Usage : BASE_URL=http://localhost:3200 MDP_GERANTE=... PHOTO=chemin.png VIDEO=chemin.webm npm run test:e2e:equipe
 *   PHOTO : une image (portrait de coiffeuse) ; VIDEO : une courte vidéo WebM lisible par Chromium.
 */
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const SHOTS = process.env.SHOTS ?? "e2e/captures/equipe";
const { MDP_GERANTE, PHOTO, VIDEO } = process.env;
if (!MDP_GERANTE || !PHOTO || !VIDEO) {
  console.error("MDP_GERANTE, PHOTO et VIDEO sont requis.");
  process.exit(1);
}

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: process.env.BROWSER ?? "msedge" },
);
const erreurs = [];
async function telephone() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" });
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && erreurs.push(m.text()));
  p.on("pageerror", (e) => erreurs.push(e.message));
  return { ctx, p };
}
const { p: gerante } = await telephone();
const { ctx: ctxCliente, p: cliente } = await telephone();

// Les vidéos de l'essai sont servies depuis une fausse adresse https (aucun accès réseau réel).
const octetsVideo = await readFile(VIDEO);
await ctxCliente.route("https://videos.exemple.test/**", (route) =>
  route.fulfill({ status: 200, contentType: "video/webm", body: octetsVideo, headers: { "Accept-Ranges": "none" } }),
);

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
    await gerante.screenshot({ path: `${SHOTS}/echec-${ok + ko}-gerante.png`, fullPage: true }).catch(() => {});
    await cliente.screenshot({ path: `${SHOTS}/echec-${ok + ko}-cliente.png`, fullPage: true }).catch(() => {});
  }
}
const visible = (p) => p.locator("main:visible").innerText();
async function largeurOk(p, nom) {
  const [sw, cw] = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  if (sw > cw) throw new Error(`${nom} : défilement horizontal (${sw}px > ${cw}px)`);
}
const capture = (p, nom) => p.screenshot({ path: `${SHOTS}/${nom}.png`, fullPage: true });
const SUFFIXE = Date.now().toString(36).slice(-4);
const TEL = `7${String(Date.now()).slice(-7)}`;

await verifier("Connexion de la gérante", async () => {
  await gerante.goto(`${BASE}/connexion`);
  await gerante.getByLabel("Identifiant").fill("gerante");
  await gerante.getByLabel("Mot de passe").fill(MDP_GERANTE);
  await gerante.getByRole("button", { name: "Se connecter" }).click();
  await gerante.waitForURL(`${BASE}/salon`);
});

let nomPhoto = "";
await verifier("La gérante ajoute la photo d'une coiffeuse", async () => {
  await gerante.goto(`${BASE}/salon/equipe`);
  await gerante.getByRole("heading", { name: "Équipe", exact: true }).waitFor();
  await largeurOk(gerante, "équipe");
  await capture(gerante, "01-equipe");
  await gerante.getByRole("button", { name: "Modifier", exact: true }).first().click();
  nomPhoto = (await gerante.getByLabel("Nom", { exact: true }).last().inputValue()).trim();
  if (!nomPhoto) throw new Error("nom de la coiffeuse introuvable");
  await gerante.locator('input[type="file"]').last().setInputFiles(PHOTO);
  await gerante.getByAltText(nomPhoto).last().waitFor();
  await gerante.getByRole("button", { name: "Retirer la photo" }).waitFor();
  await capture(gerante, "02-equipe-photo");
  await gerante.getByRole("button", { name: "Enregistrer", exact: true }).last().click();
  await gerante.getByText("Fiche enregistrée").waitFor();
});

await verifier("L'accueil montre « Notre équipe » avec la photo, et les coordonnées du salon", async () => {
  await cliente.goto(`${BASE}/`);
  await cliente.getByRole("heading", { name: "Notre équipe" }).waitFor();
  const photo = cliente.getByRole("img", { name: nomPhoto, exact: true }).first();
  await photo.waitFor();
  await photo.scrollIntoViewIfNeeded();
  await cliente.waitForFunction((n) => [...document.images].some((i) => i.alt === n && i.complete && i.naturalWidth > 0 && i.src.includes("/equipe/")), nomPhoto);
  await cliente.getByRole("heading", { name: "Nous trouver" }).waitFor();
  const t = await visible(cliente);
  for (const attendu of ["6 h 30", "23 h", "1200 logements", "64 15 00 20", "coquettedufaso64@gmail.com"]) {
    if (!t.includes(attendu)) throw new Error(`« ${attendu} » absent de l'accueil`);
  }
  const tel = await cliente.getByRole("link", { name: "Appeler" }).getAttribute("href");
  if (tel !== "tel:+22664150020") throw new Error(`lien téléphone inattendu : ${tel}`);
  const carte = await cliente.getByRole("link", { name: "Itinéraire" }).getAttribute("href");
  if (!carte.startsWith("https://www.google.com/maps")) throw new Error(`itinéraire inattendu : ${carte}`);
  const mail = await cliente.getByRole("link", { name: "Écrire", exact: true }).getAttribute("href");
  if (mail !== "mailto:coquettedufaso64@gmail.com") throw new Error(`lien email inattendu : ${mail}`);
  await largeurOk(cliente, "accueil");
  await capture(cliente, "03-accueil-equipe");
});

await verifier("Services : manucure et pédicure sont proposées, avec leurs spécialistes seulement", async () => {
  await cliente.goto(`${BASE}/`);
  await cliente.getByRole("heading", { name: "Choisissez votre service" }).waitFor();
  for (const n of ["Manucure", "Pédicure"]) await cliente.getByRole("link", { name: n, exact: true }).waitFor();
  await cliente.goto(`${BASE}/reserver`);
  // Le formulaire arrive après l'enveloppe de la page (rendu progressif) : on l'attend avant de compter.
  await cliente.getByRole("group", { name: "Coiffeuse souhaitée" }).waitFor();
  const tous = await cliente.getByRole("group", { name: "Coiffeuse souhaitée" }).getByRole("button").count();
  await cliente.getByRole("button", { name: "Ongles", exact: true }).click();
  await cliente.getByRole("button", { name: "Manucure", exact: true }).click();
  const ongles = await cliente.getByRole("group", { name: "Coiffeuse souhaitée" }).getByRole("button").count();
  if (!(ongles >= 2 && ongles < tous)) throw new Error(`spécialistes ongles : ${ongles} (toutes : ${tous})`);
  await cliente.getByRole("heading", { name: "Une personne en particulier ?" }).waitFor();
  await largeurOk(cliente, "réservation ongles");
  await capture(cliente, "04-reserver-ongles");
  // Retour à la coiffure : les types de coiffure reviennent
  await cliente.getByRole("button", { name: "Coiffure", exact: true }).click();
  await cliente.getByRole("button", { name: "Tresses", exact: true }).waitFor();
});

await verifier("Une coiffeuse choisie depuis « Notre équipe » est présélectionnée", async () => {
  await cliente.goto(`${BASE}/`);
  await cliente.getByRole("heading", { name: "Notre équipe" }).waitFor();
  await cliente.locator('a[href^="/reserver?coiffeuse="]').first().click();
  await cliente.waitForURL(/\/reserver\?coiffeuse=/);
  const groupe = cliente.getByRole("group", { name: "Coiffeuse souhaitée" });
  await groupe.waitFor();
  const choisie = groupe.getByRole("button", { pressed: true });
  if ((await choisie.count()) !== 1) throw new Error("aucune coiffeuse présélectionnée");
  if ((await choisie.first().getAttribute("data-nom")) === "Peu importe") {
    // Coiffeuse en congé ce jour-là (selon le jour où le test tourne) : la cliente doit en être informée, pas laissée sans explication.
    await cliente.getByRole("status").filter({ hasText: /n.est pas proposée/ }).waitFor({ timeout: 5000 });
  }
});

await verifier("La gérante ajoute deux vidéos (adresses https) liées à un modèle", async () => {
  await gerante.goto(`${BASE}/salon/modeles`);
  await gerante.getByRole("heading", { name: /Vidéos courtes/ }).waitFor();
  // Un modèle du catalogue à présenter (il en faut un pour le lien « Je veux cette coiffure »).
  const photoModele = PHOTO;
  await gerante.getByRole("button", { name: "+ Ajouter un modèle" }).click();
  await gerante.locator('input[type="file"]').setInputFiles(photoModele);
  await gerante.getByAltText("Aperçu du modèle").waitFor();
  await gerante.getByLabel("Nom du modèle").fill(`Vidéo modèle ${SUFFIXE}`);
  await gerante.getByRole("button", { name: "Ajouter au catalogue" }).click();
  await gerante.getByText(`Vidéo modèle ${SUFFIXE}`).first().waitFor();
  for (const [i, titre] of [`Nattes ${SUFFIXE}`, `Tresses ${SUFFIXE}`].entries()) {
    await gerante.getByRole("button", { name: "+ Ajouter une vidéo" }).click();
    await gerante.getByText(/envoi depuis le téléphone n.est pas encore activé/).waitFor();
    await gerante.getByLabel("Adresse de la vidéo (https://…)").fill(`https://videos.exemple.test/v${i}.webm`);
    await gerante.getByLabel("Titre", { exact: true }).fill(titre);
    if (i === 0) await gerante.getByLabel("Modèle présenté").selectOption({ label: `Vidéo modèle ${SUFFIXE}` });
    if (i === 0) await capture(gerante, "05-video-formulaire");
    await gerante.getByRole("button", { name: "Ajouter la vidéo" }).click();
    await gerante.getByText(titre, { exact: true }).waitFor();
  }
  await largeurOk(gerante, "vidéos");
  await capture(gerante, "06-videos-liste");
});

await verifier("Une adresse non sécurisée est refusée", async () => {
  await gerante.getByRole("button", { name: "+ Ajouter une vidéo" }).click();
  await gerante.getByLabel("Adresse de la vidéo (https://…)").fill("http://exemple.test/v.mp4");
  await gerante.getByLabel("Titre", { exact: true }).fill("Pas sûre");
  await gerante.getByRole("button", { name: "Ajouter la vidéo" }).click();
  await gerante.getByText(/doit commencer par https/).waitFor();
  await gerante.getByRole("button", { name: "Annuler" }).click();
});

// Simule un balayage du doigt (événements tactiles) : dx > 0 vers la droite, dy < 0 vers le haut.
async function balayer(p, selecteur, dx, dy) {
  await p.evaluate(
    ([sel, dx, dy]) => {
      const cible = document.querySelector(sel);
      const r = cible.getBoundingClientRect();
      const x0 = Math.max(60, Math.min(r.left + r.width / 2, window.innerWidth - 120));
      const y0 = r.top + Math.min(r.height / 2, 120);
      const touche = (x, y) => new Touch({ identifier: 1, target: cible, clientX: x, clientY: y });
      const tire = (type, t, touches) => cible.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: [t] }));
      const t0 = touche(x0, y0);
      tire("touchstart", t0, [t0]);
      const t1 = touche(x0 + dx, y0 + dy);
      tire("touchmove", t1, [t1]);
      tire("touchend", t1, []);
    },
    [selecteur, dx, dy],
  );
}
const PISTE = "ul[aria-label='Vidéos des coiffures']";

await verifier("Accueil : aucune vidéo dans la page, mais un onglet « Vidéos » sur le bord droit", async () => {
  await cliente.goto(`${BASE}/`);
  await cliente.getByRole("link", { name: "Vidéos", exact: true }).waitFor();
  if ((await cliente.locator("video").count()) !== 0) throw new Error("des vidéos sont affichées sur l'accueil");
  if ((await cliente.getByRole("heading", { name: "Voyez le résultat en vidéo" }).count()) !== 0) throw new Error("ancienne section vidéos présente");
  await largeurOk(cliente, "accueil");
});

await verifier("Un balayage vers la gauche sur l'accueil ouvre la page des vidéos", async () => {
  await balayer(cliente, "h1", -160, 10);
  await cliente.waitForURL(/\/videos$/, { timeout: 10000 });
});

await verifier("Vidéos : la première se lance seule, sans le son, plein écran ; la suivante attend", async () => {
  const liste = cliente.getByRole("list", { name: "Vidéos des coiffures" });
  await liste.waitFor();
  if ((await liste.getByRole("listitem").count()) < 2) throw new Error("moins de deux vidéos");
  await cliente.waitForFunction((sel) => {
    const v = document.querySelectorAll(`${sel} video`);
    return v.length === 1 && !v[0].paused && v[0].currentTime > 0;
  }, PISTE, { timeout: 15000 });
  const muet = await cliente.evaluate((sel) => document.querySelector(`${sel} video`).muted, PISTE);
  if (!muet) throw new Error("la vidéo démarre avec le son");
  const [h, vh] = await cliente.evaluate((sel) => [document.querySelector(`${sel} > li`).getBoundingClientRect().height, window.innerHeight], PISTE);
  if (Math.abs(h - vh) > 2) throw new Error(`la vidéo ne remplit pas l'écran (${h} px sur ${vh} px)`);
  await largeurOk(cliente, "vidéos");
  await cliente.screenshot({ path: `${SHOTS}/07-videos-plein-ecran.png` });
});

await verifier("En balayant vers le haut, la vidéo suivante se lance et la précédente s'arrête", async () => {
  await cliente.locator(PISTE).evaluate((el) => el.scrollTo({ top: el.clientHeight, behavior: "instant" }));
  await cliente.waitForFunction((sel) => {
    const v = [...document.querySelectorAll(`${sel} video`)];
    return v.length === 2 && v[0].paused && !v[1].paused;
  }, PISTE, { timeout: 15000 });
  await cliente.screenshot({ path: `${SHOTS}/08-videos-suivante.png` });
});

await verifier("Le son s'active, reste actif sur l'autre vidéo, puis se coupe", async () => {
  await cliente.getByRole("button", { name: "Activer le son" }).click();
  await cliente.getByRole("button", { name: "Couper le son" }).waitFor();
  await cliente.waitForFunction((sel) => document.querySelectorAll(`${sel} video`)[1].muted === false, PISTE, { timeout: 5000 });
  await cliente.locator(PISTE).evaluate((el) => el.scrollTo({ top: 0, behavior: "instant" }));
  await cliente.waitForFunction((sel) => {
    const v = [...document.querySelectorAll(`${sel} video`)];
    return !v[0].paused && v[0].muted === false && v[1].paused;
  }, PISTE, { timeout: 15000 });
  await cliente.getByRole("button", { name: "Couper le son" }).click();
  await cliente.getByRole("button", { name: "Activer le son" }).waitFor();
});

await verifier("Un balayage vers la droite ramène à l'accueil, et plus aucune vidéo ne joue", async () => {
  await balayer(cliente, `${PISTE} > li`, 160, 8);
  await cliente.waitForURL(`${BASE}/`, { timeout: 10000 });
  await cliente.waitForFunction(() => [...document.querySelectorAll("video")].every((v) => v.paused), null, { timeout: 5000 });
});

await verifier("Notre équipe : les photos sont rondes ; « Tout voir » ouvre la bibliothèque des réalisations", async () => {
  await cliente.goto(`${BASE}/`);
  await cliente.getByRole("heading", { name: "Notre équipe" }).waitFor();
  const formes = await cliente.evaluate(() =>
    [...document.querySelectorAll("[aria-labelledby='titre-equipe'] ul img, [aria-labelledby='titre-equipe'] ul [role='img']")].map((e) => {
      const r = e.getBoundingClientRect();
      return Math.abs(r.width - r.height) < 1 && parseFloat(getComputedStyle(e).borderTopLeftRadius) >= r.width / 2 - 1;
    }),
  );
  if (formes.length === 0 || formes.includes(false)) throw new Error("une photo de coiffeuse n'est pas ronde");
  await cliente.getByRole("link", { name: "Tout voir" }).click();
  await cliente.waitForURL(/\/realisations$/);
  await cliente.getByRole("heading", { name: "Nos réalisations" }).waitFor();
  // Les photos arrivent après l'enveloppe de la page (rendu progressif) : on les attend.
  await cliente.locator("main:visible ul img").first().waitFor({ timeout: 10000 }).catch(() => {
    throw new Error("aucune photo dans la bibliothèque");
  });
  await largeurOk(cliente, "réalisations");
});

await verifier("« Je veux cette coiffure » ouvre la réservation avec le modèle choisi", async () => {
  await cliente.goto(`${BASE}/videos`);
  const lien = cliente.getByRole("link", { name: "Je veux cette coiffure" }).first();
  await lien.waitFor();
  await lien.click();
  await cliente.waitForURL(/\/reserver\?modele=/);
  const choisi = cliente.getByRole("button", { name: new RegExp(`Vidéo modèle ${SUFFIXE}`) });
  if ((await choisi.getAttribute("aria-pressed")) !== "true") throw new Error("modèle non présélectionné");
});

let reference = "";
let coiffeuseNotee = "";
const NOM_CLIENTE = `Prisca ${SUFFIXE}`;
await verifier("La secrétaire termine une prestation et prépare la demande d'avis sur WhatsApp", async () => {
  await gerante.goto(`${BASE}/salon`);
  await gerante.getByRole("button", { name: "+ Sans rendez-vous" }).click();
  await gerante.getByLabel("Nom de la cliente").fill(NOM_CLIENTE);
  await gerante.getByLabel("Téléphone (facultatif)").fill(TEL);
  await gerante.getByRole("button", { name: "Ajouter à la file d'attente" }).click();
  await gerante.getByText(NOM_CLIENTE, { exact: true }).waitFor();
  const attente = gerante.locator("div.rounded-xl", { hasText: NOM_CLIENTE }).filter({ has: gerante.getByRole("button", { name: "Démarrer" }) });
  await attente.getByRole("button", { name: "Démarrer" }).click();
  const premiere = gerante.getByRole("button", { pressed: false }).filter({ hasText: /^[A-ZÉ][a-zéèï]+ [A-Z]\.$/ }).first();
  await premiere.waitFor();
  await premiere.click();
  await gerante.getByRole("button", { name: "1 h", exact: true }).click();
  await gerante.getByRole("button", { name: "Démarrer la prestation" }).click();
  const enCours = gerante.locator("div.rounded-xl", { hasText: NOM_CLIENTE }).filter({ has: gerante.getByRole("button", { name: "Terminer" }) });
  await enCours.getByRole("button", { name: "Terminer" }).click();
  await gerante.getByLabel("Prix payé (FCFA)").fill("8000");
  await gerante.getByRole("button", { name: "Valider et libérer les coiffeuses" }).click();
  await gerante.getByRole("button", { name: "+ Rendez-vous" }).waitFor();
  await gerante.getByRole("heading", { name: /Terminées aujourd'hui/ }).waitFor();
  await capture(gerante, "09-terminees");
  const terminee = gerante.locator("div.rounded-xl", { hasText: NOM_CLIENTE }).filter({ has: gerante.getByRole("button", { name: "Demander son avis" }) });
  await terminee.getByRole("button", { name: "Demander son avis" }).click();
  const lien = gerante.getByRole("link", { name: "Envoyer sur WhatsApp" });
  await lien.waitFor();
  const href = decodeURIComponent(await lien.getAttribute("href"));
  if (!href.startsWith(`https://wa.me/226${TEL}`)) throw new Error(`numéro inattendu : ${href.slice(0, 40)}`);
  const m = href.match(/\/demande\/([A-Z2-9]{8})/);
  if (!m) throw new Error("lien d'avis absent du message");
  reference = m[1];
  await capture(gerante, "10-demander-avis");
});

await verifier("La cliente note sa coiffeuse (4 étoiles) et peut revenir sur son avis", async () => {
  await cliente.goto(`${BASE}/demande/${reference}`);
  await cliente.getByRole("heading", { name: "Merci de votre visite !" }).waitFor();
  await cliente.getByRole("heading", { name: "Comment était votre coiffure ?" }).waitFor();
  const groupe = cliente.getByRole("radiogroup").first();
  coiffeuseNotee = ((await groupe.getAttribute("aria-label")) ?? "").replace("Note pour ", "");
  if (!coiffeuseNotee) throw new Error("coiffeuse à noter introuvable");
  await largeurOk(cliente, "notation");
  await capture(cliente, "11-avis-vide");
  await groupe.getByRole("radio", { name: "4 étoiles sur 5" }).click();
  await cliente.getByText("Très bien").waitFor();
  await cliente.getByLabel(/Un mot pour le salon/).fill("Très belle finition");
  await capture(cliente, "12-avis-4-etoiles");
  await cliente.getByRole("button", { name: "Envoyer mon avis" }).click();
  await cliente.getByText("Merci ! Votre avis est enregistré.").waitFor();
  await cliente.reload();
  await cliente.getByText("Merci ! Votre avis est enregistré.").waitFor();
  if ((await cliente.getByRole("radio", { name: "4 étoiles sur 5" }).getAttribute("aria-checked")) !== "true") throw new Error("la note n'est pas conservée");
  // Elle change d'avis : 5 étoiles
  await cliente.getByRole("radio", { name: "5 étoiles sur 5" }).click();
  await cliente.getByLabel(/Un mot pour le salon/).fill("Finalement parfaite");
  await cliente.getByRole("button", { name: "Envoyer mon avis" }).click();
  await cliente.getByText("Merci ! Votre avis est enregistré.").waitFor();
});

await verifier("Une référence de prestation non terminée ne permet pas de noter", async () => {
  await cliente.goto(`${BASE}/reserver`);
  await cliente.getByLabel(/^Votre nom/).fill(`Aïcha ${SUFFIXE}`);
  await cliente.getByLabel("Votre numéro WhatsApp").fill(`6${String(Date.now()).slice(-7)}`);
  await cliente.getByRole("button", { name: "Envoyer ma demande" }).click();
  await cliente.waitForURL(/\/demande\/[A-Z2-9]{8}$/);
  const t = await visible(cliente);
  if (t.includes("Comment était votre coiffure")) throw new Error("la notation est proposée avant la prestation");
});

await verifier("La gérante lit l'avis (note et commentaire) et la moyenne de la coiffeuse", async () => {
  await gerante.goto(`${BASE}/salon/equipe`);
  await gerante.getByRole("heading", { name: /Avis récents des clientes/ }).waitFor();
  const t = await visible(gerante);
  for (const attendu of [coiffeuseNotee, "5/5", "« Finalement parfaite »"]) {
    if (!t.includes(attendu)) throw new Error(`« ${attendu} » absent de la page Équipe`);
  }
  if (t.includes("Très belle finition")) throw new Error("l'ancien commentaire est encore affiché (l'avis doit être remplacé)");
  await capture(gerante, "13-equipe-avis");
});

await verifier("Aucune erreur dans la console", async () => {
  const vraies = erreurs.filter((e) => !/favicon|status of 404|Failed to load resource/.test(e));
  if (vraies.length) throw new Error(vraies.join(" | "));
});

await browser.close();
console.log(`\n${ok}/${ok + ko} vérifications réussies (référence ${reference})`);
process.exit(ko ? 1 : 0);
