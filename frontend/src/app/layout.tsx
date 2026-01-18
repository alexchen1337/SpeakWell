import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import "./globals.css";

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
      <body suppressHydrationWarning>
        <AuthProvider>
          <Header />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
