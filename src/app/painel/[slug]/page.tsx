import { notFound } from "next/navigation";
import { isValidAdminSlug } from "@/lib/auth";
import { AdminApp } from "@/components/admin/AdminApp";

export const dynamic = "force-dynamic";

// Painel de admin numa URL secreta: /painel/<slug>. Slug errado → 404 (nem revela
// que o admin existe). Sem senha — quem tem o link secreto administra.
export default function PainelPage({ params }: { params: { slug: string } }) {
  if (!isValidAdminSlug(params.slug)) {
    notFound();
  }
  return <AdminApp slug={params.slug} />;
}
