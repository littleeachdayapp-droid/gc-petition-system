"use client";

import { Fragment } from "react";

export interface DiffSegment {
  text: string;
  type: "equal" | "added" | "removed";
}

export interface TargetDiff {
  targetLabel: string;
  changeType: string;
  currentText: string;
  proposedText: string;
  segments: DiffSegment[];
}

const CHANGE_LABELS: Record<string, string> = {
  ADD_TEXT: "Add Text",
  DELETE_TEXT: "Delete Text",
  REPLACE_TEXT: "Replace Text",
  ADD_PARAGRAPH: "Add Paragraph",
  DELETE_PARAGRAPH: "Delete Paragraph",
  RESTRUCTURE: "Restructure",
};

function DiffSegmentSpan({ segment }: { segment: DiffSegment }) {
  if (segment.type === "added") {
    return (
      <span className="bg-green-100 text-green-900 underline decoration-green-400">
        {segment.text}
      </span>
    );
  }
  if (segment.type === "removed") {
    return (
      <span className="bg-red-100 text-red-900 line-through decoration-red-400">
        {segment.text}
      </span>
    );
  }
  return <span>{segment.text}</span>;
}

export function DiffViewer({
  diffs,
  title,
}: {
  diffs: TargetDiff[];
  title?: string;
}) {
  if (diffs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No targets to display.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {title}
        </h3>
      )}
      {diffs.map((diff, i) => (
        <div key={i} className="bg-white border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b">
            <span className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-0.5 font-medium">
              {CHANGE_LABELS[diff.changeType] || diff.changeType}
            </span>
            <span className="font-medium text-gray-900">
              {diff.targetLabel}
            </span>
          </div>
          <div className="p-4">
            {diff.segments.length === 0 ? (
              <p className="text-gray-400 italic text-sm">No text changes</p>
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-wrap font-serif">
                {diff.segments.map((seg, j) => (
                  <Fragment key={j}>
                    <DiffSegmentSpan segment={seg} />
                  </Fragment>
                ))}
              </div>
            )}
          </div>
          <div className="px-4 py-2 bg-gray-50 border-t flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-red-100 border border-red-200 rounded" />
              Removed
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-green-100 border border-green-200 rounded" />
              Added
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function InlineDiff({
  segments,
}: {
  segments: DiffSegment[];
}) {
  return (
    <span className="whitespace-pre-wrap">
      {segments.map((seg, i) => (
        <Fragment key={i}>
          <DiffSegmentSpan segment={seg} />
        </Fragment>
      ))}
    </span>
  );
}
