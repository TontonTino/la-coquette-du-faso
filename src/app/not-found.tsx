import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-10">
      <EmptyState title="Page introuvable" action={<ButtonLink href="/">Retour à l&apos;accueil</ButtonLink>}>
        Cette page n&apos;existe pas ou plus.
      </EmptyState>
    </div>
  );
}
