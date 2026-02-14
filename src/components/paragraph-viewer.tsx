"use client";

interface ParagraphData {
  id: string;
  number: number;
  title: string | null;
  currentText: string;
  categoryTags: string[];
  section: { id: string; title: string; level: number };
}

interface ParagraphViewerProps {
  paragraphs: ParagraphData[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function ParagraphViewer({
  paragraphs,
  selectedId,
  onSelect,
}: ParagraphViewerProps) {
  const selected = selectedId
    ? paragraphs.find((p) => p.id === selectedId)
    : null;

  if (selected) {
    return (
      <div>
        <button
          onClick={() => onSelect(null)}
          className="text-sm text-blue-600 hover:underline mb-4"
        >
          &larr; Back to list
        </button>
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">
                &para;{selected.number}
                {selected.title && (
                  <span className="font-normal text-gray-600">
                    {" "}
                    &mdash; {selected.title}
                  </span>
                )}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {selected.section.title}
              </p>
            </div>
          </div>
          {selected.categoryTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {selected.categoryTags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="prose max-w-none text-gray-800 whitespace-pre-wrap">
            {selected.currentText}
          </div>
        </div>
      </div>
    );
  }

  if (paragraphs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No paragraphs found.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {paragraphs.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className="w-full text-left bg-white border rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-sm font-bold text-blue-700 flex-shrink-0">
              &para;{p.number}
            </span>
            <span className="font-medium text-gray-900 truncate">
              {p.title || "Untitled"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {p.currentText}
          </p>
          {p.categoryTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {p.categoryTags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5"
                >
                  {tag}
                </span>
              ))}
              {p.categoryTags.length > 3 && (
                <span className="text-xs text-gray-400">
                  +{p.categoryTags.length - 3}
                </span>
              )}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
