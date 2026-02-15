"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PetitionStatusBadge } from "@/components/petition-status-badge";
import {
  PetitionStatus,
  PlenaryActionType,
  CommitteeActionType,
} from "@prisma/client";

interface VoteAction {
  id: string;
  action: PlenaryActionType | CommitteeActionType;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
}

interface ResultPetition {
  id: string;
  displayNumber: string | null;
  title: string;
  summary: string | null;
  status: PetitionStatus;
  updatedAt: string;
  submitter: { id: string; name: string };
  conference: { id: string; name: string; year: number };
  _count: { targets: number };
  calendarItems: {
    actions: VoteAction[];
  }[];
  assignments: {
    committee: { name: string; abbreviation: string };
    actions: VoteAction[];
  }[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ResultsPage() {
  const [petitions, setPetitions] = useState<ResultPetition[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [summary, setSummary] = useState({ adopted: 0, defeated: 0 });
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState("");
  const [page, setPage] = useState(1);

  const loadResults = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (outcome) params.set("outcome", outcome);
    params.set("page", String(page));
    params.set("limit", "20");

    fetch(`/api/public/results?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setPetitions(data.petitions || []);
        setPagination(data.pagination || null);
        setSummary(data.summary || { adopted: 0, defeated: 0 });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [outcome, page]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  useEffect(() => {
    setPage(1);
  }, [outcome]);

  function getFinalVote(petition: ResultPetition): VoteAction | null {
    for (const ci of petition.calendarItems) {
      if (ci.actions.length > 0) return ci.actions[0];
    }
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Voting Results</h1>
        <p className="text-gray-600 mt-1">
          Final outcomes of General Conference petitions
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-gray-900">
            {summary.adopted + summary.defeated}
          </div>
          <div className="text-sm text-gray-500 mt-1">Total Decided</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-green-700">
            {summary.adopted}
          </div>
          <div className="text-sm text-green-600 mt-1">Adopted</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-red-700">
            {summary.defeated}
          </div>
          <div className="text-sm text-red-600 mt-1">Defeated</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { value: "", label: "All Results" },
          { value: "adopted", label: "Adopted" },
          { value: "defeated", label: "Defeated" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setOutcome(opt.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              outcome === opt.value
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Results list */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">
          Loading results...
        </div>
      ) : petitions.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No results to display yet. Petitions will appear here after plenary
          voting.
        </div>
      ) : (
        <div className="space-y-3">
          {petitions.map((p) => {
            const finalVote = getFinalVote(p);

            return (
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
                      <span>{p._count.targets} target(s)</span>
                      <span>by {p.submitter.name}</span>
                      <span>{p.conference.name}</span>
                    </div>
                  </div>

                  {/* Vote result */}
                  <div className="flex-shrink-0 text-right">
                    {finalVote && (
                      <div>
                        <div className="flex gap-3 text-sm justify-end">
                          <span className="text-green-700 font-medium">
                            {finalVote.votesFor}
                          </span>
                          <span className="text-gray-400">-</span>
                          <span className="text-red-700 font-medium">
                            {finalVote.votesAgainst}
                          </span>
                          <span className="text-gray-400">-</span>
                          <span className="text-gray-500">
                            {finalVote.votesAbstain}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          For - Against - Abstain
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
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
