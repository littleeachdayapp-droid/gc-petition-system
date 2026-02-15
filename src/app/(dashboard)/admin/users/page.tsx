"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { UserRole, CommitteeRole } from "@prisma/client";

interface CommitteeMembership {
  id: string;
  role: CommitteeRole;
  committee: { id: string; name: string; abbreviation: string };
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  delegationConference: string | null;
  createdAt: string;
  committeeMemberships: CommitteeMembership[];
}

interface Committee {
  id: string;
  name: string;
  abbreviation: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  STAFF: "Staff",
  COMMITTEE_CHAIR: "Committee Chair",
  COMMITTEE_MEMBER: "Committee Member",
  DELEGATE: "Delegate",
  PUBLIC: "Public",
};

const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-800",
  ADMIN: "bg-orange-100 text-orange-800",
  STAFF: "bg-blue-100 text-blue-800",
  COMMITTEE_CHAIR: "bg-purple-100 text-purple-800",
  COMMITTEE_MEMBER: "bg-purple-50 text-purple-700",
  DELEGATE: "bg-green-100 text-green-800",
  PUBLIC: "bg-gray-100 text-gray-600",
};

const COMMITTEE_ROLE_LABELS: Record<CommitteeRole, string> = {
  CHAIR: "Chair",
  VICE_CHAIR: "Vice Chair",
  SECRETARY: "Secretary",
  MEMBER: "Member",
};

const ASSIGNABLE_ROLES: UserRole[] = [
  "PUBLIC",
  "DELEGATE",
  "COMMITTEE_MEMBER",
  "COMMITTEE_CHAIR",
  "STAFF",
  "ADMIN",
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadUsers = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    fetch("/api/committees")
      .then((r) => r.json())
      .then((data) => setCommittees(Array.isArray(data) ? data : []));
  }, []);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    if (!confirm(`Change this user's role to ${ROLE_LABELS[newRole]}?`)) return;

    setActionLoading(userId);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });

    if (res.ok) {
      loadUsers();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to update role");
    }
    setActionLoading(null);
  }

  async function handleAddCommittee(
    userId: string,
    committeeId: string,
    role: CommitteeRole
  ) {
    setActionLoading(userId);
    const res = await fetch(`/api/admin/users/${userId}/committees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ committeeId, role }),
    });

    if (res.ok) {
      loadUsers();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to add committee");
    }
    setActionLoading(null);
  }

  async function handleRemoveCommittee(userId: string, membershipId: string) {
    if (!confirm("Remove this committee assignment?")) return;

    setActionLoading(userId);
    const res = await fetch(
      `/api/admin/users/${userId}/committees?membershipId=${membershipId}`,
      { method: "DELETE" }
    );

    if (res.ok) {
      loadUsers();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to remove");
    }
    setActionLoading(null);
  }

  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-gray-600 mt-1">
            Manage user roles and committee assignments
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Back to Pipeline
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="flex-1 max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="text-sm text-gray-500">
        {filtered.length} user{filtered.length !== 1 ? "s" : ""}
      </div>

      {/* User list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading users...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No users found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <div key={u.id} className="bg-white border rounded-lg">
              {/* User row */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() =>
                  setExpandedUser(expandedUser === u.id ? null : u.id)
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{u.name}</span>
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 font-medium ${ROLE_COLORS[u.role]}`}
                    >
                      {ROLE_LABELS[u.role]}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {u.email}
                    {u.delegationConference && (
                      <span className="ml-2">
                        &middot; {u.delegationConference}
                      </span>
                    )}
                  </div>
                  {u.committeeMemberships.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {u.committeeMemberships.map((m) => (
                        <span
                          key={m.id}
                          className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5"
                        >
                          {m.committee.abbreviation} ({COMMITTEE_ROLE_LABELS[m.role]})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedUser === u.id ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>

              {/* Expanded panel */}
              {expandedUser === u.id && (
                <div className="border-t px-4 py-4 space-y-4 bg-gray-50">
                  {/* Role change */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Role
                    </label>
                    <select
                      value={u.role}
                      onChange={(e) =>
                        handleRoleChange(u.id, e.target.value as UserRole)
                      }
                      disabled={actionLoading === u.id}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {ASSIGNABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Committee memberships */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Committee Assignments
                    </label>

                    {u.committeeMemberships.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {u.committeeMemberships.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between bg-white rounded-lg border px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold">
                                {m.committee.abbreviation}
                              </span>
                              <span className="text-sm text-gray-700">
                                {m.committee.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({COMMITTEE_ROLE_LABELS[m.role]})
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                handleRemoveCommittee(u.id, m.id)
                              }
                              disabled={actionLoading === u.id}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 mb-3">
                        No committee assignments
                      </p>
                    )}

                    {/* Add to committee */}
                    <AddCommitteeForm
                      userId={u.id}
                      committees={committees}
                      existingIds={u.committeeMemberships.map(
                        (m) => m.committee.id
                      )}
                      loading={actionLoading === u.id}
                      onAdd={handleAddCommittee}
                    />
                  </div>

                  <div className="text-xs text-gray-400">
                    Joined {new Date(u.createdAt).toLocaleDateString()}
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

function AddCommitteeForm({
  userId,
  committees,
  existingIds,
  loading,
  onAdd,
}: {
  userId: string;
  committees: Committee[];
  existingIds: string[];
  loading: boolean;
  onAdd: (userId: string, committeeId: string, role: CommitteeRole) => void;
}) {
  const [committeeId, setCommitteeId] = useState("");
  const [role, setRole] = useState<CommitteeRole>("MEMBER");

  const available = committees.filter((c) => !existingIds.includes(c.id));

  if (available.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 items-end">
      <select
        value={committeeId}
        onChange={(e) => setCommitteeId(e.target.value)}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
      >
        <option value="">Select committee...</option>
        {available.map((c) => (
          <option key={c.id} value={c.id}>
            {c.abbreviation} — {c.name}
          </option>
        ))}
      </select>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as CommitteeRole)}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
      >
        <option value="MEMBER">Member</option>
        <option value="CHAIR">Chair</option>
        <option value="VICE_CHAIR">Vice Chair</option>
        <option value="SECRETARY">Secretary</option>
      </select>
      <button
        onClick={() => {
          if (committeeId) {
            onAdd(userId, committeeId, role);
            setCommitteeId("");
            setRole("MEMBER");
          }
        }}
        disabled={!committeeId || loading}
        className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}
