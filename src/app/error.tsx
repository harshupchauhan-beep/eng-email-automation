"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6">
      <p className="text-sm text-muted-foreground">{error.message || "Something went wrong."}</p>
      <button className="text-sm underline" onClick={reset} type="button">
        Try again
      </button>
    </div>
  );
}
