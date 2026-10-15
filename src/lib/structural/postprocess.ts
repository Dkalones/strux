/**
 * Internal forces by the method of sections, using the LEFT free body.
 * V(x) = Σ upward forces left of x;  M(x) = Σ Fy·(x − a) + Σ clockwise couples left of x.
 * Exact for point forces, couples and uniform loads (V linear, M quadratic in a UDL).
 */
import type { BeamAnalysisInput, DiagramPoint, Extreme, Reaction } from "./types";
import { globalToLocal } from "./solver";

interface Point {
  x: number;
  fx: number;
  fy: number;
}
interface Cpl {
  x: number;
  c: number;
}

function gather(input: BeamAnalysisInput, reactions: Reaction[]) {
  const angle = input.angle ?? 0;
  const points: Point[] = [
    ...input.forces.map((f) => ({ x: f.x, fx: f.fx ?? 0, fy: f.fy })),
    ...reactions.map((r) => {
      const local = globalToLocal(r.rx, r.ry, angle);
      return { x: r.x, fx: local.fx, fy: local.fy };
    }),
  ];
  // Reaction couple is ccw positive → equivalent clockwise couple is −mz.
  const couples: Cpl[] = [
    ...input.couples.map((c) => ({ x: c.x, c: c.c })),
    ...reactions.filter((r) => r.mz !== 0).map((r) => ({ x: r.x, c: -r.mz })),
  ];
  return { points, couples, distributed: input.distributed };
}

/** Evaluate at x. side = 'left' excludes concentrated actions at x; 'right' includes them. */
export function sectionForces(
  input: BeamAnalysisInput,
  reactions: Reaction[],
  x: number,
  side: "left" | "right",
) {
  const { points, couples, distributed } = gather(input, reactions);
  const acts = (a: number) => (side === "right" ? a <= x + 1e-12 : a < x - 1e-12);
  let V = 0,
    M = 0,
    axial = 0;
  for (const p of points)
    if (acts(p.x)) {
      axial -= p.fx;
      V += p.fy;
      M += p.fy * (x - p.x);
    }
  for (const c of couples) if (acts(c.x)) M += c.c;
  for (const d of distributed) {
    const loaded = Math.min(Math.max(x - d.x1, 0), d.x2 - d.x1);
    if (loaded <= 0) continue;
    axial -= (d.qx ?? 0) * loaded;
    const w = d.q * loaded;
    V -= w;
    M -= w * (x - (d.x1 + loaded / 2));
  }
  return { V, M, N: axial };
}

export function buildDiagram(
  input: BeamAnalysisInput,
  reactions: Reaction[],
  divisions = 200,
): DiagramPoint[] {
  const L = input.length;
  const critical = new Set<number>([0, L]);
  for (const f of input.forces) critical.add(f.x);
  for (const c of input.couples) critical.add(c.x);
  for (const d of input.distributed) {
    critical.add(d.x1);
    critical.add(d.x2);
  }
  for (const r of reactions) critical.add(r.x);
  const xs = new Set<number>(critical);
  for (let i = 1; i < divisions; i++) xs.add((L * i) / divisions);
  // Zero-shear points inside loaded spans give exact moment extremes.
  const sorted = [...xs].sort((a, b) => a - b);
  const out: DiagramPoint[] = [];
  for (const x of sorted) {
    if (critical.has(x)) {
      if (x > 0) out.push({ x, ...sectionForces(input, reactions, x, "left") });
      if (x < L) out.push({ x, ...sectionForces(input, reactions, x, "right") });
    } else out.push({ x, ...sectionForces(input, reactions, x, "right") });
  }
  // add exact zero-shear points
  for (let i = 0; i + 1 < out.length; i++) {
    const a = out[i],
      b = out[i + 1];
    if (!a || !b) continue;
    if (b.x > a.x && a.V * b.V < 0) {
      const xz = a.x + (a.V / (a.V - b.V)) * (b.x - a.x);
      out.splice(i + 1, 0, { x: xz, ...sectionForces(input, reactions, xz, "right") });
      i++;
    }
  }
  return out;
}

export function extremes(diagram: DiagramPoint[], key: "V" | "M" | "N") {
  let max: Extreme = { x: 0, value: -Infinity },
    min: Extreme = { x: 0, value: Infinity };
  for (const p of diagram) {
    if (p[key] > max.value) max = { x: p.x, value: p[key] };
    if (p[key] < min.value) min = { x: p.x, value: p[key] };
  }
  return { max, min };
}
