import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeriScope | AI-Assisted Scrutiny Workspace for AICTE Applications",
  description: "Secure, evidence-backed decision support platform for technical education regulatory scrutiny. Turns submitted document bundles into auditable review cases.",
};

import { AuthProvider } from "@/lib/auth-context";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-accent/30 selection:text-foreground">
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-accent-foreground focus:rounded-md focus:shadow-lg focus:outline-none"
        >
          Skip to content
        </a>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
