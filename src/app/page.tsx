import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <h1 className="text-3xl font-bold mb-2">FlavorNetwork</h1>
      <p className="text-gray-600 mb-6">Network visualization for flavour pairings</p>
      <Link
        href="/graph"
        className="text-primary font-semibold hover:underline"
      >
        View Flavour Graph →
      </Link>
    </div>
  );
}
