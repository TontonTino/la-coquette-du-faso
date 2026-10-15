import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { icons: { icon: "/brand/logo-192.png" } };

/** Habillage de la démo de réservation (espaces Cliente, Coiffeuse, Gérante sur données fictives). */
export default function DemoLayout({ children }: LayoutProps<"/demo">) {
  return <AppShell>{children}</AppShell>;
}
