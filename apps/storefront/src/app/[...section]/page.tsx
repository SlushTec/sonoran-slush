import { notFound } from "next/navigation";
import {
  PageHeading,
  Information,
  Help,
  ServicePage,
  About,
  OurWork,
  Contact,
} from "@/components/PageContent";
import { Bag, Saved, Checkout } from "@/components/ShoppingFlows";
import { Portal, Account, Admin } from "@/components/CustomerPortal";
import GiftFinder from "@/components/GiftFinder";
const paths = [
  "custom-orders",
  "events",
  "our-work",
  "help",
  "about",
  "privacy",
  "terms",
  "cart",
  "checkout",
  "account",
  "orders",
  "proofs",
  "admin",
  "help/photo-guide",
  "help/shipping",
  "help/returns",
  "gift-finder",
  "saved",
  "quotes",
  "contact",
  "accessibility",
];
export const dynamicParams = false;
export function generateStaticParams() {
  return paths.map((p) => ({ section: p.split("/") }));
}
const headings: Record<string, [string, string, string]> = {
  cart: [
    "Your bag. Your personal touches.",
    "Thoughtful details, together",
    "Review your designs, fine-tune the details, and prepare a request for the studio.",
  ],
  checkout: [
    "Let’s put the details together.",
    "Your gift request",
    "A guest request, with clear details before a commitment. No payment is collected here.",
  ],
  saved: [
    "Good ideas, kept close.",
    "Your saved work",
    "Your designs and favorites, ready when you are. Saved in this browser for 30 days.",
  ],
  account: [
    "Your little corner of the studio.",
    "Your account",
    "Saved inspiration, private order updates, and the next step for your personal piece.",
  ],
  orders: [
    "A clear view of the next step.",
    "Your order, in progress",
    "Open your private order updates with the reference and access code from the studio.",
  ],
  proofs: [
    "Every detail. Exactly right.",
    "Your proof review",
    "Check the current version carefully before approving a piece that is personal to you.",
  ],
  quotes: [
    "Your idea, taking shape.",
    "Custom requests & quotes",
    "Open the current status and any reviewed quote for your request.",
  ],
  admin: [
    "The studio workspace.",
    "For the people behind the details",
    "Authorized staff access for requests, artwork, and the next piece of work.",
  ],
  "gift-finder": [
    "Let’s find their kind of gift.",
    "A little inspiration",
    "Three little details about them. A few thoughtful places to start.",
  ],
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string[] }>;
}) {
  const { section } = await params;
  const path = section.join("/");
  return {
    title: headings[path]?.[0] || path.split("/").pop()?.replaceAll("-", " "),
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string[] }>;
}) {
  const { section } = await params;
  const path = section.join("/");
  if (!paths.includes(path)) notFound();
  let content: React.ReactNode;
  if (path === "custom-orders" || path === "events")
    content = <ServicePage event={path === "events"} />;
  else if (path === "help") content = <Help />;
  else if (path === "about") content = <About />;
  else if (path === "our-work") content = <OurWork />;
  else if (path === "contact") content = <Contact />;
  else if (
    [
      "help/photo-guide",
      "help/shipping",
      "help/returns",
      "privacy",
      "terms",
      "accessibility",
    ].includes(path)
  )
    content = <Information path={path} />;
  else {
    const h = headings[path];
    content = (
      <>
        <PageHeading title={h[0]} eyebrow={h[1]} description={h[2]} />
        {path === "cart" ? (
          <Bag />
        ) : path === "saved" ? (
          <Saved />
        ) : path === "checkout" ? (
          <Checkout />
        ) : path === "gift-finder" ? (
          <GiftFinder />
        ) : path === "account" ? (
          <Account />
        ) : path === "admin" ? (
          <Admin />
        ) : (
          <Portal kind={path as "orders" | "proofs" | "quotes"} />
        )}
      </>
    );
  }
  return <div className="container">{content}</div>;
}
