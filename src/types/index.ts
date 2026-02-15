/**
 * Shared TypeScript types for the GC Petition System.
 * Re-exports Prisma-generated types and adds application-specific types.
 */

export type {
  User,
  Conference,
  Book,
  Section,
  Paragraph,
  Resolution,
  Petition,
  PetitionTarget,
  PetitionVersion,
  Committee,
  CommitteeMembership,
  PetitionAssignment,
  CommitteeAction,
  PlenarySession,
  CalendarItem,
  PlenaryAction,
  SubmissionWindow,
} from "@prisma/client";

export type {
  UserRole,
  PetitionStatus,
  ActionType,
  TargetBook,
  ChangeType,
  VersionStage,
  CommitteeRole,
  AssignmentStatus,
  CommitteeActionType,
  PlenaryTimeBlock,
  CalendarType,
  PlenaryActionType,
} from "@prisma/client";

/** Health check API response */
export interface HealthResponse {
  status: "ok" | "error";
  database: "connected" | "disconnected";
  counts?: {
    books: number;
    sections: number;
    paragraphs: number;
    resolutions: number;
    committees: number;
    users: number;
    conferences: number;
  };
  error?: string;
}
