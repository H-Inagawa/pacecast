import type { Metadata } from "next";
import { Kaisei_Opti } from "next/font/google";
import { AppChrome } from "../components/AppChrome";
import { AppHeader } from "../components/AppHeader";
import { AppProviders } from "../components/AppProviders";
import { OnboardingGate } from "../components/OnboardingGate";
import "./globals.css";

const kaiseiOpti = Kaisei_Opti({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-serif-jp",
});

export const metadata: Metadata = {
  title: "PaceCast",
  description: "気象条件からランニングパフォーマンスを予測する",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={kaiseiOpti.variable}>
      <body className={kaiseiOpti.className}>
        <AppProviders>
          <OnboardingGate>
            <AppChrome header={<AppHeader />}>
              <main className="page">{children}</main>
            </AppChrome>
          </OnboardingGate>
        </AppProviders>
      </body>
    </html>
  );
}
