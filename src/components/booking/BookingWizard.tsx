"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { SERVICES, getService, getStylist, stylistsForService } from "@/lib/catalog";
import { appointmentEnd, availableStarts, findAlternatives, isSalonOpen, validateClient, worksOn, type ClientErrors } from "@/lib/booking";
import { addDays, capitalize, formatDateLong, formatDuration, formatFcfa, formatTime, isValidIsoDate, isValidTime, todayIso } from "@/lib/time";
import type { Appointment, DemoState, HourMinute, IsoDate } from "@/lib/types";
import { demoActions, useDemoState } from "@/store/demo-store";
import { useNow } from "@/store/use-now";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Avatar, Card, Notice, PageSkeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { AlternativesPanel, type AlternativeChoice } from "./AlternativesPanel";
import { DateStrip, SlotGrid } from "./pickers";

type Step = "prestation" | "coiffeuse" | "creneau" | "coordonnees" | "recap" | "confirme";
const STEPS: { id: Exclude<Step, "confirme">; label: string }[] = [
  { id: "prestation", label: "Prestation" },
  { id: "coiffeuse", label: "Experte" },
  { id: "creneau", label: "Créneau" },
  { id: "coordonnees", label: "Coordonnées" },
  { id: "recap", label: "Récapitulatif" },
];

interface Selection {
  serviceId: string | null;
  stylistId: string | null;
  date: IsoDate | null;
  start: HourMinute | null;
  /** Heure souhaitée (lien du scénario ou créneau perdu) à signaler si indisponible. */
  wanted: HourMinute | null;
}

/** Premier jour, à partir de `from`, où la coiffeuse a au moins un créneau libre. */
function firstAvailableDate(state: DemoState, stylistId: string, serviceId: string, from: IsoDate, now: Date): IsoDate {
  for (let i = 0; i < 30; i++) {
    const date = addDays(from, i);
    if (availableStarts(state, stylistId, serviceId, date, now).length > 0) return date;
  }
  return from;
}

function initialSelection(params: URLSearchParams): { selection: Selection; step: Step } {
  const service = getService(params.get("prestation") ?? "");
  let stylist = getStylist(params.get("coiffeuse") ?? "");
  if (service && stylist && !stylist.serviceIds.includes(service.id)) stylist = undefined;
  const date = params.get("date");
  const time = params.get("heure");
  const selection: Selection = {
    serviceId: service?.id ?? null,
    stylistId: stylist?.id ?? null,
    date: date && isValidIsoDate(date) ? date : null,
    start: null,
    wanted: time && isValidTime(time) ? time : null,
  };
  const step: Step = !service ? "prestation" : !stylist ? "coiffeuse" : "creneau";
  return { selection, step };
}

export function BookingWizard() {
  const state = useDemoState();
  const params = useSearchParams();
  // Les paramètres d'URL ne servent qu'à pré-remplir l'assistant à l'ouverture.
  const [init] = useState(() => initialSelection(new URLSearchParams(params.toString())));
  if (!state) return <PageSkeleton />;
  return <Wizard state={state} init={init} />;
}

function Wizard({ state, init }: { state: DemoState; init: { selection: Selection; step: Step } }) {
  const now = useNow();
  const today = todayIso(now);
  const toast = useToast();
  const top = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);

  const [step, setStepRaw] = useState<Step>(init.step);
  const [sel, setSel] = useState<Selection>(() => {
    const s = init.selection;
    if (s.serviceId && s.stylistId && !s.date) return { ...s, date: firstAvailableDate(state, s.stylistId, s.serviceId, today, now) };
    return s;
  });
  const [details, setDetails] = useState({ clientName: "", clientPhone: "", note: "" });
  const [errors, setErrors] = useState<ClientErrors>({});
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);

  const service = sel.serviceId ? getService(sel.serviceId) : undefined;
  const stylist = sel.stylistId ? getStylist(sel.stylistId) : undefined;

  const setStep = (next: Step) => {
    setStepRaw(next);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const slots = useMemo(
    () => (service && stylist && sel.date ? availableStarts(state, stylist.id, service.id, sel.date, now) : []),
    [state, service, stylist, sel.date, now],
  );

  // Créneau retenu : choix explicite, sinon l'heure souhaitée si elle est libre.
  const wantedFree = !!sel.wanted && slots.includes(sel.wanted);
  const chosenStart = sel.start && slots.includes(sel.start) ? sel.start : wantedFree ? sel.wanted : null;
  const wantedUnavailable = !!sel.wanted && !wantedFree && !sel.start;

  const alternatives = useMemo(() => {
    if (!service || !stylist || !sel.date) return null;
    if (slots.length > 0 && !wantedUnavailable) return null;
    return findAlternatives(state, { serviceId: service.id, stylistId: stylist.id, date: sel.date, start: sel.wanted ?? undefined }, now);
  }, [state, service, stylist, sel.date, sel.wanted, slots.length, wantedUnavailable, now]);

  const pickAlternative = (c: AlternativeChoice) => {
    setSel((s) => ({ ...s, stylistId: c.stylistId, date: c.date, start: c.start, wanted: null }));
    setBookingError(null);
    setStep("creneau");
    toast("info", "Créneau sélectionné", `${getStylist(c.stylistId)?.name} · ${formatTime(c.start)}`);
  };

  const unavailableLabel = (date: IsoDate): string | null => {
    if (!isSalonOpen(date)) return "Fermé";
    if (stylist && !worksOn(stylist, date)) return "Repos";
    if (service && stylist && availableStarts(state, stylist.id, service.id, date, now).length === 0) return "Complet";
    return null;
  };

  const submitDetails = () => {
    const errs = validateClient(details);
    setErrors(errs);
    if (Object.keys(errs).length === 0) setStep("recap");
  };

  const confirm = () => {
    if (submitting.current || !service || !stylist || !sel.date || !chosenStart) return;
    submitting.current = true;
    const result = demoActions.book({ serviceId: service.id, stylistId: stylist.id, date: sel.date, start: chosenStart, ...details });
    submitting.current = false;
    if (result.ok) {
      setConfirmed(result.value);
      setStep("confirme");
      toast("succes", "Réservation enregistrée", `Référence ${result.value.reference}`);
    } else if (result.reason === "client_invalide") {
      setErrors(validateClient(details));
      setStep("coordonnees");
    } else {
      // Le créneau a été pris entre-temps (autre onglet, coiffeuse…) : on propose des alternatives.
      setBookingError(result.message);
      setSel((s) => ({ ...s, wanted: chosenStart, start: null }));
      setStep("creneau");
      toast("erreur", "Créneau indisponible", result.message);
    }
  };

  const restart = () => {
    setSel({ serviceId: null, stylistId: null, date: null, start: null, wanted: null });
    setDetails({ clientName: "", clientPhone: "", note: "" });
    setConfirmed(null);
    setBookingError(null);
    setStep("prestation");
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div ref={top} className="mx-auto max-w-2xl scroll-mt-24">
      {step !== "confirme" && (
        <>
          <p className="mb-1 text-[11px] font-medium tracking-[0.18em] text-or-fonce uppercase">Réservation</p>
          <h1 className="font-display text-[34px] leading-tight font-semibold text-noir">Prendre rendez-vous</h1>
          <ol className="mt-4 mb-6 grid grid-cols-5 gap-1.5" aria-label="Étapes de la réservation">
            {STEPS.map((s, i) => (
              <li key={s.id} aria-current={i === stepIndex ? "step" : undefined}>
                <span className={`block h-1 rounded-full ${i <= stepIndex ? "bg-or" : "bg-noir/10"}`} />
                <span className={`mt-1.5 hidden text-[11px] sm:block ${i === stepIndex ? "font-medium text-noir" : "text-sourdine"}`}>{s.label}</span>
              </li>
            ))}
          </ol>
          <p className="-mt-3 mb-5 text-xs text-sourdine sm:hidden">
            Étape {stepIndex + 1} sur {STEPS.length} · {STEPS[stepIndex].label}
          </p>
        </>
      )}

      {/* Étape 1 : prestation */}
      {step === "prestation" && (
        <section aria-labelledby="t-prestation" className="animate-montee">
          <h2 id="t-prestation" className="mb-3 font-display text-2xl font-semibold text-noir">
            Quelle prestation souhaitez-vous ?
          </h2>
          <ul className="space-y-3">
            {SERVICES.filter((s) => !stylist || stylist.serviceIds.includes(s.id)).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    const keepStylist = sel.stylistId && getStylist(sel.stylistId)?.serviceIds.includes(s.id);
                    setSel((cur) => ({
                      ...cur,
                      serviceId: s.id,
                      start: null,
                      date: keepStylist ? firstAvailableDate(state, cur.stylistId!, s.id, today, now) : cur.date,
                    }));
                    setStep(keepStylist ? "creneau" : "coiffeuse");
                  }}
                  className={`flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left shadow-carte transition-colors hover:border-or ${
                    sel.serviceId === s.id ? "border-or ring-1 ring-or" : "border-trait"
                  }`}
                >
                  <span className="flex-1">
                    <span className="block font-display text-xl font-semibold text-noir">{s.name}</span>
                    <span className="mt-0.5 block text-sm text-sourdine">{s.description}</span>
                    <span className="mt-2 block text-xs text-sourdine">Durée : {formatDuration(s.durationMin)}</span>
                  </span>
                  <span className="text-right font-medium whitespace-nowrap text-or-fonce">{formatFcfa(s.priceFcfa)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Étape 2 : coiffeuse */}
      {step === "coiffeuse" && service && (
        <section aria-labelledby="t-coiffeuse" className="animate-montee">
          <h2 id="t-coiffeuse" className="mb-1 font-display text-2xl font-semibold text-noir">
            Avec quelle experte ?
          </h2>
          <p className="mb-4 text-sm text-sourdine">Expertes proposant « {service.name} ».</p>
          <ul className="space-y-3">
            {stylistsForService(service.id).map((s) => {
              const next = firstAvailableDate(state, s.id, service.id, today, now);
              const nextSlots = availableStarts(state, s.id, service.id, next, now);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSel((cur) => ({ ...cur, stylistId: s.id, date: cur.date && cur.date >= today ? cur.date : next, start: null }));
                      setStep("creneau");
                    }}
                    className={`flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left shadow-carte transition-colors hover:border-or ${
                      sel.stylistId === s.id ? "border-or ring-1 ring-or" : "border-trait"
                    }`}
                  >
                    <Avatar stylist={s} />
                    <span className="flex-1">
                      <span className="block font-display text-xl font-semibold text-noir">{s.name}</span>
                      <span className="block text-sm text-sourdine">{s.specialty}</span>
                      {nextSlots.length > 0 && (
                        <span className="mt-1 block text-xs text-vert">
                          Prochaine disponibilité : {capitalize(formatDateLong(next))} à {formatTime(nextSlots[0])}
                        </span>
                      )}
                    </span>
                    <span className="text-or-fonce" aria-hidden>
                      →
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <BackButton onClick={() => setStep("prestation")} />
        </section>
      )}

      {/* Étape 3 : date et créneau */}
      {step === "creneau" && service && stylist && sel.date && (
        <section aria-labelledby="t-creneau" className="animate-montee space-y-5">
          <div>
            <h2 id="t-creneau" className="font-display text-2xl font-semibold text-noir">
              Choisissez une date et un horaire
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-sourdine">
              <Avatar stylist={stylist} size="sm" />
              {service.name} avec {stylist.name} · {formatDuration(service.durationMin)}
            </p>
          </div>

          {bookingError && (
            <Notice tone="erreur" title="La réservation n'a pas pu être enregistrée">
              {bookingError} Choisissez un autre créneau ci-dessous.
            </Notice>
          )}

          <DateStrip
            value={sel.date}
            from={today}
            days={21}
            onChange={(date) => {
              setSel((s) => ({ ...s, date, start: null, wanted: null }));
              setBookingError(null);
            }}
            isUnavailable={unavailableLabel}
          />

          <Card className="p-4">
            <p className="mb-3 text-sm font-medium text-noir">{capitalize(formatDateLong(sel.date))}</p>
            {wantedUnavailable && (
              <div className="mb-4">
                <Notice tone="erreur" title={`${formatTime(sel.wanted!)} n'est pas disponible avec ${stylist.name}`}>
                  {unavailableReason(state, stylist.id, service.id, sel.date, sel.wanted!, now)}
                </Notice>
              </div>
            )}
            {slots.length > 0 ? (
              <SlotGrid
                slots={slots}
                value={chosenStart}
                onChange={(start) => {
                  setSel((s) => ({ ...s, start, wanted: null }));
                  setBookingError(null);
                }}
              />
            ) : (
              <p className="text-sm text-sourdine">{noSlotReason(state, stylist.id, sel.date, today)}</p>
            )}
          </Card>

          {alternatives && (
            <Card className="border-or/40 bg-creme p-4">
              <h3 className="mb-3 font-display text-xl font-semibold text-noir">Nos propositions</h3>
              <AlternativesPanel
                alternatives={alternatives}
                stylistId={stylist.id}
                stylistName={stylist.name}
                date={sel.date}
                start={sel.wanted ?? undefined}
                today={today}
                onPick={pickAlternative}
              />
            </Card>
          )}

          <StickyActions>
            <Button variant="contour" onClick={() => setStep("coiffeuse")}>
              Retour
            </Button>
            <Button disabled={!chosenStart} onClick={() => setStep("coordonnees")}>
              {chosenStart ? `Continuer · ${formatTime(chosenStart)}` : "Choisissez un horaire"}
            </Button>
          </StickyActions>
        </section>
      )}

      {/* Étape 4 : coordonnées */}
      {step === "coordonnees" && (
        <section aria-labelledby="t-coord" className="animate-montee">
          <h2 id="t-coord" className="mb-1 font-display text-2xl font-semibold text-noir">
            Vos coordonnées
          </h2>
          <p className="mb-4 text-sm text-sourdine">Pour la démonstration, utilisez un nom et un numéro fictifs.</p>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submitDetails();
            }}
            className="space-y-4"
          >
            <Field id="nom" label="Nom et prénom" error={errors.clientName}>
              <input
                id="nom"
                autoComplete="name"
                value={details.clientName}
                onChange={(e) => setDetails((d) => ({ ...d, clientName: e.target.value }))}
                placeholder="Ex. Cliente Démo"
                aria-invalid={!!errors.clientName}
                aria-describedby={errors.clientName ? "nom-erreur" : undefined}
                className={inputClass(!!errors.clientName)}
              />
            </Field>
            <Field id="tel" label="Téléphone" hint="8 chiffres, indicatif +226 facultatif" error={errors.clientPhone}>
              <input
                id="tel"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={details.clientPhone}
                onChange={(e) => setDetails((d) => ({ ...d, clientPhone: e.target.value }))}
                placeholder="70 00 00 00"
                aria-invalid={!!errors.clientPhone}
                aria-describedby={errors.clientPhone ? "tel-erreur" : "tel-aide"}
                className={inputClass(!!errors.clientPhone)}
              />
            </Field>
            <Field id="note" label="Remarque (facultatif)" error={errors.note}>
              <textarea
                id="note"
                rows={3}
                maxLength={300}
                value={details.note}
                onChange={(e) => setDetails((d) => ({ ...d, note: e.target.value }))}
                placeholder="Longueur souhaitée, couleur des mèches…"
                className={inputClass(!!errors.note)}
              />
            </Field>
            <StickyActions>
              <Button variant="contour" onClick={() => setStep("creneau")}>
                Retour
              </Button>
              <Button type="submit">Voir le récapitulatif</Button>
            </StickyActions>
          </form>
        </section>
      )}

      {/* Étape 5 : récapitulatif */}
      {step === "recap" && service && stylist && sel.date && (
        <section aria-labelledby="t-recap" className="animate-montee">
          <h2 id="t-recap" className="mb-4 font-display text-2xl font-semibold text-noir">
            Vérifiez votre rendez-vous
          </h2>
          {chosenStart ? (
            <Card className="overflow-hidden">
              <div className="texture-noire flex items-center gap-4 p-5 text-white">
                <Avatar stylist={stylist} size="md" />
                <div>
                  <p className="font-display text-2xl font-semibold text-or">{service.name}</p>
                  <p className="text-sm text-white/75">avec {stylist.name}</p>
                </div>
              </div>
              <dl className="divide-y divide-trait px-5">
                <Row label="Date">{capitalize(formatDateLong(sel.date))}</Row>
                <Row label="Heure">
                  {formatTime(chosenStart)} – {formatTime(appointmentEnd({ start: chosenStart, durationMin: service.durationMin }))}
                </Row>
                <Row label="Durée">{formatDuration(service.durationMin)}</Row>
                <Row label="Cliente">{details.clientName.trim()}</Row>
                <Row label="Téléphone">{details.clientPhone}</Row>
                {details.note.trim() && <Row label="Remarque">{details.note.trim()}</Row>}
                <Row label="Prix">
                  <span className="font-display text-2xl font-bold text-noir">{formatFcfa(service.priceFcfa)}</span>
                </Row>
              </dl>
              <p className="border-t border-trait bg-creme px-5 py-3 text-xs text-sourdine">
                Paiement au salon. Aucun paiement en ligne dans cette démonstration.
              </p>
            </Card>
          ) : (
            <Notice tone="erreur">Le créneau choisi n&apos;est plus disponible. Revenez à l&apos;étape précédente pour en choisir un autre.</Notice>
          )}
          <StickyActions>
            <Button variant="contour" onClick={() => setStep("coordonnees")}>
              Modifier
            </Button>
            <Button onClick={confirm} disabled={!chosenStart}>
              Confirmer la réservation
            </Button>
          </StickyActions>
        </section>
      )}

      {/* Confirmation */}
      {step === "confirme" && confirmed && service && stylist && (
        <section aria-labelledby="t-ok" className="animate-montee text-center">
          <div className="texture-noire mx-auto mb-5 flex size-20 items-center justify-center rounded-full text-3xl text-or ring-1 ring-or/50">✓</div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-or-fonce uppercase">Demande enregistrée</p>
          <h1 id="t-ok" className="mt-1 font-display text-[34px] leading-tight font-semibold text-noir">
            Merci, {confirmed.clientName.split(" ")[0]} !
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-sourdine">
            Votre rendez-vous est <strong className="text-encre">en attente de confirmation</strong> par {stylist.name}. Vous pouvez suivre son statut dans
            « Mes rendez-vous ».
          </p>
          <Card className="mx-auto mt-6 max-w-md p-5 text-left">
            <p className="text-xs text-sourdine">Référence</p>
            <p className="font-display text-2xl font-bold tracking-wider text-noir">{confirmed.reference}</p>
            <div className="filet-or my-4" />
            <p className="font-medium text-noir">
              {service.name} · {formatFcfa(confirmed.priceFcfa)}
            </p>
            <p className="text-sm text-sourdine">
              {capitalize(formatDateLong(confirmed.date))} à {formatTime(confirmed.start)}
              <br />
              avec {stylist.name} · {formatDuration(confirmed.durationMin)}
            </p>
          </Card>
          <p className="mx-auto mt-4 max-w-md text-xs text-sourdine">
            Démonstration : aucun SMS ni message WhatsApp n&apos;est envoyé. Le rendez-vous est visible dans les espaces Coiffeuse et Gérante de ce
            navigateur.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <ButtonLink href="/mes-rendez-vous">Voir mes rendez-vous</ButtonLink>
            <Button variant="contour" onClick={restart}>
              Nouvelle réservation
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function unavailableReason(state: DemoState, stylistId: string, serviceId: string, date: IsoDate, start: HourMinute, now: Date) {
  const s = getStylist(stylistId)!;
  if (!isSalonOpen(date)) return "Le salon est fermé ce jour-là.";
  if (!worksOn(s, date)) return `${s.name} ne travaille pas ce jour-là.`;
  const slotsLeft = availableStarts(state, stylistId, serviceId, date, now);
  return slotsLeft.length > 0
    ? `Ce créneau est déjà réservé ou bloqué. D'autres horaires restent libres ce jour-là.`
    : `${s.name} est complète ce jour-là ou ce créneau est déjà passé.`;
}

function noSlotReason(state: DemoState, stylistId: string, date: IsoDate, today: IsoDate) {
  const s = getStylist(stylistId)!;
  if (date < today) return "Cette date est passée.";
  if (!isSalonOpen(date)) return "Le salon est fermé ce jour-là (ouvert du lundi au samedi).";
  if (!worksOn(s, date)) return `${s.name} ne travaille pas ce jour-là.`;
  return `Plus aucun créneau libre avec ${s.name} ce jour-là.`;
}

function inputClass(invalid: boolean) {
  return `w-full rounded-xl border bg-white px-4 py-3 text-base text-encre placeholder:text-sourdine/60 focus:border-or focus:ring-1 focus:ring-or focus:outline-none ${
    invalid ? "border-rouge" : "border-trait"
  }`;
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-noir">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-erreur`} className="mt-1.5 text-sm text-rouge">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-aide`} className="mt-1.5 text-xs text-sourdine">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-sm text-sourdine">{label}</dt>
      <dd className="text-right text-sm font-medium text-encre">{children}</dd>
    </div>
  );
}

function StickyActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-6 flex justify-end gap-2 border-t border-trait bg-gris/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 [&>*:last-child]:flex-1 md:[&>*:last-child]:flex-none">
      {children}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="mt-6">
      <Button variant="discret" onClick={onClick}>
        ← Retour
      </Button>
    </div>
  );
}
