import Link from "next/link";

export default function Brand({ full = false }: { full?: boolean }) {
  return (
    <Link
      href="/"
      className={"brand southwest-brand" + (full ? " full-brand" : "")}
      aria-label="Sonoran Slush home"
    >
      {full ? (
        <img
          src="/brand/sonoran-slush-southwest-light.svg"
          alt="Sonoran Slush Creative Creations"
          width="270"
          height="193"
        />
      ) : (
        <>
          <img src="/brand/desert-mark.svg" alt="" width="65" height="48" />
          <span className="brand-wordmark">
            <span className="brand-name">SONORAN SLUSH</span>
            <span className="brand-sub">CREATIVE CREATIONS</span>
          </span>
        </>
      )}
    </Link>
  );
}
