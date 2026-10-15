import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GeistPixelSquare } from "geist/font/pixel";
import { AgentationToolbar } from "@/components/dev/agentation-toolbar";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { JS_BOOT } from "@/lib/motion";
import { THEME_BOOT } from "@/lib/theme";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const TITLE = "Papersseum";
const DESCRIPTION = "A season-long bot tournament for IIITDM Jabalpur. Write a Python agent and climb the ladder.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: TITLE, template: "%s · Papersseum" },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: TITLE, title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${GeistPixelSquare.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: JS_BOOT + THEME_BOOT }} />
      </head>
      <body>
        <SiteHeader />
        <main className="wrap">{children}</main>
        <SiteFooter />
        {process.env.NODE_ENV === "development" && <AgentationToolbar />}
      </body>
    </html>
  );
}
