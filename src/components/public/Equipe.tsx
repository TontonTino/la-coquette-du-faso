import { IconStar } from "@/components/ui/icons";

/** Photo d'une coiffeuse, toujours ronde (jamais de grand carré) ; à défaut, ses initiales sur fond noir (les clientes ne connaissent pas les noms). */
export function PhotoCoiffeuse({ nom, photoUrl, className = "" }: { nom: string; photoUrl: string | null; className?: string }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- photo servie par l'application, déjà réduite
    return <img src={photoUrl} alt={nom} loading="lazy" draggable={false} className={`overflow-hidden rounded-full object-cover ${className}`} />;
  }
  const ini = nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join("");
  return (
    <span role="img" aria-label={nom} className={`flex items-center justify-center overflow-hidden rounded-full bg-noir font-display text-[2.2rem] font-bold text-or ${className}`}>
      {ini}
    </span>
  );
}

/** « ★ 4,8 (23 avis) », ou « Nouvelle » tant qu'il y a moins de 3 avis. */
export function NoteCoiffeuse({ note, nbAvis, clair = false }: { note: string | null; nbAvis: number; clair?: boolean }) {
  if (!note) {
    return <span className={`text-xs ${clair ? "text-white/60" : "text-sourdine"}`}>{nbAvis > 0 ? `${nbAvis} avis` : "Nouvelle"}</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${clair ? "text-white/85" : "text-encre"}`}>
      <IconStar width={13} height={13} fill="currentColor" className="text-or" />
      <span>{note}</span>
      <span className={clair ? "text-white/55" : "text-sourdine"}>({nbAvis})</span>
      <span className="sr-only"> sur 5, {nbAvis} avis</span>
    </span>
  );
}
