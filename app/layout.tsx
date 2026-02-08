import type { Metadata } from "next";
import { Amiri } from "next/font/google";
import "./globals.css";

const amiri = Amiri({
  weight: ["400", "700"],
  subsets: ["arabic"],
  variable: "--font-amiri",
});

export const metadata: Metadata = {
  title: "تصحيح التلاوة - Quran Recitation",
  description: "Record your Quran recitation and get instant feedback on mistakes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${amiri.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
