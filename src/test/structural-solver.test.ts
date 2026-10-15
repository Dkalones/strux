import { describe, expect, it } from "vitest";
import {
  analyzeBeam,
  analyzeModel,
  toAnalysisInput,
  type BeamAnalysisInput,
  type BeamAnalysisResult,
} from "@/lib/structural";
import { sectionForces } from "@/lib/structural/postprocess";
import { exampleModel } from "@/lib/beam-model";

const TOL = 1e-9; // absolute tolerance, kN / kN·m
const empty = (length: number): BeamAnalysisInput => ({
  length,
  supports: [],
  forces: [],
  couples: [],
  distributed: [],
});
const solve = (i: BeamAnalysisInput) => {
  const r = analyzeBeam(i);
  if (!r.ok) throw new Error(r.message);
  return r as BeamAnalysisResult;
};
const at = (
  i: BeamAnalysisInput,
  r: BeamAnalysisResult,
  x: number,
  s: "left" | "right" = "right",
) => sectionForces(i, r.reactions, x, s);
const itemAt = <T>(items: T[], index: number): T => {
  const item = items[index];
  if (item === undefined) throw new Error(`Missing test item at index ${index}`);
  return item;
};
const near = (actual: number, expected: number) =>
  expect(
    Math.abs(actual - expected),
    `expected ${expected}, received ${actual}; absolute error ${Math.abs(actual - expected)}, tolerance ${TOL}`,
  ).toBeLessThan(TOL);

describe("required analytical validation cases", () => {
  it("simply supported beam with a centered 12 kN point load", () => {
    const i = {
      ...empty(6),
      supports: [
        { id: "A", type: "pinned" as const, x: 0 },
        { id: "B", type: "roller" as const, x: 6 },
      ],
      forces: [{ id: "P", x: 3, fy: -12 }],
    };
    const r = solve(i);
    near(itemAt(r.reactions, 0).ry, 6);
    near(itemAt(r.reactions, 1).ry, 6);
    near(Math.max(Math.abs(r.maxShear.value), Math.abs(r.minShear.value)), 6);
    near(r.maxMoment.value, 18);
    near(r.equilibrium.sumFy, 0);
    near(r.equilibrium.sumMz, 0);
  });

  it("simply supported beam with a 4 kN/m full-span UDL", () => {
    const i = {
      ...empty(6),
      supports: [
        { id: "A", type: "pinned" as const, x: 0 },
        { id: "B", type: "roller" as const, x: 6 },
      ],
      distributed: [{ id: "q", x1: 0, x2: 6, q: 4 }],
    };
    const r = solve(i);
    near(
      itemAt(i.distributed, 0).q * (itemAt(i.distributed, 0).x2 - itemAt(i.distributed, 0).x1),
      24,
    );
    near(itemAt(r.reactions, 0).ry, 12);
    near(itemAt(r.reactions, 1).ry, 12);
    near(r.maxMoment.value, 18);
    near(at(i, r, 1).V, 8);
    near(at(i, r, 2).V, 4);
    near(at(i, r, 2).M, 16);
    near(at(i, r, 4).M, 16);
    near(r.equilibrium.sumFy, 0);
    near(r.equilibrium.sumMz, 0);
  });

  it("cantilever with a 10 kN load at the free end", () => {
    const i = {
      ...empty(4),
      supports: [{ id: "E", type: "fixed" as const, x: 0 }],
      forces: [{ id: "P", x: 4, fy: -10 }],
    };
    const r = solve(i);
    near(itemAt(r.reactions, 0).ry, 10);
    near(itemAt(r.reactions, 0).mz, 40);
    near(Math.max(Math.abs(r.maxShear.value), Math.abs(r.minShear.value)), 10);
    near(Math.max(Math.abs(r.maxMoment.value), Math.abs(r.minMoment.value)), 40);
    near(r.equilibrium.sumFy, 0);
    near(r.equilibrium.sumMz, 0);
  });

  it("partially distributed load from 1 m to 5 m", () => {
    const i = {
      ...empty(6),
      supports: [
        { id: "A", type: "pinned" as const, x: 0 },
        { id: "B", type: "roller" as const, x: 6 },
      ],
      distributed: [{ id: "q", x1: 1, x2: 5, q: 5 }],
    };
    const load = itemAt(i.distributed, 0);
    const totalLoad = load.q * (load.x2 - load.x1);
    const resultantPosition = (load.x1 + load.x2) / 2;
    const r = solve(i);
    near(totalLoad, 20);
    near(resultantPosition, 3);
    near(itemAt(r.reactions, 0).ry, 10);
    near(itemAt(r.reactions, 1).ry, 10);
    near(at(i, r, 3).V, 0);
    near(at(i, r, 3).M, 20);
    near(r.equilibrium.sumFy, 0);
    near(r.equilibrium.sumMz, 0);
  });
});

describe("simply supported, central point load (L=6, P=10 kN)", () => {
  const i = {
    ...empty(6),
    supports: [
      { id: "A", type: "pinned" as const, x: 0 },
      { id: "B", type: "roller" as const, x: 6 },
    ],
    forces: [{ id: "P", x: 3, fy: -10 }],
  };
  const r = solve(i);
  it("reactions P/2", () => {
    near(itemAt(r.reactions, 0).ry, 5);
    near(itemAt(r.reactions, 1).ry, 5);
  });
  it("shear jump of −P at midspan", () => {
    near(at(i, r, 3, "left").V, 5);
    near(at(i, r, 3, "right").V, -5);
  });
  it("Mmax = PL/4 = 15 at x=3", () => {
    near(r.maxMoment.value, 15);
    near(r.maxMoment.x, 3);
  });
  it("M = 0 at supports", () => {
    near(at(i, r, 0).M, 0);
    near(at(i, r, 6, "left").M, 0);
  });
  it("global equilibrium", () => {
    near(r.equilibrium.sumFy, 0);
    near(r.equilibrium.sumMz, 0);
  });
});

describe("simply supported, full UDL (L=6, q=5 kN/m)", () => {
  const i = {
    ...empty(6),
    supports: [
      { id: "A", type: "pinned" as const, x: 0 },
      { id: "B", type: "roller" as const, x: 6 },
    ],
    distributed: [{ id: "q", x1: 0, x2: 6, q: 5 }],
  };
  const r = solve(i);
  it("reactions qL/2 = 15", () => {
    near(itemAt(r.reactions, 0).ry, 15);
    near(itemAt(r.reactions, 1).ry, 15);
  });
  it("Mmax = qL²/8 = 22.5 at midspan, V=0 there", () => {
    near(r.maxMoment.value, 22.5);
    near(r.maxMoment.x, 3);
    near(at(i, r, 3).V, 0);
  });
  it("M(x) = qx(L−x)/2 at x=1.5", () => near(at(i, r, 1.5).M, (5 * 1.5 * 4.5) / 2));
  it("equilibrium", () => {
    near(r.equilibrium.sumFy, 0);
    near(r.equilibrium.sumMz, 0);
  });
});

describe("cantilever, tip load (L=4, P=12 kN, fixed at x=0)", () => {
  const i = {
    ...empty(4),
    supports: [{ id: "E", type: "fixed" as const, x: 0 }],
    forces: [{ id: "P", x: 4, fy: -12 }],
  };
  const r = solve(i);
  it("Ry = 12 up, reaction couple = PL = 48 ccw", () => {
    near(itemAt(r.reactions, 0).ry, 12);
    near(itemAt(r.reactions, 0).mz, 48);
  });
  it("M(0+) = −PL (hogging), M(L) = 0", () => {
    near(at(i, r, 0).M, -48);
    near(at(i, r, 4, "left").M, 0);
  });
  it("constant shear +12", () => {
    near(at(i, r, 2).V, 12);
  });
  it("equilibrium", () => {
    near(r.equilibrium.sumFy, 0);
    near(r.equilibrium.sumMz, 0);
  });
});

describe("applied clockwise couple, simply supported (L=4, C=8 at x=1)", () => {
  const i = {
    ...empty(4),
    supports: [
      { id: "A", type: "pinned" as const, x: 0 },
      { id: "B", type: "roller" as const, x: 4 },
    ],
    couples: [{ id: "C", x: 1, c: 8 }],
  };
  const r = solve(i);
  it("reactions ±C/L", () => {
    near(itemAt(r.reactions, 0).ry, -2);
    near(itemAt(r.reactions, 1).ry, 2);
  });
  it("moment jump +C at x=1", () => {
    near(at(i, r, 1, "left").M, -2);
    near(at(i, r, 1, "right").M, 6);
  });
});

describe("overhang and editor adapter", () => {
  it("pinned at 0, roller at 4, P=10 down at 6", () => {
    const i = {
      ...empty(6),
      supports: [
        { id: "A", type: "pinned" as const, x: 0 },
        { id: "B", type: "roller" as const, x: 4 },
      ],
      forces: [{ id: "P", x: 6, fy: -10 }],
    };
    const r = solve(i);
    near(itemAt(r.reactions, 0).ry, -5);
    near(itemAt(r.reactions, 1).ry, 15);
    near(at(i, r, 4).M, -20);
  });
  it('editor example "simple": R = (10+20)/2 each, equilibrium holds', () => {
    const r = analyzeModel({
      name: "t",
      length: 6,
      elements: [
        { id: "s1", kind: "pinned", position: 0 },
        { id: "s2", kind: "roller", position: 6 },
        { id: "q", kind: "distributed", position: 1, length: 4, magnitude: 5 },
        { id: "f", kind: "force", position: 3, magnitude: 10 },
      ],
    });
    if (!r.ok) throw new Error(r.message);
    near(itemAt(r.reactions, 0).ry, 15);
    near(itemAt(r.reactions, 1).ry, 15);
    near(r.maxMoment.value, 15 * 3 - 5 * 2 * 1); // 35
    near(r.equilibrium.sumFy, 0);
    near(r.equilibrium.sumMz, 0);
  });
});

describe("out-of-scope models are rejected", () => {
  it("no supports → hypostatic", () =>
    expect(analyzeBeam(empty(5))).toMatchObject({ ok: false, code: "hypostatic" }));
  it("two pinned → hyperstatic", () =>
    expect(
      analyzeBeam({
        ...empty(5),
        supports: [
          { id: "a", type: "pinned", x: 0 },
          { id: "b", type: "pinned", x: 5 },
        ],
      }),
    ).toMatchObject({ ok: false, code: "hyperstatic" }));
  it("fixed + roller → hyperstatic", () =>
    expect(
      analyzeBeam({
        ...empty(5),
        supports: [
          { id: "a", type: "fixed", x: 0 },
          { id: "b", type: "roller", x: 5 },
        ],
      }),
    ).toMatchObject({ ok: false, code: "hyperstatic" }));
  it("two rollers → hypostatic", () =>
    expect(
      analyzeBeam({
        ...empty(5),
        supports: [
          { id: "a", type: "roller", x: 0 },
          { id: "b", type: "roller", x: 5 },
        ],
      }),
    ).toMatchObject({ ok: false, code: "hypostatic" }));
  it("coincident pinned+roller → hypostatic", () =>
    expect(
      analyzeBeam({
        ...empty(5),
        supports: [
          { id: "a", type: "pinned", x: 2 },
          { id: "b", type: "roller", x: 2 },
        ],
      }),
    ).toMatchObject({ ok: false, code: "hypostatic" }));
  it("non-positive length → invalid-input", () =>
    expect(analyzeBeam(empty(0))).toMatchObject({ ok: false, code: "invalid-input" }));
  it("load outside beam → invalid-input", () =>
    expect(analyzeBeam({ ...empty(5), forces: [{ id: "P", x: 5.1, fy: -1 }] })).toMatchObject({
      ok: false,
      code: "invalid-input",
    }));
});

describe("edge cases and sign conventions", () => {
  const supports = [
    { id: "A", type: "pinned" as const, x: 0 },
    { id: "B", type: "roller" as const, x: 6 },
  ];

  it("unloaded beam has zero reactions and internal forces", () => {
    const i = { ...empty(6), supports };
    const r = solve(i);
    r.reactions.forEach((reaction) => near(reaction.ry, 0));
    near(r.maxShear.value, 0);
    near(r.maxMoment.value, 0);
    near(r.equilibrium.sumFy, 0);
    near(r.equilibrium.sumMz, 0);
  });

  it("force at a support is balanced locally without changing the far reaction", () => {
    const i = { ...empty(6), supports, forces: [{ id: "P", x: 0, fy: -10 }] };
    const r = solve(i);
    near(itemAt(r.reactions, 0).ry, 10);
    near(itemAt(r.reactions, 1).ry, 0);
    near(at(i, r, 0).V, 0);
    near(at(i, r, 6, "left").M, 0);
  });

  it("multiple point forces with opposing signs preserve equilibrium", () => {
    const i = {
      ...empty(6),
      supports,
      forces: [
        { id: "P1", x: 2, fy: -4 },
        { id: "P2", x: 5, fy: 2 },
      ],
    };
    const r = solve(i);
    near(itemAt(r.reactions, 0).ry, 7 / 3);
    near(itemAt(r.reactions, 1).ry, -1 / 3);
    near(r.equilibrium.sumFy, 0);
    near(r.equilibrium.sumMz, 0);
  });

  it("loads close to the beam ends remain within the model", () => {
    const i = {
      ...empty(6),
      supports,
      forces: [
        { id: "P1", x: 1e-6, fy: -2 },
        { id: "P2", x: 6 - 1e-6, fy: -2 },
      ],
    };
    const r = solve(i);
    near(itemAt(r.reactions, 0).ry, 2);
    near(itemAt(r.reactions, 1).ry, 2);
    near(r.equilibrium.sumFy, 0);
    near(r.equilibrium.sumMz, 0);
  });

  it("clockwise moments follow the documented positive convention", () => {
    const i = { ...empty(6), supports, couples: [{ id: "C", x: 3, c: 6 }] };
    const r = solve(i);
    near(itemAt(r.reactions, 0).ry, -1);
    near(itemAt(r.reactions, 1).ry, 1);
    near(at(i, r, 3, "right").M - at(i, r, 3, "left").M, 6);
    near(r.equilibrium.sumFy, 0);
    near(r.equilibrium.sumMz, 0);
  });
});

describe("inclined beam gravity and normal distributed loads", () => {
  const supports = [
    { id: "A", kind: "pinned" as const, position: 0 },
    { id: "B", kind: "roller" as const, position: 6 },
  ];

  it("resolves a vertical point load into local axial and transverse force", () => {
    const result = analyzeModel({
      name: "Inclined beam point load",
      length: 6,
      angle: 30,
      elements: [...supports, { id: "P", kind: "force", position: 3, magnitude: 10 }],
    });
    if (!result.ok) throw new Error(result.message);
    near(itemAt(result.reactions, 0).rx, Math.sqrt(3) * 1.25);
    near(itemAt(result.reactions, 0).ry, 6.25);
    near(itemAt(result.reactions, 1).rx, -Math.sqrt(3) * 1.25);
    near(itemAt(result.reactions, 1).ry, 3.75);
    near(
      sectionForces(
        toAnalysisInput({
          name: "Inclined beam point load",
          length: 6,
          angle: 30,
          elements: [...supports, { id: "P", kind: "force", position: 3, magnitude: 10 }],
        }),
        result.reactions,
        1,
        "right",
      ).N,
      -5,
    );
    near(result.equilibrium.sumFx, 0);
    near(result.equilibrium.sumFy, 0);
    near(result.equilibrium.sumMz, 0);
  });

  it("resolves vertical distributed gravity into axial and transverse components", () => {
    const result = analyzeModel({
      name: "Inclined beam gravity load",
      length: 6,
      angle: 30,
      elements: [
        ...supports,
        {
          id: "q",
          kind: "distributed",
          position: 0,
          length: 6,
          magnitude: 4,
          direction: "vertical",
        },
      ],
    });
    if (!result.ok) throw new Error(result.message);
    near(itemAt(result.reactions, 0).rx, 3 * Math.sqrt(3));
    near(itemAt(result.reactions, 0).ry, 15);
    near(itemAt(result.reactions, 1).rx, -3 * Math.sqrt(3));
    near(itemAt(result.reactions, 1).ry, 9);
    near(result.maxAxial.value, 0);
    near(result.minAxial.value, -12);
    near(result.equilibrium.sumFx, 0);
    near(result.equilibrium.sumFy, 0);
    near(result.equilibrium.sumMz, 0);
  });

  it("calculates a uniform load normal to the inclined beam without axial force", () => {
    const result = analyzeModel({
      name: "Inclined beam normal load",
      length: 6,
      angle: 30,
      elements: [
        ...supports,
        { id: "q", kind: "distributed", position: 0, length: 6, magnitude: 4, direction: "normal" },
      ],
    });
    if (!result.ok) throw new Error(result.message);
    near(itemAt(result.reactions, 0).rx, -6);
    near(itemAt(result.reactions, 0).ry, 6 * Math.sqrt(3));
    near(itemAt(result.reactions, 1).rx, -6);
    near(itemAt(result.reactions, 1).ry, 6 * Math.sqrt(3));
    near(result.maxAxial.value, 0);
    near(result.minAxial.value, 0);
    near(result.maxMoment.value, 18);
    near(result.equilibrium.sumFx, 0);
    near(result.equilibrium.sumFy, 0);
    near(result.equilibrium.sumMz, 0);
  });

  it("solves the projected 8 m gravity load and end moments on the 8-by-6 m beam example", () => {
    const result = analyzeModel(exampleModel("inclined-projection"));
    if (!result.ok) throw new Error(result.message);
    near(itemAt(result.reactions, 0).rx, 0);
    near(itemAt(result.reactions, 0).ry, 3 * 9.80665);
    near(itemAt(result.reactions, 1).rx, 0);
    near(itemAt(result.reactions, 1).ry, 5 * 9.80665);
    near(result.equilibrium.sumFx, 0);
    near(result.equilibrium.sumFy, 0);
    near(result.equilibrium.sumMz, 0);
  });

  it("keeps an independently horizontal roller support horizontal", () => {
    const result = analyzeModel({
      name: "Independent roller direction",
      length: 6,
      angle: 30,
      elements: [
        { id: "A", kind: "pinned", position: 0 },
        { id: "B", kind: "roller", position: 6, angle: 0 },
        { id: "P", kind: "force", position: 3, magnitude: 10 },
      ],
    });
    if (!result.ok) throw new Error(result.message);
    near(itemAt(result.reactions, 0).rx, 0);
    near(itemAt(result.reactions, 0).ry, 5);
    near(itemAt(result.reactions, 1).rx, 0);
    near(itemAt(result.reactions, 1).ry, 5);
    near(result.equilibrium.sumFx, 0);
    near(result.equilibrium.sumFy, 0);
    near(result.equilibrium.sumMz, 0);
  });

  it("rejects a roller orientation that cannot resist beam rotation", () => {
    const result = analyzeBeam({
      length: 6,
      angle: 30,
      supports: [
        { id: "A", type: "pinned", x: 0 },
        { id: "B", type: "roller", x: 6, angle: -60 },
      ],
      forces: [{ id: "P", x: 3, fy: -10 }],
      couples: [],
      distributed: [],
    });
    expect(result).toMatchObject({ ok: false, code: "hypostatic" });
  });
});
