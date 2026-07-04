import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const ADMIN_COOKIE = "torneio_admin";

/** Token derivado da senha — o cookie guarda isto, não a senha em claro. */
export function adminToken(): string {
  const pwd = process.env.ADMIN_PASSWORD ?? "";
  // token simples e determinístico (base64 da senha). httpOnly no cookie.
  return Buffer.from(`torneio:${pwd}`).toString("base64");
}

export function isAdminRequest(): boolean {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) return false;
  const cookie = cookies().get(ADMIN_COOKIE)?.value;
  return Boolean(cookie) && cookie === adminToken();
}

/** Envolve um handler de rota exigindo autenticação de admin. */
export function requireAdmin(): NextResponse | null {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return null;
}
