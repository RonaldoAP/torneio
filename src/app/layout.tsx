import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { TabBar } from "@/components/TabBar";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Copa Costela · FIFA 26",
  description: "Torneio de FIFA 26 (EA Sports FC 26) em tempo real — liga, mata-mata e artilharia.",
};

export const viewport: Viewport = {
  themeColor: "#050A2C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body className="font-sans antialiased">
        <TabBar />
        <main className="mx-auto w-full max-w-5xl px-3 pb-24 pt-4 sm:px-4">{children}</main>
      </body>
    </html>
  );
}
