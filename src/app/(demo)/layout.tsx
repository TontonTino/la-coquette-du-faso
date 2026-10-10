import { AppShell } from "@/components/layout/AppShell";

/** Habillage de la démo de réservation (espaces Cliente, Coiffeuse, Gérante sur données fictives). */
export default function DemoLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
