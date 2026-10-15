import type { Metadata } from "next";
import type { ReactNode } from "react";
import { classeMarqueMia } from "@/app/polices-mia";

export const metadata: Metadata = { title: { default: "Espace MIA", template: "%s · Espace MIA" }, robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className={`${classeMarqueMia} min-h-dvh bg-mia-sable text-mia-cacao`}>{children}</div>;
}
