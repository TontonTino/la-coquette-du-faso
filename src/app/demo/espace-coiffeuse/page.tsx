import type { Metadata } from "next";
import { StylistPicker } from "./StylistPicker";

export const metadata: Metadata = { title: "Espace coiffeuse" };

export default function EspaceCoiffeusePage() {
  return <StylistPicker />;
}
