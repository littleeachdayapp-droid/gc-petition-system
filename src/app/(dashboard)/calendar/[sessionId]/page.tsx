"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PetitionStatusBadge } from "@/components/petition-status-badge";
import {
  PetitionStatus,
  PlenaryActionType,
  CalendarType,
} from "@prisma/client";

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

interface CalendarPetition {
  id: string;
  displayNumber: string | null;
  title: string;
  status: PetitionStatus;
  summary: string | null;
  submitter: { id: string; name: string };
  targets: PetitionTarget[];
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
  calendarType: CalendarType;
  orderNumber: number;
  petition: CalendarPetition;
  actions: PlenaryVote[];
}

interface SessionDetail {
  id: string;
  sessionNumber: number;
  date: string;
  timeBlock: string;
  notes: string | null;
  conference: { id: string; name: string; year: number };
  items: CalendarItemData[];
}

interface CalendarablePetition {
  id: string;
  displayNumber: string | null;
  title: string;
  status: PetitionStatus;
}

const TIME_BLOCK_LABELS: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
};

const CALENDAR_TYPE_LABELS: Record<CalendarType, string> = {
  CONSENT: "Consent Calendar",
  REGULAR: "Regular Calendar",
  SPECIAL_ORDER: "Special Order",
};

const CALENDAR_TYPE_COLORS: Record<CalendarType, string> = {
  CONSENT: "bg-green-100 text-green-700",
  REGULAR: "bg-blue-100 text-blue-700",
  SPECIAL_ORDER: "bg-purple-100 text-purple-700",
};

const PLENARY_ACTION_LABELS: Record<PlenaryActionType, string> = {
  ADOPT: "Adopt",
  DEFEAT: "Defeat",
  AMEND: "Amend",
  REFER_BACK: "Refer Back",
  TABLE: "Table",
  POSTPONE: "Postpone",
};

const PLENARY_ACTION_COLORS: Record<PlenaryActionType, string> = {
  ADOPT: "bg-green-100 text-green-800",
  DEFEAT: "bg-red-100 text-red-800",
  AMEND: "bg-indigo-100 text-indigo-800",
  REFER_BACK: "bg-orange-100 text-orange-800",
  TABLE: "bg-yellow-100 text-yellow-800",
  POSTPONE: "bg-gray-100 text-gray-700",
};

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const { data: userSession } = useSession();
  const [plenarySession, setPlenarySession] = useState<SessionDetail | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add item state
  const [showAddItem, setShowAddItem] = useState(false);
  const [availablePetitions, setAvailablePetitions] = useState<
    CalendarablePetition[]
  >([]);
  const [selectedPetitionId, setSelectedPetitionId] = useState("");
  const [selectedCalendarType, setSelectedCalendarType] =
    useState<CalendarType>("REGULAR");
  const [addingItem, setAddingItem] = useState(false);

  // Voting state
  const [votingItemId, setVotingItemId] = useState<string | null>(null);
  const [voteAction, setVoteAction] = useState<PlenaryActionType>("ADOPT");
  const [votesFor, setVotesFor] = useState(0);
  const [votesAgainst, setVotesAgainst] = useState(0);
  const [votesAbstain, setVotesAbstain] = useState(0);
  const [voteNotes, setVoteNotes] = useState("");
  const [voteLoading, setVoteLoading] = useState(false);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>("");

  const isStaff =
    userSession?.user?.role === "STAFF" ||
    userSession?.user?.role === "ADMIN" ||
    userSession?.user?.role === "SUPER_ADMIN";

  const loadSession = useCallback(() => {
    fetch(`/api/plenary-sessions/${sessionId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        setPlenarySession(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load session");
        setLoading(false);
      });
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Load available petitions when add item form is shown
  useEffect(() => {
    if (!showAddItem) return;
    fetch(
      "/api/petitions?status=APPROVED_BY_COMMITTEE&status=AMENDED&status=REJECTED_BY_COMMITTEE"
    )
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAvailablePetitions(list);
        if (list.length > 0) setSelectedPetitionId(list[0].id);
      });
  }, [showAddItem]);

  async function handleAddItem() {
    if (!selectedPetitionId) return;
    setAddingItem(true);
    setError("");

    const res = await fetch(
      `/api/plenary-sessions/${sessionId}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          petitionId: selectedPetitionId,
          calendarType: selectedCalendarType,
        }),
      }
    );

    setAddingItem(false);

    if (res.ok) {
      setShowAddItem(false);
      setSelectedPetitionId("");
      loadSession();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to add item");
    }
  }

  async function handleVote(itemId: string) {
    setVoteLoading(true);
    setError("");

    const res = await fetch(
      `/api/plenary-sessions/${sessionId}/items/${itemId}/vote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: voteAction,
          votesFor,
          votesAgainst,
          votesAbstain,
          notes: voteNotes || null,
        }),
      }
    );

    setVoteLoading(false);

    if (res.ok) {
      setVotingItemId(null);
      setVoteAction("ADOPT");
      setVotesFor(0);
      setVotesAgainst(0);
      setVotesAbstain(0);
      setVoteNotes("");
      loadSession();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to record vote");
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!confirm("Remove this petition from the calendar?")) return;

    const res = await fetch(
      `/api/plenary-sessions/${sessionId}/items/${itemId}`,
      { method: "DELETE" }
    );

    if (res.ok) {
      loadSession();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to remove item");
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">Loading session...</div>
    );
  }

  if (!plenarySession) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Session not found</p>
        <Link href="/calendar" className="text-blue-600 hover:underline">
          Back to Calendar
        </Link>
      </div>
    );
  }

  const filteredItems = typeFilter
    ? plenarySession.items.filter((item) => item.calendarType === typeFilter)
    : plenarySession.items;

  // Group items by calendar type
  const consentItems = filteredItems.filter(
    (i) => i.calendarType === "CONSENT"
  );
  const regularItems = filteredItems.filter(
    (i) => i.calendarType === "REGULAR"
  );
  const specialItems = filteredItems.filter(
    (i) => i.calendarType === "SPECIAL_ORDER"
  );

  const itemGroups = [
    { type: "CONSENT" as CalendarType, items: consentItems, label: "Consent Calendar" },
    { type: "REGULAR" as CalendarType, items: regularItems, label: "Regular Calendar" },
    {
      type: "SPECIAL_ORDER" as CalendarType,
      items: specialItems,
      label: "Special Orders",
    },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/calendar"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; All Sessions
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <span className="font-mono text-lg font-bold bg-gray-100 text-gray-700 rounded px-2.5 py-1">
            Session {plenarySession.sessionNumber}
          </span>
          <h1 className="text-2xl font-bold">
            {new Date(plenarySession.date).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </h1>
          <span className="text-sm text-gray-500">
            {TIME_BLOCK_LABELS[plenarySession.timeBlock]}
          </span>
        </div>
        {plenarySession.notes && (
          <p className="text-gray-600 mt-1">{plenarySession.notes}</p>
        )}
        <div className="text-sm text-gray-500 mt-1">
          {plenarySession.conference.name} &middot;{" "}
          {plenarySession.items.length} item(s)
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["", "CONSENT", "REGULAR", "SPECIAL_ORDER"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded-lg text-xs font-medium ${
                typeFilter === t
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t
                ? CALENDAR_TYPE_LABELS[t as CalendarType]
                : `All (${plenarySession.items.length})`}
            </button>
          ))}
        </div>
        {isStaff && (
          <button
            onClick={() => setShowAddItem(!showAddItem)}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            {showAddItem ? "Cancel" : "Add Petition"}
          </button>
        )}
      </div>

      {/* Add item form */}
      {showAddItem && (
        <div className="bg-white border rounded-lg p-5">
          <h3 className="font-semibold mb-3">
            Add Petition to Calendar
          </h3>
          {availablePetitions.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No petitions available for calendar placement. Petitions must have
              committee action first.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Petition
                  </label>
                  <select
                    value={selectedPetitionId}
                    onChange={(e) => setSelectedPetitionId(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  >
                    {availablePetitions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayNumber} — {p.title} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Calendar Type
                  </label>
                  <select
                    value={selectedCalendarType}
                    onChange={(e) =>
                      setSelectedCalendarType(e.target.value as CalendarType)
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  >
                    <option value="CONSENT">Consent Calendar</option>
                    <option value="REGULAR">Regular Calendar</option>
                    <option value="SPECIAL_ORDER">Special Order</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddItem}
                disabled={addingItem || !selectedPetitionId}
                className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {addingItem ? "Adding..." : "Add to Calendar"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Calendar items grouped by type */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No items on this session&apos;s calendar.
          {isStaff && ' Click "Add Petition" to place one.'}
        </div>
      ) : (
        <div className="space-y-8">
          {itemGroups.map((group) => (
            <div key={group.type}>
              <div className="flex items-center gap-2 mb-3 border-b pb-2">
                <span
                  className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${CALENDAR_TYPE_COLORS[group.type]}`}
                >
                  {group.label}
                </span>
                <span className="text-sm text-gray-500">
                  {group.items.length} item(s)
                </span>
              </div>

              <div className="space-y-4">
                {group.items.map((item) => {
                  const hasVotes = item.actions.length > 0;
                  const lastAction = hasVotes
                    ? item.actions[0]
                    : null;
                  const isFinal =
                    lastAction?.action === "ADOPT" ||
                    lastAction?.action === "DEFEAT";

                  return (
                    <div
                      key={item.id}
                      className="bg-white border rounded-lg p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-400 font-mono">
                              #{item.orderNumber}
                            </span>
                            {item.petition.displayNumber && (
                              <Link
                                href={`/petitions/${item.petition.id}`}
                                className="font-mono text-sm font-bold text-blue-700 hover:underline"
                              >
                                {item.petition.displayNumber}
                              </Link>
                            )}
                            <PetitionStatusBadge
                              status={item.petition.status}
                            />
                          </div>
                          <Link
                            href={`/petitions/${item.petition.id}`}
                            className="font-medium text-gray-900 hover:text-blue-700"
                          >
                            {item.petition.title}
                          </Link>
                          {item.petition.summary && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                              {item.petition.summary}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {item.petition.targets.map((t) => (
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
                          <div className="text-xs text-gray-500 mt-2">
                            by {item.petition.submitter.name}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 flex-shrink-0">
                          {isStaff && !isFinal && (
                            <button
                              onClick={() =>
                                setVotingItemId(
                                  votingItemId === item.id ? null : item.id
                                )
                              }
                              className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-blue-700"
                            >
                              {votingItemId === item.id
                                ? "Cancel"
                                : "Record Vote"}
                            </button>
                          )}
                          {isStaff && !hasVotes && (
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="border border-red-300 text-red-600 rounded-lg px-3 py-1.5 text-xs hover:bg-red-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Voting form */}
                      {votingItemId === item.id && (
                        <div className="border-t mt-4 pt-4">
                          <h4 className="text-sm font-semibold mb-3">
                            Record Plenary Vote
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
                                    e.target.value as PlenaryActionType
                                  )
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                              >
                                {(
                                  Object.entries(
                                    PLENARY_ACTION_LABELS
                                  ) as [PlenaryActionType, string][]
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
                                    setVotesFor(
                                      parseInt(e.target.value) || 0
                                    )
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
                                    setVotesAgainst(
                                      parseInt(e.target.value) || 0
                                    )
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
                                    setVotesAbstain(
                                      parseInt(e.target.value) || 0
                                    )
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
                              placeholder="Optional notes about this vote..."
                            />
                          </div>
                          <button
                            onClick={() => handleVote(item.id)}
                            disabled={voteLoading}
                            className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                          >
                            {voteLoading ? "Recording..." : "Submit Vote"}
                          </button>
                        </div>
                      )}

                      {/* Vote history */}
                      {item.actions.length > 0 && (
                        <div className="border-t mt-3 pt-3 space-y-2">
                          {item.actions.map((act) => (
                            <div
                              key={act.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span
                                className={`text-xs rounded-full px-2 py-0.5 font-medium ${PLENARY_ACTION_COLORS[act.action]}`}
                              >
                                {PLENARY_ACTION_LABELS[act.action]}
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
                                {new Date(act.createdAt).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
