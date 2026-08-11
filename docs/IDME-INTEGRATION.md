# ID.me Integration — Community Discount Verification

**Last updated:** 2026-08-11  
**Purpose:** Auto-verify **Veterans / Military**, **First Responders**, and **Teachers** for the shop-wide **10%** discount.  
**Platform:** Shopify (Sonoran Slush store)

Official docs: https://docs.id.me/integrations/supported-applications/shopify  
App: https://apps.shopify.com/id-me-group-verification

---

## What ID.me does

1. Customer clicks **Verify with ID.me** (cart / checkout / landing page)
2. Signs into ID.me wallet (or creates one)
3. Proves community status (docs / database checks)
4. Returns to your store; **10% discount applies automatically** (if configured)

No manual codes required once live. Verified status is portable for many customers who already use ID.me elsewhere.

---

## Cost (approx.)

| Plan | Cost |
|------|------|
| **Basic** | **$50/month** |
| Included | **40 verifications / month** |
| Overage | **~$1.25 per verification** after 40 |

At low volume (events + local online), 40/mo is often enough. Watch overage in the first months.

*Confirm current pricing in the Shopify App Store at install time.*

---

## Install checklist (you do this in Shopify admin)

### 1. Install the app
1. Open https://apps.shopify.com/id-me-group-verification  
2. **Install** → approve access  
3. Confirm store domain and admin account

### 2. Create three community discounts (or one per segment)
For **each** of: **Military/Veteran**, **First Responder**, **Teacher**:

| Field | Setting |
|-------|---------|
| Segment | Military / Veteran · First Responder · Teacher |
| Discount type | **Amount off order** |
| Value | **Percentage — 10%** |
| Minimum purchase | None (or match free-ship strategy if desired) |
| Combinations | Prefer **do not stack** with other % order discounts |
| Apply | **Automatically** after verification |

Save each discount and set **Status → Active**.

### 3. Place the ID.me button
1. **Apps → ID.me Community Verification → Overview**  
2. **Add button** → **Checkout** (recommended)  
3. Optional: also add to cart drawer / a dedicated “Military & Service Discount” page  
4. Offer copy example:

> **10% off for verified veterans, first responders, and teachers.**  
> Verify with ID.me — discount applies at checkout.

5. Save checkout customization

### 4. Landing page (optional but recommended)
1. In the ID.me app: **Create landing page**  
2. Page appears under **Online Store → Pages**  
3. Link from footer / header: “Service Discount” or “Veterans & First Responders”

### 5. Site copy
- Footer + discount policy page  
- Product pages can reference: *Verified service members save 10%*

---

## Mapping to our policy

| Our policy group | ID.me segment(s) |
|------------------|------------------|
| Veterans | Military / Veteran |
| First responders | First Responder |
| Teachers | Teacher |

All three get **10% off** order subtotal (shop-wide).

---

## Stacking & free shipping

| Rule | Recommendation |
|------|----------------|
| Other % discounts | **Do not stack** with ID.me 10% |
| Free shipping $75 | Configure threshold on **post-discount** total (Shopify setting) or keep pre-discount if you prefer stricter free-ship |
| Event / in-person | Keep **manual ID check** + same 10%; ID.me is for online |

---

## QA before go-live

- [ ] Install app on production (or staging theme)
- [ ] Create 10% discounts for Military/Veteran, First Responder, Teacher
- [ ] Automatic apply = ON
- [ ] ID.me button visible at checkout
- [ ] Test verification with a real eligible account if available
- [ ] Confirm discount line appears on order
- [ ] Confirm tax calculated on discounted amount
- [ ] Policy page + footer link live
- [ ] Note $50/mo + overage in operating costs

---

## Fallback (until ID.me is live)

Manual verification still valid:
1. Customer emails proof or shows ID at event  
2. Issue single-use / limited Shopify discount code **SERVICE10**  
3. Code = 10% off order, one-time or customer-tagged

---

## Alternative (if ID.me cost is too high early)

**Hero ID** (Shopify App Store) — ~$9.99/mo + % of redeemed orders; also targets military / responders / teachers. Evaluate only if ID.me Basic is overkill for volume.

**SheerID** — common enterprise alternative; often heavier sales process.

**Recommendation:** Start with **ID.me Community Verification** — standard for this discount type and matches our three communities.

---

## Owner actions (cannot be done by repo alone)

1. Log into Shopify admin for Sonoran Slush  
2. Install ID.me app  
3. Configure the three 10% community discounts  
4. Add button to checkout  
5. Publish policy page link  

After install, paste any app settings screenshots or errors here for fine-tuning.
