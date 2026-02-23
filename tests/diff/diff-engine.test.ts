import { describe, it, expect } from "vitest";
import { computeDiff, buildVersionDiffs, compareVersionTargets } from "../../src/lib/diff";

describe("computeDiff", () => {
  it("diffs two different strings with word-level changes", () => {
    const result = computeDiff("hello world", "hello there");
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some((s) => s.type === "equal")).toBe(true);
    expect(result.some((s) => s.type === "removed" || s.type === "added")).toBe(true);
  });

  it("returns all added when old text is empty", () => {
    const result = computeDiff("", "hello world");
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("added");
    expect(result[0].text).toBe("hello world");
  });

  it("returns all removed when new text is empty", () => {
    const result = computeDiff("hello world", "");
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("removed");
    expect(result[0].text).toBe("hello world");
  });

  it("returns empty array when both texts are empty", () => {
    const result = computeDiff("", "");
    expect(result).toEqual([]);
  });

  it("returns single equal segment for identical texts", () => {
    const result = computeDiff("same text", "same text");
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("equal");
    expect(result[0].text).toBe("same text");
  });

  it("handles multi-word additions", () => {
    const result = computeDiff("The church shall", "The church shall always and forever");
    const addedSegments = result.filter((s) => s.type === "added");
    expect(addedSegments.length).toBeGreaterThan(0);
  });

  it("handles complete replacement", () => {
    const result = computeDiff("old content entirely", "new content completely");
    expect(result.some((s) => s.type === "removed")).toBe(true);
    expect(result.some((s) => s.type === "added")).toBe(true);
  });
});

describe("buildVersionDiffs", () => {
  it("shows all green for ADD_PARAGRAPH", () => {
    const result = buildVersionDiffs([
      {
        changeType: "ADD_PARAGRAPH",
        proposedText: "New paragraph text to add.",
        paragraph: { number: 101, title: "Constitution", currentText: "Existing text" },
      },
    ]);
    expect(result.length).toBe(1);
    expect(result[0].segments.length).toBe(1);
    expect(result[0].segments[0].type).toBe("added");
    expect(result[0].segments[0].text).toBe("New paragraph text to add.");
  });

  it("shows all red for DELETE_PARAGRAPH", () => {
    const result = buildVersionDiffs([
      {
        changeType: "DELETE_PARAGRAPH",
        proposedText: null,
        paragraph: { number: 101, title: "Constitution", currentText: "Text to be deleted" },
      },
    ]);
    expect(result.length).toBe(1);
    expect(result[0].segments.length).toBe(1);
    expect(result[0].segments[0].type).toBe("removed");
    expect(result[0].segments[0].text).toBe("Text to be deleted");
  });

  it("shows word-level diff for REPLACE_TEXT", () => {
    const result = buildVersionDiffs([
      {
        changeType: "REPLACE_TEXT",
        proposedText: "The church shall always gather",
        paragraph: { number: 201, title: "Local Church", currentText: "The church shall gather" },
      },
    ]);
    expect(result.length).toBe(1);
    expect(result[0].segments.some((s) => s.type === "equal")).toBe(true);
    expect(result[0].segments.some((s) => s.type === "added")).toBe(true);
  });

  it("handles null proposedText (treats as empty)", () => {
    const result = buildVersionDiffs([
      {
        changeType: "REPLACE_TEXT",
        proposedText: null,
        paragraph: { number: 101, title: "Test", currentText: "Some text" },
      },
    ]);
    expect(result.length).toBe(1);
    // With empty proposed text, everything should be "removed"
    expect(result[0].segments.some((s) => s.type === "removed")).toBe(true);
  });

  it("generates correct target label for paragraph", () => {
    const result = buildVersionDiffs([
      {
        changeType: "REPLACE_TEXT",
        proposedText: "new",
        paragraph: { number: 101, title: "The Constitution", currentText: "old" },
      },
    ]);
    expect(result[0].targetLabel).toBe("¶101 — The Constitution");
  });

  it("generates correct target label for resolution", () => {
    const result = buildVersionDiffs([
      {
        changeType: "REPLACE_TEXT",
        proposedText: "new",
        resolution: { resolutionNumber: 1101, title: "Peace and Justice", currentText: "old" },
      },
    ]);
    expect(result[0].targetLabel).toBe("R1101 — Peace and Justice");
  });

  it("generates label without title for paragraph without title", () => {
    const result = buildVersionDiffs([
      {
        changeType: "ADD_TEXT",
        proposedText: "new text",
        paragraph: { number: 99, title: null, currentText: "" },
      },
    ]);
    expect(result[0].targetLabel).toBe("¶99");
  });

  it("handles empty segments for DELETE with no currentText", () => {
    const result = buildVersionDiffs([
      {
        changeType: "DELETE_PARAGRAPH",
        proposedText: null,
        paragraph: { number: 101, title: "Test", currentText: "" },
      },
    ]);
    expect(result[0].segments).toEqual([]);
  });
});

describe("compareVersionTargets", () => {
  it("compares two versions with matching targets", () => {
    const oldTargets = [
      {
        changeType: "REPLACE_TEXT",
        proposedText: "The church shall gather for worship",
        paragraph: { number: 201, title: "Local Church", currentText: "original" },
      },
    ];
    const newTargets = [
      {
        changeType: "REPLACE_TEXT",
        proposedText: "The church shall always gather for worship and fellowship",
        paragraph: { number: 201, title: "Local Church", currentText: "original" },
      },
    ];
    const result = compareVersionTargets(oldTargets, newTargets);
    expect(result.length).toBe(1);
    // Diff should be between old proposed and new proposed
    expect(result[0].currentText).toBe("The church shall gather for worship");
    expect(result[0].proposedText).toBe("The church shall always gather for worship and fellowship");
    expect(result[0].segments.some((s) => s.type === "added")).toBe(true);
  });

  it("handles target in new but not in old (no match found)", () => {
    const oldTargets: typeof newTargets = [];
    const newTargets = [
      {
        changeType: "ADD_PARAGRAPH",
        proposedText: "Brand new paragraph",
        paragraph: { number: 999, title: "New Section", currentText: "" },
      },
    ];
    const result = compareVersionTargets(oldTargets, newTargets);
    expect(result.length).toBe(1);
    // Old proposed is "" (no match), new proposed is the text
    expect(result[0].currentText).toBe("");
    expect(result[0].proposedText).toBe("Brand new paragraph");
  });

  it("handles resolution targets correctly", () => {
    const oldTargets = [
      {
        changeType: "REPLACE_TEXT",
        proposedText: "Old proposed resolution text",
        resolution: { resolutionNumber: 1101, title: "Peace", currentText: "original" },
      },
    ];
    const newTargets = [
      {
        changeType: "REPLACE_TEXT",
        proposedText: "New proposed resolution text",
        resolution: { resolutionNumber: 1101, title: "Peace", currentText: "original" },
      },
    ];
    const result = compareVersionTargets(oldTargets, newTargets);
    expect(result.length).toBe(1);
    expect(result[0].targetLabel).toBe("R1101 — Peace");
  });

  it("handles null proposedText in both versions", () => {
    const oldTargets = [
      {
        changeType: "DELETE_PARAGRAPH",
        proposedText: null,
        paragraph: { number: 101, title: "Test", currentText: "text" },
      },
    ];
    const newTargets = [
      {
        changeType: "DELETE_PARAGRAPH",
        proposedText: null,
        paragraph: { number: 101, title: "Test", currentText: "text" },
      },
    ];
    const result = compareVersionTargets(oldTargets, newTargets);
    expect(result.length).toBe(1);
    // Both null → both treated as "" → empty diff
    expect(result[0].segments).toEqual([]);
  });
});
