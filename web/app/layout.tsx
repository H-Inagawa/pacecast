import type { Metadata } from "next";
import { AppHeader } from "../components/AppHeader";
import { AppProviders } from "../components/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "PaceCast",
  description: "気象条件からランニングパフォーマンスを予測する",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AppProviders>
          <AppHeader />
          <main className="page">{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
