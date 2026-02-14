"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface CommitteeSummary {
  id: string;
  name: string;
  abbreviation: string;
  description: string | null;
  _count: { memberships: number; assignments: number };
}

export default function CommitteesPage() {
  const [committees, setCommittees] = useState<CommitteeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/committees")
      .then((r) => r.json())
      .then((data) => {
        setCommittees(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">
        Loading committees...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Committees</h1>
        <p className="text-gray-600 mt-1">
          Legislative committees review and act on assigned petitions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {committees.map((c) => (
          <Link
            key={c.id}
            href={`/committees/${c.id}`}
            className="bg-white border rounded-lg p-5 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-sm font-bold bg-gray-100 text-gray-700 rounded px-2 py-0.5">
                {c.abbreviation}
              </span>
            </div>
            <h3 className="font-medium text-gray-900">{c.name}</h3>
            {c.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {c.description}
              </p>
            )}
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span>{c._count.memberships} member(s)</span>
              <span>{c._count.assignments} assignment(s)</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
