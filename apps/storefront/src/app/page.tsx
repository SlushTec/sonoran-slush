import Link from "next/link";
import { catalog } from "@/lib/catalog";
import { featuredSlugs, categoryShort } from "@/lib/shop";
import Icon, { categoryIcons } from "@/components/Icon";
import ProductCard from "@/components/ProductCard";
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-star">✦</span> Ordinary things.
              Extraordinary meaning.
            </p>
            <h1>
              A little personal.
              <br />A lot <em>unforgettable.</em>
            </h1>
            <p>
              A favorite face. A family name. An inside joke.
              <br className="desktop-break" /> Turn the things they love into
              something only you could give.
            </p>
            <div className="actions">
              <Link className="button primary" href="/shop">
                Find their gift <Icon name="arrow" size={18} />
              </Link>
              <Link className="button text-button" href="/gift-finder">
                Need a little inspiration? <Icon name="arrow" size={17} />
              </Link>
            </div>
            <div className="hero-signoff">
              <span className="hero-line" />
              <p>
                Personalized gifts & laser engraving
                <br />
                <strong>Made with meaning in Tucson, Arizona.</strong>
              </p>
            </div>
          </div>
          <div
            className="hero-editorial"
            aria-label="Sonoran Slush desert emblem"
          >
            <div className="editorial-top">
              <span>THE PERSONAL TOUCH</span>
              <span>EST. IN TUCSON, AZ</span>
            </div>
            <div className="editorial-type southwest-editorial">
              <img
                src="/brand/desert-mark-light.svg"
                alt="A roadrunner, coyote, and saguaro in the Sonoran Desert"
                width="430"
                height="317"
              />
              <span>
                Rooted in the desert.
                <br />
                <em>Made for your story.</em>
              </span>
            </div>
            <div className="editorial-bottom">
              <span>
                YOUR MEMORY.
                <br />
                OUR CRAFT.
              </span>
              <span className="photo-pending">A little Sonoran spirit</span>
            </div>
          </div>
        </div>
      </section>
      <div className="craft-strip">
        <div className="container">
          <span>
            <Icon name="pencil" />
            Personalized, down to the detail
          </span>
          <span>
            <Icon name="gift" />
            Gifts for life’s real moments
          </span>
          <span>
            <Icon name="pin" />A small Arizona studio
          </span>
        </div>
      </div>
      <section className="container section collection-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A gift for every kind of person</p>
            <h2>Find your starting point.</h2>
          </div>
          <Link href="/shop" className="text-link">
            Explore all gifts <Icon name="arrow" />
          </Link>
        </div>
        <div className="collection-grid">
          {catalog.categories.map((c, i) => (
            <Link
              key={c.slug}
              href={"/shop/" + c.slug}
              className="collection-tile"
            >
              <span className="collection-number">0{i + 1}</span>
              <Icon name={categoryIcons[c.slug]} size={34} />
              <h3>{categoryShort[c.slug]}</h3>
              <span className="collection-arrow">
                <Icon name="arrow" size={19} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="section soft">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Thoughtful things, made theirs</p>
              <h2>
                Everyday favorites.
                <br />
                <em>Anything but ordinary.</em>
              </h2>
            </div>
            <Link className="text-link" href="/shop">
              Meet the collection <Icon name="arrow" />
            </Link>
          </div>
          <div className="product-grid">
            {featuredSlugs.map((slug) => (
              <ProductCard
                key={slug}
                product={catalog.products.find((p) => p.slug === slug)!}
              />
            ))}
          </div>
        </div>
      </section>
      <section className="occasion-band">
        <div className="container">
          <p className="eyebrow">There’s always a reason</p>
          <div className="occasion-row">
            <h2>
              Made for <em>your moment.</em>
            </h2>
            <div className="occasion-links">
              {[
                "Wedding",
                "Birthday",
                "Graduation",
                "Remembrance",
                "Housewarming",
                "Thank you",
              ].map((o) => (
                <Link key={o} href={"/shop?occasion=" + encodeURIComponent(o)}>
                  {o}
                  <Icon name="arrow" size={15} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="container section process-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your idea. Our craft.</p>
            <h2>Personal shouldn’t be complicated.</h2>
          </div>
          <p className="section-description">
            A few thoughtful details make all the difference.
            <br />
            We help with the rest.
          </p>
        </div>
        <div className="process-grid">
          {[
            [
              "01",
              "Find their thing",
              "A tumbler for their daily ritual. A board for their table. A crystal for a favorite memory.",
              "gift",
            ],
            [
              "02",
              "Make it personal",
              "Add a name, a meaningful date, your artwork, or a photograph. Save your idea and come back to it.",
              "pencil",
            ],
            [
              "03",
              "Let the details come together",
              "We review your request, confirm the details, and prepare the proof needed for your piece.",
              "sparkle",
            ],
          ].map(([n, title, copy, icon]) => (
            <article key={n}>
              <div className="process-top">
                <span>{n}</span>
                <Icon name={icon} size={27} />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="container event-home-wrap">
        <div className="event-home">
          <div className="event-home-copy">
            <p className="eyebrow">The memory is the main event</p>
            <h2>
              We bring the craft.
              <br />
              <em>You bring the occasion.</em>
            </h2>
            <p>
              Live engraving at weddings, celebrations, and company gatherings.
              Give your guests more than a favor: give them a moment they can
              take home.
            </p>
            <Link href="/events" className="button cream-button">
              Let’s plan your event <Icon name="arrow" />
            </Link>
            <span className="event-region">
              <Icon name="pin" size={16} /> Arizona · New Mexico · Southern
              California
            </span>
          </div>
          <div className="event-home-detail">
            <Icon name="sparkle" size={48} />
            <span>
              Made here.
              <br />
              In the moment.
              <br />
              <em>Kept forever.</em>
            </span>
            <Link href="/events">
              Explore live engraving <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </section>
      <section className="container section story-teaser">
        <div>
          <p className="eyebrow">Not off the shelf. From the heart.</p>
          <h2>
            Small studio.
            <br />
            <em>Big on the little things.</em>
          </h2>
        </div>
        <div>
          <p>
            We’re Sonoran Slush Creative Creations, a Tucson studio turning
            everyday objects and favorite memories into something personal.
          </p>
          <p>
            From one thoughtful gift to a room full of keepsakes, it starts the
            same way: with your story.
          </p>
          <Link className="text-link" href="/about">
            A little about us <Icon name="arrow" />
          </Link>
        </div>
      </section>
      <div className="help-callout">
        <div className="container">
          <Icon name="sparkle" size={28} />
          <div>
            <h2>Not sure where to start?</h2>
            <p>Tell us who it’s for. We’ll help you find their thing.</p>
          </div>
          <Link className="button outline" href="/gift-finder">
            Find a little inspiration <Icon name="arrow" />
          </Link>
        </div>
      </div>
    </>
  );
}
