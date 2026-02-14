"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PetitionStatusBadge } from "@/components/petition-status-badge";
import {
  PetitionStatus,
  AssignmentStatus,
  CommitteeActionType,
  CommitteeRole,
  UserRole,
} from "@/generated/prisma/client";

interface Member {
  id: string;
  role: CommitteeRole;
  user: { id: string; name: string; email: string; role: UserRole };
}

interface CommitteeDetail {
  id: string;
  name: string;
  abbreviation: string;
  description: string | null;
  memberships: Member[];
  _count: { assignments: number; actions: number };
}

interface PetitionTarget {
  id: string;
  changeType: string;
  paragraph: { id: string; number: number; title: string | null } | null;
  resolution: {
    id: string;
    resolutionNumber: number;
    title: string;
  } | null;
}

interface AssignmentAction {
  id: string;
  action: CommitteeActionType;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  notes: string | null;
  createdAt: string;
}

interface AssignmentWithPetition {
  id: string;
  status: AssignmentStatus;
  assignedAt: string;
  petition: {
    id: string;
    displayNumber: string | null;
    title: string;
    status: PetitionStatus;
    summary: string | null;
    submitter: { id: string; name: string };
    targets: PetitionTarget[];
    _count: { versions: number };
  };
  actions: AssignmentAction[];
}

const COMMITTEE_ROLE_LABELS: Record<CommitteeRole, string> = {
  CHAIR: "Chair",
  VICE_CHAIR: "Vice Chair",
  SECRETARY: "Secretary",
  MEMBER: "Member",
};

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

const ACTION_LABELS: Record<CommitteeActionType, string> = {
  APPROVE: "Approve",
  REJECT: "Reject",
  AMEND_AND_APPROVE: "Amend & Approve",
  DEFER: "Defer",
  REFER: "Refer to Another Committee",
  NO_ACTION: "No Action",
};

const ACTION_COLORS: Record<CommitteeActionType, string> = {
  APPROVE: "bg-green-100 text-green-800",
  REJECT: "bg-red-100 text-red-800",
  AMEND_AND_APPROVE: "bg-indigo-100 text-indigo-800",
  DEFER: "bg-yellow-100 text-yellow-800",
  REFER: "bg-purple-100 text-purple-800",
  NO_ACTION: "bg-gray-100 text-gray-700",
};

export default function CommitteeWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [committee, setCommittee] = useState<CommitteeDetail | null>(null);
  const [assignments, setAssignments] = useState<AssignmentWithPetition[]>([]);
  const [activeTab, setActiveTab] = useState<
    "assignments" | "members" | "history"
  >("assignments");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  // Voting form state
  const [votingAssignmentId, setVotingAssignmentId] = useState<string | null>(
    null
  );
  const [voteAction, setVoteAction] = useState<CommitteeActionType>("APPROVE");
  const [votesFor, setVotesFor] = useState(0);
  const [votesAgainst, setVotesAgainst] = useState(0);
  const [votesAbstain, setVotesAbstain] = useState(0);
  const [voteNotes, setVoteNotes] = useState("");
  const [voteLoading, setVoteLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/committees/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setCommittee(data);
        setLoading(false);
      });
  }, [id]);

  const loadAssignments = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/committees/${id}/assignments?${params}`)
      .then((r) => r.json())
      .then((data) => setAssignments(Array.isArray(data) ? data : []));
  }, [id, statusFilter]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const isMember = committee?.memberships.some(
    (m) => m.user.id === session?.user?.id
  );
  const isChair = committee?.memberships.some(
    (m) =>
      m.user.id === session?.user?.id &&
      (m.role === "CHAIR" || m.role === "VICE_CHAIR")
  );
  const canVote = isChair || session?.user?.role === "STAFF" ||
    session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

  async function handleVote(assignmentId: string) {
    setVoteLoading(true);

    const res = await fetch(`/api/committees/${id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignmentId,
        action: voteAction,
        votesFor,
        votesAgainst,
        votesAbstain,
        notes: voteNotes || null,
      }),
    });

    setVoteLoading(false);

    if (res.ok) {
      setVotingAssignmentId(null);
      setVoteAction("APPROVE");
      setVotesFor(0);
      setVotesAgainst(0);
      setVotesAbstain(0);
      setVoteNotes("");
      loadAssignments();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to record vote");
    }
  }

  if (loading || !committee) {
    return (
      <div className="text-center py-20 text-gray-500">
        Loading committee...
      </div>
    );
  }

  const completedAssignments = assignments.filter(
    (a) => a.actions.length > 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/committees"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; All Committees
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <span className="font-mono text-lg font-bold bg-gray-100 text-gray-700 rounded px-2.5 py-1">
            {committee.abbreviation}
          </span>
          <h1 className="text-2xl font-bold">{committee.name}</h1>
        </div>
        {committee.description && (
          <p className="text-gray-600 mt-1">{committee.description}</p>
        )}
        <div className="flex gap-4 mt-2 text-sm text-gray-500">
          <span>{committee.memberships.length} member(s)</span>
          <span>{committee._count.assignments} assignment(s)</span>
          {isMember && (
            <span className="text-blue-600 font-medium">
              You are a member
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["assignments", "members", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === tab
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "assignments" && `Assignments (${assignments.length})`}
            {tab === "members" && `Members (${committee.memberships.length})`}
            {tab === "history" && `Actions (${completedAssignments.length})`}
          </button>
        ))}
      </div>

      {/* Assignments tab */}
      {activeTab === "assignments" && (
        <div>
          <div className="flex gap-2 mb-4">
            {["", "PENDING", "IN_PROGRESS", "COMPLETED", "DEFERRED"].map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium ${
                    statusFilter === s
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {s || "All"}
                </button>
              )
            )}
          </div>

          {assignments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No assignments found.
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((a) => (
                <div key={a.id} className="bg-white border rounded-lg p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {a.petition.displayNumber && (
                          <Link
                            href={`/petitions/${a.petition.id}`}
                            className="font-mono text-sm font-bold text-blue-700 hover:underline"
                          >
                            {a.petition.displayNumber}
                          </Link>
                        )}
                        <PetitionStatusBadge status={a.petition.status} />
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 font-medium ${ASSIGNMENT_STATUS_COLORS[a.status]}`}
                        >
                          {ASSIGNMENT_STATUS_LABELS[a.status]}
                        </span>
                      </div>
                      <Link
                        href={`/petitions/${a.petition.id}`}
                        className="font-medium text-gray-900 hover:text-blue-700"
                      >
                        {a.petition.title}
                      </Link>
                      {a.petition.summary && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {a.petition.summary}
                        </p>
                      )}
                      <div className="text-xs text-gray-500 mt-2">
                        {a.petition.targets.length} target(s) &middot; by{" "}
                        {a.petition.submitter.name} &middot; Assigned{" "}
                        {new Date(a.assignedAt).toLocaleDateString()}
                      </div>

                      {/* Targets summary */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {a.petition.targets.map((t) => (
                          <span
                            key={t.id}
                            className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5"
                          >
                            {t.paragraph
                              ? `¶${t.paragraph.number}`
                              : `R${t.resolution?.resolutionNumber}`}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Vote button */}
                    {canVote &&
                      (a.status === "PENDING" ||
                        a.status === "IN_PROGRESS") && (
                        <button
                          onClick={() =>
                            setVotingAssignmentId(
                              votingAssignmentId === a.id ? null : a.id
                            )
                          }
                          className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-blue-700 flex-shrink-0"
                        >
                          {votingAssignmentId === a.id
                            ? "Cancel"
                            : "Record Action"}
                        </button>
                      )}
                  </div>

                  {/* Voting form */}
                  {votingAssignmentId === a.id && (
                    <div className="border-t mt-4 pt-4">
                      <h4 className="text-sm font-semibold mb-3">
                        Record Committee Action
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Action
                          </label>
                          <select
                            value={voteAction}
                            onChange={(e) =>
                              setVoteAction(
                                e.target.value as CommitteeActionType
                              )
                            }
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                          >
                            {(
                              Object.entries(ACTION_LABELS) as [
                                CommitteeActionType,
                                string,
                              ][]
                            ).map(([val, label]) => (
                              <option key={val} value={val}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              For
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={votesFor}
                              onChange={(e) =>
                                setVotesFor(parseInt(e.target.value) || 0)
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Against
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={votesAgainst}
                              onChange={(e) =>
                                setVotesAgainst(parseInt(e.target.value) || 0)
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Abstain
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={votesAbstain}
                              onChange={(e) =>
                                setVotesAbstain(parseInt(e.target.value) || 0)
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Notes
                        </label>
                        <textarea
                          value={voteNotes}
                          onChange={(e) => setVoteNotes(e.target.value)}
                          rows={2}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                          placeholder="Optional notes about this action..."
                        />
                      </div>
                      <button
                        onClick={() => handleVote(a.id)}
                        disabled={voteLoading}
                        className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                      >
                        {voteLoading ? "Recording..." : "Submit Action"}
                      </button>
                    </div>
                  )}

                  {/* Previous actions */}
                  {a.actions.length > 0 && (
                    <div className="border-t mt-3 pt-3">
                      {a.actions.map((act) => (
                        <div
                          key={act.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span
                            className={`text-xs rounded-full px-2 py-0.5 font-medium ${ACTION_COLORS[act.action]}`}
                          >
                            {ACTION_LABELS[act.action]}
                          </span>
                          <span className="text-gray-500">
                            {act.votesFor}-{act.votesAgainst}-
                            {act.votesAbstain}
                          </span>
                          {act.notes && (
                            <span className="text-gray-500 truncate">
                              &mdash; {act.notes}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 ml-auto">
                            {new Date(act.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members tab */}
      {activeTab === "members" && (
        <div className="space-y-2">
          {committee.memberships.map((m) => (
            <div
              key={m.id}
              className="bg-white border rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <span className="font-medium text-gray-900">
                  {m.user.name}
                </span>
                <span className="text-sm text-gray-500 ml-2">
                  {m.user.email}
                </span>
              </div>
              <span
                className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${
                  m.role === "CHAIR"
                    ? "bg-purple-100 text-purple-700"
                    : m.role === "VICE_CHAIR"
                      ? "bg-blue-100 text-blue-700"
                      : m.role === "SECRETARY"
                        ? "bg-cyan-100 text-cyan-700"
                        : "bg-gray-100 text-gray-600"
                }`}
              >
                {COMMITTEE_ROLE_LABELS[m.role]}
              </span>
            </div>
          ))}
          {committee.memberships.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No members assigned to this committee.
            </div>
          )}
        </div>
      )}

      {/* Action history tab */}
      {activeTab === "history" && (
        <div>
          {completedAssignments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No actions recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {completedAssignments.map((a) =>
                a.actions.map((act) => (
                  <div
                    key={act.id}
                    className="bg-white border rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {a.petition.displayNumber && (
                        <Link
                          href={`/petitions/${a.petition.id}`}
                          className="font-mono text-sm font-bold text-blue-700 hover:underline"
                        >
                          {a.petition.displayNumber}
                        </Link>
                      )}
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 font-medium ${ACTION_COLORS[act.action]}`}
                      >
                        {ACTION_LABELS[act.action]}
                      </span>
                    </div>
                    <div className="text-sm text-gray-900">
                      {a.petition.title}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>
                        Vote: {act.votesFor}-{act.votesAgainst}-
                        {act.votesAbstain}
                      </span>
                      <span>
                        {new Date(act.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {act.notes && (
                      <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded p-2">
                        {act.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
