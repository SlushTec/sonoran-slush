# Photo Optimize + Crystal Preview Architecture

**Goal:** Customer uploads a photo → automatic optimization for subsurface engraving → clear preview of how it will look in the crystal → approve → burn on Jet Mini Original.

---

## Recommended near-term path: **Mask-based (non-rotating) preview**

You already have the crystal shape masks. Use them.

```
Customer photo
    ↓
Upload on site / Shopify
    ↓
Optimize (fal.ai Nano Banana 2 or simpler enhance)
  • brighten subject, fix underexposure
  • boost contrast
  • optional background removal
    ↓
Composite optimized photo into the matching crystal mask
  (Heart, Rectangle Tall/Wide, Dog Bone, Notched, Circle Ornament, Keychain, etc.)
    ↓
Show static “photo inside crystal” preview on the product / order page
    ↓
Customer approves (or requests changes)
    ↓
Staff: FastPass conversion → Jet Mini Original burn → ship / event handoff
```

**Why this is the right first version**
- No FastPass API required
- Uses assets you already own
- Fast, cheap, works on Shopify or a custom site
- Honest: it’s a mockup of the *shape and placement*, not a full subsurface point-cloud simulation
- Still pairs with the real FastPass preview before you burn (operator-side)

Label it clearly for customers:
> *Preview of your photo inside this crystal shape. Final 3D depth and internal lighting are prepared after approval.*

---

## How the mask composite works

1. **Choose shape** — customer picks Heart, Rectangle Tall, Dog Bone, etc.
2. **Load the matching mask** — PNG with transparent crystal silhouette (from `Masks for website` / keep set).
3. **Fit the photo** — scale/crop the optimized image into the mask’s content area (object-fit: cover or a guided crop UI).
4. **Stack**
   - Bottom: optional soft shadow / reflection for desk realism
   - Middle: photo clipped to mask
   - Top: crystal edge / highlight overlay if the mask includes one (or a subtle bevel PNG)
5. **Output** — single PNG/WebP preview the customer sees and you store with the order.

Optional light polish:
- Soft inner glow or slight desaturation to hint at “inside glass”
- Very subtle CSS parallax on mouse move (still non-rotating 3D)
- Side-by-side: original upload vs optimized-in-crystal

---

## Shapes that have (or need) masks

| Shape | Mask status | Notes |
|-------|-------------|--------|
| Heart | Have / keep | High priority |
| Rectangle Tall / Wide | Have / keep | High priority |
| Cut Corner / Prestige | Have / keep | |
| Dog Bone V / H | Have templates | Pet line |
| Keychains (Heart / Rectangle) | Have | Favors / events |
| Circle Ornament | Confirm / add | Holiday + memorial |
| Small Notched | Confirm / add | |
| Candle | Optional | Specialty |

If a mask is missing for a shape you sell, generate or request one before that product goes live with live preview.

---

## Optimize layer (still recommended)

Even with masks only, auto-optimize helps:

- Dark photos → fewer dots → weak crystals. Brighten subjects first.
- fal.ai Nano Banana 2 edit (~$0.08, seconds) or a simpler enhance pipeline.
- Background removal makes the composite cleaner inside the mask.

Example prompt direction:
```
Optimize this portrait for subsurface 3D crystal engraving.
Brighten the subject’s face and eyes, increase contrast,
reduce heavy shadows, keep natural identity, and remove or
soften a busy background.
```

---

## Where FastPass still fits

| Stage | Tool |
|-------|------|
| Customer-facing preview on site | **Mask composite** (this section) |
| Production 2D→3D point cloud | **FastPass / Cockpit3D** |
| Final “this is what we will burn” check | FastPass rotatable preview (operator) or screenshot sent to customer |
| Laser file | FastPass / Cockpit3D export → Jet Mini Original |

Mask preview sells the shape and placement. FastPass still owns accuracy before the laser runs.

---

## Implementation sketch (Shopify or custom)

**Frontend**
- Shape selector → loads corresponding mask URL
- Photo upload → shows crop/position UI inside mask bounds
- “Generate preview” → calls backend (or client-side canvas if simple)

**Backend / worker**
- Optional: fal optimize
- Composite: photo + mask (+ optional edge overlay)
- Store preview URL on the order
- Return preview to the browser

**Tech options**
- Client-side: Canvas 2D or CSS `mask-image` for a quick v1
- Server-side: Sharp / ImageMagick / Pillow for consistent production composites
- Later: fal for optimize, then same composite step

---

## Phased plan (updated)

### Phase 1 — Mask previews (do this first)
- Wire product pages to shape-specific masks
- Upload + composite + show static crystal mockup
- Store original + preview on the order
- Staff still uses FastPass before burning

### Phase 2 — Auto-optimize
- Add fal.ai (or equivalent) before composite
- Show optimized-in-crystal as the default preview

### Phase 3 — Faster production loop
- If Cockpit3D grants API/webhook: auto-submit optimized image after approval
- Until then: staff drops optimized file into FastPass as today

### Phase 4 — Optional motion
- Light parallax or slow auto-tilt on the mask composite
- Or full Three.js rotation later — still secondary to mask + FastPass accuracy

---

## Customer-facing copy

> **See your photo in the crystal.**  
> Upload a picture, choose a shape, and we’ll show you a preview of how it sits inside the crystal. We optimize every image for engraving and only burn after you approve.

---

## Next actions

1. Inventory masks for every keep-list shape; fill any gaps (Circle Ornament, Small Notched).
2. Build a simple composite prototype (one shape — e.g. Heart or Rectangle Tall).
3. Attach preview generation to the crystal product upload flow post-reset.
4. Keep FastPass as the production truth before the Jet Mini runs.

*Mask-based non-rotating preview is the fastest honest path using what you already have.*

*Last updated: 2026-08-11*
