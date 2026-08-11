# Sonoran Slush — Marketing Assets Inventory (Filtered)

**Date received:** 2026-08-11  
**Filter applied:** Keep only items the **Jet Mini Original** can produce or that can be altered to fit its capabilities.

### Jet Mini Original Limits (locked)
- Max crystal size ≈ **6" × 4" (15 × 10 cm)**
- Field of view height ≈ **12 cm**
- Subsurface 3D engraving in optical / K9 crystal
- Practical shapes: rectangle (tall/wide), heart, prestige/cube, keychain, ornament, smaller awards

Anything clearly larger than this envelope is excluded or quarantined.

---

## Keep List (Usable / Alterable)

| Pack | Keep | Notes |
|------|------|-------|
| **Blank Crystal Images – Sizes** | Yes — filtered | Keep Cut Corner, Heart, Prestige, Rectangle Tall, Rectangle Wide **only if within ~6×4"**. Discard or quarantine any oversized blanks. |
| **Lifestyle shots** | Selective | Keep shots where the crystal is clearly within Original size range or can be cropped. Prefer desk, LED base, family, pet, and gift settings with mid-size crystals. |
| **Renders** | Yes — filtered | Keep heart, keychain, necklace/pendant-style, prestige, rectangle, and similar renders that fit the Original. Drop any large award or oversized prestige shots. |
| **Masks for website** | Yes — filtered | Keep masks for heart, rectangle tall/wide, keychain, prestige, ornament, dogbone (if size-appropriate). These are ideal for photo-in-crystal mockups. |
| **Brochure** | Selective | Extract only product claims, shapes, and sizes that match what the Jet Mini Original can actually make. Quarantine any page showing larger machines or oversized crystals. |

---

## Quarantine / Discard Criteria

- Crystals visually larger than ~6" in any primary dimension
- Multi-crystal large arrays that imply a bigger machine
- Marketing that claims sizes or speeds the Original cannot deliver
- Any asset that would create false customer expectations about maximum size

---

## Recommended Clean Structure (post-filter)

```
assets/
  crystals/
    blank/          # size-safe blanks only
    renders/        # size-safe product renders
    lifestyle/      # lifestyle shots with in-range crystals
  masks/            # website masks for supported shapes
  brochure/         # filtered pages / claims only
  event/            # future real Jet Mini Original event photos
```

---

## Mapping to Website (Original-only)

| Site Section | Allowed Assets |
|--------------|----------------|
| Hero / Home | Lifestyle + size-safe renders |
| Crystal Selection Guide | Blank crystals + masks within Original limits |
| Product Detail Pages | Renders + lifestyle of producible shapes/sizes |
| On-Site Events | Lifestyle + real future event photos of the Original |
| Configurator / Preview | Masks for supported shapes only |
| Sales materials | Brochure pages that match actual capability |

---

## Action Items

- [ ] Visually audit every blank, render, and lifestyle image against the 6×4" envelope
- [ ] Move oversized items to a `_quarantine` folder (do not use on site)
- [ ] Build the public Crystal Selection Guide exclusively from the keep list
- [ ] Prefer real photos of **our** Jet Mini Original at Tucson events as they become available

*Filter rule: If the Jet Mini Original cannot make it (or a close variant), it does not appear in customer-facing marketing.*
