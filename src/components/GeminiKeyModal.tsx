"use client";

import { useState } from "react";

interface GeminiKeyModalProps {
  onSubmit: (key: string) => void;
  onDismiss: () => void;
}

export function GeminiKeyModal({ onSubmit, onDismiss }: GeminiKeyModalProps) {
  const [key, setKey] = useState("");

  const handleSubmit = () => {
    const trimmed = key.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-6 w-96 max-w-[90vw]">
        <h2 className="text-base font-bold text-gray-100 mb-2">
          Gemini API Key Required
        </h2>
        <p className="text-sm text-gray-400 mb-1">
          AI-powered search uses Google Gemini. Enter your own free API key to
          use this feature.
        </p>
        <p className="text-xs text-gray-500 mb-4">
          Your key is saved only in your browser and is never sent to our
          servers — it goes directly to Google.
        </p>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline mb-4"
        >
          Get a free API key at Google AI Studio
          <span aria-hidden>↗</span>
        </a>
        <input
          type="password"
          placeholder="AIzaSy..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-900 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary mb-4 block"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!key.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white disabled:opacity-40 hover:bg-blue-600"
          >
            Save & Search
          </button>
        </div>
      </div>
    </div>
  );
}
