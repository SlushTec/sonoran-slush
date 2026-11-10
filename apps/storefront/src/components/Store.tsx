"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { readLocal, writeLocal, newId } from "@/lib/client";
import { catalog } from "@/lib/catalog";
import { migrateCrystalDesign } from "@/lib/crystals";
export type Design = {
  id: string;
  slug: string;
  text: string;
  secondary: string;
  font: string;
  options: Record<string, string>;
  quantity: number;
  notes: string;
  artworkName: string;
  gift: boolean;
  giftMessage: string;
  updated: string;
};
type StoreState = {
  designs: Design[];
  cart: Design[];
  favorites: string[];
  hydrated: boolean;
  storageAvailable: boolean;
  notice: string;
  saveDesign: (d: Design) => void;
  addToCart: (d: Design) => void;
  removeCart: (id: string) => void;
  setQuantity: (id: string, n: number) => void;
  toggleFavorite: (slug: string) => void;
  removeDesign: (id: string) => void;
  clear: () => void;
  notify: (message: string) => void;
};
const Context = createContext<StoreState | null>(null);
export function parseDesign(value: unknown): Design | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const d =
    typeof raw.slug === "string" &&
    raw.options &&
    typeof raw.options === "object" &&
    !Array.isArray(raw.options)
      ? migrateCrystalDesign(
          raw as Record<string, unknown> & {
            slug: string;
            options: Record<string, string>;
          },
        )
      : raw;
  if (
    typeof d.id !== "string" ||
    !d.id ||
    typeof d.slug !== "string" ||
    !catalog.products.some((p) => p.slug === d.slug) ||
    typeof d.text !== "string" ||
    d.text.length > 120 ||
    !Number.isInteger(d.quantity) ||
    Number(d.quantity) < 1 ||
    Number(d.quantity) > 500 ||
    !d.options ||
    typeof d.options !== "object" ||
    Array.isArray(d.options)
  )
    return null;
  const options = Object.entries(d.options);
  if (
    options.length > 16 ||
    options.some(
      ([k, v]) => k.length > 60 || typeof v !== "string" || v.length > 200,
    )
  )
    return null;
  const text = (key: string, max: number) =>
    typeof d[key] === "string" ? (d[key] as string).slice(0, max) : "";
  return {
    id: d.id,
    slug: d.slug,
    text: d.text,
    quantity: Number(d.quantity),
    options: Object.fromEntries(options) as Record<string, string>,
    secondary: text("secondary", 120),
    font: ["Classic serif", "Modern sans", "Handwritten"].includes(
      String(d.font),
    )
      ? String(d.font)
      : "Classic serif",
    notes: text("notes", 1500),
    artworkName: text("artworkName", 255),
    gift: d.gift === true,
    giftMessage: text("giftMessage", 300),
    updated: text("updated", 50),
  };
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [designs, setDesigns] = useState<Design[]>([]),
    [cart, setCart] = useState<Design[]>([]),
    [favorites, setFavorites] = useState<string[]>([]),
    [hydrated, setHydrated] = useState(false),
    [storageAvailable, setStorageAvailable] = useState(true),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const valid = (v: unknown): Design[] =>
      Array.isArray(v)
        ? v
            .map(parseDesign)
            .filter((d): d is Design => d !== null)
            .slice(0, 100)
        : [];
    // Preserve the previous collection's autosaved draft at its new shape route.
    // An existing draft at the new route takes precedence.
    const oldCrystal = parseDesign(
      readLocal("config:photo-crystal-collection", null),
    );
    if (
      oldCrystal &&
      oldCrystal.slug !== "photo-crystal-collection" &&
      !readLocal("config:" + oldCrystal.slug, null)
    ) {
      writeLocal("config:" + oldCrystal.slug, oldCrystal);
    }
    setDesigns(valid(readLocal("designs", [])));
    setCart(valid(readLocal("cart", [])));
    const f = readLocal<unknown>("favorites", []);
    setFavorites(
      Array.isArray(f)
        ? f.filter(
            (x) =>
              typeof x === "string" &&
              catalog.products.some((p) => p.slug === x),
          )
        : [],
    );
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) {
      const ok = [
        writeLocal("designs", designs),
        writeLocal("cart", cart),
        writeLocal("favorites", favorites),
      ].every(Boolean);
      setStorageAvailable(ok);
    }
  }, [designs, cart, favorites, hydrated]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4200);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const notify = useCallback((message: string) => setNotice(message), []);
  const saveDesign = (d: Design) => {
    setDesigns((a) => [d, ...a.filter((x) => x.id !== d.id)].slice(0, 100));
    notify("Design saved on this device.");
  };
  const addToCart = (d: Design) => {
    setCart((a) =>
      a.some((x) => x.id === d.id)
        ? a.map((x) => (x.id === d.id ? d : x))
        : [...a, d].slice(0, 100),
    );
    setDesigns((a) => [d, ...a.filter((x) => x.id !== d.id)].slice(0, 100));
    notify("Design added to your bag.");
  };
  const toggleFavorite = (slug: string) =>
    setFavorites((a) =>
      a.includes(slug) ? a.filter((s) => s !== slug) : [...a, slug],
    );
  const clear = () => {
    setDesigns([]);
    setCart([]);
    setFavorites([]);
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sonoran:"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
    notify("Saved designs and browsing data cleared from this device.");
  };
  return (
    <Context.Provider
      value={{
        designs,
        cart,
        favorites,
        hydrated,
        storageAvailable,
        notice,
        saveDesign,
        addToCart,
        removeCart: (id) => setCart((a) => a.filter((d) => d.id !== id)),
        setQuantity: (id, n) =>
          setCart((a) =>
            a.map((d) =>
              d.id === id
                ? { ...d, quantity: Math.max(1, Math.min(500, n)) }
                : d,
            ),
          ),
        toggleFavorite,
        removeDesign: (id) => {
          const removed = designs.find((d) => d.id === id);
          if (
            removed &&
            readLocal<Design | null>("config:" + removed.slug, null)?.id === id
          ) {
            try {
              localStorage.removeItem("sonoran:config:" + removed.slug);
            } catch {
              /* optional storage */
            }
          }
          setDesigns((a) => a.filter((d) => d.id !== id));
        },
        clear,
        notify,
      }}
    >
      {children}
      <div
        className={"toast" + (notice ? " visible" : "")}
        role="status"
        aria-live="polite"
      >
        {notice}
      </div>
    </Context.Provider>
  );
}
export function useStore() {
  const s = useContext(Context);
  if (!s) throw new Error("StoreProvider required");
  return s;
}
export function emptyDesign(slug: string): Design {
  return {
    id: newId(),
    slug,
    text: "",
    secondary: "",
    font: "Classic serif",
    options: {},
    quantity: 1,
    notes: "",
    artworkName: "",
    gift: false,
    giftMessage: "",
    updated: new Date().toISOString(),
  };
}
