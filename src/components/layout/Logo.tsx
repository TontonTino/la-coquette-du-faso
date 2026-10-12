import Image from "next/image";

/**
 * Emplacement unique du logo. Le fichier `public/brand/logo.png` est le logo officiel fourni par le salon
 * (fond sombre : les angles arrondis le présentent comme une pastille sur les zones sombres de l'application).
 * Le remplacer suffit à mettre à jour toute l'application.
 */
export function Logo({ size = 44, priority }: { size?: number; priority?: boolean }) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Logo La Coquette du Faso"
      width={size}
      height={Math.round((size * 753) / 681)}
      priority={priority}
      className="rounded-[14%]"
    />
  );
}
