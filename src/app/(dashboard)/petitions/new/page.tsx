"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Conference {
  id: string;
  name: string;
  year: number;
  isActive: boolean;
}

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

export default function NewPetitionPage() {
  const router = useRouter();
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [rationale, setRationale] = useState("");
  const [actionType, setActionType] = useState("AMEND");
  const [targetBook, setTargetBook] = useState("DISCIPLINE");
  const [conferenceId, setConferenceId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/conferences")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setConferences(list);
        const active = list.find((c: Conference) => c.isActive);
        if (active) setConferenceId(active.id);
        else if (list.length > 0) setConferenceId(list[0].id);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (!conferenceId) {
      setError("Conference is required");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/petitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        summary: summary.trim() || null,
        rationale: rationale.trim() || null,
        actionType,
        targetBook,
        conferenceId,
      }),
    });

    setLoading(false);

    if (res.ok) {
      const petition = await res.json();
      router.push(`/petitions/${petition.id}`);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create petition");
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/petitions"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Petitions
        </Link>
        <h1 className="text-2xl font-bold mt-2">New Petition</h1>
        <p className="text-gray-600 mt-1">
          Create a draft petition. You can add targets and submit it later.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="conference"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Conference
          </label>
          <select
            id="conference"
            value={conferenceId}
            onChange={(e) => setConferenceId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {conferences.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.year})
              </option>
            ))}
          </select>
        </div>

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
            placeholder="Brief description of the proposed change"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            Summary{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Brief summary of what this petition proposes"
          />
        </div>

        <div>
          <label
            htmlFor="rationale"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Rationale{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Why is this change needed?"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-gray-900 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Draft"}
          </button>
          <Link
            href="/petitions"
            className="border border-gray-300 rounded-lg px-6 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
