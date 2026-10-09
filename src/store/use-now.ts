"use client";

import { useSyncExternalStore } from "react";

/**
 * Instant présent, lu uniquement dans le navigateur et rafraîchi chaque minute
 * pour que les créneaux passés disparaissent. Pendant le rendu serveur, une date
 * neutre est renvoyée : les composants n'affichent alors qu'un état de chargement
 * (le store de démonstration vaut `null`).
 */
const SERVER_NOW = new Date(0);
let current: Date | null = null;
const listeners = new Set<() => void>();
let timer: number | undefined;

function tick() {
  current = new Date();
  listeners.forEach((l) => l());
}

function onVisibility() {
  if (document.visibilityState === "visible") tick();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", onVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

function getSnapshot() {
  if (!current) current = new Date();
  return current;
}

export function useNow(): Date {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_NOW);
}
