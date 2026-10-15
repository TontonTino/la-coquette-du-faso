import Image from "next/image";
import type { LogoVitrine } from "@/lib/salon/vitrine";

/**
 * Logo d'un salon (ses fichiers vivent dans `public/`). Sans logo, rien ne s'affiche : le nom du salon suffit.
 * Les angles arrondis présentent le logo comme une pastille sur les zones sombres de l'application.
 */
export function Logo({ logo, size = 44, priority }: { logo: LogoVitrine | null; size?: number; priority?: boolean }) {
  if (!logo) return null;
  return (
    <Image
      src={logo.src}
      alt={logo.alt}
      width={size}
      height={Math.round((size * logo.hauteur) / logo.largeur)}
      priority={priority}
      className="rounded-[14%]"
    />
  );
}
