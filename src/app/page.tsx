import Link from "next/link";
import { DEMO_SCENARIO, SALON, SERVICES, STYLISTS, formatWorkDays, getService, getStylist } from "@/lib/catalog";
import { capitalize, formatDateLong, formatDuration, formatFcfa, formatTime } from "@/lib/time";
import { Logo } from "@/components/layout/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar, Card, SectionTitle } from "@/components/ui/primitives";
import { MyNextAppointment } from "./MyNextAppointment";

const scenarioService = getService(DEMO_SCENARIO.serviceId)!;
const scenarioStylist = getStylist(DEMO_SCENARIO.stylistId)!;
const scenarioHref = `/reserver?prestation=${DEMO_SCENARIO.serviceId}&coiffeuse=${DEMO_SCENARIO.stylistId}&date=${DEMO_SCENARIO.date}&heure=${DEMO_SCENARIO.start}`;

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Accueil */}
      <section className="texture-noire relative -mx-4 -mt-6 overflow-hidden px-6 pt-10 pb-12 text-white sm:mx-0 sm:mt-0 sm:rounded-3xl sm:px-12 sm:py-14">
        <div className="relative z-10 flex flex-col items-center text-center md:flex-row md:items-center md:gap-12 md:text-left">
          <div className="mb-6 md:order-2 md:mb-0">
            <Logo size={150} priority />
          </div>
          <div className="flex-1">
            <p className="text-[11px] tracking-[0.3em] text-or uppercase">Salon de beauté · {SALON.city}</p>
            <h1 className="mt-3 font-display text-[44px] leading-[1.02] font-semibold sm:text-6xl">
              L&apos;élégance,
              <br />
              <span className="text-or">sur rendez-vous.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/70 md:mx-0">
              Choisissez votre prestation, votre experte et votre créneau en quelques instants. Plus d&apos;attente au salon.
            </p>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center md:justify-start">
              <ButtonLink href="/reserver" size="lg">
                Réserver maintenant
              </ButtonLink>
              <ButtonLink href="/prestations" variant="contour-clair" size="lg">
                Voir les prestations
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <MyNextAppointment />

      {/* Scénario de démonstration */}
      <section aria-labelledby="scenario">
        <Card className="relative overflow-hidden border-or/50 bg-creme p-5 sm:p-6">
          <span className="absolute top-0 right-0 rounded-bl-2xl bg-or px-3 py-1 text-[10.5px] font-medium tracking-wider text-noir uppercase">
            Démonstration
          </span>
          <p id="scenario" className="pr-28 text-[11px] font-medium tracking-[0.18em] text-or-fonce uppercase">
            Scénario guidé
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-noir">
            {scenarioService.name} avec {scenarioStylist.name}
          </h2>
          <p className="mt-1 text-sm text-sourdine">
            {capitalize(formatDateLong(DEMO_SCENARIO.date))} à {formatTime(DEMO_SCENARIO.start)} · {formatDuration(scenarioService.durationMin)} ·{" "}
            {formatFcfa(scenarioService.priceFcfa)}
          </p>
          <p className="mt-3 text-xs text-sourdine">
            Ouvre la réservation pré-remplie. Relancez-le après avoir réservé : le créneau étant pris, l&apos;application propose des alternatives.
          </p>
          <ButtonLink href={scenarioHref} variant="noir" className="mt-4">
            Lancer le scénario
          </ButtonLink>
        </Card>
      </section>

      {/* Prestations */}
      <section aria-labelledby="prestations">
        <SectionTitle
          id="prestations"
          eyebrow="Nos prestations"
          title="Tresses & coiffures"
          action={
            <Link href="/prestations" className="text-sm font-medium text-or-fonce hover:underline">
              Tout voir
            </Link>
          }
        />
        <ul className="grid gap-3 sm:grid-cols-3">
          {SERVICES.map((s) => (
            <li key={s.id}>
              <Link href={`/reserver?prestation=${s.id}`} className="group block h-full">
                <Card className="flex h-full flex-col p-5 transition-colors group-hover:border-or">
                  <h3 className="font-display text-2xl font-semibold text-noir">{s.name}</h3>
                  <p className="mt-1 flex-1 text-sm text-sourdine">{s.description}</p>
                  <div className="filet-or my-4" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-sourdine">{formatDuration(s.durationMin)}</span>
                    <span className="font-display text-xl font-bold text-noir">{formatFcfa(s.priceFcfa)}</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Équipe */}
      <section aria-labelledby="equipe">
        <SectionTitle
          id="equipe"
          eyebrow="Notre équipe"
          title="Nos expertes"
          action={
            <Link href="/equipe" className="text-sm font-medium text-or-fonce hover:underline">
              Tout voir
            </Link>
          }
        />
        <ul className="grid gap-3 sm:grid-cols-3">
          {STYLISTS.map((s) => (
            <li key={s.id}>
              <Link href={`/equipe/${s.id}`} className="group block">
                <Card className="flex items-center gap-4 p-4 transition-colors group-hover:border-or">
                  <Avatar stylist={s} />
                  <div className="min-w-0">
                    <p className="font-display text-xl font-semibold text-noir">{s.name}</p>
                    <p className="text-sm text-sourdine">{s.specialty}</p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Infos pratiques */}
      <section aria-labelledby="infos" className="grid gap-3 sm:grid-cols-2">
        <Card className="p-5">
          <h2 id="infos" className="font-display text-xl font-semibold text-noir">
            Horaires (démonstration)
          </h2>
          <p className="mt-1 text-sm text-sourdine">
            {capitalize(formatWorkDays([...SALON.openDays]))}, de {formatTime(SALON.openingTime)} à {formatTime(SALON.closingTime)}. Horaires fictifs, à
            remplacer par ceux du salon.
          </p>
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-xl font-semibold text-noir">Paiement</h2>
          <p className="mt-1 text-sm text-sourdine">Règlement sur place, au salon. Aucun paiement en ligne n&apos;est demandé.</p>
        </Card>
      </section>
    </div>
  );
}
