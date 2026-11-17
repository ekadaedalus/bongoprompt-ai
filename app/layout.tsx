import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BongoPrompt - Prompt-Driven Travel Planning & Auto-Budgeting Platform",
  description: "Describe your trip in one sentence. BongoPrompt plans your transport, hotel and guide across Bangladesh and builds the budget automatically.",
  keywords: ["travel", "Bangladesh", "trip planner", "AI", "budget", "hotels", "booking"],
  authors: [{ name: "Abir Hosen Oli" }],
  openGraph: {
    title: "BongoPrompt - Prompt-Driven Travel Planning & Auto-Budgeting Platform",
    description: "Describe your trip in one sentence. BongoPrompt plans it and builds the budget automatically.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}