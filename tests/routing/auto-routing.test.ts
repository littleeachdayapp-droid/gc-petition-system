import { describe, it, expect } from "vitest";
import {
  isInRange,
  routeParagraph,
  routeResolution,
  routeByTags,
  CommitteeWithRules,
} from "../../src/lib/routing";

// Sample committee rules for testing
const sampleRules: CommitteeWithRules[] = [
  {
    id: "c1",
    abbreviation: "FA",
    rules: {
      paragraphRanges: [{ from: 100, to: 200 }],
      resolutionRanges: [{ from: 1100, to: 1200 }],
      tags: ["finance", "budget"],
    },
  },
  {
    id: "c2",
    abbreviation: "CB",
    rules: {
      paragraphRanges: [{ from: 200, to: 300 }, { from: 500, to: 600 }],
      resolutionRanges: [{ from: 2000, to: 2100 }],
      tags: ["church-body", "organization"],
    },
  },
  {
    id: "c3",
    abbreviation: "DL",
    rules: {
      paragraphRanges: [{ from: 301, to: 400 }],
      resolutionRanges: [],
      tags: ["disciplinary", "judicial"],
    },
  },
  {
    id: "c4",
    abbreviation: "SP",
    rules: {
      paragraphRanges: [],
      resolutionRanges: [],
      tags: ["social-principles"],
    },
  },
];

describe("isInRange", () => {
  it("returns true for value inside range", () => {
    expect(isInRange(150, [{ from: 100, to: 200 }])).toBe(true);
  });

  it("returns true for value at lower boundary", () => {
    expect(isInRange(100, [{ from: 100, to: 200 }])).toBe(true);
  });

  it("returns true for value at upper boundary", () => {
    expect(isInRange(200, [{ from: 100, to: 200 }])).toBe(true);
  });

  it("returns false for value below range", () => {
    expect(isInRange(99, [{ from: 100, to: 200 }])).toBe(false);
  });

  it("returns false for value above range", () => {
    expect(isInRange(201, [{ from: 100, to: 200 }])).toBe(false);
  });

  it("returns true when value matches any of multiple ranges", () => {
    expect(isInRange(550, [{ from: 100, to: 200 }, { from: 500, to: 600 }])).toBe(true);
  });

  it("returns false for empty ranges array", () => {
    expect(isInRange(150, [])).toBe(false);
  });
});

describe("routeParagraph", () => {
  it("routes paragraph 101 to FA", () => {
    const result = routeParagraph(101, sampleRules);
    expect(result).toEqual(["FA"]);
  });

  it("routes paragraph 200 to both FA and CB (boundary overlap)", () => {
    const result = routeParagraph(200, sampleRules);
    expect(result).toContain("FA");
    expect(result).toContain("CB");
  });

  it("routes paragraph in second range of CB (550)", () => {
    const result = routeParagraph(550, sampleRules);
    expect(result).toEqual(["CB"]);
  });

  it("returns empty array for unmatched paragraph", () => {
    const result = routeParagraph(999, sampleRules);
    expect(result).toEqual([]);
  });

  it("returns empty for committees with no paragraph ranges", () => {
    const result = routeParagraph(150, [sampleRules[3]]); // SP has no ranges
    expect(result).toEqual([]);
  });
});

describe("routeResolution", () => {
  it("routes resolution 1150 to FA", () => {
    const result = routeResolution(1150, sampleRules);
    expect(result).toEqual(["FA"]);
  });

  it("routes resolution 2050 to CB", () => {
    const result = routeResolution(2050, sampleRules);
    expect(result).toEqual(["CB"]);
  });

  it("returns empty for unmatched resolution", () => {
    const result = routeResolution(9999, sampleRules);
    expect(result).toEqual([]);
  });
});

describe("routeByTags", () => {
  it("routes by matching tag", () => {
    const result = routeByTags(["finance"], sampleRules);
    expect(result).toEqual(["FA"]);
  });

  it("returns multiple committees when tag matches several", () => {
    // "organization" matches CB
    const result = routeByTags(["organization"], sampleRules);
    expect(result).toEqual(["CB"]);
  });

  it("returns empty for no matching tags", () => {
    const result = routeByTags(["nonexistent-tag"], sampleRules);
    expect(result).toEqual([]);
  });

  it("returns empty for empty tags array", () => {
    const result = routeByTags([], sampleRules);
    expect(result).toEqual([]);
  });

  it("matches when any tag overlaps", () => {
    const result = routeByTags(["social-principles", "finance"], sampleRules);
    expect(result).toContain("SP");
    expect(result).toContain("FA");
  });
});
