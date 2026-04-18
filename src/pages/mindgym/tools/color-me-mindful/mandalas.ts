// Procedurally generated mandala SVGs with named regions for tap-to-fill.
// Each mandala returns { paths, viewBox } where paths have stable ids.

export type MandalaPath = {
  id: string;
  d: string;
  defaultFill?: string;
};

export type Mandala = {
  id: string;
  name: string;
  viewBox: string;
  paths: MandalaPath[];
};

const TAU = Math.PI * 2;

function petalRing(
  cx: number,
  cy: number,
  count: number,
  innerR: number,
  outerR: number,
  width: number,
  rotate = 0,
): MandalaPath[] {
  const paths: MandalaPath[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + rotate;
    const ax = cx + Math.cos(a) * innerR;
    const ay = cy + Math.sin(a) * innerR;
    const tx = cx + Math.cos(a) * outerR;
    const ty = cy + Math.sin(a) * outerR;
    const perp = a + Math.PI / 2;
    const c1x = ax + Math.cos(perp) * width;
    const c1y = ay + Math.sin(perp) * width;
    const c2x = tx + Math.cos(perp) * (width * 0.4);
    const c2y = ty + Math.sin(perp) * (width * 0.4);
    const c3x = tx - Math.cos(perp) * (width * 0.4);
    const c3y = ty - Math.sin(perp) * (width * 0.4);
    const c4x = ax - Math.cos(perp) * width;
    const c4y = ay - Math.sin(perp) * width;
    const d = `M ${ax} ${ay} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty} C ${c3x} ${c3y}, ${c4x} ${c4y}, ${ax} ${ay} Z`;
    paths.push({ id: `petal-${count}-${i}`, d });
  }
  return paths;
}

function circle(cx: number, cy: number, r: number, id: string): MandalaPath {
  return {
    id,
    d: `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`,
  };
}

function dotRing(cx: number, cy: number, count: number, ringR: number, dotR: number, prefix: string): MandalaPath[] {
  const out: MandalaPath[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    const x = cx + Math.cos(a) * ringR;
    const y = cy + Math.sin(a) * ringR;
    out.push(circle(x, y, dotR, `${prefix}-${i}`));
  }
  return out;
}

function teardropRing(
  cx: number,
  cy: number,
  count: number,
  innerR: number,
  outerR: number,
  width: number,
): MandalaPath[] {
  const out: MandalaPath[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    const tipX = cx + Math.cos(a) * outerR;
    const tipY = cy + Math.sin(a) * outerR;
    const baseX = cx + Math.cos(a) * innerR;
    const baseY = cy + Math.sin(a) * innerR;
    const perp = a + Math.PI / 2;
    const lx = baseX + Math.cos(perp) * width;
    const ly = baseY + Math.sin(perp) * width;
    const rx = baseX - Math.cos(perp) * width;
    const ry = baseY - Math.sin(perp) * width;
    out.push({
      id: `tear-${count}-${i}`,
      d: `M ${tipX} ${tipY} Q ${lx} ${ly}, ${baseX} ${baseY} Q ${rx} ${ry}, ${tipX} ${tipY} Z`,
    });
  }
  return out;
}

function buildMandala(seed: number, name: string): Mandala {
  const cx = 200;
  const cy = 200;
  const paths: MandalaPath[] = [];

  // Center
  paths.push(circle(cx, cy, 18, "center"));
  paths.push(circle(cx, cy, 10, "center-dot"));

  // Variants by seed
  const layouts = [
    { p1: 8, p2: 12, p3: 16, t: 24, dots: 32 },
    { p1: 6, p2: 10, p3: 18, t: 20, dots: 28 },
    { p1: 10, p2: 14, p3: 20, t: 28, dots: 36 },
    { p1: 8, p2: 16, p3: 12, t: 24, dots: 30 },
    { p1: 12, p2: 8, p3: 16, t: 32, dots: 40 },
    { p1: 6, p2: 12, p3: 24, t: 18, dots: 24 },
  ];
  const L = layouts[seed % layouts.length];

  // Inner petal ring
  paths.push(...petalRing(cx, cy, L.p1, 22, 60, 14));
  // Mid ring of small circles
  paths.push(...dotRing(cx, cy, L.p2, 72, 6, "mid-dot"));
  // Mid petal ring
  paths.push(...petalRing(cx, cy, L.p2, 78, 118, 18, Math.PI / L.p2));
  // Ring divider
  paths.push({
    id: "ring-1",
    d: `M ${cx - 124} ${cy} a 124 124 0 1 0 248 0 a 124 124 0 1 0 -248 0 Z M ${cx - 118} ${cy} a 118 118 0 1 1 236 0 a 118 118 0 1 1 -236 0 Z`,
  });
  // Outer teardrop ring
  paths.push(...teardropRing(cx, cy, L.t, 130, 172, 10));
  // Outermost dot ring
  paths.push(...dotRing(cx, cy, L.dots, 184, 4, "outer-dot"));
  // Outer petals
  paths.push(...petalRing(cx, cy, L.p3, 188, 196, 6, Math.PI / L.p3));

  return {
    id: `mandala-${seed + 1}`,
    name,
    viewBox: "0 0 400 400",
    paths,
  };
}

export const mandalas: Mandala[] = Array.from({ length: 6 }, (_, i) =>
  buildMandala(i, `Mandala ${String(i + 1).padStart(2, "0")}`),
);

export function getMandala(id: string): Mandala | undefined {
  return mandalas.find((m) => m.id === id);
}
