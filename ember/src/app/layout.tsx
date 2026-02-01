import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Ember - Your AI Integrator",
    template: "%s | Ember",
  },
  description: "AI-powered EOS coaching and accountability for leadership teams. Ember helps you stay on track with Rocks, Scorecard, Issues, and L10 meetings.",
  applicationName: "Ember",
  authors: [{ name: "Caldera", url: "https://withcaldera.com" }],
  creator: "Caldera",
  publisher: "Caldera",
  keywords: ["EOS", "Entrepreneurial Operating System", "Traction", "L10", "Rocks", "Scorecard", "AI coaching", "leadership"],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    siteName: "Ember",
    title: "Ember - Your AI Integrator",
    description: "AI-powered EOS coaching and accountability for leadership teams",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ember - Your AI Integrator",
    description: "AI-powered EOS coaching and accountability for leadership teams",
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} antialiased`}
      >
        <ThemeProvider defaultTheme="system">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
