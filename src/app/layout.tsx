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
        <main>{children}</main>
      </body>
    </html>
  );
}
