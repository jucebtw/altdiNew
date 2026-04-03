import type { Metadata } from "next";
import { Cormorant_Garamond, Noto_Sans } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";

const serif = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Noto_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atelier Local — декор от локальных мастеров",
  description:
    "Онлайн-витрина предметов интерьера ручной работы от дизайнеров и творческих мастерских.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${serif.variable} ${sans.variable}`}>
      <body className="font-sans min-h-screen bg-cream text-charcoal antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
