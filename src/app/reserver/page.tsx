import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { PageSkeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Réserver" };

export default function ReserverPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BookingWizard />
    </Suspense>
  );
}
