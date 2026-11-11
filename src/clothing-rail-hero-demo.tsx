"use client";

import ClothingRailHero from "@/components/ui/product-rail-gallery";
import type { RailGarment } from "@/components/ui/product-rail-gallery";

export const RAIL_DEMO_ITEMS: RailGarment[] = [
  {
    id: "bone-tee",
    name: "Heavyweight tee · Bone",
    kind: "tee",
    color: "#EFEBE2",
    tag: "$48",
    description: "240 gsm organic cotton with a tonal DHxWHY embroidery on the chest.",
    details: ["240 gsm", "Regular fit", "Tonal embroidery"],
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
    backImage: "https://images.unsplash.com/photo-1618354691373-d851c5c3a99b?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "cc-graphic",
    name: "Graphic tee · CCgather",
    kind: "tee",
    color: "#101214",
    tag: "$52",
    description: "Black tee with the CCgather wordmark printed front and back.",
    details: ["240 gsm", "Regular fit", "Screen print"],
    image: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=800&q=80",
    backImage: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "oxford-sky",
    name: "Oxford shirt · Sky",
    kind: "shirt",
    color: "#A3D3EB",
    tag: "$74",
    description: "Pale sky oxford with a button-down collar and a tiny Maestiq embroidery.",
    details: ["Oxford cotton", "Button-down collar", "Chest pocket"],
    image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80",
    backImage: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "cardigan-olive",
    name: "Knit cardigan · Olive",
    kind: "knit",
    color: "#758151",
    tag: "$96",
    description: "Chunky olive wool cardigan with wooden buttons and ribbed trims.",
    details: ["Lambswool", "Wooden buttons", "V-neck"],
    image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80",
    backImage: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "hoodie-heather",
    name: "Hoodie · Maestiq",
    kind: "hoodie",
    color: "#A0A5AB",
    tag: "$88",
    description: "Heather fleece hoodie with the Maestiq wordmark across the chest.",
    details: ["400 gsm fleece", "Kangaroo pocket", "Chest print"],
    image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80",
    backImage: "https://images.unsplash.com/photo-1509942774463-acf339cf87d5?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "sweat-lilac",
    name: "Crewneck sweatshirt · Lilac",
    kind: "knit",
    color: "#CCB2E0",
    tag: "$78",
    description: "Muted lilac fleece crewneck with a raised DHxWHY puff print.",
    details: ["400 gsm fleece", "Ribbed trims", "Puff print"],
    image: "https://images.unsplash.com/photo-1578587018452-892b713fd585?auto=format&fit=crop&w=800&q=80",
    backImage: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "polo-forest",
    name: "Piqué polo · Forest",
    kind: "tee",
    color: "#185B37",
    tag: "$62",
    description: "Forest piqué polo with a bone CCgather embroidery on the chest.",
    details: ["Piqué knit", "Two-button placket", "Embroidered"],
    image: "https://images.unsplash.com/photo-1618354691438-25bc045586c9?auto=format&fit=crop&w=800&q=80",
    backImage: "https://images.unsplash.com/photo-1598033125813-2c1d79e2d7e0?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "henley-brick",
    name: "Henley · Brick",
    kind: "knit",
    color: "#B05139",
    tag: "$56",
    description: "Dusty brick henley with a three-button placket, worn in from day one.",
    details: ["Slub cotton", "Three buttons", "Long sleeve"],
    image: "https://images.unsplash.com/photo-1489987707025-afc232f7ea71?auto=format&fit=crop&w=800&q=80",
    backImage: "https://images.unsplash.com/photo-15233812949112-8dd3f1e79d32?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "breton",
    name: "Breton long sleeve",
    kind: "knit",
    color: "#E4DFD3",
    tag: "$58",
    description: "Classic ink-and-bone Breton stripe with a boat neck.",
    details: ["220 gsm", "Boat neck", "Long sleeve"],
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
    backImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "oversized-ochre",
    name: "Oversized tee · CCgather",
    kind: "tee",
    color: "#DE9C31",
    tag: "$52",
    description: "Boxy ochre tee with a small chest mark and a large CCgather back print.",
    details: ["Oversized", "Dropped shoulder", "Back print"],
    image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80",
    backImage: "https://images.unsplash.com/photo-1503342394128-c104d54dba01?auto=format&fit=crop&w=800&q=80",
  },
];

export default function ClothingRailHeroDemo({ autoplay = true }: { autoplay?: boolean }) {
  return (
    <div data-rail-demo className="flex min-h-svh w-full items-center justify-center bg-background text-foreground">
      <ClothingRailHero
        items={RAIL_DEMO_ITEMS}
        hanger="none"
        eyebrow="New season · Ten pieces on the rail"
        heading="A clothing rail you can handle, right on the page."
        caption="Brush along the rail, slide a hanger, lift a piece to see the back."
        autoplay={autoplay}
        action={
          <button type="button" className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-sm outline-none transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none">
            Shop the edit
          </button>
        }
      />
    </div>
  );
}
