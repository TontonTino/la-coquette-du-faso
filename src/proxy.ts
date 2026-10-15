import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirection rapide vers la connexion quand aucun cookie de session n'est présent.
 * Ce n'est qu'un confort : la vraie vérification (session valide, rôle) est faite
 * côté serveur dans chaque page et chaque action (src/server/auth.ts).
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    // Espace MIA : sauf la page de connexion, il faut un cookie « mia_admin » (vérifié pour de bon côté serveur).
    if (request.nextUrl.pathname !== "/admin/connexion" && !request.cookies.has("mia_admin")) {
      return NextResponse.redirect(new URL("/admin/connexion", request.url));
    }
    return NextResponse.next();
  }
  if (!request.cookies.has("mia_session")) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/salon", "/salon/:path*", "/admin", "/admin/:path*"],
};
