import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIMAP — AI Marketing Automation",
  description: "AI-Powered Marketing Automation Platform for Small Businesses",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-cover bg-center bg-no-repeat bg-fixed" style={{ backgroundImage: "url('/images/bg-main.png')" }}>
        {children}
      </body>
    </html>
  );
}
