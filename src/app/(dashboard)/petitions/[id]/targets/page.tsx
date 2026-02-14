"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface BookSummary {
  id: string;
  title: string;
  editionYear: number;
  _count: { paragraphs: number; resolutions: number };
}

interface ParagraphOption {
  id: string;
  number: number;
  title: string | null;
}

interface ResolutionOption {
  id: string;
  resolutionNumber: number;
  title: string;
}

interface TargetEntry {
  key: string;
  paragraphId: string | null;
  resolutionId: string | null;
  changeType: string;
  proposedText: string;
  label: string;
}

const CHANGE_OPTIONS = [
  { value: "ADD_TEXT", label: "Add text" },
  { value: "DELETE_TEXT", label: "Delete text" },
  { value: "REPLACE_TEXT", label: "Replace text" },
  { value: "ADD_PARAGRAPH", label: "Add paragraph" },
  { value: "DELETE_PARAGRAPH", label: "Delete paragraph" },
  { value: "RESTRUCTURE", label: "Restructure" },
];

let keyCounter = 0;

export default function TargetsEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [paragraphs, setParagraphs] = useState<ParagraphOption[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionOption[]>([]);
  const [targets, setTargets] = useState<TargetEntry[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load books + existing targets
  useEffect(() => {
    Promise.all([
      fetch("/api/books").then((r) => r.json()),
      fetch(`/api/petitions/${id}`).then((r) => r.json()),
    ]).then(([booksData, petition]) => {
      setBooks(booksData);
      if (booksData.length > 0) setSelectedBookId(booksData[0].id);

      // Load existing targets
      if (petition.targets) {
        const existing: TargetEntry[] = petition.targets.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (t: any) => ({
            key: `existing-${keyCounter++}`,
            paragraphId: t.paragraph?.id || null,
            resolutionId: t.resolution?.id || null,
            changeType: t.changeType,
            proposedText: t.proposedText || "",
            label: t.paragraph
              ? `¶${t.paragraph.number}${t.paragraph.title ? ` — ${t.paragraph.title}` : ""}`
              : t.resolution
                ? `R${t.resolution.resolutionNumber} — ${t.resolution.title}`
                : "Unknown",
          })
        );
        setTargets(existing);
      }
      setLoading(false);
    });
  }, [id]);

  // Load paragraphs/resolutions when book changes
  useEffect(() => {
    if (!selectedBookId) return;
    const book = books.find((b) => b.id === selectedBookId);
    if (!book) return;

    const params = new URLSearchParams();
    if (search) params.set("search", search);

    if (book._count.paragraphs > 0) {
      fetch(`/api/books/${selectedBookId}/paragraphs?${params}`)
        .then((r) => r.json())
        .then(setParagraphs);
      setResolutions([]);
    } else {
      fetch(`/api/books/${selectedBookId}/resolutions?${params}`)
        .then((r) => r.json())
        .then(setResolutions);
      setParagraphs([]);
    }
  }, [selectedBookId, books, search]);

  function addParagraphTarget(p: ParagraphOption) {
    setTargets((prev) => [
      ...prev,
      {
        key: `new-${keyCounter++}`,
        paragraphId: p.id,
        resolutionId: null,
        changeType: "REPLACE_TEXT",
        proposedText: "",
        label: `¶${p.number}${p.title ? ` — ${p.title}` : ""}`,
      },
    ]);
  }

  function addResolutionTarget(r: ResolutionOption) {
    setTargets((prev) => [
      ...prev,
      {
        key: `new-${keyCounter++}`,
        paragraphId: null,
        resolutionId: r.id,
        changeType: "REPLACE_TEXT",
        proposedText: "",
        label: `R${r.resolutionNumber} — ${r.title}`,
      },
    ]);
  }

  function removeTarget(key: string) {
    setTargets((prev) => prev.filter((t) => t.key !== key));
  }

  function updateTarget(key: string, field: string, value: string) {
    setTargets((prev) =>
      prev.map((t) => (t.key === key ? { ...t, [field]: value } : t))
    );
  }

  async function handleSave() {
    if (targets.length === 0) {
      setError("Add at least one target");
      return;
    }

    setSaving(true);
    setError("");

    const res = await fetch(`/api/petitions/${id}/targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targets: targets.map((t) => ({
          paragraphId: t.paragraphId,
          resolutionId: t.resolutionId,
          changeType: t.changeType,
          proposedText: t.proposedText || null,
        })),
      }),
    });

    setSaving(false);

    if (res.ok) {
      router.push(`/petitions/${id}`);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save targets");
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">Loading...</div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/petitions/${id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Petition
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Targets</h1>
        <p className="text-gray-600 mt-1">
          Select which paragraphs or resolutions this petition affects.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Browse & select */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Browse Documents
          </h2>

          <div className="flex gap-2 mb-3">
            {books.map((book) => (
              <button
                key={book.id}
                onClick={() => {
                  setSelectedBookId(book.id);
                  setSearch("");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  selectedBookId === book.id
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {book.title.replace("The Book of ", "")}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by number or title..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="border rounded-lg max-h-96 overflow-y-auto">
            {paragraphs.length > 0 &&
              paragraphs.map((p) => {
                const alreadyAdded = targets.some(
                  (t) => t.paragraphId === p.id
                );
                return (
                  <button
                    key={p.id}
                    onClick={() => !alreadyAdded && addParagraphTarget(p)}
                    disabled={alreadyAdded}
                    className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 ${
                      alreadyAdded
                        ? "bg-blue-50 text-blue-400"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-mono font-bold text-blue-700">
                      &para;{p.number}
                    </span>{" "}
                    {p.title || "Untitled"}
                    {alreadyAdded && (
                      <span className="float-right text-xs">Added</span>
                    )}
                  </button>
                );
              })}
            {resolutions.length > 0 &&
              resolutions.map((r) => {
                const alreadyAdded = targets.some(
                  (t) => t.resolutionId === r.id
                );
                return (
                  <button
                    key={r.id}
                    onClick={() => !alreadyAdded && addResolutionTarget(r)}
                    disabled={alreadyAdded}
                    className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 ${
                      alreadyAdded
                        ? "bg-blue-50 text-blue-400"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-mono font-bold text-blue-700">
                      R{r.resolutionNumber}
                    </span>{" "}
                    {r.title}
                    {alreadyAdded && (
                      <span className="float-right text-xs">Added</span>
                    )}
                  </button>
                );
              })}
            {paragraphs.length === 0 && resolutions.length === 0 && (
              <div className="p-4 text-sm text-gray-500 text-center">
                No results found.
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected targets */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Selected Targets ({targets.length})
          </h2>

          {targets.length === 0 ? (
            <div className="border rounded-lg p-8 text-center text-gray-500 text-sm">
              Click a paragraph or resolution from the left to add it as a
              target.
            </div>
          ) : (
            <div className="space-y-3">
              {targets.map((t) => (
                <div
                  key={t.key}
                  className="border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{t.label}</span>
                    <button
                      onClick={() => removeTarget(t.key)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  <select
                    value={t.changeType}
                    onChange={(e) =>
                      updateTarget(t.key, "changeType", e.target.value)
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mb-2"
                  >
                    {CHANGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={t.proposedText}
                    onChange={(e) =>
                      updateTarget(t.key, "proposedText", e.target.value)
                    }
                    rows={3}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Proposed new text (optional)"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-gray-900 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Targets"}
            </button>
            <Link
              href={`/petitions/${id}`}
              className="border border-gray-300 rounded-lg px-6 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
