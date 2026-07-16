import { NextResponse } from "next/server";

/** Slug secreto do admin (definido em ADMIN_SLUG no servidor). */
export function getAdminSlug(): string {
  return process.env.ADMIN_SLUG ?? "";
}

export function adminSlugConfigured(): boolean {
  return getAdminSlug().length > 0;
}

/** Confere se o slug informado bate com o secreto do servidor. */
export function isValidAdminSlug(slug: string | null | undefined): boolean {
  const secret = getAdminSlug();
  return secret.length > 0 && slug === secret;
}

/** Bloqueia rotas de gravação sem o slug secreto (enviado no header x-admin-slug). */
export function requireAdmin(req: Request): NextResponse | null {
  const slug = req.headers.get("x-admin-slug");
  if (!isValidAdminSlug(slug)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return null;
}
