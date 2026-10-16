import Link from "next/link";
import Icon from "./Icon";
import InquiryForm from "./InquiryForm";
import { ProductVisual } from "./ProductCard";
import { catalog } from "@/lib/catalog";
import { categoryShort } from "@/lib/shop";
export function PageHeading({
  title,
  eyebrow,
  description,
}: {
  title: string;
  eyebrow: string;
  description?: string;
}) {
  return (
    <div className="page-intro">
      <p className="breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        {title}
      </p>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
}
const helpNav = [
  ["Help & contact", "/help"],
  ["Photo & artwork guide", "/help/photo-guide"],
  ["Shipping & pickup", "/help/shipping"],
  ["Care & order help", "/help/returns"],
  ["Privacy", "/privacy"],
  ["Ordering terms", "/terms"],
  ["Accessibility", "/accessibility"],
];
export function Information({ path }: { path: string }) {
  const contents: Record<
    string,
    {
      eyebrow: string;
      title: string;
      description: string;
      sections: { title: string; paragraphs?: string[]; list?: string[] }[];
    }
  > = {
    "help/photo-guide": {
      eyebrow: "A little preparation goes a long way",
      title: "A good photo. A great starting point.",
      description:
        "Clear faces, thoughtful framing, and the best original you have. We help with the rest.",
      sections: [
        {
          title: "Start with the original.",
          paragraphs: [
            "Choose a well-lit photo with clear faces and good contrast. An original camera file usually gives more detail than a screenshot or an image downloaded from social media.",
            "Avoid cutting off the top of a head, ears, or other important details. For group portraits, look for enough space between faces to keep each person recognizable.",
          ],
        },
        {
          title: "Local artwork preview.",
          paragraphs: [
            "The customizer accepts JPG, PNG, and WebP files up to 10 MB for a local layout preview. HEIC photos need to be exported as JPG first. SVG, documents, and other formats are not accepted by the preview.",
            "The preview does not upload your file. Original artwork is not stored in the saved draft; you will need to reattach it or provide it through the studio’s secure artwork process.",
          ],
        },
        {
          title: "A layout is a starting point.",
          paragraphs: [
            "The text and photo layout in the customizer helps you explore your idea. It is not a finished production proof, a 3D conversion, or a physically accurate representation of the engraving.",
            "Where a proof is required, check the exact version sent by the studio. New artwork or a revised proof requires a new approval before production.",
          ],
        },
        {
          title: "Names, dates, logos, and little details.",
          list: [
            "Double-check spelling and dates before saving your design.",
            "Use original artwork you have permission to reproduce.",
            "For logos, bring the clearest source you have and describe the intended placement.",
            "Tell us when each piece needs a different name. Shared artwork and unique personalization are reviewed separately.",
          ],
        },
      ],
    },
    "help/shipping": {
      eyebrow: "From your idea to your hands",
      title: "Timing, shipping & pickup.",
      description:
        "A personal piece has a few steps before it heads your way. We make those steps clear.",
      sections: [
        {
          title: "Three dates, three different things.",
          list: [
            "Artwork deadline: when we need your files and any required proof approval.",
            "Production estimate: time to make and check your approved piece.",
            "Arrival estimate: transit after dispatch, separate from production.",
          ],
        },
        {
          title: "A deadline worth discussing.",
          paragraphs: [
            "Tell us your desired arrival date when you request a quote. The studio reviews material availability, artwork preparation, production capacity, and delivery options before committing to a timeline.",
            "Color-filled glassware requires curing time. It is not a same-day engraving option.",
          ],
        },
        {
          title: "Shipping & Tucson pickup.",
          paragraphs: [
            "Delivery methods, costs, and any pickup arrangements are confirmed during quote review. This private storefront review does not show live shipping rates or promise pickup availability.",
            "If a piece is a surprise gift, tell us. The request form uses the purchaser’s contact details; it does not sign a recipient up for marketing.",
          ],
        },
        {
          title: "Live events are a separate plan.",
          paragraphs: [
            "For engraving at a venue, use the event inquiry. Date availability, travel, setup, quantity, and production capacity are reviewed as part of the proposal. An inquiry alone does not reserve a date.",
          ],
        },
      ],
    },
    "help/returns": {
      eyebrow: "Good things deserve good care",
      title: "Care, keeping & a little help.",
      description:
        "A few simple habits keep a personal gift looking its best. If something needs attention, start here.",
      sections: [
        {
          title: "Photo crystals.",
          paragraphs: [
            "Dust gently with a soft cloth. Avoid harsh cleaners, impacts, and extreme temperature changes. The image in a subsurface photo crystal is engraved inside the crystal.",
            "A hanging surface-engraved ornament is a different product from a subsurface photo crystal. Follow the care instructions provided for the piece you receive.",
          ],
        },
        {
          title: "Wood boards & bar accessories.",
          paragraphs: [
            "Hand wash and dry promptly. Do not soak wood or put it in the dishwasher. Use the unengraved side of a board for cutting, and follow the studio’s care instructions for its finish.",
          ],
        },
        {
          title: "Drinkware & glassware.",
          paragraphs: [
            "Hand washing is the careful choice for personalized drinkware and fine engraved detail. Avoid abrasive scrubbing on the engraving. Color-filled work needs the care instructions supplied with the finished piece.",
          ],
        },
        {
          title: "Something arrived damaged or looks wrong?",
          paragraphs: [
            "Keep the packaging and take clear photos of the issue and the whole piece. Gather your order reference and contact the studio so the details can be reviewed.",
            "For an artwork concern, include the version of the proof you approved. Final returns, remake, and refund terms will be shown with live ordering; this review does not invent a policy.",
          ],
        },
      ],
    },
    privacy: {
      eyebrow: "Your story stays yours",
      title: "A little clarity about privacy.",
      description:
        "What this review saves, what stays local, and how you can clear it.",
      sections: [
        {
          title: "Saved work on this device.",
          paragraphs: [
            "Design text, selected options, favorites, and your bag are saved in this browser’s local storage for up to 30 days after the latest save. If you explicitly save an inquiry draft, that draft includes the form details you entered.",
            "Local storage is tied to the browser and device. It is not an online account or a way to move designs across devices. On a shared device, clear your saved work when you are finished.",
          ],
        },
        {
          title: "Your photos and artwork.",
          paragraphs: [
            "A local image preview is held in browser memory for this visit. Original file contents are not put in local storage, sent to an AI model, or included in analytics. A saved design may keep the file name so you know what to reattach.",
            "Local zoom and placement adjustments are exploratory; they do not submit an artwork file or authorize manufacturing.",
          ],
        },
        {
          title: "Submitting a request.",
          paragraphs: [
            "Online submission requires the connected commerce service. When connected, selecting Send submits the shown request details for the studio to review. Downloading a draft does not send it.",
            "Contact details are used to respond to your request. Marketing consent is not included or selected by default. Recipients are not enrolled in marketing by the request form.",
          ],
        },
        {
          title: "Access to private records.",
          paragraphs: [
            "An order, quote, or proof requires its reference and private access code. The code is held in memory for your visit, rather than added to page URLs or device storage. Keep downloaded private receipts secure.",
            "The review does not include third-party analytics, advertising trackers, or a live customer upload service. Final production privacy terms, retention schedules, and contact details must be published before public commerce opens.",
          ],
        },
      ],
    },
    terms: {
      eyebrow: "Clear details before a commitment",
      title: "Before it becomes an order.",
      description:
        "This is a private storefront review. Live ordering policies are still being finalized.",
      sections: [
        {
          title: "A saved design is an idea.",
          paragraphs: [
            "Saving a design or placing it in your bag does not reserve inventory, create a paid order, confirm a delivery date, or approve a proof. Selected options describe the piece you want the studio to review.",
          ],
        },
        {
          title: "A quote puts the details together.",
          paragraphs: [
            "Current materials, personalization, quantities, price, shipping, tax, and timing need to be confirmed before payment. This review does not publish provisional prices as a current offer.",
            "Shared designs and individually named pieces need different preparation. Ask for a quote that reflects the work you actually need.",
          ],
        },
        {
          title: "Artwork approval belongs to a version.",
          paragraphs: [
            "Where a proof is required, approval must identify the exact current proof version. Revisions invalidate earlier approvals. Payment and approval are separate from production release.",
          ],
        },
        {
          title: "An event needs a confirmed booking.",
          paragraphs: [
            "An inquiry does not hold or confirm a date. The studio reviews the venue, capacity, travel, preparation, and package details before agreeing a booking. Deposit, balance, cancellation, and travel terms belong in the reviewed agreement.",
          ],
        },
        {
          title: "Live terms before live payment.",
          paragraphs: [
            "Shipping, returns, remakes, refunds, privacy, and legally reviewed ordering terms must be available before public commerce opens. No card details or payments are collected by this private review.",
          ],
        },
      ],
    },
    accessibility: {
      eyebrow: "Thoughtful details for everyone",
      title: "An easier way to make it personal.",
      description:
        "The experience is designed to work with a keyboard, readable controls, and a clear next step.",
      sections: [
        {
          title: "Ways to use this site.",
          list: [
            "Use the Skip to content link to reach the main page.",
            "Use Tab to move between controls and Enter or Space to activate buttons.",
            "Use the labeled sliders and rotation selector to explore a local artwork layout without dragging.",
            "Search and filters work without a chat assistant.",
            "Reduced-motion preferences are respected.",
          ],
        },
        {
          title: "If something gets in the way.",
          paragraphs: [
            "You can save or download a draft and return to it. If a control or piece of content makes the site difficult to use, describe the page and what you were trying to do in the contact form.",
            "Accessibility requires ongoing testing with real devices and assistive technologies. This page describes the design approach; it is not a certification of conformance.",
          ],
        },
      ],
    },
  };
  const content = contents[path];
  if (!content) return null;
  return (
    <>
      <PageHeading
        title={content.title}
        eyebrow={content.eyebrow}
        description={content.description}
      />
      <div className="content-layout">
        <nav className="content-nav" aria-label="Help and policies">
          {helpNav.map(([n, url]) => (
            <Link
              href={url}
              className={"/" + path === url ? "active" : ""}
              key={url}
            >
              {n}
            </Link>
          ))}
        </nav>
        <article className="prose">
          {content.sections.map((s) => (
            <section key={s.title}>
              <h2>{s.title}</h2>
              {s.paragraphs?.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {s.list && (
                <ul>
                  {s.list.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          {path === "privacy" && (
            <Link className="text-link" href="/saved" style={{ marginTop: 20 }}>
              Manage or clear device data <Icon name="arrow" size={16} />
            </Link>
          )}
          <div className="help-contact">
            <h2>A little more help?</h2>
            <p>
              Tell us what you are working on. A clear question is a great
              starting point.
            </p>
            <Link
              href="/contact"
              className="text-link"
              style={{ marginTop: 15 }}
            >
              Start a conversation <Icon name="arrow" size={16} />
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
const faqs = [
  [
    "What can I personalize?",
    "Explore drinkware, glassware and bar gifts, boards and kitchen pieces, small gifts, jewelry and pet items, ornaments, and 3D photo crystals. Each product page shows the relevant design requests.",
  ],
  [
    "How is a photo crystal different from an ornament?",
    "A subsurface photo crystal holds an engraved image inside the crystal. Surface-engraved hanging ornaments carry their design on the surface. The product pages distinguish the processes.",
  ],
  [
    "Can I use a name, a logo, or my own photo?",
    "Yes, the starting point depends on the piece. Add text or a local artwork preview in the customizer and tell us what you have in mind. The studio reviews suitability before production.",
  ],
  [
    "Can I see a proof?",
    "Where a proof is required, the studio provides the exact version for review. The customizer’s local text and artwork layout is a planning aid, rather than the production proof.",
  ],
  [
    "Can every piece have a different name?",
    "Use the custom and bulk form to describe shared artwork plus individual names, or completely different designs. Those need separate preparation and reviewed pricing.",
  ],
  [
    "Do you engrave at events?",
    "We offer portable live engraving experiences for weddings, celebrations, and company gatherings. Arizona, New Mexico, and Southern California are the service-area focus. Dates, travel, products, and capacity are reviewed for each event.",
  ],
  [
    "Does an event inquiry reserve my date?",
    "No. An inquiry starts the conversation. The studio needs to confirm availability, the package, and the booking details with you.",
  ],
  [
    "How long does an order take?",
    "Timing depends on materials, artwork preparation, approval, the finish, and production capacity. Tell us your desired date so the studio can review it. Color fill requires additional curing time.",
  ],
  [
    "Where are my designs saved?",
    "Saved designs, favorites, and your bag stay in this browser for 30 days. Original artwork files are not saved. You can clear your device data from the Saved designs page.",
  ],
  [
    "Can I order without an account?",
    "Guest requests and private access to quotes, orders, and proofs are part of the flow. Public ordering and account sign-in need their live service connections.",
  ],
];
export function Help() {
  return (
    <>
      <PageHeading
        title="A little guidance. A clear next step."
        eyebrow="We are here for the details"
        description="From a good starting photo to caring for a finished keepsake, find a little help along the way."
      />
      <div className="help-topic-grid">
        {[
          [
            "Photo & artwork",
            "A clearer starting point for your design.",
            "/help/photo-guide",
            "pencil",
          ],
          [
            "Shipping & timing",
            "Artwork, production, and delivery — explained.",
            "/help/shipping",
            "truck",
          ],
          [
            "Care & order help",
            "Keep it looking good. Get help when needed.",
            "/help/returns",
            "heart",
          ],
        ].map(([n, d, u, i]) => (
          <Link className="help-topic" key={u} href={u}>
            <Icon name={i} size={29} />
            <h2>{n}</h2>
            <p>{d}</p>
            <span>
              Find out more <Icon name="arrow" size={16} />
            </span>
          </Link>
        ))}
      </div>
      <div className="content-layout">
        <nav className="content-nav" aria-label="Customer help">
          <Link href="/orders">Track your order</Link>
          <Link href="/proofs">Review a proof</Link>
          <Link href="/quotes">Open a custom request</Link>
          <Link href="/saved">Manage saved designs</Link>
          <Link href="/contact">Contact the studio</Link>
        </nav>
        <div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">The questions that come up</p>
              <h2>A few things, answered.</h2>
            </div>
          </div>
          <div className="faq">
            {faqs.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Icon name="plus" size={18} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
          <div className="help-contact">
            <h2>Your question is a little more personal?</h2>
            <p>Tell us what you have in mind and we can start there.</p>
            <Link
              href="/contact"
              className="text-link"
              style={{ marginTop: 12 }}
            >
              Ask the studio <Icon name="arrow" size={16} />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
export function ServicePage({ event }: { event: boolean }) {
  return (
    <>
      <p className="breadcrumb" style={{ paddingTop: 25 }}>
        <Link href="/">Home</Link>
        <span>/</span>
        {event ? "Live event engraving" : "Custom & bulk orders"}
      </p>
      <section className="service-hero">
        <div>
          <p className="eyebrow">
            {event
              ? "The experience becomes the keepsake"
              : "One thoughtful gift. Or a whole collection."}
          </p>
          <h1>
            {event ? (
              <>
                Made in the moment.
                <br />
                <em>Kept long after.</em>
              </>
            ) : (
              <>
                Your idea.
                <br />
                Your people.
                <br />
                <em>Your personal touch.</em>
              </>
            )}
          </h1>
          <p>
            {event
              ? "We bring portable engraving to the celebration, so the personal detail becomes part of the experience. Weddings, milestones, company gatherings — let’s make the moment mean a little more."
              : "A shared logo, a list of names, a mixed set of gifts, or something that starts with “could you make…” Tell us about your idea. We will work through the details together."}
          </p>
          <div className="actions">
            <a href="#inquiry" className="button primary">
              {event
                ? "Let’s talk about your event"
                : "Start your custom request"}
              <Icon name="arrow" />
            </a>
          </div>
          {event && (
            <div className="service-types">
              {[
                "Weddings",
                "Milestones",
                "Corporate gatherings",
                "Celebrations of life",
                "Festivals & markets",
              ].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="service-editorial">
          <Icon name={event ? "sparkle" : "pencil"} size={46} />
          <span>
            {event ? (
              <>
                A little wonder.
                <br />A real moment.
                <br />
                <em>A personal keepsake.</em>
              </>
            ) : (
              <>
                One mark.
                <br />
                Many stories.
                <br />
                <em>Made for your people.</em>
              </>
            )}
          </span>
          <small>
            {event
              ? "Arizona · New Mexico · Southern California"
              : "Names · Logos · Photos · Your ideas"}
          </small>
        </div>
      </section>
      <section className="service-benefits">
        {(event
          ? [
              [
                "A keepsake with a story",
                "Guests can see the craft and leave with something personal. Product mix and throughput are planned for your event.",
              ],
              [
                "A plan that fits the venue",
                "We review the space, setup, power, guest count, travel, and preparation with you.",
              ],
              [
                "A date, properly confirmed",
                "Your inquiry starts the conversation. Availability, a proposal, and agreed booking details come next.",
              ],
            ]
          : [
              [
                "Shared design or unique names?",
                "Tell us which pieces share artwork and which need individual personalization. The quote reflects the actual work.",
              ],
              [
                "A mix that feels considered",
                "Combine product families or ask for help choosing the right pieces for your people and occasion.",
              ],
              [
                "Clear before you commit",
                "Materials, artwork, quantities, pricing, timing, and any proof requirements come together in the reviewed quote.",
              ],
            ]
        ).map(([t, d]) => (
          <article key={t}>
            <h2>{t}</h2>
            <p>{d}</p>
          </article>
        ))}
      </section>
      <section className="form-layout" id="inquiry">
        <aside className="form-aside">
          <p className="eyebrow">Start with the idea</p>
          <h2>
            {event
              ? "Let’s make it an occasion."
              : "A little about what you have in mind."}
          </h2>
          <p>
            {event
              ? "A date, a place, and a rough headcount are a great start. We will review what is practical for your gathering."
              : "You do not need final artwork to start. A rough quantity, a product idea, and a deadline help us ask the right questions."}
          </p>
          <ol>
            <li>Tell us the essentials.</li>
            <li>The studio reviews the details and availability.</li>
            <li>We agree the quote and next steps with you.</li>
          </ol>
          <p>
            {event
              ? "An inquiry is not a confirmed booking. No date is held or payment taken by this form."
              : "A request is not a paid order. Pricing and production start only after the relevant details are agreed."}
          </p>
        </aside>
        <InquiryForm kind={event ? "event" : "bulk"} />
      </section>
    </>
  );
}
export function About() {
  return (
    <div className="story-page">
      <div className="story-intro">
        <p className="eyebrow">
          Sonoran Slush Creative Creations · Tucson, Arizona
        </p>
        <h1>
          Some things deserve
          <br />
          <em>a personal touch.</em>
        </h1>
        <p>
          A name on the cup they take everywhere. A memory held in crystal. A
          keepsake made right in the middle of the celebration.
        </p>
        <p>
          We’re a small, family-run creative studio with Arizona roots and a
          simple belief: the details are what make a gift feel like it came from
          you.
        </p>
      </div>
      <div className="story-quote">
        <span aria-hidden="true">✦</span>
        <blockquote>
          Ordinary things carry extraordinary meaning when they carry a little
          of your story.
        </blockquote>
      </div>
      <div className="story-values">
        {[
          [
            "pencil",
            "Your story comes first.",
            "A meaningful date, a favorite face, a phrase only the two of you understand. We start with what makes it personal.",
          ],
          [
            "leaf",
            "Small studio. Real craft.",
            "Laser engraving, natural materials, and thoughtful preparation. The work is in the little details.",
          ],
          [
            "sparkle",
            "The moment matters.",
            "From one gift to live engraving at a gathering, we help turn an occasion into a keepsake.",
          ],
        ].map(([i, t, d]) => (
          <article key={t}>
            <Icon name={i} size={28} />
            <h2>{t}</h2>
            <p>{d}</p>
          </article>
        ))}
      </div>
      <div
        className="actions"
        style={{ justifyContent: "center", marginTop: 40 }}
      >
        <Link href="/shop" className="button primary">
          Meet the collection <Icon name="arrow" />
        </Link>
        <Link href="/custom-orders" className="button outline">
          Tell us your idea
        </Link>
      </div>
    </div>
  );
}
export function OurWork() {
  return (
    <>
      <PageHeading
        title="A little look at the craft."
        eyebrow="The work, in the details"
        description="Personalized pieces across seven collections. Finished-product and studio photography will be added here."
      />
      <div className="info-banner" style={{ marginBottom: 30 }}>
        Photography has intentionally been left out of this build. These
        reserved panels show the planned portfolio structure; they are not
        examples of finished products.
      </div>
      <div className="product-grid" style={{ paddingBottom: 70 }}>
        {catalog.categories.map((c) => (
          <Link
            key={c.slug}
            href={"/shop/" + c.slug}
            style={{ textDecoration: "none" }}
          >
            <ProductVisual
              category={c.slug}
              label="Portfolio photography to come"
            />
            <h2 style={{ fontSize: 25, marginTop: 18 }}>
              {categoryShort[c.slug]}
            </h2>
            <p className="small muted" style={{ marginTop: 10 }}>
              {c.description}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
export function Contact() {
  return (
    <>
      <PageHeading
        title="Let’s start with your idea."
        eyebrow="A little conversation goes a long way"
        description="A question, a custom piece, a detail you want to get right. Tell us what is on your mind."
      />
      <div className="form-layout" style={{ paddingTop: 0 }}>
        <aside className="form-aside">
          <h2>Good things start here.</h2>
          <p>
            For a larger order or live event, the dedicated forms help us gather
            the right details.
          </p>
          <div className="actions">
            <Link href="/custom-orders" className="text-link">
              Custom & bulk orders <Icon name="arrow" size={16} />
            </Link>
            <Link href="/events" className="text-link">
              Live event engraving <Icon name="arrow" size={16} />
            </Link>
          </div>
          <p>
            Already working with the studio? Include your reference in the
            message, but keep your private access code out of it.
          </p>
        </aside>
        <InquiryForm kind="contact" />
      </div>
    </>
  );
}
