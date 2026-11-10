import reference from "../../../../packages/contracts/catalog.reference.json";
export const catalog = reference;
export type Product = (typeof reference.products)[number];
export type Category = (typeof reference.categories)[number];
