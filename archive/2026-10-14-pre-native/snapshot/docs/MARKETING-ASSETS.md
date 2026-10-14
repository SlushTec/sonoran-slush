# Sonoran Slush — Marketing Assets Inventory (Filtered to Jet Mini Original)

**Hard limit:** Jet Mini Original can produce shapes/sizes up to **6" × 4" (15 × 10 cm)**  
(Confirmed by Year of the JetMini 2025 PDF p.7 and official size charts)

Only assets that match the producible list are kept for customer-facing use.

---

## Keep List (from size charts)

**Fully supported shapes**
- 3D Dog Bone (6×4 vertical & horizontal)
- Candle (4×2.4×2.4)
- Cut Corner Diamond (S / M / L)
- Heart (S / M / L)
- Prestige Iceberg **Small only**
- Rectangle Tall & Wide up to **Mini Mantel (6×4)**
- All keychains (Heart, Rectangle)
- 2D Heart & Rectangle Necklaces

**Quarantine**
- Prestige Medium & Large
- Rectangle Large Mantel / Mini Presidential / Large Presidential
- Any oversized or unconfirmed specialty shapes

---

## Asset Pack Status

| Pack | Status |
|------|--------|
| Blank Crystal Images – Sizes | Keep only shapes/sizes in the list above |
| Lifestyle shots | Keep only shots showing crystals ≤ 6×4 |
| Renders | Keep matching shapes/sizes |
| Masks for website | Keep masks for supported shapes |
| Brochure | Use only claims that match 6×4 capacity |

---

## Recommended Structure

```
assets/
  crystals/blank/     # size-safe only
  crystals/renders/   # size-safe only
  lifestyle/          # in-range only
  masks/              # supported shapes
  brochure/           # filtered claims
  event/              # real Jet Mini Original photos (future)
  _quarantine/        # oversized items (never on site)
```

*Filter enforced 2026-08-11. See also `docs/CRYSTAL-SIZE-KEEP-LIST.md`.*
