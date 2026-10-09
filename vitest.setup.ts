import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom n'implémente pas le défilement.
Element.prototype.scrollIntoView = () => {};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
