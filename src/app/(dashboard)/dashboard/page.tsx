"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Stats {
  totalPetitions: number;
  submitted: number;
  inCommittee: number;
  onCalendar: number;
  adopted: number;
  defeated: number;
  totalCommittees: number;
  totalSessions: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalPetitions}
            </div>
            <div className="text-xs text-gray-500 mt-1">Total Petitions</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">
              {stats.submitted}
            </div>
            <div className="text-xs text-blue-600 mt-1">Awaiting Routing</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-700">
              {stats.inCommittee}
            </div>
            <div className="text-xs text-purple-600 mt-1">In Committee</div>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-cyan-700">
              {stats.onCalendar}
            </div>
            <div className="text-xs text-cyan-600 mt-1">On Calendar</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-700">
              {stats.adopted}
            </div>
            <div className="text-xs text-green-600 mt-1">Adopted</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-700">
              {stats.defeated}
            </div>
            <div className="text-xs text-red-600 mt-1">Defeated</div>
          </div>
          <div className="bg-white border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalCommittees}
            </div>
            <div className="text-xs text-gray-500 mt-1">Committees</div>
          </div>
          <div className="bg-white border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalSessions}
            </div>
            <div className="text-xs text-gray-500 mt-1">Plenary Sessions</div>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href="/petitions"
          className="p-6 border rounded-lg hover:shadow-md transition-shadow bg-white"
        >
          <h2 className="text-xl font-semibold mb-2">Petitions</h2>
          <p className="text-gray-600">
            Submit and track legislative petitions.
          </p>
        </Link>
        <Link
          href="/documents"
          className="p-6 border rounded-lg hover:shadow-md transition-shadow bg-white"
        >
          <h2 className="text-xl font-semibold mb-2">Documents</h2>
          <p className="text-gray-600">
            Browse the Book of Discipline and Book of Resolutions.
          </p>
        </Link>
        <Link
          href="/committees"
          className="p-6 border rounded-lg hover:shadow-md transition-shadow bg-white"
        >
          <h2 className="text-xl font-semibold mb-2">Committees</h2>
          <p className="text-gray-600">
            View committee assignments and actions.
          </p>
        </Link>
        <Link
          href="/calendar"
          className="p-6 border rounded-lg hover:shadow-md transition-shadow bg-white"
        >
          <h2 className="text-xl font-semibold mb-2">Plenary Calendar</h2>
          <p className="text-gray-600">
            Track plenary session schedules and votes.
          </p>
        </Link>
        <Link
          href="/admin"
          className="p-6 border rounded-lg hover:shadow-md transition-shadow bg-white"
        >
          <h2 className="text-xl font-semibold mb-2">Admin</h2>
          <p className="text-gray-600">
            Manage the petition pipeline and routing.
          </p>
        </Link>
        <Link
          href="/browse"
          className="p-6 border rounded-lg hover:shadow-md transition-shadow bg-white"
        >
          <h2 className="text-xl font-semibold mb-2">Public Portal</h2>
          <p className="text-gray-600">
            View the public-facing petition browser.
          </p>
        </Link>
      </div>
    </div>
  );
}
