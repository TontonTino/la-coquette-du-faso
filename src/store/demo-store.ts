"use client";

import { useSyncExternalStore } from "react";
import { applyAction, createAppointment, toggleBlock, type ActionResult, type AppointmentAction, type BookingInput } from "@/lib/booking";
import { createSeed } from "@/lib/seed";
import type { Actor, DemoState } from "@/lib/types";

/**
 * Store de démonstration persisté dans le localStorage de ce navigateur.
 * Les données ne sont pas partagées entre appareils : seuls les onglets d'un
 * même navigateur restent synchronisés (évènement « storage »).
 */
export const STORAGE_KEY = "la-coquette-du-faso:demo:v1";

let state: DemoState | null = null;
const listeners = new Set<() => void>();

function isDemoState(value: unknown): value is DemoState {
  const v = value as DemoState;
  return !!v && v.version === 1 && Array.isArray(v.appointments) && Array.isArray(v.blocks) && Array.isArray(v.myAppointmentIds);
}

function read(): DemoState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDemoState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function write(next: DemoState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible (navigation privée…) : la démo fonctionne en mémoire.
  }
}

function ensureLoaded(): DemoState {
  if (!state) {
    state = read();
    if (!state) {
      state = createSeed(new Date());
      write(state);
    }
  }
  return state;
}

function setState(next: DemoState) {
  state = next;
  write(next);
  listeners.forEach((l) => l());
}

function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  state = read() ?? createSeed(new Date());
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/** État de la démo, ou `null` pendant le rendu serveur et l'hydratation. */
export function useDemoState(): DemoState | null {
  return useSyncExternalStore(subscribe, ensureLoaded, () => null);
}

function commit<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) setState(result.state);
  return result;
}

export const demoActions = {
  book(input: BookingInput) {
    return commit(createAppointment(ensureLoaded(), input, new Date(), { markAsMine: true }));
  },
  act(appointmentId: string, action: AppointmentAction, actor: Actor) {
    return commit(applyAction(ensureLoaded(), appointmentId, action, actor, new Date()));
  },
  toggleBlock(stylistId: string, date: string, start: string) {
    return commit(toggleBlock(ensureLoaded(), stylistId, date, start, new Date()));
  },
  reset() {
    setState(createSeed(new Date()));
  },
};

/** Réservé aux tests. */
export function __resetStoreForTests() {
  state = null;
  listeners.clear();
}
