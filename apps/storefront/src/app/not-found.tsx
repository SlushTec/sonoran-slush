import Link from "next/link";
import Icon from "@/components/Icon";
export default function NotFound() {
  return (
    <div className="container error-page">
      <p className="eyebrow">A little detour</p>
      <h1>
        That page has
        <br />
        <em>stepped out of the studio.</em>
      </h1>
      <p>The collection is still here. Let’s find a good place to start.</p>
      <div className="actions">
        <Link className="button primary" href="/shop">
          Explore the gifts <Icon name="arrow" />
        </Link>
        <Link className="button outline" href="/">
          Back to home
        </Link>
      </div>
    </div>
  );
}
