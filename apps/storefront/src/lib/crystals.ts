import reference from "../../../../packages/contracts/crystal-shapes.json";
export const crystalShapes = reference.shapes;
export function crystalForSlug(slug: string) {
  return crystalShapes.find((s) => s.slug === slug);
}
export function migrateCrystalDesign<
  T extends { slug: string; options: Record<string, string> },
>(design: T): T {
  if (design.slug !== "photo-crystal-collection") return design;
  const shape = crystalShapes.find(
    (s) => s.shape === design.options["Crystal shape"],
  );
  return shape ? { ...design, slug: shape.slug } : design;
}
