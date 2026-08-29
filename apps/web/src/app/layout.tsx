import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Patentory — Ar-Ge Patent Kütüphanesi",
  description:
    "Kimya ve malzeme patentlerini yapılandırılmış, aranabilir Ar-Ge bilgisine dönüştürün.",
  icons: {
    icon: "/patentory-icon.png",
    apple: "/patentory-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
