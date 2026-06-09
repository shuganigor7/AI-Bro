import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI BRO",
  description: "Твой личный ИИ-помощник с характером",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AI BRO",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full">
      <body className="h-full flex flex-col">{children}</body>
    </html>
  );
}
