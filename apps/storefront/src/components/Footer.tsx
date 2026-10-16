import Link from "next/link";
import Icon from "./Icon";
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-story">
          <Link href="/" className="brand">
            <span className="brand-name">
              SONORAN SLUSH<span className="brand-dot">✦</span>
            </span>
            <span className="brand-sub">CREATIVE CREATIONS</span>
          </Link>
          <p>
            For the moments worth keeping.
            <br />
            Personalized gifts & custom engraving
            <br />
            from Tucson, Arizona.
          </p>
          <span className="footer-location">
            <Icon name="pin" size={15} /> Arizona roots. Personal touches.
          </span>
        </div>
        <div>
          <h2>Find your gift</h2>
          <Link href="/shop">All gifts</Link>
          <Link href="/shop/photo-crystals">3D photo crystals</Link>
          <Link href="/shop/drinkware">Drinkware</Link>
          <Link href="/shop/kitchen">Kitchen & entertaining</Link>
          <Link href="/gift-finder">Help me choose</Link>
        </div>
        <div>
          <h2>Make it happen</h2>
          <Link href="/custom-orders">Custom & bulk orders</Link>
          <Link href="/events">Live event engraving</Link>
          <Link href="/saved">Saved designs</Link>
          <Link href="/orders">Track an order</Link>
          <Link href="/proofs">Review a proof</Link>
        </div>
        <div>
          <h2>A little guidance</h2>
          <Link href="/about">Our story</Link>
          <Link href="/our-work">Our work</Link>
          <Link href="/help">Help & contact</Link>
          <Link href="/help/photo-guide">Photo & artwork guide</Link>
          <Link href="/help/shipping">Shipping & pickup</Link>
          <Link href="/help/returns">Care & order help</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <p>
          © {new Date().getFullYear()} Sonoran Slush Creative Creations. A
          SlushTec studio.
        </p>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Ordering terms</Link>
          <Link href="/accessibility">Accessibility</Link>
        </div>
      </div>
      <div className="review-note">
        Private storefront review · Product imagery, final pricing, and live
        service connections are pending.
      </div>
    </footer>
  );
}
