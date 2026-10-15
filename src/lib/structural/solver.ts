/** Isostatic equilibrium solver in the beam's local axes. */
import type { BeamAnalysisError, BeamAnalysisInput, Reaction } from "./types";

export const GEOMETRY_TOL = 1e-9;
const toRadians = (angle: number) => (angle * Math.PI) / 180;

function err(code: BeamAnalysisError["code"], message: string): BeamAnalysisError {
  return { ok: false, code, message };
}

export function localToGlobal(fx: number, fy: number, angle: number) {
  const radians = toRadians(angle);
  return {
    fx: fx * Math.cos(radians) - fy * Math.sin(radians),
    fy: fx * Math.sin(radians) + fy * Math.cos(radians),
  };
}

export function globalToLocal(fx: number, fy: number, angle: number) {
  const radians = toRadians(angle);
  return {
    fx: fx * Math.cos(radians) + fy * Math.sin(radians),
    fy: -fx * Math.sin(radians) + fy * Math.cos(radians),
  };
}

/** Applied force resultants use local axes; couples are invariant under rotation. */
export function appliedResultants(input: BeamAnalysisInput, xRef: number) {
  let fx = 0;
  let fy = 0;
  let mz = 0;
  for (const f of input.forces) {
    fx += f.fx ?? 0;
    fy += f.fy;
    mz += f.fy * (f.x - xRef);
  }
  for (const c of input.couples) mz -= c.c;
  for (const d of input.distributed) {
    const length = d.x2 - d.x1;
    fx += (d.qx ?? 0) * length;
    const vertical = -d.q * length;
    fy += vertical;
    mz += vertical * ((d.x1 + d.x2) / 2 - xRef);
  }
  return { fx, fy, mz };
}

export function validateInput(input: BeamAnalysisInput): BeamAnalysisError | null {
  const L = input.length;
  if (!Number.isFinite(L) || L <= 0)
    return err("invalid-input", "Comprimento da viga deve ser positivo.");
  if (input.angle !== undefined && !Number.isFinite(input.angle))
    return err("invalid-input", "Ângulo da viga inválido.");
  const inside = (x: number) => Number.isFinite(x) && x >= -GEOMETRY_TOL && x <= L + GEOMETRY_TOL;
  for (const s of input.supports)
    if (!inside(s.x) || (s.angle !== undefined && !Number.isFinite(s.angle)))
      return err("invalid-input", "Apoio inválido.");
  for (const f of input.forces)
    if (!inside(f.x) || !Number.isFinite(f.fy) || !Number.isFinite(f.fx ?? 0))
      return err("invalid-input", "Força concentrada inválida.");
  for (const c of input.couples)
    if (!inside(c.x) || !Number.isFinite(c.c))
      return err("invalid-input", "Momento concentrado inválido.");
  for (const d of input.distributed) {
    if (
      !inside(d.x1) ||
      !inside(d.x2) ||
      d.x2 <= d.x1 ||
      !Number.isFinite(d.q) ||
      !Number.isFinite(d.qx ?? 0)
    )
      return err("invalid-input", "Carga distribuída inválida.");
  }
  return null;
}

function globalReactions(
  reactions: Array<{
    supportId: string;
    type: Reaction["type"];
    x: number;
    localX: number;
    localY: number;
    mz: number;
  }>,
  angle: number,
): Reaction[] {
  return reactions.map(({ localX, localY, ...reaction }) => {
    const global = localToGlobal(localX, localY, angle);
    return { ...reaction, rx: global.fx, ry: global.fy };
  });
}

export function solveReactions(input: BeamAnalysisInput): Reaction[] | BeamAnalysisError {
  const invalid = validateInput(input);
  if (invalid) return invalid;
  const s = input.supports;
  const unknowns = s.reduce(
    (n, sp) => n + (sp.type === "fixed" ? 3 : sp.type === "pinned" ? 2 : 1),
    0,
  );
  if (s.length === 0) return err("hypostatic", "Sem apoios: a estrutura é hipostática.");
  if (s.length === 3 && s.every((support) => support.type === "roller"))
    return err(
      "hypostatic",
      "Três roletes não restringem o deslocamento ao longo da viga: estrutura hipostática.",
    );
  if (unknowns < 3)
    return err("hypostatic", "Vínculos insuficientes (menos de 3 reações): estrutura hipostática.");
  if (unknowns > 3)
    return err(
      "hyperstatic",
      `Estrutura hiperestática (grau ${unknowns - 3}). Ainda não suportada: requer o método da rigidez.`,
    );

  const angle = input.angle ?? 0;
  const fixed = s.length === 1 ? s[0] : undefined;
  if (fixed?.type === "fixed") {
    const applied = appliedResultants(input, fixed.x);
    return globalReactions(
      [
        {
          supportId: fixed.id,
          type: "fixed",
          x: fixed.x,
          localX: -applied.fx,
          localY: -applied.fy,
          mz: -applied.mz,
        },
      ],
      angle,
    );
  }
  if (s.length === 2) {
    const pinned = s.find((support) => support.type === "pinned");
    const roller = s.find((support) => support.type === "roller");
    if (!pinned || !roller) return err("unsupported", "Combinação de apoios não suportada.");
    if (Math.abs(pinned.x - roller.x) < 1e-6)
      return err("hypostatic", "Apoios coincidentes: a estrutura pode girar (hipostática).");
    const applied = appliedResultants(input, pinned.x);
    const beamRadians = toRadians(angle);
    const supportRadians = toRadians(roller.angle ?? angle);
    const rollerX = -Math.sin(supportRadians);
    const rollerY = Math.cos(supportRadians);
    const momentArm =
      (roller.x - pinned.x) * (Math.cos(beamRadians) * rollerY - Math.sin(beamRadians) * rollerX);
    if (Math.abs(momentArm) < 1e-9)
      return err(
        "hypostatic",
        "A orientação do rolete não cria braço de momento para equilibrar a viga.",
      );
    const rollerMagnitude = -applied.mz / momentArm;
    const appliedGlobal = localToGlobal(applied.fx, applied.fy, angle);
    return [
      {
        supportId: pinned.id,
        type: "pinned",
        x: pinned.x,
        rx: -appliedGlobal.fx - rollerMagnitude * rollerX,
        ry: -appliedGlobal.fy - rollerMagnitude * rollerY,
        mz: 0,
      },
      {
        supportId: roller.id,
        type: "roller",
        x: roller.x,
        rx: rollerMagnitude * rollerX,
        ry: rollerMagnitude * rollerY,
        mz: 0,
      },
    ];
  }
  return err("unsupported", "Combinação de apoios não suportada nesta versão.");
}
