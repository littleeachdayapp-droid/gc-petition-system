"use client";

interface ResolutionData {
  id: string;
  resolutionNumber: number;
  title: string;
  currentText: string;
  socialPrinciplePara: string | null;
  topicGroup: string | null;
  section: { id: string; title: string; level: number };
}

interface ResolutionViewerProps {
  resolutions: ResolutionData[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function ResolutionViewer({
  resolutions,
  selectedId,
  onSelect,
}: ResolutionViewerProps) {
  const selected = selectedId
    ? resolutions.find((r) => r.id === selectedId)
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
          <div className="mb-4">
            <h2 className="text-xl font-bold">
              R{selected.resolutionNumber}
              <span className="font-normal text-gray-600">
                {" "}
                &mdash; {selected.title}
              </span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {selected.section.title}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {selected.topicGroup && (
              <span className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5">
                {selected.topicGroup}
              </span>
            )}
            {selected.socialPrinciplePara && (
              <span className="text-xs bg-purple-50 text-purple-700 rounded px-2 py-0.5">
                Related: {selected.socialPrinciplePara}
              </span>
            )}
          </div>
          <div className="prose max-w-none text-gray-800 whitespace-pre-wrap">
            {selected.currentText}
          </div>
        </div>
      </div>
    );
  }

  if (resolutions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No resolutions found.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {resolutions.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r.id)}
          className="w-full text-left bg-white border rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-sm font-bold text-blue-700 flex-shrink-0">
              R{r.resolutionNumber}
            </span>
            <span className="font-medium text-gray-900 truncate">
              {r.title}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {r.currentText}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {r.topicGroup && (
              <span className="text-xs bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">
                {r.topicGroup}
              </span>
            )}
            {r.socialPrinciplePara && (
              <span className="text-xs bg-purple-50 text-purple-600 rounded px-1.5 py-0.5">
                {r.socialPrinciplePara}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
