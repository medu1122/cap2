import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIMAP — AI Marketing Automation",
  description: "AI-Powered Marketing Automation Platform for Small Businesses",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
