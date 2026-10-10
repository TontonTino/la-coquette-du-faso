// Crée le salon et les comptes de la gérante et de la secrétaire (une seule fois).
//
// Usage (PowerShell) :
//   $env:DATABASE_URL="..."; $env:MOT_DE_PASSE_GERANTE="..."; $env:MOT_DE_PASSE_SECRETAIRE="..."
//   npm run db:seed            # comptes seulement
//   npm run db:seed -- --demo  # + 20 coiffeuses fictives (développement uniquement)
//
// Les mots de passe ne sont jamais écrits dans le code ni dans Git.
import postgres from "postgres";
import { hashPassword, passwordProblem } from "../src/server/password.ts";

const url = process.env.DATABASE_URL;
const pwdGerante = process.env.MOT_DE_PASSE_GERANTE ?? "";
const pwdSecretaire = process.env.MOT_DE_PASSE_SECRETAIRE ?? "";
const demo = process.argv.includes("--demo");

for (const [label, pwd] of [["MOT_DE_PASSE_GERANTE", pwdGerante], ["MOT_DE_PASSE_SECRETAIRE", pwdSecretaire]] as const) {
  const problem = passwordProblem(pwd);
  if (!url || problem) {
    console.error(!url ? "DATABASE_URL manquant." : `${label} : ${problem}`);
    process.exit(1);
  }
}

const DEMO_COIFFEUSES: [string, number[]][] = [
  ["Awa K.", [1]], ["Fatim O.", [1]], ["Mariam S.", [2]], ["Aminata Z.", [2]], ["Salimata B.", [3]],
  ["Rasmata C.", [3]], ["Alima D.", [4]], ["Habibou T.", [4]], ["Assita N.", [5]], ["Kadi Y.", [5]],
  ["Nafi P.", [1, 2]], ["Bintou L.", [2, 3]], ["Safiatou G.", [3, 4]], ["Ramatou I.", [4, 5]], ["Adja M.", [1]],
  ["Djeneba F.", [2]], ["Clarisse H.", [6]], ["Estelle R.", [3]], ["Pélagie V.", [4]], ["Edwige A.", [6]],
];

/** Neon ajoute « channel_binding=require », que le pilote « postgres » refuse : on le retire (sslmode=require reste). */
function nettoyerUrl(url: string): string {
  const u = new URL(url);
  u.searchParams.delete("channel_binding");
  return u.toString();
}

// Types de coiffure et spécialités fictifs (démo) : la gérante saisira les vrais dans l'onglet Équipe.
const DEMO_TYPES = ["Tresses", "Braids", "Nattes collées", "Tissage", "Perruque", "Défrisage & brushing"];
const specialitesDemo = (i: number) => [DEMO_TYPES[i % 6], DEMO_TYPES[(i + 2) % 6], ...(i % 3 === 0 ? [DEMO_TYPES[(i + 4) % 6]] : [])];

const sql = postgres(nettoyerUrl(url!), { max: 1, onnotice: () => {} });
try {
  const existing = await sql`SELECT id FROM salon LIMIT 1`;
  if (existing.length > 0) {
    console.log("Un salon existe déjà : rien n'a été modifié.");
  } else {
    await sql.begin(async (tx) => {
      const [salon] = await tx`INSERT INTO salon (nom) VALUES ('La Coquette du Faso') RETURNING id`;
      await tx`INSERT INTO utilisateur (salon_id, identifiant, nom, role, mot_de_passe_hash) VALUES
        (${salon.id}, 'gerante', 'Gérante', 'gerante', ${await hashPassword(pwdGerante)}),
        (${salon.id}, 'secretaire', 'Secrétaire', 'secretaire', ${await hashPassword(pwdSecretaire)})`;
      if (demo) {
        const typeId = new Map<string, string>();
        for (const nom of DEMO_TYPES) {
          const [t] = await tx`INSERT INTO categorie (salon_id, nom) VALUES (${salon.id}, ${nom}) RETURNING id`;
          typeId.set(nom, t.id);
        }
        for (const [i, [nom, conges]] of DEMO_COIFFEUSES.entries()) {
          const [c] = await tx`INSERT INTO coiffeuse (salon_id, nom, jours_conge) VALUES (${salon.id}, ${nom}, ${conges}) RETURNING id`;
          for (const type of specialitesDemo(i)) {
            await tx`INSERT INTO competence (coiffeuse_id, categorie_id, salon_id) VALUES (${c.id}, ${typeId.get(type)!}, ${salon.id})`;
          }
        }
      }
    });
    console.log(`✔ Salon créé, comptes « gerante » et « secretaire »${demo ? ", 6 types de coiffure et 20 coiffeuses fictives" : ""}.`);
  }
} catch (error) {
  console.error("Échec :", (error as Error).message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
