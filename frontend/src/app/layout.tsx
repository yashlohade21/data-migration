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
        <header className="sticky top-0 z-50 glass-nav">
          <div className="max-w-7xl mx-auto px-6 h-[56px] flex items-center justify-between">
            <a href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:shadow-lg group-hover:shadow-indigo-500/30 transition-all">
                <svg className="w-[18px] h-[18px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <span className="font-bold text-gray-900 text-[15px] leading-tight tracking-tight">Migration Agent</span>
            </a>
            <div className="flex items-center gap-3">
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
