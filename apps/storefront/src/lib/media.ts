import reference from "./product-media.json";
export type ProductMedia = {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  variants?: Record<
    string,
    { src: string; alt: string; width: number; height: number }
  >;
};
export function mediaFor(slug: string): ProductMedia | undefined {
  return (reference as Record<string, ProductMedia>)[slug];
}
