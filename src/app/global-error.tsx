"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>
          Something went wrong
        </h1>
        <p style={{ color: "#666", marginBottom: "1rem" }}>{error.message}</p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            background: "#1e40af",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
