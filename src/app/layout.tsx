import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { TabBar } from "@/components/TabBar";

const satoshi = localFont({
  src: [
    { path: "./fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/Satoshi-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Copa Costela · FIFA 26",
  description: "Torneio de FIFA 26 (EA Sports FC 26) em tempo real — liga, mata-mata e artilharia.",
};

export const viewport: Viewport = {
  themeColor: "#080D18",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={satoshi.variable}>
      <body className="font-sans antialiased">
        <TabBar />
        <main className="mx-auto w-full max-w-5xl px-3 pb-24 pt-4 sm:px-4">{children}</main>
      </body>
    </html>
  );
}
