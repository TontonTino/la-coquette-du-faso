import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { STORAGE_KEY, __resetStoreForTests, demoActions } from "@/store/demo-store";
import type { DemoState } from "@/lib/types";
import { BookingWizard } from "./BookingWizard";

let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/reserver",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Vendredi 9 octobre 2026, 10 h à Ouagadougou.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-10-09T10:00:00Z"));
afterAll(() => vi.useRealTimers());

const SCENARIO = "prestation=tresses-fulani&coiffeuse=aicha-k&date=2026-12-23&heure=15:30";
const nb = (s: string | null) => (s ?? "").replace(/ /g, " ");
/** Nom accessible d'un horaire, les espaces étant insécables (« 15 h 30 »). */
const slot = (label: string) => new RegExp(`^${label.replace(/ /g, "\\s")}$`);

function renderWizard(query = SCENARIO) {
  search = query;
  return render(
    <ToastProvider>
      <BookingWizard />
    </ToastProvider>,
  );
}

function stored(): DemoState {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
}

async function fillDetailsAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /continuer/i }));
  await user.type(screen.getByLabelText("Nom et prénom"), "Cliente Démo");
  await user.type(screen.getByLabelText("Téléphone"), "70 00 00 00");
  await user.click(screen.getByRole("button", { name: "Voir le récapitulatif" }));
}

beforeEach(() => {
  __resetStoreForTests();
  window.localStorage.clear();
});

describe("parcours de réservation", () => {
  it("réalise le scénario principal de bout en bout", async () => {
    const user = userEvent.setup();
    renderWizard();

    // Le créneau du scénario est pré-sélectionné.
    expect(screen.getByRole("button", { name: slot("15 h 30"), pressed: true })).toBeInTheDocument();
    expect(nb(screen.getByRole("button", { name: /continuer/i }).textContent)).toContain("15 h 30");

    // Validation des coordonnées.
    await user.click(screen.getByRole("button", { name: /continuer/i }));
    await user.click(screen.getByRole("button", { name: "Voir le récapitulatif" }));
    expect(screen.getByText(/Indiquez votre nom/)).toBeInTheDocument();
    expect(screen.getByText(/Indiquez un numéro/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nom et prénom"), "Cliente Démo");
    await user.type(screen.getByLabelText("Téléphone"), "1234");
    await user.click(screen.getByRole("button", { name: "Voir le récapitulatif" }));
    expect(screen.getByText(/8 chiffres attendus/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Téléphone"));
    await user.type(screen.getByLabelText("Téléphone"), "70 00 00 00");
    await user.click(screen.getByRole("button", { name: "Voir le récapitulatif" }));

    // Récapitulatif.
    const recap = nb(document.body.textContent);
    expect(recap).toContain("Tresses Fulani");
    expect(recap).toContain("avec Aïcha K.");
    expect(recap).toContain("Mercredi 23 décembre 2026");
    expect(recap).toContain("15 h 30 – 18 h");
    expect(recap).toContain("2 h 30");
    expect(recap).toContain("15 000 FCFA");

    await user.click(screen.getByRole("button", { name: "Confirmer la réservation" }));

    // Confirmation visible + persistance.
    expect(screen.getByRole("heading", { name: /Merci, Cliente/ })).toBeInTheDocument();
    const saved = stored().appointments.filter((a) => a.date === "2026-12-23" && a.stylistId === "aicha-k" && a.start === "15:30");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ clientName: "Cliente Démo", priceFcfa: 15000, durationMin: 150, status: "en_attente" });
    expect(stored().myAppointmentIds).toContain(saved[0].id);
    expect(screen.getByText(saved[0].reference)).toBeInTheDocument();
  });

  it("ne propose plus le créneau déjà réservé et suggère des alternatives", async () => {
    const user = userEvent.setup();
    const first = demoActions.book({ serviceId: "tresses-fulani", stylistId: "aicha-k", date: "2026-12-23", start: "15:30", clientName: "Awa", clientPhone: "70000000" });
    expect(first.ok).toBe(true);

    renderWizard();
    expect(screen.queryByRole("button", { name: slot("15 h 30") })).not.toBeInTheDocument();
    expect(nb(screen.getByRole("alert").textContent)).toContain("15 h 30 n'est pas disponible avec Aïcha K.");

    // Salimata B. est libre à la même heure (Fatou est occupée dans les données de démo).
    const propositions = screen.getByRole("heading", { name: "Nos propositions" }).parentElement!;
    expect(within(propositions).queryByText("Fatou S.")).not.toBeInTheDocument();
    await user.click(within(propositions).getByRole("button", { name: /Salimata B\./ }));
    expect(nb(document.body.textContent)).toContain("Tresses Fulani avec Salimata B.");
    expect(screen.getByRole("button", { name: slot("15 h 30"), pressed: true })).toBeInTheDocument();

    await fillDetailsAndConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmer la réservation" }));
    expect(screen.getByRole("heading", { name: /Merci/ })).toBeInTheDocument();
    const at1530 = stored().appointments.filter((a) => a.date === "2026-12-23" && a.start === "15:30" && a.status !== "annule");
    expect(at1530.map((a) => a.stylistId).sort()).toEqual(["aicha-k", "salimata-b"]);
  });

  it("refuse la confirmation si le créneau est pris entre-temps (double réservation)", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillDetailsAndConfirm(user);
    expect(screen.getByRole("button", { name: "Confirmer la réservation" })).toBeInTheDocument();

    // Une autre réservation (autre onglet, coiffeuse…) prend le même créneau juste avant la confirmation.
    let other!: ReturnType<typeof demoActions.book>;
    act(() => {
      other = demoActions.book({ serviceId: "tresses-fulani", stylistId: "aicha-k", date: "2026-12-23", start: "15:30", clientName: "Mariam", clientPhone: "70000001" });
    });
    expect(other.ok).toBe(true);

    // Le récapitulatif détecte que le créneau n'est plus libre.
    expect(screen.getByRole("button", { name: "Confirmer la réservation" })).toBeDisabled();
    expect(screen.getByText(/n'est plus disponible/)).toBeInTheDocument();

    const count = stored().appointments.filter((a) => a.date === "2026-12-23" && a.stylistId === "aicha-k" && a.start === "15:30").length;
    expect(count).toBe(1);
  });

  it("indique un jour de fermeture et propose les prochaines disponibilités", async () => {
    renderWizard("prestation=tresses-fulani&coiffeuse=aicha-k&date=2026-12-27"); // dimanche
    expect(screen.getByText(/Le salon est fermé ce jour-là/)).toBeInTheDocument();
    expect(screen.getByText(/Prochaines disponibilités de Aïcha K\./)).toBeInTheDocument();
  });

  it("commence par le choix de la prestation sans paramètres", async () => {
    const user = userEvent.setup();
    renderWizard("");
    await user.click(screen.getByRole("button", { name: /Nattes collées/ }));
    // Aïcha ne propose pas les nattes collées : seules Fatou et Salimata sont listées.
    expect(screen.queryByRole("button", { name: /Aïcha K\./ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fatou S\./ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salimata B\./ })).toBeInTheDocument();
  });
});
