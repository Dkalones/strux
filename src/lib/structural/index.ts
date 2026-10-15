import { isLoad, type BeamModel } from "@/lib/beam-model";
import { appliedResultants, globalToLocal, localToGlobal, solveReactions } from "./solver";
import { buildDiagram, extremes } from "./postprocess";
import type { BeamAnalysisInput, BeamAnalysisOutcome } from "./types";

export * from "./types";
export * from "./frame-types";
export {
  hingedPortalExample,
  portalExample,
  portalDistributedLoadsExample,
  simplePortalExample,
  threeHingedPortalExample,
  trussExample,
} from "./frame-examples";
export { analyzePlanarStructure } from "./frame-solver";

/**
 * Adapter: editor model → engine input. The editor stores loads as
 * "positive downward" (forces, kN/m) and moments "positive clockwise".
 * Positions are already physical metres (never pixels).
 */
export function toAnalysisInput(model: BeamModel): BeamAnalysisInput {
  const angle = ((model.angle ?? 0) * Math.PI) / 180;
  const input: BeamAnalysisInput = {
    length: model.length,
    angle: model.angle ?? 0,
    supports: [],
    forces: [],
    couples: [],
    distributed: [],
  };
  for (const el of model.elements) {
    if (!isLoad(el))
      input.supports.push({
        id: el.id,
        type: el.kind,
        x: el.position,
        angle: el.angle ?? model.angle ?? 0,
      });
    else if (el.kind === "force")
      input.forces.push({
        id: el.id,
        x: el.position,
        fx: -el.magnitude * Math.sin(angle),
        fy: -el.magnitude * Math.cos(angle),
      });
    else if (el.kind === "moment")
      input.couples.push({ id: el.id, x: el.position, c: el.magnitude });
    else {
      const magnitude =
        el.direction === "horizontal-projection"
          ? el.magnitude * Math.abs(Math.cos(angle))
          : el.magnitude;
      input.distributed.push({
        id: el.id,
        x1: el.position,
        x2: el.position + (el.length ?? 0),
        qx: el.direction === "normal" ? 0 : -magnitude * Math.sin(angle),
        q: el.direction === "normal" ? el.magnitude : magnitude * Math.cos(angle),
      });
    }
  }
  return input;
}

export function analyzeBeam(input: BeamAnalysisInput): BeamAnalysisOutcome {
  const reactions = solveReactions(input);
  if (!Array.isArray(reactions)) return reactions;
  const diagram = buildDiagram(input, reactions);
  const v = extremes(diagram, "V");
  const m = extremes(diagram, "M");
  const n = extremes(diagram, "N");
  const applied = appliedResultants(input, 0);
  const appliedGlobal = localToGlobal(applied.fx, applied.fy, input.angle ?? 0);
  let sumFx = appliedGlobal.fx;
  let sumFy = appliedGlobal.fy;
  let sumMz = applied.mz;
  for (const r of reactions) {
    sumFx += r.rx;
    sumFy += r.ry;
    const local = globalToLocal(r.rx, r.ry, input.angle ?? 0);
    sumMz += local.fy * r.x + r.mz;
  }
  return {
    ok: true,
    method: "isostatic-equilibrium",
    reactions,
    diagram,
    maxShear: v.max,
    minShear: v.min,
    maxMoment: m.max,
    minMoment: m.min,
    maxAxial: n.max,
    minAxial: n.min,
    equilibrium: { sumFx, sumFy, sumMz },
  };
}

export const analyzeModel = (model: BeamModel) => analyzeBeam(toAnalysisInput(model));
