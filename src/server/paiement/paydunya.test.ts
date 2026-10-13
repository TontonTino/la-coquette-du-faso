import { describe, expect, it, vi } from "vitest";
import { configPaydunya, creerFacture, ErreurPaiement, etatFacture, montantAcompte } from "./paydunya";

const CLES = { PAYDUNYA_MASTER_KEY: "MASTER", PAYDUNYA_PRIVATE_KEY: "PRIVEE", PAYDUNYA_TOKEN: "JETON" };
const reponse = (corps: unknown) => vi.fn(async () => new Response(JSON.stringify(corps), { status: 200 })) as unknown as typeof fetch;
const facture = { montant: 2000, description: "Acompte", nomBoutique: "Salon", reference: "ABCDEFGH", retourUrl: "https://s.test/demande/ABCDEFGH", annulationUrl: "https://s.test/demande/ABCDEFGH" };

describe("configuration PayDunya", () => {
  it("est éteinte sans les trois clés", () => {
    expect(configPaydunya({})).toBeNull();
    expect(configPaydunya({ ...CLES, PAYDUNYA_TOKEN: " " })).toBeNull();
  });
  it("utilise le bac à sable par défaut, la production seulement si demandé", () => {
    expect(configPaydunya(CLES)).toMatchObject({ mode: "test", base: "https://app.paydunya.com/sandbox-api/v1" });
    expect(configPaydunya({ ...CLES, PAYDUNYA_MODE: "prod" })?.mode).toBe("test");
    expect(configPaydunya({ ...CLES, PAYDUNYA_MODE: "production" })).toMatchObject({ mode: "production", base: "https://app.paydunya.com/api/v1" });
  });
  it("montant d'acompte borné, 0 = éteint", () => {
    expect(montantAcompte({ ACOMPTE_FCFA: "2000" })).toBe(2000);
    for (const v of [undefined, "", "abc", "10", "2000.5", "999999"]) expect(montantAcompte({ ACOMPTE_FCFA: v })).toBe(0);
  });
});

describe("creerFacture", () => {
  const c = configPaydunya(CLES)!;
  it("envoie les clés en en-têtes et renvoie l'adresse et le jeton", async () => {
    const appel = reponse({ response_code: "00", response_text: "https://paydunya.com/checkout/invoice/xyz", token: "xyz" });
    expect(await creerFacture(c, facture, appel)).toEqual({ url: "https://paydunya.com/checkout/invoice/xyz", jeton: "xyz" });
    const [url, init] = (appel as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create");
    expect(init.headers).toMatchObject({ "PAYDUNYA-MASTER-KEY": "MASTER", "PAYDUNYA-PRIVATE-KEY": "PRIVEE", "PAYDUNYA-TOKEN": "JETON" });
    expect(JSON.parse(init.body as string)).toMatchObject({ invoice: { total_amount: 2000 }, custom_data: { reference: "ABCDEFGH" }, actions: { return_url: facture.retourUrl } });
  });
  it("refuse une réponse en erreur, sans clé dans le message", async () => {
    const e = await creerFacture(c, facture, reponse({ response_code: "1001", response_text: "Invalid Masterkey Specified" })).catch((x) => x);
    expect(e).toBeInstanceOf(ErreurPaiement);
    expect(e.message).not.toContain("MASTER");
  });
  it("refuse une adresse de paiement non https", async () => {
    await expect(creerFacture(c, facture, reponse({ response_code: "00", response_text: "http://evil.test", token: "t" }))).rejects.toThrow(/inattendue/);
    await expect(creerFacture(c, facture, reponse({ response_code: "00", response_text: "javascript:alert(1)", token: "t" }))).rejects.toThrow(/inattendue/);
  });
  it("traduit une panne réseau", async () => {
    const panne = vi.fn(async () => { throw new Error("réseau"); }) as unknown as typeof fetch;
    await expect(creerFacture(c, facture, panne)).rejects.toThrow(/injoignable/);
  });
});

describe("etatFacture", () => {
  const c = configPaydunya({ ...CLES, PAYDUNYA_MODE: "production" })!;
  it("lit statut, montant et référence", async () => {
    const appel = reponse({ response_code: "00", status: "completed", invoice: { total_amount: "2000" }, custom_data: { reference: "ABCDEFGH" } });
    expect(await etatFacture(c, "a/b", appel)).toEqual({ statut: "completed", montant: 2000, reference: "ABCDEFGH" });
    expect((appel as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("https://app.paydunya.com/api/v1/checkout-invoice/confirm/a%2Fb");
  });
  it("un statut inconnu reste en attente ; une réponse illisible lève une erreur", async () => {
    expect((await etatFacture(c, "j", reponse({ response_code: "00", status: "???" }))).statut).toBe("pending");
    await expect(etatFacture(c, "j", reponse({ response_code: "1002" }))).rejects.toThrow(ErreurPaiement);
  });
});
