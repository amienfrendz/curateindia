import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "CurateIndia — Stay where India still lives",
  description:
    "A hand-curated collection of India's most extraordinary small stays — heritage havelis, plantation bungalows, tribal homestays, island retreats, forest lodges. Every property personally vetted for great food, expert hosts, and unforgettable experiences. Just describe what you want, we'll find the perfect stay.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${display.variable} ${sans.variable} font-sans antialiased min-h-screen`}>
        <div className="w-full overflow-x-hidden">
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
