import "server-only";
import postgres from "postgres";

/**
 * Client PostgreSQL unique pour tout le serveur.
 * `prepare: false` : compatible avec le pooler de Neon (mode transaction).
 * Les types `date` sont renvoyés en texte AAAA-MM-JJ pour éviter toute conversion de fuseau.
 */
type Sql = postgres.Sql;

const globalForDb = globalThis as unknown as { __miaSql?: Sql };

export function db(): Sql {
  if (!globalForDb.__miaSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL n'est pas configurée.");
    globalForDb.__miaSql = postgres(url, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idle_timeout: 20,
      prepare: false,
      onnotice: () => {},
      types: { date: { to: 1082, from: [1082], serialize: (v: string) => v, parse: (v: string) => v } },
    });
  }
  return globalForDb.__miaSql;
}

/** Réservé aux tests d'intégration. */
export async function __fermerDbPourTests() {
  await globalForDb.__miaSql?.end();
  globalForDb.__miaSql = undefined;
}
