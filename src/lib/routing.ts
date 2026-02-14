/**
 * Committee auto-routing logic.
 * Given a petition's target paragraphs/resolutions, determines which committee(s)
 * should handle it based on routing rules.
 *
 * Full implementation in Session 5 (Admin Pipeline).
 */

export interface RoutingRules {
  paragraphRanges: Array<{ from: number; to: number }>;
  resolutionRanges: Array<{ from: number; to: number }>;
  tags: string[];
}

export function isInRange(
  value: number,
  ranges: Array<{ from: number; to: number }>
): boolean {
  return ranges.some((r) => value >= r.from && value <= r.to);
}

/**
 * Determines which committee abbreviation a paragraph number routes to.
 * Stub — will be fully implemented when committees are loaded from DB.
 */
export function routeParagraph(
  _paragraphNumber: number,
  _committeeRules: Array<{ abbreviation: string; rules: RoutingRules }>
): string | null {
  // TODO: Implement in Session 5
  return null;
}

/**
 * Determines which committee abbreviation a resolution number routes to.
 * Stub — will be fully implemented when committees are loaded from DB.
 */
export function routeResolution(
  _resolutionNumber: number,
  _committeeRules: Array<{ abbreviation: string; rules: RoutingRules }>
): string | null {
  // TODO: Implement in Session 5
  return null;
}
