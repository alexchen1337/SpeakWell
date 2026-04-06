import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import { ConfirmProvider } from "@/contexts/ConfirmContext";
import Header from "@/components/Header";
import KeyboardProvider from "@/components/KeyboardProvider"
import { AppToaster } from "@/components/AppToaster";
import "../styles/tokens.css";
import "./globals.css";
import "../styles/library.css";
import "../styles/studio-pages.css";
import "../styles/studio-surface.css";

export const metadata: Metadata = {
  title: "SpeakWell",
  description: "Upload, transcribe, and analyze your presentation audio files",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ConfirmProvider>
            <Header />
            <KeyboardProvider>
              {children}
            </KeyboardProvider>
            <AppToaster />
          </ConfirmProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
