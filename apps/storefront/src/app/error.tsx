"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container error-page">
      <p className="eyebrow">A small interruption</p>
      <h1>Let’s give that another try.</h1>
      <p>
        Your saved work is kept on this device. Refresh the page or return to
        your designs.
      </p>
      <div className="actions">
        <button className="button primary" onClick={reset}>
          Try again
        </button>
        <Link href="/saved" className="button outline">
          Open saved designs
        </Link>
      </div>
    </div>
  );
}
