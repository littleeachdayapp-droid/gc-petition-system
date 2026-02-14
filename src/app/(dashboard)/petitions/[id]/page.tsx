"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PetitionStatusBadge } from "@/components/petition-status-badge";
import { PetitionStatus } from "@/generated/prisma/client";

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

interface PetitionDetail {
  id: string;
  displayNumber: string | null;
  title: string;
  summary: string | null;
  rationale: string | null;
  status: PetitionStatus;
  actionType: string;
  targetBook: string;
  submitterId: string;
  createdAt: string;
  updatedAt: string;
  submitter: { id: string; name: string; email: string };
  conference: { id: string; name: string; year: number };
  targets: Target[];
  versions: Version[];
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

export default function PetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [petition, setPetition] = useState<PetitionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "targets" | "history">(
    "details"
  );

  const loadPetition = useCallback(() => {
    fetch(`/api/petitions/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        setPetition(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load petition");
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    loadPetition();
  }, [loadPetition]);

  const isOwner = session?.user?.id === petition?.submitterId;
  const isDraft = petition?.status === "DRAFT";
  const canEdit = isDraft && isOwner;

  async function handleSubmit() {
    if (
      !confirm(
        "Submit this petition? Once submitted, it cannot be edited."
      )
    )
      return;

    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/petitions/${id}/submit`, {
      method: "POST",
    });

    setSubmitting(false);

    if (res.ok) {
      loadPetition();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to submit petition");
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        "Delete this petition? This action cannot be undone."
      )
    )
      return;

    setDeleting(true);

    const res = await fetch(`/api/petitions/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      router.push("/petitions");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to delete petition");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">
        Loading petition...
      </div>
    );
  }

  if (!petition) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Petition not found</p>
        <Link href="/petitions" className="text-blue-600 hover:underline">
          Back to Petitions
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/petitions"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Petitions
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
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
            {petition.submitter.name} &middot;{" "}
            {petition.conference.name}
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2 flex-shrink-0">
            <Link
              href={`/petitions/${id}/edit`}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm hover:bg-gray-50"
            >
              Edit
            </Link>
            <button
              onClick={handleSubmit}
              disabled={submitting || petition.targets.length === 0}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              title={
                petition.targets.length === 0
                  ? "Add at least one target before submitting"
                  : undefined
              }
            >
              {submitting ? "Submitting..." : "Submit Petition"}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="border border-red-300 text-red-600 rounded-lg px-4 py-2 text-sm hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {(["details", "targets", "history"] as const).map((tab) => (
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
          {!petition.summary && !petition.rationale && (
            <div className="text-gray-500 py-8 text-center">
              No summary or rationale provided yet.
              {canEdit && (
                <>
                  {" "}
                  <Link
                    href={`/petitions/${id}/edit`}
                    className="text-blue-600 hover:underline"
                  >
                    Add details
                  </Link>
                </>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-white border rounded-lg p-4">
              <div className="text-gray-500">Created</div>
              <div className="font-medium">
                {new Date(petition.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <div className="text-gray-500">Last Updated</div>
              <div className="font-medium">
                {new Date(petition.updatedAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Targets tab */}
      {activeTab === "targets" && (
        <div>
          {canEdit && (
            <div className="mb-4">
              <Link
                href={`/petitions/${id}/targets`}
                className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800"
              >
                {petition.targets.length > 0
                  ? "Edit Targets"
                  : "Add Targets"}
              </Link>
            </div>
          )}
          {petition.targets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No targets added yet.
              {canEdit && " Click &ldquo;Add Targets&rdquo; to specify which paragraphs or resolutions this petition affects."}
            </div>
          ) : (
            <div className="space-y-3">
              {petition.targets.map((t) => (
                <div
                  key={t.id}
                  className="bg-white border rounded-lg p-4"
                >
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
                  {t.proposedText && (
                    <div className="mt-2">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        Proposed Text
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-gray-800 whitespace-pre-wrap">
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

      {/* History tab */}
      {activeTab === "history" && (
        <div>
          {petition.versions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No version history yet. Versions are created when the petition
              is submitted and at each stage of review.
            </div>
          ) : (
            <div className="space-y-2">
              {petition.versions.map((v) => (
                <div
                  key={v.id}
                  className="bg-white border rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium">
                      Version {v.versionNum}
                    </span>
                    <span className="ml-2 text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                      {STAGE_LABELS[v.stage] || v.stage}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {v.createdBy.name} &middot;{" "}
                    {new Date(v.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
