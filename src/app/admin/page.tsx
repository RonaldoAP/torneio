import { notFound } from "next/navigation";
import { adminSlugConfigured } from "@/lib/auth";
import { AdminApp } from "@/components/admin/AdminApp";

export const dynamic = "force-dynamic";

// Transição/fallback: enquanto ADMIN_SLUG não estiver configurado, o admin fica
// acessível aqui (modo local, um dispositivo). Assim que você definir ADMIN_SLUG,
// esta rota some (404) e o admin passa a existir só na URL secreta /painel/<slug>.
export default function AdminPage() {
  if (adminSlugConfigured()) {
    notFound();
  }
  return <AdminApp />;
}
