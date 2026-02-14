"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PetitionStatusBadge } from "@/components/petition-status-badge";
import { PetitionStatus } from "@/generated/prisma/client";

interface PetitionSummary {
  id: string;
  displayNumber: string | null;
  title: string;
  summary: string | null;
  status: PetitionStatus;
  actionType: string;
  targetBook: string;
  updatedAt: string;
  submitter: { id: string; name: string };
  conference: { id: string; name: string; year: number };
  _count: { targets: number; versions: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ACTION_LABELS: Record<string, string> = {
  AMEND: "Amend",
  ADD: "Add",
  DELETE: "Delete",
  REPLACE: "Replace",
  RENAME: "Rename",
  RESTRUCTURE: "Restructure",
  NEW_RESOLUTION: "New Resolution",
};

const BOOK_LABELS: Record<string, string> = {
  DISCIPLINE: "Book of Discipline",
  RESOLUTIONS: "Book of Resolutions",
  BOTH: "Both Books",
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "IN_COMMITTEE", label: "In Committee" },
  { value: "AMENDED", label: "Amended" },
  { value: "APPROVED_BY_COMMITTEE", label: "Approved by Committee" },
  { value: "REJECTED_BY_COMMITTEE", label: "Rejected by Committee" },
  { value: "ON_CALENDAR", label: "On Calendar" },
  { value: "ADOPTED", label: "Adopted" },
  { value: "DEFEATED", label: "Defeated" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "title", label: "Title (A-Z)" },
  { value: "number", label: "Petition Number" },
];

export default function BrowsePetitionsPage() {
  const [petitions, setPetitions] = useState<PetitionSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);

  const loadPetitions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    params.set("sort", sortBy);
    params.set("page", String(page));
    params.set("limit", "20");

    fetch(`/api/public/petitions?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setPetitions(data.petitions || []);
        setPagination(data.pagination || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [search, statusFilter, sortBy, page]);

  useEffect(() => {
    loadPetitions();
  }, [loadPetitions]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortBy]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Browse Petitions</h1>
        <p className="text-gray-600 mt-1">
          Search and explore General Conference petitions
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, number, or summary..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      {pagination && !loading && (
        <div className="text-sm text-gray-500">
          {pagination.total} petition{pagination.total !== 1 ? "s" : ""} found
        </div>
      )}

      {/* Petition list */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">
          Loading petitions...
        </div>
      ) : petitions.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No petitions found matching your criteria.
        </div>
      ) : (
        <div className="space-y-3">
          {petitions.map((p) => (
            <Link
              key={p.id}
              href={`/browse/${p.id}`}
              className="block bg-white border rounded-lg p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {p.displayNumber && (
                      <span className="font-mono text-sm font-bold text-blue-700">
                        {p.displayNumber}
                      </span>
                    )}
                    <PetitionStatusBadge status={p.status} />
                  </div>
                  <h3 className="font-medium text-gray-900">{p.title}</h3>
                  {p.summary && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {p.summary}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                    <span>{ACTION_LABELS[p.actionType] || p.actionType}</span>
                    <span>{BOOK_LABELS[p.targetBook] || p.targetBook}</span>
                    <span>{p._count.targets} target(s)</span>
                    <span>by {p.submitter.name}</span>
                    <span>{p.conference.name}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(p.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= pagination.totalPages}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
