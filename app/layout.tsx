import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-cairo" });

export const metadata: Metadata = {
  title: "HTS Media - حسابات الإيرادات والمصروفات",
  description: "نظام حسابات شركة HTS Media للتسويق الإلكتروني",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
