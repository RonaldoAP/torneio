import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD não configurada no servidor." },
      { status: 500 },
    );
  }
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (body.password !== pwd) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  });
  return res;
}
