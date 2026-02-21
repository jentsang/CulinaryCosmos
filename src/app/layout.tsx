import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlavorNetwork",
  description: "FlavorNetwork - network visualization for flavour pairings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-white text-black">
        <header className="border-b border-gray-200 px-6 py-4">
          <nav className="flex gap-6">
            <a href="/" className="font-semibold text-primary hover:underline">
              FlavorNetwork
            </a>
            <a href="/graph" className="text-gray-600 hover:text-primary hover:underline">
              Graph
            </a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
