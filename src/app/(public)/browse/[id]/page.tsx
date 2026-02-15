"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { PetitionStatusBadge } from "@/components/petition-status-badge";
import { DiffViewer, type TargetDiff } from "@/components/diff-viewer";
import {
  PetitionStatus,
  CommitteeActionType,
  PlenaryActionType,
} from "@prisma/client";

interface Target {
  id: string;
  changeType: string;
  proposedText: string | null;
  paragraph: {
    id: string;
    number: number;
    title: string | null;
    currentText: string;
  } | null;
  resolution: {
    id: string;
    resolutionNumber: number;
    title: string;
    currentText: string;
  } | null;
}

interface Version {
  id: string;
  versionNum: number;
  stage: string;
  createdAt: string;
  createdBy: { id: string; name: string };
}

interface CommitteeAction {
  id: string;
  action: CommitteeActionType;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  notes: string | null;
  createdAt: string;
}

interface Assignment {
  id: string;
  committee: { id: string; name: string; abbreviation: string };
  actions: CommitteeAction[];
}

interface PlenaryVote {
  id: string;
  action: PlenaryActionType;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  notes: string | null;
  createdAt: string;
}

interface CalendarItemData {
  id: string;
  plenarySession: {
    id: string;
    sessionNumber: number;
    date: string;
    timeBlock: string;
  };
  actions: PlenaryVote[];
}

interface PublicPetition {
  id: string;
  displayNumber: string | null;
  title: string;
  summary: string | null;
  rationale: string | null;
  status: PetitionStatus;
  actionType: string;
  targetBook: string;
  createdAt: string;
  updatedAt: string;
  submitter: { id: string; name: string };
  conference: { id: string; name: string; year: number };
  targets: Target[];
  versions: Version[];
  assignments: Assignment[];
  calendarItems: CalendarItemData[];
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

const CHANGE_LABELS: Record<string, string> = {
  ADD_TEXT: "Add Text",
  DELETE_TEXT: "Delete Text",
  REPLACE_TEXT: "Replace Text",
  ADD_PARAGRAPH: "Add Paragraph",
  DELETE_PARAGRAPH: "Delete Paragraph",
  RESTRUCTURE: "Restructure",
};

const STAGE_LABELS: Record<string, string> = {
  ORIGINAL: "Original",
  COMMITTEE_AMENDED: "Committee Amended",
  PLENARY_AMENDED: "Plenary Amended",
  CONSENT_CALENDAR: "Consent Calendar",
  FINAL: "Final",
};

const COMMITTEE_ACTION_LABELS: Record<CommitteeActionType, string> = {
  APPROVE: "Approved",
  REJECT: "Rejected",
  AMEND_AND_APPROVE: "Amended & Approved",
  DEFER: "Deferred",
  REFER: "Referred",
  NO_ACTION: "No Action",
};

const COMMITTEE_ACTION_COLORS: Record<CommitteeActionType, string> = {
  APPROVE: "bg-green-100 text-green-800",
  REJECT: "bg-red-100 text-red-800",
  AMEND_AND_APPROVE: "bg-indigo-100 text-indigo-800",
  DEFER: "bg-yellow-100 text-yellow-800",
  REFER: "bg-purple-100 text-purple-800",
  NO_ACTION: "bg-gray-100 text-gray-700",
};

const PLENARY_ACTION_LABELS: Record<PlenaryActionType, string> = {
  ADOPT: "Adopted",
  DEFEAT: "Defeated",
  AMEND: "Amended",
  REFER_BACK: "Referred Back",
  TABLE: "Tabled",
  POSTPONE: "Postponed",
};

const PLENARY_ACTION_COLORS: Record<PlenaryActionType, string> = {
  ADOPT: "bg-green-100 text-green-800",
  DEFEAT: "bg-red-100 text-red-800",
  AMEND: "bg-indigo-100 text-indigo-800",
  REFER_BACK: "bg-orange-100 text-orange-800",
  TABLE: "bg-yellow-100 text-yellow-800",
  POSTPONE: "bg-gray-100 text-gray-700",
};

// Status flow for timeline
const STATUS_ORDER: PetitionStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "IN_COMMITTEE",
  "AMENDED",
  "APPROVED_BY_COMMITTEE",
  "ON_CALENDAR",
  "ADOPTED",
];

function getStatusIndex(status: PetitionStatus): number {
  const idx = STATUS_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

export default function PublicPetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [petition, setPetition] = useState<PublicPetition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<
    "details" | "targets" | "history" | "votes"
  >("details");
  const [diffs, setDiffs] = useState<TargetDiff[] | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null
  );

  const loadPetition = useCallback(() => {
    fetch(`/api/public/petitions/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setPetition(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Petition not found");
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    loadPetition();
  }, [loadPetition]);

  async function loadDiff(versionId: string) {
    setDiffLoading(true);
    setDiffs(null);
    setSelectedVersionId(versionId);

    try {
      const res = await fetch(
        `/api/petitions/${id}/versions/${versionId}`
      );
      if (res.ok) {
        const data = await res.json();
        setDiffs(data.diffs);
      }
    } catch {
      // silently fail
    } finally {
      setDiffLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">
        Loading petition...
      </div>
    );
  }

  if (error || !petition) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">{error || "Petition not found"}</p>
        <Link href="/browse" className="text-blue-600 hover:underline">
          Back to Browse
        </Link>
      </div>
    );
  }

  const currentIdx = getStatusIndex(petition.status);
  const hasVotes =
    petition.assignments.some((a) => a.actions.length > 0) ||
    petition.calendarItems.some((c) => c.actions.length > 0);

  return (
    <div>
      <div className="mb-6">
        <Link href="/browse" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Browse
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          {petition.displayNumber && (
            <span className="font-mono text-lg font-bold text-blue-700">
              {petition.displayNumber}
            </span>
          )}
          <PetitionStatusBadge status={petition.status} />
        </div>
        <h1 className="text-2xl font-bold">{petition.title}</h1>
        <div className="text-sm text-gray-500 mt-1">
          {ACTION_LABELS[petition.actionType]} &middot;{" "}
          {BOOK_LABELS[petition.targetBook]} &middot; by{" "}
          {petition.submitter.name} &middot; {petition.conference.name}
        </div>
      </div>

      {/* Status timeline */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_ORDER.map((s, i) => {
            const isReached = i <= currentIdx;
            const isCurrent = s === petition.status;
            return (
              <div key={s} className="flex items-center min-w-0">
                {i > 0 && (
                  <div
                    className={`w-8 h-0.5 ${
                      isReached ? "bg-blue-400" : "bg-gray-200"
                    }`}
                  />
                )}
                <div
                  className={`text-xs px-2 py-1 rounded-full whitespace-nowrap font-medium ${
                    isCurrent
                      ? "bg-blue-600 text-white"
                      : isReached
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {s.replace(/_/g, " ").replace(/BY /g, "by ")}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {(["details", "targets", "votes", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === tab
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "details" && "Details"}
            {tab === "targets" && `Targets (${petition.targets.length})`}
            {tab === "votes" && `Votes${hasVotes ? "" : ""}`}
            {tab === "history" && `History (${petition.versions.length})`}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {activeTab === "details" && (
        <div className="space-y-6">
          {petition.summary && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Summary
              </h3>
              <div className="bg-white border rounded-lg p-4 text-gray-800 whitespace-pre-wrap">
                {petition.summary}
              </div>
            </div>
          )}
          {petition.rationale && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Rationale
              </h3>
              <div className="bg-white border rounded-lg p-4 text-gray-800 whitespace-pre-wrap">
                {petition.rationale}
              </div>
            </div>
          )}

          {/* Committee assignments */}
          {petition.assignments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Committee Assignments
              </h3>
              <div className="space-y-2">
                {petition.assignments.map((a) => (
                  <div
                    key={a.id}
                    className="bg-white border rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-gray-100 text-gray-700 rounded px-1.5 py-0.5">
                        {a.committee.abbreviation}
                      </span>
                      <span className="text-sm text-gray-900">
                        {a.committee.name}
                      </span>
                    </div>
                    {a.actions.length > 0 && (
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 font-medium ${COMMITTEE_ACTION_COLORS[a.actions[0].action]}`}
                      >
                        {COMMITTEE_ACTION_LABELS[a.actions[0].action]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-white border rounded-lg p-4">
              <div className="text-gray-500">Submitted</div>
              <div className="font-medium">
                {new Date(petition.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <div className="text-gray-500">Last Updated</div>
              <div className="font-medium">
                {new Date(petition.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Targets tab */}
      {activeTab === "targets" && (
        <div>
          {petition.targets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No targets specified.
            </div>
          ) : (
            <div className="space-y-3">
              {petition.targets.map((t) => (
                <div key={t.id} className="bg-white border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5 font-medium">
                      {CHANGE_LABELS[t.changeType] || t.changeType}
                    </span>
                    {t.paragraph && (
                      <span className="font-mono text-sm font-bold text-blue-700">
                        &para;{t.paragraph.number}
                        {t.paragraph.title && (
                          <span className="font-normal text-gray-600 font-sans">
                            {" "}
                            &mdash; {t.paragraph.title}
                          </span>
                        )}
                      </span>
                    )}
                    {t.resolution && (
                      <span className="font-mono text-sm font-bold text-blue-700">
                        R{t.resolution.resolutionNumber}
                        <span className="font-normal text-gray-600 font-sans">
                          {" "}
                          &mdash; {t.resolution.title}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Current text */}
                  {(t.paragraph?.currentText || t.resolution?.currentText) && (
                    <div className="mt-2">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        Current Text
                      </div>
                      <div className="bg-gray-50 border rounded p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {t.paragraph?.currentText ||
                          t.resolution?.currentText}
                      </div>
                    </div>
                  )}

                  {/* Proposed text */}
                  {t.proposedText && (
                    <div className="mt-2">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        Proposed Text
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-gray-800 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {t.proposedText}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Votes tab */}
      {activeTab === "votes" && (
        <div className="space-y-6">
          {/* Committee votes */}
          {petition.assignments.some((a) => a.actions.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Committee Votes
              </h3>
              <div className="space-y-3">
                {petition.assignments
                  .filter((a) => a.actions.length > 0)
                  .map((a) =>
                    a.actions.map((act) => (
                      <div
                        key={act.id}
                        className="bg-white border rounded-lg p-4"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-xs font-bold bg-gray-100 text-gray-700 rounded px-1.5 py-0.5">
                            {a.committee.abbreviation}
                          </span>
                          <span
                            className={`text-xs rounded-full px-2 py-0.5 font-medium ${COMMITTEE_ACTION_COLORS[act.action]}`}
                          >
                            {COMMITTEE_ACTION_LABELS[act.action]}
                          </span>
                        </div>
                        <div className="flex gap-6 text-sm">
                          <span className="text-green-700">
                            {act.votesFor} For
                          </span>
                          <span className="text-red-700">
                            {act.votesAgainst} Against
                          </span>
                          <span className="text-gray-500">
                            {act.votesAbstain} Abstain
                          </span>
                        </div>
                        {act.notes && (
                          <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded p-2">
                            {act.notes}
                          </p>
                        )}
                        <div className="text-xs text-gray-400 mt-2">
                          {new Date(act.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
              </div>
            </div>
          )}

          {/* Plenary votes */}
          {petition.calendarItems.some((c) => c.actions.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Plenary Votes
              </h3>
              <div className="space-y-3">
                {petition.calendarItems
                  .filter((c) => c.actions.length > 0)
                  .map((c) =>
                    c.actions.map((act) => (
                      <div
                        key={act.id}
                        className="bg-white border rounded-lg p-4"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs bg-gray-100 text-gray-700 rounded px-1.5 py-0.5">
                            Session {c.plenarySession.sessionNumber}
                          </span>
                          <span
                            className={`text-xs rounded-full px-2 py-0.5 font-medium ${PLENARY_ACTION_COLORS[act.action]}`}
                          >
                            {PLENARY_ACTION_LABELS[act.action]}
                          </span>
                        </div>
                        <div className="flex gap-6 text-sm">
                          <span className="text-green-700">
                            {act.votesFor} For
                          </span>
                          <span className="text-red-700">
                            {act.votesAgainst} Against
                          </span>
                          <span className="text-gray-500">
                            {act.votesAbstain} Abstain
                          </span>
                        </div>
                        {act.notes && (
                          <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded p-2">
                            {act.notes}
                          </p>
                        )}
                        <div className="text-xs text-gray-400 mt-2">
                          {new Date(act.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
              </div>
            </div>
          )}

          {!hasVotes && (
            <div className="text-center py-8 text-gray-500">
              No votes have been recorded for this petition yet.
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {petition.versions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No version history available.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {petition.versions.map((v) => {
                  const isSelected = selectedVersionId === v.id;
                  return (
                    <div
                      key={v.id}
                      className={`bg-white border rounded-lg p-4 flex items-center justify-between transition-all ${
                        isSelected
                          ? "border-blue-400 ring-1 ring-blue-200"
                          : ""
                      }`}
                    >
                      <div>
                        <span className="font-medium">
                          Version {v.versionNum}
                        </span>
                        <span className="ml-2 text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                          {STAGE_LABELS[v.stage] || v.stage}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">
                          {v.createdBy.name} &middot;{" "}
                          {new Date(v.createdAt).toLocaleString()}
                        </span>
                        <button
                          onClick={() => loadDiff(v.id)}
                          className={`text-xs px-3 py-1 rounded font-medium ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          Red-line
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {diffLoading && (
                <div className="text-center py-8 text-gray-500">
                  Computing diff...
                </div>
              )}

              {diffs && !diffLoading && (
                <DiffViewer
                  diffs={diffs}
                  title="Proposed Changes (Red-line View)"
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
