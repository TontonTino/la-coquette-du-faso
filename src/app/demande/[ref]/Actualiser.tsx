"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Recharge le suivi toutes les 30 s tant que la demande attend une réponse. */
export function Actualiser() {
  const router = useRouter();
  useEffect(() => {
    const t = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(t);
  }, [router]);
  return null;
}
