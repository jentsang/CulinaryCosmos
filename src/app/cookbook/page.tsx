import Link from "next/link";

export default function CookbookPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-slate-900 text-gray-100">
      <div className="max-w-lg w-full text-center">
        <div className="text-5xl mb-6">📖</div>
        <h1 className="text-3xl font-bold text-gray-100 mb-3">Cookbook</h1>
        <p className="text-gray-400 mb-8">
          Your saved flavor combinations and recipes will appear here.
        </p>
        <div className="border border-slate-600 rounded-xl p-8 bg-slate-800/60 text-gray-500 text-sm mb-8">
          Coming soon — bookmark your favourite pairings from the Flavor Network
          and generate recipe ideas with Gemini.
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-sky-300 hover:text-sky-200 hover:underline"
        >
          ← Back to Flavor Network
        </Link>
      </div>
    </div>
  );
}
