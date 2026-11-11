import ClothingRailHero from "@/components/ui/product-rail-gallery";
import type { RailGarment } from "@/components/ui/product-rail-gallery";

type CatalogItem = {
  handle: string;
  title: string;
  type: string;
  color: string;
  price: number;
  front?: string;
  back?: string;
  images?: string[];
  print?: string;
  material?: string;
  fabric?: string;
  origin?: string;
  line?: string;
};

function sized(url: string, width = 900) {
  if (!url) return url;
  return url.includes("?") ? `${url}&width=${width}` : `${url}?width=${width}`;
}

function clothColor(color: string) {
  if (/beige/i.test(color)) return "#D2B089";
  if (/brown/i.test(color)) return "#6B4A32";
  return "#1A1A1A";
}

const SARYAN_BEIGE_RAIL = {
  image: "./img/rail/saryan-hang-print.png?v=5",
  backImage: "./img/rail/saryan-hang-front.png?v=5",
  sideImage: "./img/rail/saryan-hang-side.png?v=5",
};

function itemsFromCatalog(): RailGarment[] {
  const catalog = (window as unknown as { HAYUGEN_CATALOG?: CatalogItem[] }).HAYUGEN_CATALOG ?? [];
  const seen = new Set<string>();
  return catalog
    .filter((item) => {
      if (item.type !== "T-Shirt") return false;
      const key = `${item.title}:${item.color}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => {
      const beige = /saryan/i.test(item.title) && /beige/i.test(item.color);
      return {
        id: item.handle,
        name: item.title,
        kind: "tee" as const,
        color: clothColor(item.color),
        description: item.print || item.material,
        details: [item.fabric, item.color, item.line, item.origin].filter((value): value is string => Boolean(value)),
        ...(beige ? SARYAN_BEIGE_RAIL : { printImage: sized(item.back || item.images?.[0] || "") }),
      };
    });
}

export default function SelectedPiecesRail() {
  const items = itemsFromCatalog();
  if (!items.length) return null;
  return (
    <ClothingRailHero
      items={items}
      hanger="matte"
      caption="Hover a hanger to turn the print toward you."
      labels={{ front: "Print", back: "Front", close: "Close", show: "Show" }}
      action={
        <a
          href="./shop.html"
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-sm outline-none transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
        >
          The full salon
        </a>
      }
    />
  );
}
