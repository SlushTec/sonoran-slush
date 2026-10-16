import type { CSSProperties } from "react";
const paths: Record<string, React.ReactNode> = {
  arrow: (
    <>
      <path d="M4 12h16M14 6l6 6-6 6" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  down: <path d="m6 9 6 6 6-6" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  bag: (
    <>
      <path d="M5 7h14l1 14H4L5 7Z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </>
  ),
  heart: (
    <path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 3 11 8 15 5-4 13-10 8-15Z" />
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m5 5 14 14M5 19 19 5" />,
  sparkle: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
      <path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5L20 2Z" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  gift: (
    <>
      <path d="M4 10h16v11H4ZM2 6h20v4H2ZM12 6v15" />
      <path d="M12 6C2 7 5-4 12 6Zm0 0C22 7 19-4 12 6Z" />
    </>
  ),
  pin: (
    <>
      <path d="M19 9c0 6-7 12-7 12S5 15 5 9a7 7 0 0 1 14 0Z" />
      <circle cx="12" cy="9" r="2" />
    </>
  ),
  upload: (
    <>
      <path d="M4 16v5h16v-5M12 16V3m-5 5 5-5 5 5" />
    </>
  ),
  shield: (
    <>
      <path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </>
  ),
  truck: (
    <>
      <path d="M2 5h12v12H2ZM14 9h4l4 5v3h-8" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  pencil: (
    <>
      <path d="m15 3 6 6-12 12H3v-6L15 3ZM12 6l6 6" />
    </>
  ),
  glass: (
    <>
      <path d="M7 3h10l2 10c-1 6-13 6-14 0L7 3ZM12 18v4M7 22h10" />
    </>
  ),
  mug: (
    <>
      <path d="M5 3h12v14a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V3ZM17 6h2a3 3 0 0 1 0 6h-2M8 6h6" />
    </>
  ),
  board: (
    <>
      <path d="M8 7V4a4 4 0 0 1 8 0v3h4v15H4V7h4Z" />
      <circle cx="12" cy="4" r=".5" />
      <path d="M8 12h8M8 16h5" />
    </>
  ),
  diamond: (
    <>
      <path d="m12 2 10 10-10 10L2 12 10 2h2ZM2 12h20M12 2l-5 10 5 10 5-10-5-10Z" />
    </>
  ),
  tag: (
    <>
      <path d="M3 3h8l10 10-8 8L3 11V3Z" />
      <circle cx="7" cy="7" r="1" />
    </>
  ),
  star: <path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1 3-6Z" />,
  pet: (
    <>
      <circle cx="5" cy="8" r="2" />
      <circle cx="10" cy="4" r="2" />
      <circle cx="16" cy="5" r="2" />
      <circle cx="20" cy="10" r="2" />
      <path d="M6 17c1-3 3-6 6-6s5 3 6 6c2 6-5 3-6 3s-8 3-6-3Z" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="1" />
      <path d="m2 5 10 8L22 5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" />
    </>
  ),
  download: (
    <>
      <path d="M4 17v4h16v-4M12 3v13m-5-5 5 5 5-5" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 3C4 2 1 9 7 16c6 6 14 2 13-13Z" />
      <path d="M3 21 16 8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="1" />
      <path d="M7 2v6M17 2v6M3 11h18M7 15h3M14 15h3" />
    </>
  ),
};
export const categoryIcons: Record<string, string> = {
  drinkware: "mug",
  "glassware-bar": "glass",
  kitchen: "board",
  "small-gifts": "tag",
  "jewelry-pets": "pet",
  ornaments: "star",
  "photo-crystals": "diamond",
};
export default function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {paths[name] || paths.sparkle}
    </svg>
  );
}
