// Unified artwork registry — combines mandalas + figurative drawings.
import { mandalas, type Mandala } from "./mandalas";
import { drawings, type Drawing } from "./drawings";

export type ArtworkCategory = "all" | "animal" | "nature" | "mandala";

export type Artwork = {
  id: string;
  name: string;
  category: Exclude<ArtworkCategory, "all">;
  emoji?: string;
  viewBox: string;
  paths: { id: string; d: string }[];
};

const mandalaArtworks: Artwork[] = mandalas.map((m: Mandala) => ({
  id: m.id,
  name: m.name,
  category: "mandala" as const,
  emoji: "🌸",
  viewBox: m.viewBox,
  paths: m.paths.map((p) => ({ id: p.id, d: p.d })),
}));

const drawingArtworks: Artwork[] = drawings.map((d: Drawing) => ({
  id: d.id,
  name: d.name,
  category: d.category,
  emoji: d.emoji,
  viewBox: d.viewBox,
  paths: d.paths,
}));

export const artworks: Artwork[] = [...drawingArtworks, ...mandalaArtworks];

export function getArtwork(id: string): Artwork | undefined {
  return artworks.find((a) => a.id === id);
}

export const categories: { id: ArtworkCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "animal", label: "Animals" },
  { id: "nature", label: "Nature" },
  { id: "mandala", label: "Mandalas" },
];
