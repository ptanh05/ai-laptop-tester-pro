import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Laptop Tester Pro",
  description: "Comprehensive hardware testing suite with AI-powered laptop evaluation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}