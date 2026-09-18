import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Migration Agent — AI-Powered HR Data Migration",
  description: "AI-powered HR data migration with human-in-the-loop review",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Navbar */}
        <header className="sticky top-0 z-50 glass-card border-b">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shadow-sm">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M12 9v6" />
                </svg>
              </div>
              <span className="font-bold text-slate-900 text-[15px] tracking-tight">Migration Agent</span>
            </a>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">v1.0</span>
            </div>
          </div>
        </header>
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
