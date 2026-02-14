import { diffWords } from "diff";

export interface DiffSegment {
  text: string;
  type: "equal" | "added" | "removed";
}

/**
 * Compute word-level diff between two texts.
 * Returns an array of segments marked as equal, added, or removed.
 */
export function computeDiff(
  oldText: string,
  newText: string
): DiffSegment[] {
  if (!oldText && !newText) return [];

  // Handle cases where one side is empty
  if (!oldText) {
    return [{ text: newText, type: "added" }];
  }
  if (!newText) {
    return [{ text: oldText, type: "removed" }];
  }

  const changes = diffWords(oldText, newText);
  return changes.map((change) => ({
    text: change.value,
    type: change.added ? "added" : change.removed ? "removed" : "equal",
  }));
}

export interface TargetDiff {
  targetLabel: string; // e.g. "¶101 — The Constitution" or "R1101 — Title"
  changeType: string;
  currentText: string;
  proposedText: string;
  segments: DiffSegment[];
}

/**
 * Build diffs for all targets in a version snapshot.
 * The snapshot has targets with embedded paragraph/resolution currentText and proposedText.
 */
export function buildVersionDiffs(
  snapshotTargets: Array<{
    changeType: string;
    proposedText: string | null;
    paragraph?: { number: number; title: string | null; currentText: string } | null;
    resolution?: {
      resolutionNumber: number;
      title: string;
      currentText: string;
    } | null;
  }>
): TargetDiff[] {
  return snapshotTargets.map((target) => {
    const currentText =
      target.paragraph?.currentText || target.resolution?.currentText || "";
    const proposedText = target.proposedText || "";

    let targetLabel = "";
    if (target.paragraph) {
      targetLabel = `¶${target.paragraph.number}`;
      if (target.paragraph.title) {
        targetLabel += ` — ${target.paragraph.title}`;
      }
    } else if (target.resolution) {
      targetLabel = `R${target.resolution.resolutionNumber} — ${target.resolution.title}`;
    }

    // For DELETE_PARAGRAPH / DELETE_TEXT, the proposed text is empty — show all as removed
    // For ADD_PARAGRAPH / ADD_TEXT, the current text is effectively empty — show all as added
    let segments: DiffSegment[];
    if (
      target.changeType === "DELETE_PARAGRAPH" ||
      target.changeType === "DELETE_TEXT"
    ) {
      segments = currentText
        ? [{ text: currentText, type: "removed" }]
        : [];
    } else if (
      target.changeType === "ADD_PARAGRAPH" ||
      target.changeType === "ADD_TEXT"
    ) {
      segments = proposedText
        ? [{ text: proposedText, type: "added" }]
        : [];
    } else {
      // REPLACE_TEXT, RESTRUCTURE — show word-level diff
      segments = computeDiff(currentText, proposedText);
    }

    return {
      targetLabel,
      changeType: target.changeType,
      currentText,
      proposedText,
      segments,
    };
  });
}

/**
 * Compare targets between two version snapshots.
 * Shows what changed from one version's proposed text to another's.
 */
export function compareVersionTargets(
  oldTargets: Array<{
    changeType: string;
    proposedText: string | null;
    paragraph?: { number: number; title: string | null; currentText: string } | null;
    resolution?: {
      resolutionNumber: number;
      title: string;
      currentText: string;
    } | null;
  }>,
  newTargets: Array<{
    changeType: string;
    proposedText: string | null;
    paragraph?: { number: number; title: string | null; currentText: string } | null;
    resolution?: {
      resolutionNumber: number;
      title: string;
      currentText: string;
    } | null;
  }>
): TargetDiff[] {
  return newTargets.map((newTarget) => {
    // Find matching old target by paragraph number or resolution number
    const oldTarget = oldTargets.find((old) => {
      if (newTarget.paragraph && old.paragraph) {
        return newTarget.paragraph.number === old.paragraph.number;
      }
      if (newTarget.resolution && old.resolution) {
        return (
          newTarget.resolution.resolutionNumber ===
          old.resolution.resolutionNumber
        );
      }
      return false;
    });

    let targetLabel = "";
    if (newTarget.paragraph) {
      targetLabel = `¶${newTarget.paragraph.number}`;
      if (newTarget.paragraph.title) {
        targetLabel += ` — ${newTarget.paragraph.title}`;
      }
    } else if (newTarget.resolution) {
      targetLabel = `R${newTarget.resolution.resolutionNumber} — ${newTarget.resolution.title}`;
    }

    const oldProposed = oldTarget?.proposedText || "";
    const newProposed = newTarget.proposedText || "";

    return {
      targetLabel,
      changeType: newTarget.changeType,
      currentText: oldProposed,
      proposedText: newProposed,
      segments: computeDiff(oldProposed, newProposed),
    };
  });
}
