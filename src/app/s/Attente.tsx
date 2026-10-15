/** Emplacement vide pendant la lecture de l'adresse du salon (évite un écran blanc qui saute). */
export function Attente({ fond }: { fond: "bg-lin" | "bg-noir" }) {
  return <div aria-busy className={`min-h-dvh ${fond}`} />;
}
