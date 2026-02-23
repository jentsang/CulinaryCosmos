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
    <html lang="en" className="overflow-hidden">
      <body className="antialiased h-screen w-full overflow-hidden bg-slate-900 text-gray-100">
        {children}
      </body>
    </html>
  );
}
