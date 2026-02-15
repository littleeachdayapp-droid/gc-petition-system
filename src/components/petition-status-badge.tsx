import { PetitionStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  PetitionStatus,
  { label: string; className: string }
> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  SUBMITTED: { label: "Submitted", className: "bg-blue-100 text-blue-700" },
  UNDER_REVIEW: {
    label: "Under Review",
    className: "bg-yellow-100 text-yellow-800",
  },
  IN_COMMITTEE: {
    label: "In Committee",
    className: "bg-purple-100 text-purple-700",
  },
  AMENDED: { label: "Amended", className: "bg-indigo-100 text-indigo-700" },
  APPROVED_BY_COMMITTEE: {
    label: "Committee Approved",
    className: "bg-green-100 text-green-700",
  },
  REJECTED_BY_COMMITTEE: {
    label: "Committee Rejected",
    className: "bg-red-100 text-red-700",
  },
  ON_CALENDAR: {
    label: "On Calendar",
    className: "bg-cyan-100 text-cyan-700",
  },
  ADOPTED: { label: "Adopted", className: "bg-emerald-100 text-emerald-800" },
  DEFEATED: { label: "Defeated", className: "bg-red-100 text-red-800" },
  WITHDRAWN: { label: "Withdrawn", className: "bg-gray-200 text-gray-600" },
};

export function PetitionStatusBadge({ status }: { status: PetitionStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
