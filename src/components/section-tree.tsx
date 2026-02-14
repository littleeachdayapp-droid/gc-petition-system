"use client";

import { useState } from "react";

interface SectionNode {
  id: string;
  title: string;
  level: number;
  sortOrder: number;
  children?: SectionNode[];
  _count?: { paragraphs: number; resolutions: number };
}

interface SectionTreeProps {
  sections: SectionNode[];
  selectedSectionId: string | null;
  onSelectSection: (id: string | null) => void;
  contentType: "paragraphs" | "resolutions";
}

function SectionItem({
  section,
  depth,
  selectedSectionId,
  onSelectSection,
  contentType,
}: {
  section: SectionNode;
  depth: number;
  selectedSectionId: string | null;
  onSelectSection: (id: string | null) => void;
  contentType: "paragraphs" | "resolutions";
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = section.children && section.children.length > 0;
  const isSelected = selectedSectionId === section.id;
  const count =
    contentType === "paragraphs"
      ? section._count?.paragraphs
      : section._count?.resolutions;

  return (
    <div>
      <button
        onClick={() => {
          onSelectSection(section.id);
          if (hasChildren) setExpanded(!expanded);
        }}
        className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-1 hover:bg-gray-100 rounded ${
          isSelected ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {hasChildren && (
          <span className="text-gray-400 text-xs w-4 flex-shrink-0">
            {expanded ? "▼" : "▶"}
          </span>
        )}
        {!hasChildren && <span className="w-4 flex-shrink-0" />}
        <span className="truncate flex-1">{section.title}</span>
        {count !== undefined && count > 0 && (
          <span className="text-xs text-gray-400 flex-shrink-0">{count}</span>
        )}
      </button>
      {hasChildren && expanded && (
        <div>
          {section.children!.map((child) => (
            <SectionItem
              key={child.id}
              section={child}
              depth={depth + 1}
              selectedSectionId={selectedSectionId}
              onSelectSection={onSelectSection}
              contentType={contentType}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SectionTree({
  sections,
  selectedSectionId,
  onSelectSection,
  contentType,
}: SectionTreeProps) {
  return (
    <div className="space-y-0.5">
      <button
        onClick={() => onSelectSection(null)}
        className={`w-full text-left px-3 py-1.5 text-sm font-medium hover:bg-gray-100 rounded ${
          selectedSectionId === null
            ? "bg-blue-50 text-blue-700"
            : "text-gray-900"
        }`}
      >
        All Sections
      </button>
      {sections.map((section) => (
        <SectionItem
          key={section.id}
          section={section}
          depth={0}
          selectedSectionId={selectedSectionId}
          onSelectSection={onSelectSection}
          contentType={contentType}
        />
      ))}
    </div>
  );
}
