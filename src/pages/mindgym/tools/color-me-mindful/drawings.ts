// Figurative coloring drawings — peacock, panda, butterfly, lotus, elephant, fox, owl, turtle.
// Each design is a collection of SVG paths with stable region ids (tap-to-fill).

export type DrawingPath = {
  id: string;
  d: string;
};

export type Drawing = {
  id: string;
  name: string;
  category: "animal" | "nature" | "mandala";
  emoji: string;
  viewBox: string;
  paths: DrawingPath[];
};

// ---------- PEACOCK ----------
const peacock: Drawing = {
  id: "peacock",
  name: "Peacock",
  category: "animal",
  emoji: "🦚",
  viewBox: "0 0 400 400",
  paths: [
    // Tail feathers — fanned arcs
    ...Array.from({ length: 9 }, (_, i) => {
      const angle = -90 + (i - 4) * 18; // degrees
      const rad = (angle * Math.PI) / 180;
      const cx = 200, cy = 260;
      const len = 180;
      const tipX = cx + Math.cos(rad) * len;
      const tipY = cy + Math.sin(rad) * len;
      const w = 30;
      const perp = rad + Math.PI / 2;
      const lx = cx + Math.cos(rad) * (len * 0.5) + Math.cos(perp) * w;
      const ly = cy + Math.sin(rad) * (len * 0.5) + Math.sin(perp) * w;
      const rx = cx + Math.cos(rad) * (len * 0.5) - Math.cos(perp) * w;
      const ry = cy + Math.sin(rad) * (len * 0.5) - Math.sin(perp) * w;
      return {
        id: `feather-${i}`,
        d: `M ${cx} ${cy} Q ${lx} ${ly}, ${tipX} ${tipY} Q ${rx} ${ry}, ${cx} ${cy} Z`,
      };
    }),
    // Eye spots on each feather
    ...Array.from({ length: 9 }, (_, i) => {
      const angle = -90 + (i - 4) * 18;
      const rad = (angle * Math.PI) / 180;
      const cx = 200, cy = 260;
      const dist = 150;
      const x = cx + Math.cos(rad) * dist;
      const y = cy + Math.sin(rad) * dist;
      return {
        id: `eye-${i}`,
        d: `M ${x - 10} ${y} a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0 Z`,
      };
    }),
    // Body
    { id: "body", d: "M 200 260 C 175 270, 175 320, 200 340 C 225 320, 225 270, 200 260 Z" },
    // Head
    { id: "head", d: "M 200 245 a 22 22 0 1 0 0.01 0 Z" },
    // Crest plumes
    { id: "crest-1", d: "M 195 224 Q 188 200, 195 188" },
    { id: "crest-2", d: "M 200 222 Q 200 198, 200 184" },
    { id: "crest-3", d: "M 205 224 Q 212 200, 205 188" },
    // Beak
    { id: "beak", d: "M 200 252 L 218 256 L 200 260 Z" },
    // Eye
    { id: "eye", d: "M 192 244 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 Z" },
  ],
};

// ---------- PANDA ----------
const panda: Drawing = {
  id: "panda",
  name: "Panda",
  category: "animal",
  emoji: "🐼",
  viewBox: "0 0 400 400",
  paths: [
    // Body
    { id: "body", d: "M 200 240 C 130 240, 110 340, 200 360 C 290 340, 270 240, 200 240 Z" },
    // Head
    { id: "head", d: "M 200 110 C 120 110, 110 230, 200 240 C 290 230, 280 110, 200 110 Z" },
    // Ears
    { id: "ear-left", d: "M 130 130 a 28 28 0 1 0 56 0 a 28 28 0 1 0 -56 0 Z" },
    { id: "ear-right", d: "M 214 130 a 28 28 0 1 0 56 0 a 28 28 0 1 0 -56 0 Z" },
    // Eye patches
    { id: "patch-left", d: "M 150 170 C 140 160, 165 150, 178 165 C 188 180, 165 200, 152 188 Z" },
    { id: "patch-right", d: "M 250 170 C 260 160, 235 150, 222 165 C 212 180, 235 200, 248 188 Z" },
    // Eyes
    { id: "eye-left", d: "M 162 178 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0 Z" },
    { id: "eye-right", d: "M 228 178 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0 Z" },
    // Nose
    { id: "nose", d: "M 192 200 Q 200 195, 208 200 Q 200 212, 192 200 Z" },
    // Mouth
    { id: "mouth", d: "M 200 212 Q 195 220, 188 218 M 200 212 Q 205 220, 212 218" },
    // Arms / paws
    { id: "arm-left", d: "M 150 270 a 26 26 0 1 0 52 0 a 26 26 0 1 0 -52 0 Z" },
    { id: "arm-right", d: "M 198 270 a 26 26 0 1 0 52 0 a 26 26 0 1 0 -52 0 Z" },
    // Legs
    { id: "leg-left", d: "M 150 330 a 24 24 0 1 0 48 0 a 24 24 0 1 0 -48 0 Z" },
    { id: "leg-right", d: "M 202 330 a 24 24 0 1 0 48 0 a 24 24 0 1 0 -48 0 Z" },
    // Bamboo
    { id: "bamboo-1", d: "M 100 280 L 110 280 L 110 360 L 100 360 Z" },
    { id: "bamboo-2", d: "M 100 320 L 110 320" },
    { id: "leaf", d: "M 110 290 Q 140 270, 160 285 Q 140 300, 110 290 Z" },
  ],
};

// ---------- BUTTERFLY ----------
const butterfly: Drawing = {
  id: "butterfly",
  name: "Butterfly",
  category: "animal",
  emoji: "🦋",
  viewBox: "0 0 400 400",
  paths: [
    // Body
    { id: "body", d: "M 196 130 Q 200 120, 204 130 L 204 290 Q 200 300, 196 290 Z" },
    // Head
    { id: "head", d: "M 200 118 a 10 10 0 1 0 0.01 0 Z" },
    // Antennae
    { id: "antenna-left", d: "M 197 112 Q 180 90, 175 80" },
    { id: "antenna-right", d: "M 203 112 Q 220 90, 225 80" },
    // Upper wings
    { id: "wing-upper-left", d: "M 196 150 C 120 100, 70 160, 90 220 C 110 240, 170 240, 196 200 Z" },
    { id: "wing-upper-right", d: "M 204 150 C 280 100, 330 160, 310 220 C 290 240, 230 240, 204 200 Z" },
    // Lower wings
    { id: "wing-lower-left", d: "M 196 220 C 130 230, 100 290, 140 320 C 170 330, 196 290, 196 250 Z" },
    { id: "wing-lower-right", d: "M 204 220 C 270 230, 300 290, 260 320 C 230 330, 204 290, 204 250 Z" },
    // Wing patterns - upper circles
    { id: "spot-ul-1", d: "M 130 170 a 14 14 0 1 0 28 0 a 14 14 0 1 0 -28 0 Z" },
    { id: "spot-ur-1", d: "M 242 170 a 14 14 0 1 0 28 0 a 14 14 0 1 0 -28 0 Z" },
    // Wing patterns - lower spots
    { id: "spot-ll-1", d: "M 145 270 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0 Z" },
    { id: "spot-lr-1", d: "M 235 270 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0 Z" },
    // Decorative swirls upper
    { id: "swirl-ul", d: "M 100 200 Q 130 210, 170 195" },
    { id: "swirl-ur", d: "M 300 200 Q 270 210, 230 195" },
  ],
};

// ---------- LOTUS ----------
const lotus: Drawing = {
  id: "lotus",
  name: "Lotus",
  category: "nature",
  emoji: "🪷",
  viewBox: "0 0 400 400",
  paths: [
    // Outer petals
    ...Array.from({ length: 7 }, (_, i) => {
      const angle = -90 + (i - 3) * 26;
      const rad = (angle * Math.PI) / 180;
      const cx = 200, cy = 260;
      const len = 150;
      const tipX = cx + Math.cos(rad) * len;
      const tipY = cy + Math.sin(rad) * len;
      const perp = rad + Math.PI / 2;
      const w = 38;
      const lx = cx + Math.cos(rad) * (len * 0.55) + Math.cos(perp) * w;
      const ly = cy + Math.sin(rad) * (len * 0.55) + Math.sin(perp) * w;
      const rx = cx + Math.cos(rad) * (len * 0.55) - Math.cos(perp) * w;
      const ry = cy + Math.sin(rad) * (len * 0.55) - Math.sin(perp) * w;
      return {
        id: `outer-petal-${i}`,
        d: `M ${cx} ${cy} Q ${lx} ${ly}, ${tipX} ${tipY} Q ${rx} ${ry}, ${cx} ${cy} Z`,
      };
    }),
    // Mid petals
    ...Array.from({ length: 5 }, (_, i) => {
      const angle = -90 + (i - 2) * 32;
      const rad = (angle * Math.PI) / 180;
      const cx = 200, cy = 260;
      const len = 110;
      const tipX = cx + Math.cos(rad) * len;
      const tipY = cy + Math.sin(rad) * len;
      const perp = rad + Math.PI / 2;
      const w = 30;
      const lx = cx + Math.cos(rad) * (len * 0.5) + Math.cos(perp) * w;
      const ly = cy + Math.sin(rad) * (len * 0.5) + Math.sin(perp) * w;
      const rx = cx + Math.cos(rad) * (len * 0.5) - Math.cos(perp) * w;
      const ry = cy + Math.sin(rad) * (len * 0.5) - Math.sin(perp) * w;
      return {
        id: `mid-petal-${i}`,
        d: `M ${cx} ${cy} Q ${lx} ${ly}, ${tipX} ${tipY} Q ${rx} ${ry}, ${cx} ${cy} Z`,
      };
    }),
    // Inner petals
    ...Array.from({ length: 3 }, (_, i) => {
      const angle = -90 + (i - 1) * 36;
      const rad = (angle * Math.PI) / 180;
      const cx = 200, cy = 260;
      const len = 70;
      const tipX = cx + Math.cos(rad) * len;
      const tipY = cy + Math.sin(rad) * len;
      const perp = rad + Math.PI / 2;
      const w = 22;
      const lx = cx + Math.cos(rad) * (len * 0.5) + Math.cos(perp) * w;
      const ly = cy + Math.sin(rad) * (len * 0.5) + Math.sin(perp) * w;
      const rx = cx + Math.cos(rad) * (len * 0.5) - Math.cos(perp) * w;
      const ry = cy + Math.sin(rad) * (len * 0.5) - Math.sin(perp) * w;
      return {
        id: `inner-petal-${i}`,
        d: `M ${cx} ${cy} Q ${lx} ${ly}, ${tipX} ${tipY} Q ${rx} ${ry}, ${cx} ${cy} Z`,
      };
    }),
    // Center
    { id: "center", d: "M 188 258 a 12 12 0 1 0 24 0 a 12 12 0 1 0 -24 0 Z" },
    // Water lines
    { id: "water-1", d: "M 60 320 Q 100 310, 140 320 T 220 320 T 340 320" },
    { id: "water-2", d: "M 80 350 Q 120 340, 160 350 T 240 350 T 360 350" },
  ],
};

// ---------- ELEPHANT ----------
const elephant: Drawing = {
  id: "elephant",
  name: "Elephant",
  category: "animal",
  emoji: "🐘",
  viewBox: "0 0 400 400",
  paths: [
    // Body
    { id: "body", d: "M 110 230 C 90 200, 110 160, 160 150 L 280 150 C 330 160, 340 220, 320 260 L 320 310 L 280 310 L 280 280 L 200 280 L 200 310 L 160 310 L 160 260 C 130 260, 110 250, 110 230 Z" },
    // Head
    { id: "head", d: "M 60 220 C 50 180, 80 140, 130 140 C 170 140, 180 180, 170 220 C 160 250, 100 260, 60 220 Z" },
    // Trunk
    { id: "trunk", d: "M 90 220 C 60 250, 50 290, 80 320 C 100 330, 110 310, 100 290 C 95 280, 100 270, 110 270" },
    // Ear
    { id: "ear", d: "M 140 150 C 120 130, 100 145, 105 175 C 110 195, 135 195, 145 180 Z" },
    // Eye
    { id: "eye", d: "M 130 175 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0 Z" },
    // Tusk
    { id: "tusk", d: "M 110 235 Q 120 250, 115 260 L 108 258 Q 105 248, 105 238 Z" },
    // Legs
    { id: "leg-fl", d: "M 160 260 L 160 340 L 195 340 L 195 260 Z" },
    { id: "leg-fr", d: "M 240 260 L 240 340 L 275 340 L 275 260 Z" },
    // Toenails
    { id: "nail-fl-1", d: "M 165 332 L 175 332 L 175 340 L 165 340 Z" },
    { id: "nail-fl-2", d: "M 180 332 L 190 332 L 190 340 L 180 340 Z" },
    { id: "nail-fr-1", d: "M 245 332 L 255 332 L 255 340 L 245 340 Z" },
    { id: "nail-fr-2", d: "M 260 332 L 270 332 L 270 340 L 260 340 Z" },
    // Tail
    { id: "tail", d: "M 320 220 Q 345 230, 348 260 L 344 262 Q 340 240, 318 232 Z" },
    // Decorative blanket
    { id: "blanket", d: "M 180 150 L 290 150 L 285 200 L 185 200 Z" },
    { id: "blanket-trim-1", d: "M 185 200 L 285 200 L 282 210 L 188 210 Z" },
  ],
};

// ---------- FOX ----------
const fox: Drawing = {
  id: "fox",
  name: "Fox",
  category: "animal",
  emoji: "🦊",
  viewBox: "0 0 400 400",
  paths: [
    // Head main
    { id: "head", d: "M 200 150 L 110 220 L 150 280 L 250 280 L 290 220 Z" },
    // Ears
    { id: "ear-left", d: "M 110 220 L 130 110 L 175 180 Z" },
    { id: "ear-right", d: "M 290 220 L 270 110 L 225 180 Z" },
    // Inner ears
    { id: "ear-inner-left", d: "M 130 130 L 145 175 L 165 175 Z" },
    { id: "ear-inner-right", d: "M 270 130 L 255 175 L 235 175 Z" },
    // Face mask (white)
    { id: "mask", d: "M 200 200 L 150 260 L 200 290 L 250 260 Z" },
    // Cheeks
    { id: "cheek-left", d: "M 110 220 L 150 280 L 175 270 L 160 230 Z" },
    { id: "cheek-right", d: "M 290 220 L 250 280 L 225 270 L 240 230 Z" },
    // Eyes
    { id: "eye-left", d: "M 168 230 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0 Z" },
    { id: "eye-right", d: "M 218 230 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0 Z" },
    // Nose
    { id: "nose", d: "M 190 268 Q 200 262, 210 268 Q 200 280, 190 268 Z" },
    // Body
    { id: "body", d: "M 150 280 C 130 320, 170 360, 230 360 C 280 360, 290 320, 250 280 Z" },
    // Tail
    { id: "tail", d: "M 280 320 C 340 310, 360 360, 320 380 C 290 380, 270 360, 280 320 Z" },
    // Tail tip
    { id: "tail-tip", d: "M 320 380 C 340 380, 350 365, 340 355 C 330 360, 320 370, 320 380 Z" },
  ],
};

// ---------- OWL ----------
const owl: Drawing = {
  id: "owl",
  name: "Owl",
  category: "animal",
  emoji: "🦉",
  viewBox: "0 0 400 400",
  paths: [
    // Body
    { id: "body", d: "M 200 100 C 110 100, 100 280, 160 340 C 190 360, 210 360, 240 340 C 300 280, 290 100, 200 100 Z" },
    // Belly
    { id: "belly", d: "M 200 220 C 165 220, 160 320, 200 340 C 240 320, 235 220, 200 220 Z" },
    // Tufts
    { id: "tuft-left", d: "M 140 120 L 160 90 L 175 130 Z" },
    { id: "tuft-right", d: "M 260 120 L 240 90 L 225 130 Z" },
    // Eye discs
    { id: "disc-left", d: "M 140 175 a 38 38 0 1 0 76 0 a 38 38 0 1 0 -76 0 Z" },
    { id: "disc-right", d: "M 184 175 a 38 38 0 1 0 76 0 a 38 38 0 1 0 -76 0 Z" },
    // Eyes
    { id: "eye-left", d: "M 162 175 a 14 14 0 1 0 28 0 a 14 14 0 1 0 -28 0 Z" },
    { id: "eye-right", d: "M 210 175 a 14 14 0 1 0 28 0 a 14 14 0 1 0 -28 0 Z" },
    // Pupils
    { id: "pupil-left", d: "M 170 175 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0 Z" },
    { id: "pupil-right", d: "M 218 175 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0 Z" },
    // Beak
    { id: "beak", d: "M 200 200 L 210 220 L 200 230 L 190 220 Z" },
    // Wing left
    { id: "wing-left", d: "M 130 220 C 110 240, 110 300, 140 330 C 150 320, 155 280, 145 240 Z" },
    { id: "wing-right", d: "M 270 220 C 290 240, 290 300, 260 330 C 250 320, 245 280, 255 240 Z" },
    // Feet
    { id: "foot-left", d: "M 175 340 L 170 360 L 175 360 L 178 345 M 180 345 L 180 360 L 185 360 L 185 345" },
    { id: "foot-right", d: "M 215 345 L 215 360 L 220 360 L 220 345 M 225 345 L 222 360 L 227 360 L 230 345" },
    // Branch
    { id: "branch", d: "M 80 360 L 320 360 L 320 372 L 80 372 Z" },
  ],
};

// ---------- TURTLE ----------
const turtle: Drawing = {
  id: "turtle",
  name: "Turtle",
  category: "animal",
  emoji: "🐢",
  viewBox: "0 0 400 400",
  paths: [
    // Shell
    { id: "shell", d: "M 200 130 C 100 130, 80 280, 200 290 C 320 280, 300 130, 200 130 Z" },
    // Shell hexagons
    { id: "hex-center", d: "M 200 175 L 225 195 L 225 230 L 200 250 L 175 230 L 175 195 Z" },
    { id: "hex-tl", d: "M 155 165 L 175 175 L 175 195 L 155 205 L 135 195 L 135 175 Z" },
    { id: "hex-tr", d: "M 245 165 L 265 175 L 265 195 L 245 205 L 225 195 L 225 175 Z" },
    { id: "hex-bl", d: "M 155 225 L 175 235 L 175 255 L 155 265 L 135 255 L 135 235 Z" },
    { id: "hex-br", d: "M 245 225 L 265 235 L 265 255 L 245 265 L 225 255 L 225 235 Z" },
    { id: "hex-top", d: "M 200 140 L 220 150 L 220 170 L 200 175 L 180 170 L 180 150 Z" },
    { id: "hex-bot", d: "M 200 250 L 220 260 L 220 278 L 200 285 L 180 278 L 180 260 Z" },
    // Head
    { id: "head", d: "M 305 200 C 340 195, 360 215, 350 240 C 335 250, 310 245, 295 230 Z" },
    // Eye
    { id: "eye", d: "M 325 215 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0 Z" },
    // Legs
    { id: "leg-fl", d: "M 130 270 C 110 285, 110 305, 130 305 L 160 290 Z" },
    { id: "leg-fr", d: "M 270 270 L 240 290 L 270 305 C 290 305, 290 285, 270 270 Z" },
    { id: "leg-bl", d: "M 145 165 C 130 150, 110 160, 115 175 L 155 195 Z" },
    { id: "leg-br", d: "M 255 165 L 245 195 L 285 175 C 290 160, 270 150, 255 165 Z" },
    // Tail
    { id: "tail", d: "M 100 215 L 75 220 L 75 230 L 100 235 Z" },
  ],
};

export const drawings: Drawing[] = [peacock, panda, butterfly, lotus, elephant, fox, owl, turtle];

export function getDrawing(id: string): Drawing | undefined {
  return drawings.find((d) => d.id === id);
}
