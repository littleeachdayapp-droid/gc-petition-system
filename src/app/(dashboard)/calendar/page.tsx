"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Conference {
  id: string;
  name: string;
  year: number;
}

interface PlenarySessionSummary {
  id: string;
  sessionNumber: number;
  date: string;
  timeBlock: string;
  notes: string | null;
  conference: Conference;
  _count: { items: number };
}

const TIME_BLOCK_LABELS: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
};

const TIME_BLOCK_COLORS: Record<string, string> = {
  MORNING: "bg-amber-100 text-amber-800",
  AFTERNOON: "bg-blue-100 text-blue-700",
  EVENING: "bg-indigo-100 text-indigo-700",
};

export default function CalendarPage() {
  const { data: session } = useSession();
  const [sessions, setSessions] = useState<PlenarySessionSummary[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [conferenceId, setConferenceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newSessionNumber, setNewSessionNumber] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTimeBlock, setNewTimeBlock] = useState("MORNING");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const isStaff =
    session?.user?.role === "STAFF" ||
    session?.user?.role === "ADMIN" ||
    session?.user?.role === "SUPER_ADMIN";

  useEffect(() => {
    fetch("/api/conferences")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setConferences(list);
        if (list.length > 0) setConferenceId(list[0].id);
      });
  }, []);

  const loadSessions = useCallback(() => {
    if (!conferenceId) return;
    setLoading(true);
    fetch(`/api/plenary-sessions?conferenceId=${conferenceId}`)
      .then((r) => r.json())
      .then((data) => {
        setSessions(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [conferenceId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function handleCreate() {
    if (!newSessionNumber || !newDate || !conferenceId) return;
    setCreating(true);
    setError("");

    const res = await fetch("/api/plenary-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conferenceId,
        sessionNumber: parseInt(newSessionNumber),
        date: newDate,
        timeBlock: newTimeBlock,
        notes: newNotes || null,
      }),
    });

    setCreating(false);

    if (res.ok) {
      setShowCreate(false);
      setNewSessionNumber("");
      setNewDate("");
      setNewTimeBlock("MORNING");
      setNewNotes("");
      loadSessions();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create session");
    }
  }

  // Group sessions by date
  const sessionsByDate = sessions.reduce<
    Record<string, PlenarySessionSummary[]>
  >((acc, s) => {
    const dateKey = new Date(s.date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plenary Calendar</h1>
          <p className="text-gray-600 mt-1">
            Plenary sessions, calendar items, and voting
          </p>
        </div>
        <div className="flex items-center gap-3">
          {conferences.length > 1 && (
            <select
              value={conferenceId}
              onChange={(e) => setConferenceId(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              {conferences.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {isStaff && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              {showCreate ? "Cancel" : "New Session"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Create session form */}
      {showCreate && (
        <div className="bg-white border rounded-lg p-5">
          <h3 className="font-semibold mb-3">Create Plenary Session</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Session Number
              </label>
              <input
                type="number"
                min={1}
                value={newSessionNumber}
                onChange={(e) => setNewSessionNumber(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Date
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Time Block
              </label>
              <select
                value={newTimeBlock}
                onChange={(e) => setNewTimeBlock(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="MORNING">Morning</option>
                <option value="AFTERNOON">Afternoon</option>
                <option value="EVENING">Evening</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newSessionNumber || !newDate}
            className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Session"}
          </button>
        </div>
      )}

      {/* Sessions list */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">
          Loading sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No plenary sessions scheduled.
          {isStaff && " Click \"New Session\" to create one."}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(sessionsByDate).map(([dateLabel, dateSessions]) => (
            <div key={dateLabel}>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                {dateLabel}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dateSessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/calendar/${s.id}`}
                    className="bg-white border rounded-lg p-5 hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm font-bold bg-gray-100 text-gray-700 rounded px-2 py-0.5">
                        Session {s.sessionNumber}
                      </span>
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 font-medium ${TIME_BLOCK_COLORS[s.timeBlock]}`}
                      >
                        {TIME_BLOCK_LABELS[s.timeBlock]}
                      </span>
                    </div>
                    {s.notes && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {s.notes}
                      </p>
                    )}
                    <div className="text-xs text-gray-500 mt-3">
                      {s._count.items} item(s) on calendar
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
