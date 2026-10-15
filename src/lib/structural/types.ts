/**
 * STRUX structural engine — physical model types (independent from the UI).
 *
 * Units: length m, force kN, distributed load kN/m, moment kN·m.
 * Coordinates: x measured along the beam axis from the left end (x = 0).
 *
 * Sign conventions (engine input, local beam axes):
 *  - Point force fx/fy: positive along local +x/+y.
 *  - Reaction forces are reported in global axes.
 *  - Concentrated couples: positive CLOCKWISE.
 *  - Distributed qx: positive along local +x; q is positive along local -y.
 *  - Shear V(x): resultant of local +y forces on the LEFT part.
 *  - Bending moment M(x): positive when sagging (traction at the bottom fibre).
 *  - Normal force N(x): positive in tension (negative resultant of left-side local axial actions).
 */

export type SupportType = "pinned" | "roller" | "fixed";

export interface SupportInput {
  id: string;
  type: SupportType;
  x: number;
  /** Support local +x angle from global +x; a roller reacts normal to this axis. */
  angle?: number;
}
/** Point force components in local beam axes (kN). */
export interface PointForce {
  id: string;
  x: number;
  fx?: number;
  fy: number;
}
/** Concentrated couple, positive clockwise (kN·m). */
export interface Couple {
  id: string;
  x: number;
  c: number;
}
/** Uniform distributed load over [x1, x2]; q is positive along local -y (kN/m). */
export interface UniformLoad {
  id: string;
  x1: number;
  x2: number;
  qx?: number;
  q: number;
}

export interface BeamAnalysisInput {
  length: number;
  /** Beam axis angle counter-clockwise from global +x (degrees). */
  angle?: number;
  supports: SupportInput[];
  forces: PointForce[];
  couples: Couple[];
  distributed: UniformLoad[];
}

export interface Reaction {
  supportId: string;
  type: SupportType;
  x: number;
  /** Horizontal reaction in global axes (kN), positive to the right. */
  rx: number;
  /** Vertical reaction in global axes (kN), positive upward. */
  ry: number;
  /** Reaction couple (kN·m), positive counter-clockwise. Only for fixed supports. */
  mz: number;
}

export interface DiagramPoint {
  x: number;
  V: number;
  M: number;
  N: number;
}

export interface Extreme {
  x: number;
  value: number;
}

export interface BeamAnalysisResult {
  ok: true;
  method: "isostatic-equilibrium";
  reactions: Reaction[];
  /** Ordered samples; at discontinuities the same x appears twice (left then right limit). */
  diagram: DiagramPoint[];
  maxShear: Extreme;
  minShear: Extreme;
  maxMoment: Extreme;
  minMoment: Extreme;
  maxAxial: Extreme;
  minAxial: Extreme;
  /** Global equilibrium residuals (should be ~0). */
  equilibrium: { sumFx: number; sumFy: number; sumMz: number };
}

export type AnalysisErrorCode = "invalid-input" | "hypostatic" | "hyperstatic" | "unsupported";
export interface BeamAnalysisError {
  ok: false;
  code: AnalysisErrorCode;
  message: string;
}

export type BeamAnalysisOutcome = BeamAnalysisResult | BeamAnalysisError;
