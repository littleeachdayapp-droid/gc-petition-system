"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PetitionStatusBadge } from "@/components/petition-status-badge";
import { PetitionStatus, AssignmentStatus } from "@prisma/client";

interface Assignment {
  id: string;
  status: AssignmentStatus;
  assignedAt: string;
  committee: { id: string; name: string; abbreviation: string };
}

interface PipelinePetition {
  id: string;
  displayNumber: string | null;
  title: string;
  status: PetitionStatus;
  actionType: string;
  targetBook: string;
  updatedAt: string;
  submitter: { id: string; name: string };
  conference: { id: string; name: string; year: number };
  assignments: Assignment[];
  _count: { targets: number };
}

interface Committee {
  id: string;
  name: string;
  abbreviation: string;
}

const PIPELINE_TABS = [
  { value: "", label: "All Active" },
  { value: "SUBMITTED", label: "Awaiting Routing" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "IN_COMMITTEE", label: "In Committee" },
  { value: "APPROVED_BY_COMMITTEE", label: "Approved" },
  { value: "REJECTED_BY_COMMITTEE", label: "Rejected" },
];

const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  DEFERRED: "Deferred",
};

const ASSIGNMENT_STATUS_COLORS: Record<AssignmentStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  DEFERRED: "bg-gray-100 text-gray-600",
};

export default function AdminPage() {
  const [petitions, setPetitions] = useState<PipelinePetition[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadPipeline = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);

    setLoading(true);
    fetch(`/api/admin/pipeline?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setPetitions(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [statusFilter, search]);

  useEffect(() => {
    loadPipeline();
  }, [loadPipeline]);

  useEffect(() => {
    fetch("/api/committees")
      .then((r) => r.json())
      .then((data) => setCommittees(Array.isArray(data) ? data : []));
  }, []);

  async function handleAutoRoute(petitionId: string) {
    setActionLoading(petitionId);
    const res = await fetch(`/api/petitions/${petitionId}/route-petition`, {
      method: "POST",
    });

    if (res.ok) {
      const result = await res.json();
      alert(
        result.newAssignments > 0
          ? `Routed to: ${result.assignedTo.join(", ")}`
          : "No matching committees found"
      );
      loadPipeline();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to route");
    }
    setActionLoading(null);
  }

  async function handleManualAssign(petitionId: string, committeeId: string) {
    setActionLoading(petitionId);
    const res = await fetch(`/api/petitions/${petitionId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ committeeId }),
    });

    if (res.ok) {
      loadPipeline();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to assign");
    }
    setActionLoading(null);
  }

  async function handleAssignmentStatus(
    assignmentId: string,
    status: AssignmentStatus
  ) {
    const res = await fetch(`/api/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      loadPipeline();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to update");
    }
  }

  async function handleRemoveAssignment(assignmentId: string) {
    if (!confirm("Remove this committee assignment?")) return;
    const res = await fetch(`/api/assignments/${assignmentId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      loadPipeline();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to remove");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Pipeline</h1>
          <p className="text-gray-600 mt-1">
            Route petitions to committees and manage assignments
          </p>
        </div>
        <Link
          href="/admin/users"
          className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800"
        >
          Manage Users
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {PIPELINE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              statusFilter === tab.value
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by title or number..."
          className="flex-1 max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Pipeline list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">
          Loading pipeline...
        </div>
      ) : petitions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No petitions in pipeline.
        </div>
      ) : (
        <div className="space-y-4">
          {petitions.map((p) => (
            <div key={p.id} className="bg-white border rounded-lg p-5">
              {/* Petition header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {p.displayNumber && (
                      <Link
                        href={`/petitions/${p.id}`}
                        className="font-mono text-sm font-bold text-blue-700 hover:underline"
                      >
                        {p.displayNumber}
                      </Link>
                    )}
                    <PetitionStatusBadge status={p.status} />
                  </div>
                  <Link
                    href={`/petitions/${p.id}`}
                    className="font-medium text-gray-900 hover:text-blue-700"
                  >
                    {p.title}
                  </Link>
                  <div className="text-xs text-gray-500 mt-1">
                    {p._count.targets} target(s) &middot; by{" "}
                    {p.submitter.name} &middot;{" "}
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Actions for SUBMITTED petitions */}
                {p.status === "SUBMITTED" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAutoRoute(p.id)}
                      disabled={actionLoading === p.id}
                      className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {actionLoading === p.id
                        ? "Routing..."
                        : "Auto-Route"}
                    </button>
                    <select
                      onChange={(e) => {
                        if (e.target.value)
                          handleManualAssign(p.id, e.target.value);
                        e.target.value = "";
                      }}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Manual assign...
                      </option>
                      {committees.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.abbreviation} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Manual assign for UNDER_REVIEW */}
                {p.status === "UNDER_REVIEW" && (
                  <select
                    onChange={(e) => {
                      if (e.target.value)
                        handleManualAssign(p.id, e.target.value);
                      e.target.value = "";
                    }}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs flex-shrink-0"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Add committee...
                    </option>
                    {committees
                      .filter(
                        (c) =>
                          !p.assignments.some(
                            (a) => a.committee.id === c.id
                          )
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.abbreviation} — {c.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {/* Assignments */}
              {p.assignments.length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Committee Assignments
                  </div>
                  <div className="space-y-2">
                    {p.assignments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between bg-gray-50 rounded px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold">
                            {a.committee.abbreviation}
                          </span>
                          <span className="text-sm text-gray-700">
                            {a.committee.name}
                          </span>
                          <span
                            className={`text-xs rounded-full px-2 py-0.5 font-medium ${ASSIGNMENT_STATUS_COLORS[a.status]}`}
                          >
                            {ASSIGNMENT_STATUS_LABELS[a.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <select
                            value={a.status}
                            onChange={(e) =>
                              handleAssignmentStatus(
                                a.id,
                                e.target.value as AssignmentStatus
                              )
                            }
                            className="border border-gray-300 rounded px-2 py-1 text-xs"
                          >
                            <option value="PENDING">Pending</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="DEFERRED">Deferred</option>
                          </select>
                          <button
                            onClick={() => handleRemoveAssignment(a.id)}
                            className="text-xs text-red-500 hover:text-red-700 px-1"
                            title="Remove assignment"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
