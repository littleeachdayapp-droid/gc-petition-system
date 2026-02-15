"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PetitionStatusBadge } from "@/components/petition-status-badge";
import { PetitionStatus } from "@prisma/client";

interface PetitionSummary {
  id: string;
  displayNumber: string | null;
  title: string;
  status: PetitionStatus;
  actionType: string;
  targetBook: string;
  createdAt: string;
  updatedAt: string;
  submitter: { id: string; name: string };
  conference: { id: string; name: string; year: number };
  _count: { targets: number; versions: number };
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "IN_COMMITTEE", label: "In Committee" },
  { value: "AMENDED", label: "Amended" },
  { value: "APPROVED_BY_COMMITTEE", label: "Committee Approved" },
  { value: "REJECTED_BY_COMMITTEE", label: "Committee Rejected" },
  { value: "ON_CALENDAR", label: "On Calendar" },
  { value: "ADOPTED", label: "Adopted" },
  { value: "DEFEATED", label: "Defeated" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

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
  DISCIPLINE: "Discipline",
  RESOLUTIONS: "Resolutions",
  BOTH: "Both",
};

export default function PetitionsPage() {
  const { data: session } = useSession();
  const [petitions, setPetitions] = useState<PetitionSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);

  const loadPetitions = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (mineOnly) params.set("mine", "true");
    if (search) params.set("search", search);

    setLoading(true);
    fetch(`/api/petitions?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setPetitions(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [statusFilter, mineOnly, search]);

  useEffect(() => {
    loadPetitions();
  }, [loadPetitions]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Petitions</h1>
          <p className="text-gray-600 mt-1">
            Submit and track legislative petitions
          </p>
        </div>
        {session?.user && (
          <Link
            href="/petitions/new"
            className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800"
          >
            New Petition
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Status
          </label>
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
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            className="rounded"
          />
          My petitions
        </label>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48"
          />
          <button
            type="submit"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSearchInput("");
              }}
              className="text-sm text-gray-500 hover:text-gray-700 px-2"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">
          Loading petitions...
        </div>
      ) : petitions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No petitions found.{" "}
          <Link
            href="/petitions/new"
            className="text-blue-600 hover:underline"
          >
            Create one
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {petitions.map((p) => (
            <Link
              key={p.id}
              href={`/petitions/${p.id}`}
              className="block bg-white border rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
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
                  <h3 className="font-medium text-gray-900 truncate">
                    {p.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{ACTION_LABELS[p.actionType] || p.actionType}</span>
                    <span>&middot;</span>
                    <span>{BOOK_LABELS[p.targetBook] || p.targetBook}</span>
                    <span>&middot;</span>
                    <span>{p._count.targets} target(s)</span>
                    <span>&middot;</span>
                    <span>by {p.submitter.name}</span>
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
    </div>
  );
}
