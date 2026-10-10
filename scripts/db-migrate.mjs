// Applique les migrations SQL de db/migrations dans l'ordre, une seule fois chacune.
// Usage : DATABASE_URL=... node scripts/db-migrate.mjs
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✘ DATABASE_URL manquant : indiquez l'adresse de la base (voir docs/09-deployment.md).");
  process.exit(1);
}
if (!/^postgres(ql)?:\/\//.test(url)) {
  console.error("✘ DATABASE_URL n'est pas une adresse PostgreSQL : elle doit commencer par postgresql://");
  console.error("  (Remplacez bien le texte d'exemple par votre vraie adresse Neon.)");
  process.exit(1);
}

/** Neon ajoute « channel_binding=require », que le pilote « postgres » refuse : on le retire (sslmode=require reste). */
function nettoyerUrl(url) {
  const u = new URL(url);
  u.searchParams.delete("channel_binding");
  return u.toString();
}

const dir = fileURLToPath(new URL("../db/migrations/", import.meta.url));
// prepare: false : compatible avec le pooler de Neon (adresse « -pooler » utilisée par Vercel).
const sql = postgres(nettoyerUrl(url), { max: 1, prepare: false, onnotice: () => {} });

try {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (nom text PRIMARY KEY, appliquee_le timestamptz NOT NULL DEFAULT now())`;
  const done = new Set((await sql`SELECT nom FROM schema_migrations`).map((r) => r.nom));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const body = await readFile(new URL(file, `file://${dir}`), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (nom) VALUES (${file})`;
    });
    console.log(`✔ ${file}`);
    applied++;
  }
  console.log(applied ? `${applied} migration(s) appliquée(s).` : "Base déjà à jour.");
} catch (error) {
  console.error("Échec de la migration :", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
