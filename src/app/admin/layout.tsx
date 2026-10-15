import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: { default: "Espace MIA", template: "%s · Espace MIA" }, robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-atelier text-encre">{children}</div>;
}
