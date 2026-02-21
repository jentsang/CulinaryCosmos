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
      <body className="antialiased min-h-screen min-w-full overflow-hidden bg-gray-50 text-black">
        <main className="h-screen w-full overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
