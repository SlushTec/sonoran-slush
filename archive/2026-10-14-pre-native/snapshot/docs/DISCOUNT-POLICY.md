# Discount Policy — Sonoran Slush Creative Creations

**Last updated:** 2026-08-11

Three standing discount programs:

1. **SERVICE10** — veterans / first responders / teachers  
2. **Event rates** — ~15% off all crystals at booked events  
3. **Wedding guest codes** — 15% online for out-of-town guests  

**Related:** [EVENTS.md](./EVENTS.md) · [PRICING-3D-CRYSTAL.md](./PRICING-3D-CRYSTAL.md)

---

## 1. Service discount — 10% off

**Who:** Verified veterans · first responders · teachers / educators  
**Amount:** **10% off** product subtotal  
**Scope:** Shop-wide (crystal, surface, boards, tumblers, smalls, bases, listed add-ons)

### How (current)
1. Customer requests discount  
2. You verify ID / credentials  
3. Issue code **`SERVICE10`** (or single-use)  
4. Applied at checkout  

| Setting | Value |
|---------|--------|
| Code | `SERVICE10` |
| Type | 10% off order |
| Stacking | **No** stack with other % order discounts |
| Min purchase | None |
| Events | Same 10% with ID check (POS or code) |

**ID.me:** Deferred — see [IDME-INTEGRATION.md](./IDME-INTEGRATION.md).

**Site copy:**  
> 10% off for verified veterans, first responders, and teachers. Contact us for a code — or show ID at events.

---

## 2. Event crystal rates — ~15% off retail

**When:** Any booked on-site event (wedding, corporate, party, etc.)  
**What:** **All crystals and crystal keychains / bases** sold as extras beyond a package  
**Amount:** **~15% off** locked online retail, rounded to whole dollars  

Package **included** pieces stay inside the package price — not re-priced at this table.

### Full event price list

#### Rectangles
| Size | Online | **Event** |
|------|--------|-----------|
| Small 60×40 | $73 | **$62** |
| Medium 80×50 | $94 | **$80** |
| Large 90×60 | $115 | **$98** |
| XLarge 120×80 | $167 | **$142** |
| Mini Mantel 150×100 | $251 | **$213** |

#### Hearts
| Size | Online | **Event** |
|------|--------|-----------|
| Small 80×70 | $94 | **$80** |
| Medium 100×90 | $125 | **$106** |
| Large 120×110 | $157 | **$133** |

#### Diamonds / special
| Shape | Online | **Event** |
|-------|--------|-----------|
| Diamond Small 50×50 | $73 | **$62** |
| Diamond Medium 60×60 | $83 | **$71** |
| Diamond Large 80×80 | $115 | **$98** |
| Prestige Iceberg | $199 | **$169** |
| Candle 100×60 | $104 | **$88** |
| Notched Small | $199 | **$169** |
| Dog Bone Large | $209 | **$178** |

#### Keychains / necklace / ornament
| Shape | Online | **Event** |
|-------|--------|-----------|
| Rectangle keychain | $48 | **$41** |
| Heart keychain | $52 | **$44** |
| Rectangle / Heart necklace | $45 | **$38** |
| Circle ornament | $41 | **$35** |

#### Bases
| Base | Online | **Event** |
|------|--------|-----------|
| Square / Rect LED | $26 | **$22** |
| Rotating LED | $30 | **$26** |
| Medium wooden | $48 | **$41** |
| Large wooden | $58 | **$49** |

#### Add-ons at events
| Add-on | Online | **Event** |
|--------|--------|-----------|
| Background optimize | $32 | **$27** |
| Text (up to 2 lines) | $11 | **$9** |

### Event rate rules
| Rule | Detail |
|------|--------|
| Who pays event price | Host extras + any guest purchases at the station |
| SERVICE10 at events | May apply on extras with ID — **does not stack** on top of the 15% event menu (use one or the other) |
| Color fill | Not same-hour; quote if pre/post event |

---

## 3. Wedding guest online code — 15% off

For guests who could not buy on-site (out of town, left early, etc.).

| Setting | Value |
|---------|--------|
| **Discount** | **15% off** eligible online order |
| **Code** | Unique per wedding (e.g. `JAMIEALEX15`, `MILLERWED`) |
| **Created by** | You, when the wedding is booked |
| **Shared by** | Couple → guests (program, text, QR, thank-you) |
| **Valid** | Event date through **event + 30 days** (extend on request) |
| **Stacking** | **No** stack with SERVICE10 or other % codes |
| **Scope** | Online catalog (crystals, engraving, bases, add-ons). Exclude gift cards / event package invoices if desired |
| **Usage** | Unlimited guests preferred; or cap if abuse appears |

### Shopify setup (per wedding)
1. Discounts → Create discount code  
2. **15%** off order (or collections: crystal + drinkware as you prefer)  
3. Code name = couple-specific  
4. End date = event + 30 days  
5. Optional: one use per customer  

### Couple handoff copy
> Couldn’t get a crystal at the wedding? Use code **[CODE]** for **15% off** at [site] — valid for 30 days.

---

## Stacking summary

| Discount A | Discount B | Stack? |
|------------|------------|--------|
| SERVICE10 | Wedding guest 15% | **No** |
| SERVICE10 | Event menu 15% | **No** — pick one |
| Wedding guest 15% | Event menu | N/A (different channels) |
| Any % code | Free shipping $75 | **Yes** (shipping rule separate) |

---

## Notes

- Corporate / bulk / QR+ reseller pricing stays separate from these three programs.  
- Event menu tracks online retail; when retail changes, refresh event column (~15% off, round).  
