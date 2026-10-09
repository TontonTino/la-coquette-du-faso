"use client";

import { useEffect, useState } from "react";

/** Instant présent, rafraîchi chaque minute pour que les créneaux passés disparaissent. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
