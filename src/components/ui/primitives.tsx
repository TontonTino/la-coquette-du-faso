import type { ReactNode } from "react";
import type { AppointmentStatus, Stylist } from "@/lib/types";

export function Card({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "li" }) {
  return <Tag className={`rounded-2xl border border-trait/80 bg-white shadow-carte ${className}`}>{children}</Tag>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-[11px] font-medium tracking-[0.18em] text-or-fonce uppercase">{eyebrow}</p>}
        <h2 className="font-display text-[26px] leading-tight font-semibold text-noir">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-6">
      {eyebrow && <p className="mb-1 text-[11px] font-medium tracking-[0.18em] text-or-fonce uppercase">{eyebrow}</p>}
      <h1 className="font-display text-[34px] leading-[1.05] font-semibold text-noir sm:text-[40px]">{title}</h1>
      {children && <div className="mt-2 text-sm leading-relaxed text-sourdine">{children}</div>}
    </header>
  );
}

export function Avatar({ stylist, size = "md" }: { stylist: Pick<Stylist, "initials" | "name">; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "size-9 text-xs", md: "size-12 text-sm", lg: "size-20 text-xl" }[size];
  return (
    <span
      className={`${dims} inline-flex shrink-0 items-center justify-center rounded-full bg-noir font-display font-bold tracking-wide text-or ring-1 ring-or/60 ring-offset-2 ring-offset-white`}
      aria-hidden
      title={stylist.name}
    >
      {stylist.initials}
    </span>
  );
}

const STATUS: Record<AppointmentStatus, { label: string; className: string }> = {
  en_attente: { label: "En attente", className: "bg-or-pale text-or-fonce ring-or/40" },
  confirme: { label: "Confirmé", className: "bg-vert-pale text-vert ring-vert/25" },
  annule: { label: "Annulé", className: "bg-rouge-pale text-rouge ring-rouge/25" },
  termine: { label: "Terminé", className: "bg-gris text-sourdine ring-noir/10" },
};

export function statusLabel(status: AppointmentStatus) {
  return STATUS[status].label;
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const s = STATUS[status];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${s.className}`}>{s.label}</span>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-or/40 bg-creme px-6 py-10 text-center">
      <span className="mb-3 text-2xl text-or" aria-hidden>
        ✦
      </span>
      <p className="font-display text-xl font-semibold text-noir">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-sourdine">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "erreur" | "succes"; title?: string; children: ReactNode }) {
  const tones = {
    info: "border-or/40 bg-or-pale/60 text-encre",
    erreur: "border-rouge/30 bg-rouge-pale text-rouge",
    succes: "border-vert/25 bg-vert-pale text-vert",
  }[tone];
  return (
    <div role={tone === "erreur" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${tones}`}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-0.5" : ""}>{children}</div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-noir/[0.06] ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
