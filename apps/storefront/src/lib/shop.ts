import { catalog, type Product } from "./catalog";
import { crystalShapes } from "./crystals";

export type Option = { label: string; values: string[] };
export type ProductInfo = {
  title: string;
  line: string;
  description: string;
  material: string;
  care: string;
  occasions: string[];
  options: Option[];
  details: [string, string][];
  personalization: "text" | "photo" | "either" | "none";
};
const base = (
  title: string,
  line: string,
  description: string,
  material: string,
  occasions: string[],
  options: Option[] = [],
  details: [string, string][] = [],
): ProductInfo => ({
  title,
  line,
  description,
  material,
  occasions,
  options,
  details,
  personalization: "text",
  care: "Use a soft cloth and wash by hand. Keep the engraved surface away from abrasive cleaners.",
});
const option = (label: string, ...values: string[]): Option => ({
  label,
  values,
});
const placement = option(
  "Engraving placement",
  "One side",
  "Two sides",
  "Bottom",
  "One side + bottom",
  "Two sides + bottom",
);
const glassSet = option("Set size", "Single", "Pair", "Set of 4");
const wedding = ["Wedding", "Anniversary", "Housewarming"];
const everyday = ["Birthday", "Graduation", "Thank you"];
export const productInfo: Record<string, ProductInfo> = {
  "makertwist-40oz-tumbler": base(
    "The everyday tumbler",
    "Cold longer. Marked for keeps.",
    "A generous 40 oz stainless steel tumbler, made personal with a name, a monogram, or a design they will reach for every day.",
    "Stainless steel",
    everyday,
    [
      option("Design", "Name or monogram", "Logo or custom design"),
      option("Placement", "Single placement", "Full-wrap design request"),
    ],
    [
      ["Capacity", "40 oz"],
      ["Finish", "Powder-coated stainless steel"],
      ["Care", "Hand wash only"],
    ],
  ),
  "makerflo-32oz-water-bottle": base(
    "The go-everywhere bottle",
    "Hydrate. Carry the mark.",
    "From a workday to a trail day, a personalized 32 oz insulated bottle makes the practical feel thoughtful.",
    "Stainless steel",
    ["Birthday", "Graduation", "Team gifts"],
    [option("Design", "Name or monogram", "Logo or custom design")],
    [
      ["Capacity", "32 oz"],
      ["Lid", "Dual straw and chug lid"],
      ["Material", "304 stainless steel"],
    ],
  ),
  "makerflo-40oz-electroplated": base(
    "The metallic-reveal tumbler",
    "A little more shine. A lot more personal.",
    "Engraving through the powder coat reveals the metallic finish beneath. A bold canvas for names, artwork, and meaningful marks.",
    "Stainless steel",
    everyday,
    [
      option("Finish request", "Gold reveal", "Rainbow reveal"),
      option("Outer coat request", "Black", "White"),
    ],
    [
      ["Capacity", "40 oz"],
      ["Process", "Laser-revealed electroplating"],
    ],
  ),
  "libbey-1639-mixing-glass": base(
    "The personalized pint",
    "Their glass. Every pour.",
    "A classic 16 oz Libbey mixing glass with room for a monogram, a favorite line, or a mark that belongs at their bar.",
    "Glass",
    wedding,
    [placement, glassSet],
    [
      ["Capacity", "16 oz"],
      ["Glass", "Libbey 1639"],
      ["Process", "Surface engraving"],
    ],
  ),
  "libbey-2339-dof": base(
    "The rocks glass",
    "A name worth toasting.",
    "A substantial, short-profile Libbey rocks glass for the rituals worth keeping. Add a name, a date, or a quiet message on the base.",
    "Glass",
    ["Birthday", "Anniversary", "Retirement", "Wedding"],
    [placement, glassSet],
    [
      ["Capacity", "12½ oz"],
      ["Glass", "Libbey 2339 Lexington"],
      ["Process", "Surface engraving"],
    ],
  ),
  "shot-glass-2oz-square": base(
    "The square shot glass",
    "Small glass. Big occasion.",
    "A square glass with a reassuringly heavy base. Personalize a single piece or plan favors for the whole celebration.",
    "Glass",
    ["Wedding", "Birthday", "Team gifts"],
    [
      placement,
      option("Finish request", "Frosted engraving", "Color fill request"),
    ],
    [
      ["Capacity", "Approximately 2.2 oz"],
      ["Process", "Surface engraving"],
      ["Color fill", "Additional curing time; reviewed separately"],
    ],
  ),
  "shot-glass-2oz-wood-box": base(
    "The boxed toast set",
    "Keep the toast. And the memory.",
    "Mini shot glasses in a wood gift box, ready for names, a wedding date, or the mark of a memorable gathering.",
    "Glass",
    wedding,
    [option("Engraving request", "Glasses", "Glasses + box")],
    [
      ["Capacity", "2 oz glass class"],
      ["Packaging", "Wood gift box"],
      ["Set contents", "Confirmed with your quote"],
    ],
  ),
  "whiskey-decanter-26oz-set": base(
    "The signature decanter set",
    "A ritual with their name on it.",
    "A classic decanter and matching rocks glasses, personalized for anniversaries, retirements, and evenings at home.",
    "Glass",
    ["Anniversary", "Retirement", "Birthday", "Wedding"],
    [option("Engraving request", "Decanter", "Decanter + glasses")],
    [
      ["Decanter", "Approximately 26 oz"],
      ["Material", "Lead-free glass"],
      ["Set contents", "Confirmed with your quote"],
    ],
  ),
  "whiskey-decanter-4-glass-stones": base(
    "The complete whiskey set",
    "The full pour. The full gift.",
    "A decanter, four tumblers, eight chilling stones, and a wood box. Personal details turn the complete set into their own little tradition.",
    "Glass",
    ["Birthday", "Anniversary", "Retirement", "Housewarming"],
    [
      option(
        "Engraving request",
        "Decanter",
        "Decanter + glasses",
        "Decanter + glasses + box",
      ),
    ],
    [
      ["Includes", "Decanter, 4 tumblers, 8 stones"],
      ["Packaging", "Wood gift box"],
    ],
  ),
  "cocktail-smoker-kit": base(
    "The cocktail ritual kit",
    "Make an evening of it.",
    "A cocktail smoker kit in a wood box, with a personal mark on the lid or smoker top. For the person who makes the pour an occasion.",
    "Wood",
    ["Birthday", "Retirement", "Thank you"],
    [
      option(
        "Engraving request",
        "Box lid",
        "Smoker top",
        "Box lid + smoker top",
      ),
    ],
    [
      ["Kit", "Smoker top, torch, wood chips, wood box"],
      ["Process", "Surface engraving on wood"],
    ],
  ),
  "crystal-wine-stopper": base(
    "The keepsake wine stopper",
    "Close the bottle. Keep the night.",
    "A crystal glass wine stopper with a name, date, or monogram. A small reminder of a good evening, ready for the next one.",
    "Glass",
    wedding,
    [],
    [
      ["Material", "Crystal / glass top"],
      ["Process", "Surface engraving"],
    ],
  ),
  "acacia-cutting-boards": base(
    "The acacia gathering board",
    "Good food. Better company.",
    "Natural acacia wood, useful every day and personal enough to give. Add a family name, a wedding date, or a design that belongs in their kitchen.",
    "Wood",
    wedding,
    [option("Size request", "Small", "Medium", "Large", "Three-board set")],
    [
      ["Material", "Acacia wood"],
      ["Sizes", "Dimensions depend on the selected blank"],
      ["Use", "Prep and serving"],
    ],
  ),
  "bamboo-cutting-board": base(
    "The bamboo kitchen board",
    "A place at their table.",
    "A handled bamboo board with a personal mark. A thoughtful housewarming gift, a useful thank-you, or a starting point for custom favors.",
    "Wood",
    ["Housewarming", "Wedding", "Thank you"],
    [],
    [
      ["Material", "Bamboo"],
      ["Dimensions", "Approximately 11 × 8.6 in"],
      ["Care", "Hand wash; do not soak"],
    ],
  ),
  "salt-rimmer-acacia": base(
    "The margarita night rimmer",
    "Salt the rim. Keep the night.",
    "An acacia salt rimmer with a matching lid, engraved for the home bar, a wedding toast, or the host who always makes room for one more.",
    "Wood",
    ["Housewarming", "Wedding", "Birthday"],
    [option("Engraving request", "Top ring", "Lid", "Top ring + lid")],
    [
      ["Material", "Acacia wood"],
      ["Diameter", "Approximately 5.9 in"],
      ["Includes", "One rimmer and matching lid"],
    ],
  ),
  "laserette-journal": base(
    "The next-chapter journal",
    "A place for what comes next.",
    "A refillable leatherette journal with their name or mark on the cover. For a new job, a new chapter, or the thoughts worth writing down.",
    "Leatherette",
    ["Graduation", "Thank you", "Birthday"],
    [option("Placement", "Front cover", "Front + back cover")],
    [
      ["Material", "Engravable leatherette"],
      ["Size", "Approximately 8.75 × 5.5 in"],
      ["Cover", "Removable and refillable"],
    ],
  ),
  "aluminum-rfid-money-clip": base(
    "The everyday money clip",
    "Less bulk. More meaning.",
    "A slim aluminum card holder and money clip, engraved with a name, initials, or a small mark that makes an everyday essential their own.",
    "Metal",
    ["Graduation", "Wedding", "Birthday"],
    [],
    [
      ["Material", "Aluminum alloy"],
      ["Format", "Card holder + money clip"],
    ],
  ),
  "credit-card-bottle-opener": base(
    "The pocket bottle opener",
    "A small mark that goes everywhere.",
    "A card-shaped bottle opener with space for a name, a logo, or a reminder of the celebration. A useful little gift for a big group.",
    "Metal",
    ["Wedding", "Team gifts", "Thank you"],
  ),
  "steel-flat-bottle-opener": base(
    "The classic bar opener",
    "The mark behind the bar.",
    "A flat steel bottle opener, personalized for a favorite bartender, a home bar, or a team. Simple, practical, and distinctly theirs.",
    "Metal",
    ["Birthday", "Team gifts", "Thank you"],
  ),
  "wood-bottle-opener-keychain": base(
    "The bottle-opener keychain",
    "A useful little keepsake.",
    "A wood-accented bottle opener that travels on a keyring. Personalize it for a celebration, a team, or an everyday thank-you.",
    "Wood",
    ["Wedding", "Team gifts", "Thank you"],
  ),
  "wood-keychain-rectangle": base(
    "The wood keepsake keychain",
    "Something small to keep close.",
    "A rectangle wood keychain with room for a name, a date, or a simple design. A little everyday reminder with a natural finish.",
    "Wood",
    everyday,
  ),
  "wood-keychain-round": base(
    "The round wood keychain",
    "Carry a little of the occasion.",
    "A round wood keychain engraved with a name, a monogram, or a simple logo. A personal token that goes wherever they do.",
    "Wood",
    everyday,
  ),
  "crystal-heart-ornament": {
    ...base(
      "The heart ornament",
      "Some memories belong in the light.",
      "A heart-shaped hanging ornament, surface engraved with names, a date, or a favorite photo. For a tree, a window, or a place of remembrance.",
      "Crystal",
      ["Holiday", "Anniversary", "Remembrance"],
    ),
    personalization: "either",
  },
  "crystal-round-ornament-60-80": {
    ...base(
      "The round keepsake ornament",
      "A memory for every season.",
      "A clear, round hanging ornament with a photo, name, or year worth keeping. Surface engraving makes it distinct from our subsurface 3D crystals.",
      "Crystal",
      ["Holiday", "Wedding", "Remembrance"],
      [option("Size request", "60 mm", "80 mm")],
      [
        ["Process", "Surface engraving"],
        ["Format", "Hanging ornament"],
      ],
    ),
    personalization: "either",
  },
  "photo-crystal-collection": {
    ...base(
      "Your photo, held in crystal",
      "A moment. Made permanent.",
      "Turn a favorite photograph into a keepsake with an image engraved inside optical crystal. Choose a shape, add a personal inscription, and let the memory take its place.",
      "Crystal",
      ["Anniversary", "Remembrance", "Graduation", "Wedding"],
      [
        option(
          "Crystal shape",
          "Rectangle tall",
          "Rectangle wide",
          "Heart",
          "Cut corner diamond",
          "Prestige Iceberg small",
          "Dog bone",
          "Candle",
          "Small notched",
          "Circle ornament",
          "Heart keychain",
          "Rectangle keychain",
          "2D heart necklace",
          "2D rectangle necklace",
        ),
      ],
      [
        ["Process", "Subsurface engraving; necklaces use 2D engraving"],
        ["Photo", "Human artwork review before production"],
        ["Sizes", "Only supported shapes and sizes are offered"],
      ],
    ),
    personalization: "photo",
    care: "Dust gently with a soft cloth. Avoid harsh cleaners, impacts, and extreme temperature changes.",
  },
  "crystal-bases": {
    ...base(
      "A little light for your memory",
      "Give the details their moment.",
      "Explore light and wood bases for photo crystals. Compatibility, dimensions, and the finish are confirmed for the crystal you select.",
      "Mixed materials",
      ["Anniversary", "Remembrance"],
      [option("Base request", "LED light base", "Wood base")],
      [["Compatibility", "Reviewed for your selected crystal"]],
    ),
    personalization: "none",
  },
  "balsa-earrings": base(
    "The hand-painted earrings",
    "A little color. A little character.",
    "Hand-painted balsa wood earrings for a personal gift with a light touch. Tell us about the look you have in mind.",
    "Wood",
    ["Birthday", "Thank you"],
  ),
  "stainless-pendants": base(
    "The personal pendant",
    "A mark to wear close.",
    "A stainless steel pendant personalized with a name, initials, or a simple design. Tell us about the piece you want to create.",
    "Metal",
    ["Anniversary", "Birthday", "Remembrance"],
  ),
  "pet-tags": base(
    "The very-good-pet tag",
    "For the one who is family.",
    "A personal tag for their everyday adventures. Add a pet name and discuss the contact details and shape that work for your companion.",
    "Metal",
    ["Pet gifts", "Birthday"],
  ),
  "pet-bowls": base(
    "The personalized pet bowl",
    "Their name. Their corner of home.",
    "A metal pet bowl engraved for the family member who never misses dinner. Tell us about the size and style you have in mind.",
    "Metal",
    ["Pet gifts", "Housewarming"],
  ),
};
for (const shape of crystalShapes) {
  productInfo[shape.slug] = {
    ...base(
      shape.title,
      shape.line,
      shape.description,
      "Crystal",
      shape.shape === "Dog bone"
        ? ["Pet gifts", "Remembrance", "Birthday"]
        : ["Anniversary", "Remembrance", "Graduation", "Wedding", "Holiday"],
      [
        option("Size", ...shape.sizes.map((s) => s.value)),
        ...(shape.orientations.length
          ? [option("Orientation", ...shape.orientations)]
          : []),
      ],
      [
        ["Shape", shape.shape],
        ["Process", shape.process + " subsurface photo engraving"],
        ["Photo", "Your photograph; artwork reviewed before production"],
        ["Size range", shape.sizes.map((s) => s.label).join("; ")],
      ],
    ),
    personalization: "photo",
    care: "Dust gently with a soft cloth. Avoid harsh cleaners, impacts, and extreme temperature changes.",
  };
}
export function infoFor(p: Product) {
  return productInfo[p.slug];
}
export const featuredSlugs = [
  "makertwist-40oz-tumbler",
  "acacia-cutting-boards",
  "photo-crystal-heart",
  "whiskey-decanter-4-glass-stones",
];
export const occasions = [
  "All occasions",
  "Birthday",
  "Wedding",
  "Anniversary",
  "Housewarming",
  "Graduation",
  "Remembrance",
  "Holiday",
  "Thank you",
  "Team gifts",
  "Retirement",
  "Pet gifts",
];
export const categoryShort: Record<string, string> = {
  drinkware: "Drinkware",
  "glassware-bar": "Bar & glassware",
  kitchen: "Kitchen & hosting",
  "small-gifts": "Little keepsakes",
  "jewelry-pets": "Jewelry & pets",
  ornaments: "Ornaments",
  "photo-crystals": "3D photo crystals",
};
export const categoryLines: Record<string, string> = {
  drinkware: "Their everyday, made personal.",
  "glassware-bar": "Here’s to the good company.",
  kitchen: "A place at their table.",
  "small-gifts": "Small things. Lasting meaning.",
  "jewelry-pets": "For the ones held closest.",
  ornaments: "Memories that catch the light.",
  "photo-crystals": "A moment, made permanent.",
};
export const categoryNames = Object.fromEntries(
  catalog.categories.map((c) => [c.slug, c.name]),
);
export const fonts = [
  { name: "Classic serif", family: "Georgia, serif" },
  { name: "Modern sans", family: "Arial, sans-serif" },
  { name: "Handwritten", family: "cursive" },
];
export function crystalSizes(shape: string = ""): string[] {
  return (
    crystalShapes.find((s) => s.shape === shape)?.sizes.map((s) => s.value) || [
      "Size confirmed during review",
    ]
  );
}
