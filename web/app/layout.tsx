import type { Metadata } from "next";
import { AppHeader } from "../components/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "PaceCast",
  description: "気象条件からランニングパフォーマンスを予測する",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AppHeader />
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
