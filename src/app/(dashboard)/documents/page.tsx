"use client";

import { useState, useEffect, useCallback } from "react";
import { SectionTree } from "@/components/section-tree";
import { ParagraphViewer } from "@/components/paragraph-viewer";
import { ResolutionViewer } from "@/components/resolution-viewer";

interface BookSummary {
  id: string;
  title: string;
  editionYear: number;
  _count: { sections: number; paragraphs: number; resolutions: number };
}

interface SectionNode {
  id: string;
  title: string;
  level: number;
  sortOrder: number;
  children?: SectionNode[];
  _count?: { paragraphs: number; resolutions: number };
}

interface BookDetail {
  id: string;
  title: string;
  editionYear: number;
  sections: SectionNode[];
  _count: { paragraphs: number; resolutions: number };
}

export default function DocumentsPage() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [bookDetail, setBookDetail] = useState<BookDetail | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const contentType: "paragraphs" | "resolutions" =
    bookDetail && bookDetail._count.resolutions > 0
      ? "resolutions"
      : "paragraphs";

  // Load books on mount
  useEffect(() => {
    fetch("/api/books")
      .then((r) => r.json())
      .then((data) => {
        setBooks(data);
        if (data.length > 0) {
          setSelectedBookId(data[0].id);
        }
        setLoading(false);
      });
  }, []);

  // Load book detail when selected
  useEffect(() => {
    if (!selectedBookId) return;
    fetch(`/api/books/${selectedBookId}`)
      .then((r) => r.json())
      .then(setBookDetail);
  }, [selectedBookId]);

  // Load content when filters change
  const loadContent = useCallback(() => {
    if (!selectedBookId || !bookDetail) return;
    const type =
      bookDetail._count.resolutions > 0 ? "resolutions" : "paragraphs";
    const params = new URLSearchParams();
    if (selectedSectionId) params.set("sectionId", selectedSectionId);
    if (search) params.set("search", search);

    fetch(
      `/api/books/${selectedBookId}/${type}?${params.toString()}`
    )
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        setSelectedItemId(null);
      });
  }, [selectedBookId, bookDetail, selectedSectionId, search]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  function handleBookChange(bookId: string) {
    setSelectedBookId(bookId);
    setSelectedSectionId(null);
    setSelectedItemId(null);
    setSearch("");
    setSearchInput("");
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setSelectedItemId(null);
  }

  function clearSearch() {
    setSearch("");
    setSearchInput("");
    setSelectedItemId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        Loading documents...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Document Browser</h1>
        <p className="text-gray-600 mt-1">
          Browse the Book of Discipline and Book of Resolutions
        </p>
      </div>

      {/* Book tabs */}
      <div className="flex gap-2 mb-4">
        {books.map((book) => (
          <button
            key={book.id}
            onClick={() => handleBookChange(book.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedBookId === book.id
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {book.title} ({book.editionYear})
          </button>
        ))}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={`Search ${contentType === "resolutions" ? "resolutions" : "paragraphs"} by title or text...`}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={clearSearch}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </form>

      {/* Two-panel layout */}
      <div className="flex gap-4">
        {/* Sidebar - section tree */}
        <div
          className={`flex-shrink-0 transition-all ${
            sidebarOpen ? "w-72" : "w-0"
          } overflow-hidden`}
        >
          <div className="bg-white border rounded-lg p-3 h-[calc(100vh-300px)] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Sections</h3>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                Hide
              </button>
            </div>
            {bookDetail && (
              <SectionTree
                sections={bookDetail.sections}
                selectedSectionId={selectedSectionId}
                onSelectSection={(id) => {
                  setSelectedSectionId(id);
                  setSelectedItemId(null);
                }}
                contentType={contentType}
              />
            )}
          </div>
        </div>

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex-shrink-0 bg-white border rounded-lg px-2 py-1 text-xs text-gray-500 hover:text-gray-700 h-fit"
          >
            Show Sections
          </button>
        )}

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {search && (
            <div className="text-sm text-gray-500 mb-3">
              Showing results for &ldquo;{search}&rdquo; ({items.length} found)
            </div>
          )}
          {contentType === "paragraphs" ? (
            <ParagraphViewer
              paragraphs={items}
              selectedId={selectedItemId}
              onSelect={setSelectedItemId}
            />
          ) : (
            <ResolutionViewer
              resolutions={items}
              selectedId={selectedItemId}
              onSelect={setSelectedItemId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
