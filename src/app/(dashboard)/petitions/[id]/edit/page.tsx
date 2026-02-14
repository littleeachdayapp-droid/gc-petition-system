"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ACTION_OPTIONS = [
  { value: "AMEND", label: "Amend existing text" },
  { value: "ADD", label: "Add new text" },
  { value: "DELETE", label: "Delete existing text" },
  { value: "REPLACE", label: "Replace existing text" },
  { value: "RENAME", label: "Rename section/paragraph" },
  { value: "RESTRUCTURE", label: "Restructure organization" },
  { value: "NEW_RESOLUTION", label: "New resolution" },
];

const BOOK_OPTIONS = [
  { value: "DISCIPLINE", label: "Book of Discipline" },
  { value: "RESOLUTIONS", label: "Book of Resolutions" },
  { value: "BOTH", label: "Both books" },
];

export default function EditPetitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [rationale, setRationale] = useState("");
  const [actionType, setActionType] = useState("AMEND");
  const [targetBook, setTargetBook] = useState("DISCIPLINE");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/petitions/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        if (data.status !== "DRAFT") {
          router.push(`/petitions/${id}`);
          return;
        }
        setTitle(data.title);
        setSummary(data.summary || "");
        setRationale(data.rationale || "");
        setActionType(data.actionType);
        setTargetBook(data.targetBook);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load petition");
        setLoading(false);
      });
  }, [id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);

    const res = await fetch(`/api/petitions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        summary: summary.trim() || null,
        rationale: rationale.trim() || null,
        actionType,
        targetBook,
      }),
    });

    setSaving(false);

    if (res.ok) {
      router.push(`/petitions/${id}`);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to update petition");
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">Loading...</div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/petitions/${id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Petition
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Petition</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="actionType"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Action Type
            </label>
            <select
              id="actionType"
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="targetBook"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Target Book
            </label>
            <select
              id="targetBook"
              value={targetBook}
              onChange={(e) => setTargetBook(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {BOOK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="summary"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Summary
          </label>
          <textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="rationale"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Rationale
          </label>
          <textarea
            id="rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-gray-900 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href={`/petitions/${id}`}
            className="border border-gray-300 rounded-lg px-6 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
