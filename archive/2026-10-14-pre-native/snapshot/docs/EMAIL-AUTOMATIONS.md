# Email Automations — Sonoran Slush Creative Creations

**Last updated:** 2026-08-11  
**Platform:** Shopify native notifications + Messaging automations  
**Goal:** Cart recovery + clear order journey (thank you → prep → ship → delivery)

---

## Email map

| # | Email | Trigger | Where to configure |
|---|--------|---------|---------------------|
| 1 | **Abandoned cart** | Checkout started, not completed | Apps → Messaging → Automations |
| 2 | **Order confirmation / Thank you** | Order paid | Settings → Notifications → Order confirmation |
| 3 | **We're prepping your order** | Manual tag or fulfillment start | Order confirmation copy *or* tag + process |
| 4 | **Shipping confirmation** | Order fulfilled + tracking added | Settings → Notifications → Shipping confirmation |
| 5 | **Shipping update** | Tracking number/status updated | Settings → Notifications → Shipping update |
| 6 | **Out for delivery** | Carrier event | Settings → Notifications (enable) |
| 7 | **Delivered** | Carrier delivered event | Settings → Notifications (enable) |

Transactional emails (2–7) are **free** and do not use marketing email quota.  
Abandoned cart is free via Shopify Messaging automations.

---

## 1. Abandoned cart

### Setup
1. **Apps → Messaging → Automations** (or Marketing → Automations)
2. **View templates → Abandoned checkout**
3. Turn **on**
4. Edit timing: first send **1–4 hours** after abandon (not 10+ hours)
5. Optional later: 2nd email at ~24h (Flow or Messaging if available)

### Subject / preview
| Field | Copy |
|-------|------|
| Subject | Still thinking it over? Your cart is waiting |
| Preview | Finish your order whenever you're ready — no rush. |

### Body (short)
> Hi {{ customer.first_name | default: "there" }},  
>  
> You left something in your cart at Sonoran Slush.  
> Whenever you're ready, you can pick up where you left off:  
> **[Complete your order]**  
>  
> Questions about engraving, sizing, or photo uploads? Just reply.  
>  
> — Sonoran Slush Creative Creations  
> Tucson, Arizona

**Rules:** No discount in the first email. Keep it light. Marketing consent required for abandoned-cart sends in many setups — use Shopify’s subscriber rules.

---

## 2. Order confirmation / Thank you (receipt)

**Settings → Notifications → Order confirmation → Customize**

### Subject
`Thank you — we got your order {{ name }}`

### Body notes to add above the default summary
> Hi {{ customer.first_name }},  
>  
> Thank you for ordering from **Sonoran Slush**. We’re glad it’s with us.  
>  
> **What happens next**  
> 1. We review your order and any photo/text details  
> 2. We engrave and pack with care  
> 3. You’ll get another email with tracking when it ships  
>  
> Custom engraved pieces usually ship within **[X–Y] business days** after approval (update with your real SLA).  
> Need a change? Reply to this email as soon as you can.  
>  
> — Brian & the Sonoran Slush team  
> Tucson, Arizona

Keep Shopify’s order line items, totals, and “View your order” link.

---

## 3. We're prepping your order

Shopify does **not** send a separate “prepping” email by default.

**Option A (simplest — recommended now)**  
Bake prep language into the **order confirmation** (section above). One clear email is better than noise.

**Option B (when you want a second touch)**  
1. When you start work, add order tag `prepping`  
2. Optionally email the customer manually once:  
   *Subject:* `We're working on your order {{ name }}`  
   *Body:* Short note that engraving has started; tracking comes at ship.

**Option C (later)**  
Klaviyo / Omnisend flow on “Placed Order” + delay, or custom status apps — not required at launch.

---

## 4. Shipping confirmation

**Settings → Notifications → Shipping confirmation**  
Sent when you **fulfill** the order and add tracking.

### Subject
`Your order is on the way {{ name }}`

### Body add-on
> Hi {{ customer.first_name }},  
>  
> Your Sonoran Slush order has shipped.  
> Track it here: **[tracking link from template]**  
>  
> Handle engraved crystal and glass with care when it arrives.  
> Questions? Reply anytime.  
>  
> — Sonoran Slush

Ensure fulfillment always includes **tracking number + carrier** so this fires correctly.

---

## 5. Shipping update

**Settings → Notifications → Shipping update**  
Enable if you update tracking mid-route. Default template is fine; keep branding consistent.

---

## 6–7. Out for delivery & Delivered

**Settings → Notifications**  
Enable:
- **Out for delivery**
- **Delivered**

These fire from **carrier tracking events** (accuracy varies by USPS/UPS/etc.).  
Leave on — customers expect them.

### Delivered subject (optional customize)
`Delivered — hope you love it`

### Soft follow-up line (optional in template)
> If anything doesn’t look right, reply with a photo and we’ll make it right.

---

## Brand voice rules

| Do | Don’t |
|----|--------|
| Short, warm, Tucson-local | Corporate fluff |
| Clear next step | Vague “we’ll be in touch” |
| Reply-friendly (real support path) | No-reply dead ends |
| One CTA per email | Discount spam on transactional mail |

**From name:** Sonoran Slush (or Brian at Sonoran Slush)  
**From email:** use your verified domain (e.g. orders@ / hello@ on sonoranslush domain when DNS is ready)

---

## Admin checklist

- [ ] Messaging → Abandoned checkout **ON** (1–4h delay)
- [ ] Order confirmation customized (thank you + next steps)
- [ ] Shipping confirmation customized + always add tracking on fulfill
- [ ] Shipping update **ON**
- [ ] Out for delivery **ON**
- [ ] Delivered **ON**
- [ ] Sender email / domain authenticated (SPF/DKIM) when custom domain is live
- [ ] Test order end-to-end (place → fulfill with tracking → confirm emails)

---

## SLA line (fill in)

Replace `[X–Y] business days` in order confirmation with your real number, e.g.:
- Surface engraving: 2–4 business days  
- 3D crystal (photo): 3–7 business days after photo approval  

---

## Out of scope for now

- SMS (optional later via Shopify Messaging)
- Multi-step Klaviyo abandoned-cart series
- Review-request email (add 7–14 days post-delivery when ready)

*All of the above is configurable in Shopify admin; this doc is the copy + sequence spec.*
