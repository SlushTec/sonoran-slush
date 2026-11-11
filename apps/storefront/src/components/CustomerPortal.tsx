"use client";
import Link from "next/link";
import { useStore } from "./Store";
import Icon from "./Icon";
import ProofReviewPortal from "./ProofReviewPortal";
import OrderReviewPortal from "./OrderReviewPortal";
import QuoteReviewPortal from "./QuoteReviewPortal";
export function Portal({ kind }: { kind: "orders" | "proofs" | "quotes" }) {
  return kind === "proofs" ? <ProofReviewPortal /> : kind === "orders" ? <OrderReviewPortal /> : <QuoteReviewPortal />;
}
export function Account() {
  const { designs, favorites } = useStore();
  const login = process.env.NEXT_PUBLIC_CUSTOMER_LOGIN_URL;
  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="info-banner">
        <strong>Keep it simple.</strong> You can prepare a gift request, open an
        order, or review a proof without creating an account.
      </div>
      <div className="dashboard-grid" style={{ marginTop: 30 }}>
        {[
          [
            "Saved designs",
            designs.length + " designs kept on this device.",
            "/saved",
            "pencil",
          ],
          [
            "Favorite gifts",
            favorites.length + " gifts that caught your eye.",
            "/saved",
            "heart",
          ],
          [
            "Your orders",
            "Open a private order with your reference and access code.",
            "/orders",
            "bag",
          ],
          [
            "Proof review",
            "Check the exact artwork version before you approve.",
            "/proofs",
            "check",
          ],
          [
            "Custom requests",
            "Open the latest status of a quote or custom inquiry.",
            "/quotes",
            "mail",
          ],
          [
            "Need a hand?",
            "Find artwork guidance, care notes, and a way to ask.",
            "/help",
            "sparkle",
          ],
        ].map(([title, copy, url, icon]) => (
          <article className="dashboard-card" key={title}>
            <Icon
              name={icon}
              style={{ color: "var(--gold)", marginBottom: 18 }}
            />
            <h2>{title}</h2>
            <p>{copy}</p>
            <Link className="text-link" href={url}>
              Open <Icon name="arrow" size={15} />
            </Link>
          </article>
        ))}
      </div>
      <div className="clear-section">
        <div>
          <h2>An account, when you want one.</h2>
          <p>
            Online sign-in will connect saved work and order history across your
            devices.
          </p>
        </div>
        {login?.startsWith("https://") ? (
          <a className="button primary" href={login}>
            Sign in securely <Icon name="arrow" />
          </a>
        ) : (
          <span className="small muted">
            Account sign-in is being connected.
          </span>
        )}
      </div>
    </div>
  );
}
export { default as Admin } from "./StaffWorkspace";
