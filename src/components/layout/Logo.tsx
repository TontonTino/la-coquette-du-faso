import Image from "next/image";

/**
 * Emplacement unique du logo. Le fichier `public/brand/logo.png` provient du
 * dossier « COQUETTE FILM » : le remplacer par le fichier officiel fourni par
 * le salon suffit à mettre à jour toute l'application.
 */
export function Logo({ size = 44, priority }: { size?: number; priority?: boolean }) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Logo La Coquette du Faso"
      width={size}
      height={Math.round((size * 753) / 681)}
      priority={priority}
      className="drop-shadow-[0_2px_8px_rgba(200,164,77,0.25)]"
    />
  );
}
