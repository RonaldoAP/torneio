import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import "./globals.css";
import { TabBar } from "@/components/TabBar";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Torneio FIFA 26",
  description: "Torneio de FIFA 26 (EA Sports FC 26) em tempo real — liga, mata-mata e artilharia.",
};

export const viewport: Viewport = {
  themeColor: "#080D18",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${bebas.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        <TabBar />
        <main className="mx-auto w-full max-w-5xl px-3 pb-24 pt-4 sm:px-4">{children}</main>
      </body>
    </html>
  );
}
