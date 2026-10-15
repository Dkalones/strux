export type LengthUnit = "m";
export type ForceUnit = "kN";
export type LoadUnit = "kN/m";
export type MomentUnit = "kN·m";
export type ElementKind = "pinned" | "roller" | "fixed" | "force" | "distributed" | "moment";
export type Support = {
  id: string;
  kind: "pinned" | "roller" | "fixed";
  position: number;
  /** Null or omitted means the support follows the beam angle. */
  angle?: number | null;
};
export type Load = {
  id: string;
  kind: "force" | "distributed" | "moment";
  position: number;
  magnitude: number;
  length?: number;
  direction?: "vertical" | "normal" | "horizontal-projection";
};
export type BeamElement = Support | Load;
export type BeamModel = { name: string; length: number; angle?: number; elements: BeamElement[] };
export const labels: Record<ElementKind, string> = {
  pinned: "Apoio articulado",
  roller: "Apoio rolete",
  fixed: "Engaste",
  force: "Força concentrada",
  distributed: "Carga distribuída",
  moment: "Momento concentrado",
};
export const isLoad = (element: BeamElement): element is Load => "magnitude" in element;
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export const roundPosition = (value: number) => Math.round(value * 100) / 100;
export function normalizeModel(model: BeamModel): BeamModel {
  const length = Number.isFinite(model.length) ? Math.max(model.length, 0.5) : 0.5;
  const angle = Number.isFinite(model.angle) ? clamp(model.angle ?? 0, -60, 60) : 0;
  return {
    ...model,
    length,
    angle,
    elements: model.elements.map((element) => {
      const position = clamp(element.position, 0, length);
      if (element.kind === "distributed")
        return {
          ...element,
          position: Math.min(position, length - 0.1),
          length: clamp(
            element.length ?? 1,
            0.1,
            Math.max(0.1, length - Math.min(position, length - 0.1)),
          ),
        };
      if (isLoad(element)) return { ...element, position };
      const supportAngle =
        element.angle == null
          ? element.angle
          : Number.isFinite(element.angle)
            ? clamp(element.angle, -180, 180)
            : null;
      return {
        ...element,
        position,
        ...(supportAngle === undefined ? {} : { angle: supportAngle }),
      };
    }),
  };
}
export function exampleModel(example = "simple"): BeamModel {
  if (example === "inclined-projection")
    return {
      name: "Viga inclinada com carga e momentos",
      length: 10,
      angle: (Math.atan2(6, 8) * 180) / Math.PI,
      elements: [
        { id: "s1", kind: "pinned", position: 0, angle: 0 },
        { id: "s2", kind: "roller", position: 10, angle: 0 },
        {
          id: "q1",
          kind: "distributed",
          position: 0,
          length: 10,
          magnitude: 9.80665,
          direction: "horizontal-projection",
        },
        { id: "m1", kind: "moment", position: 0, magnitude: 6 * 9.80665 },
        { id: "m2", kind: "moment", position: 10, magnitude: 2 * 9.80665 },
      ],
    };
  if (example === "cantilever")
    return {
      name: "Viga em balanço",
      length: 4,
      angle: 0,
      elements: [
        { id: "s1", kind: "fixed", position: 0 },
        { id: "f1", kind: "force", position: 4, magnitude: 12 },
      ],
    };
  if (example === "uniform")
    return {
      name: "Carga uniforme",
      length: 6,
      angle: 0,
      elements: [
        { id: "s1", kind: "pinned", position: 0 },
        { id: "s2", kind: "roller", position: 6 },
        { id: "q1", kind: "distributed", position: 0, length: 6, magnitude: 5 },
      ],
    };
  return {
    name: "Viga biapoiada",
    length: 6,
    angle: 0,
    elements: [
      { id: "s1", kind: "pinned", position: 0 },
      { id: "s2", kind: "roller", position: 6 },
      { id: "q1", kind: "distributed", position: 1, length: 4, magnitude: 5 },
      { id: "f1", kind: "force", position: 3, magnitude: 10 },
    ],
  };
}
