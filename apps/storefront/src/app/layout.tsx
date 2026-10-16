import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { StoreProvider } from "@/components/Store";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Sonoran Slush · Gifts with a personal touch",
    template: "%s | Sonoran Slush",
  },
  description:
    "Personalized gifts, custom laser engraving, 3D photo crystals, and live event experiences. A small creative studio in Tucson, Arizona.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <Header />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </StoreProvider>
      </body>
    </html>
  );
}
