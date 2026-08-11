# Photo Optimize + Live Crystal Preview Architecture

**Goal:** Customer uploads a photo → automatic optimization for subsurface engraving → rotatable preview of how it will look in the crystal → approve → burn on Jet Mini Original.

**Stack split**
- **Public-facing optimize:** fal.ai (Nano Banana 2 or similar)
- **Production 2D→3D + accurate preview:** Cockpit3D FastPass (you already have this)
- **Optional later:** Lightweight Three.js “approximate” crystal rotation on the product page using our masks

---

## 1. Realistic Flow (recommended)

```
Customer photo
    ↓
[Your site / Shopify] upload
    ↓
fal.ai Nano Banana 2 (edit)
  • brighten subject / fix underexposure
  • boost contrast
  • optional background removal
  • crystal-oriented prompt
    ↓
Optimized 2D image stored + shown to customer
    ↓
Operator (or future automation) submits optimized image to FastPass
    ↓
Cockpit3D FastPass
  • 2D → 3D point-cloud conversion (credits)
  • rotatable crystal-style preview
    ↓
Preview link / screenshot / PDF sent to customer for approval
    ↓
Customer approves
    ↓
Burn on Jet Mini Original → ship or hand off at event
```

This matches what you already promise: free digitize/enhance/optimize + preview before engraving.

---

## 2. fal.ai role (auto-optimize)

**What it is good for**
- Fixing dark / underexposed photos (critical: dark → fewer dots → weak crystal)
- Increasing contrast so faces and subjects read clearly
- Background removal or simplification
- Fast, cheap, API-native (~$0.08/image, seconds)

**What it is not**
- It does not produce a subsurface point cloud
- It does not produce a true rotatable “inside the crystal” preview

**Example edit prompt direction**
```
Optimize this portrait for subsurface 3D crystal engraving.
Brighten the subject’s face and eyes, increase overall contrast,
reduce heavy shadows, keep natural skin texture, and remove or
soften a busy background so the subject is clearly separated.
Do not stylize or change identity.
```

Store the optimized image; optionally show a before/after on the order page.

---

## 3. Cockpit3D FastPass role (real preview + production)

FastPass is the conversion engine that belongs with the Jet Mini.

**What it does**
- Accepts the (optimized) photo
- Runs AI 2D→3D conversion into a point cloud suited for green-beam subsurface lasers
- Produces a rotatable preview that closely matches the final crystal
- Exports the production file for the Jet Mini Original

**Credits**
- FastPass uses conversion credits (per image / complexity)
- Keep a credit balance for production volume

---

## 4. FastPass “API key” — current reality

**Important:** Cockpit3D FastPass does **not** appear to expose a public, self-serve developer API with a simple API key for third-party sites (unlike fal.ai).

What exists today is primarily:
- Web UI (FastPass upload + preview)
- Desktop Cockpit3D app for positioning, density, export
- Credit-based conversion
- Operator / reseller workflow

### How to get access / clarify API options

1. **Log into your existing FastPass / Cockpit3D account**  
   Look under Account, Settings, Integrations, Developer, or API for any token or webhook options.

2. **Contact 3D Crystal / Cockpit3D support as a Jet Mini Original owner**  
   Ask specifically:
   - Is there a **reseller or production API** for FastPass (upload image → get preview URL + scene file)?
   - Is there a **webhook** when a conversion finishes?
   - Can preview links be generated and shared with end customers automatically?
   - Any documentation for automating FastPass from an external store (Shopify, custom site)?

3. **Until an API exists, use the hybrid manual/semi-auto path**  
   - Site collects photo + order  
   - fal optimizes automatically  
   - You (or staff) drop the optimized file into FastPass  
   - You send the FastPass preview to the customer  
   - On approval, you burn  

This is still far better than raw uploads and matches how many crystal shops operate.

---

## 5. Concrete implementation phases

### Phase A — Design / post-reset (do first)
- Product pages use the scaffolding + photo conversion guide
- Upload field on crystal products
- Order stores original photo + notes
- Staff workflow: optimize (fal or manual) → FastPass → send preview → burn

### Phase B — fal on the storefront
- Shopify app or small backend service:
  1. Customer uploads photo
  2. Backend calls fal.ai `nano-banana-2/edit` (or photo-restoration + edit)
  3. Returns optimized image URL to the order and to the customer
- Still use FastPass offline for the real 3D preview

### Phase C — Closer automation (if support grants API/webhook)
- On order paid → optimized image auto-submitted to FastPass
- On conversion complete → preview URL emailed / shown in customer account
- Approval button → marks order ready to burn

### Phase D — Optional marketing preview on-site
- Three.js (or similar) viewer that places the optimized photo into your crystal shape masks with light parallax/rotation
- Label clearly: “Approximate preview — final 3D crystal preview follows after we process your photo”

---

## 6. Environment / keys you will need

| Service | Key / access | Where |
|---------|--------------|--------|
| **fal.ai** | API key from fal dashboard | https://fal.ai → account / API keys |
| **FastPass / Cockpit3D** | Login credentials + conversion credits | Your existing account; ask support for any API/reseller token |
| **Shopify** (later) | Admin API / app credentials | When building the upload + order bridge |

Never commit keys to the public repo. Use env vars / Shopify secrets / a small private backend.

---

## 7. Customer-facing copy (short)

> Upload your photo. We automatically optimize it for 3D crystal engraving, then prepare a true preview of how it will look inside the crystal. You approve before we engrave. Most remote orders ship within 24 hours after approval.

---

## 8. Next actions

1. Log into FastPass/Cockpit3D and note any Settings → API / Integrations / Developer options.
2. Email or chat 3D Crystal support: “Jet Mini Original owner — do you offer a FastPass API or webhook for automated customer previews from our store?”
3. Create a fal.ai account and generate an API key for later Phase B.
4. Keep production path as: optimize → FastPass preview → approve → Jet Mini Original burn.

*This keeps marketing honest, production accurate, and the door open for full automation if/when FastPass exposes an API.*

*Last updated: 2026-08-11*
