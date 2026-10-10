import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Les tests d'intégration du serveur tournent sans DOM (environnement « node »).
const avecDom = typeof window !== "undefined";

// jsdom n'implémente pas le défilement.
if (avecDom) Element.prototype.scrollIntoView = () => {};

afterEach(() => {
  if (!avecDom) return;
  cleanup();
  window.localStorage.clear();
});
