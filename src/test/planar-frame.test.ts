import { describe, expect, it } from "vitest";
import {
  analyzePlanarStructure,
  hingedPortalExample,
  portalDistributedLoadsExample,
  portalExample,
  simplePortalExample,
  threeHingedPortalExample,
  trussExample,
} from "@/lib/structural";
import type { PlanarAnalysisResult, PlanarStructureModel } from "@/lib/structural/frame-types";

const TOL = 1e-8;
const itemAt = <T>(items: T[], index: number): T => {
  const item = items[index];
  if (item === undefined) throw new Error(`Missing test item at index ${index}`);
  return item;
};
const solve = (model: PlanarStructureModel): PlanarAnalysisResult => {
  const result = analyzePlanarStructure(model);
  if (!result.ok) throw new Error(result.message);
  return result;
};
const near = (actual: number, expected: number, tolerance = TOL) =>
  expect(
    Math.abs(actual - expected),
    `expected ${expected}; received ${actual}; abs error ${Math.abs(actual - expected)}; tolerance ${tolerance}`,
  ).toBeLessThan(tolerance);

describe("2D frame direct stiffness solver", () => {
  it("matches cantilever tip-force reactions, bending moment and deflection", () => {
    const model: PlanarStructureModel = {
      name: "Cantilever",
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 4, y: 0 },
      ],
      members: [
        {
          id: "AB",
          kind: "frame",
          startNodeId: "A",
          endNodeId: "B",
          E: 200_000_000,
          A: 0.02,
          I: 0.0001,
        },
      ],
      supports: [{ nodeId: "A", ux: true, uy: true, rz: true }],
      pointLoads: [{ nodeId: "B", fx: 0, fy: -10, mz: 0 }],
      linearLoads: [],
    };
    const result = solve(model);
    const reaction = itemAt(result.reactions, 0);
    const displacement = itemAt(result.displacements, 1);
    near(reaction.fy, 10);
    near(reaction.mz, 40);
    near(displacement.uy, (-10 * 4 ** 3) / (3 * 200_000_000 * 0.0001));
    near(displacement.rz, (-10 * 4 ** 2) / (2 * 200_000_000 * 0.0001));
    near(result.equilibrium.sumFy, 0);
    near(result.equilibrium.sumMz, 0);
  });

  it("solves a cantilever with triangular transverse distributed load", () => {
    const model: PlanarStructureModel = {
      name: "Carga triangular",
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 3, y: 0 },
      ],
      members: [
        {
          id: "AB",
          kind: "frame",
          startNodeId: "A",
          endNodeId: "B",
          E: 200_000_000,
          A: 0.02,
          I: 0.0002,
        },
      ],
      supports: [{ nodeId: "A", ux: true, uy: true, rz: true }],
      pointLoads: [],
      linearLoads: [{ id: "q", memberId: "AB", qStart: 0, qEnd: -4 }],
    };
    const result = solve(model);
    near(itemAt(result.reactions, 0).fy, 6);
    near(itemAt(result.reactions, 0).mz, 12);
    near(result.equilibrium.sumFy, 0);
    near(result.equilibrium.sumMz, 0);
  });

  it("solves an axial-only truss bar and reports its free-node displacement", () => {
    const model: PlanarStructureModel = {
      name: "Barra tracionada",
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 4, y: 0 },
      ],
      members: [
        { id: "AB", kind: "truss", startNodeId: "A", endNodeId: "B", E: 200_000_000, A: 0.01 },
      ],
      supports: [
        { nodeId: "A", ux: true, uy: true, rz: false },
        { nodeId: "B", ux: false, uy: true, rz: false },
      ],
      pointLoads: [{ nodeId: "B", fx: 10, fy: 0, mz: 0 }],
      linearLoads: [],
    };
    const result = solve(model);
    near(itemAt(result.displacements, 1).ux, (10 * 4) / (200_000_000 * 0.01));
    near(itemAt(result.reactions, 0).fx, -10);
    near(itemAt(result.memberForces, 0).axialStart, 10);
    near(result.equilibrium.sumFx, 0);
  });

  it("rotates support restraint axes and returns global reactions", () => {
    const model: PlanarStructureModel = {
      name: "Roletes orientados",
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 4, y: 0 },
      ],
      members: [
        { id: "AB", kind: "truss", startNodeId: "A", endNodeId: "B", E: 200_000_000, A: 0.01 },
      ],
      supports: [
        { nodeId: "A", ux: true, uy: true, rz: false },
        { nodeId: "B", ux: true, uy: false, rz: false, angle: 90 },
      ],
      pointLoads: [{ nodeId: "B", fx: 0, fy: -10, mz: 0 }],
      linearLoads: [],
    };
    const result = solve(model);
    near(itemAt(result.reactions, 1).fy, 10);
    near(result.equilibrium.sumFy, 0);
    near(result.equilibrium.sumMz, 0);
  });

  it("rotates nodal load components by their global direction angle", () => {
    const model: PlanarStructureModel = {
      name: "Carga inclinada",
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 4, y: 0 },
      ],
      members: [
        { id: "AB", kind: "truss", startNodeId: "A", endNodeId: "B", E: 200_000_000, A: 0.01 },
      ],
      supports: [
        { nodeId: "A", ux: true, uy: true, rz: false },
        { nodeId: "B", ux: false, uy: true, rz: false },
      ],
      pointLoads: [{ nodeId: "B", fx: 10, fy: 0, mz: 0, angle: 90 }],
      linearLoads: [],
    };
    const result = solve(model);
    near(itemAt(result.reactions, 0).fx, 0);
    near(itemAt(result.reactions, 1).fy, -10);
    near(result.equilibrium.sumFx, 0);
    near(result.equilibrium.sumFy, 0);
  });

  it("supports globally oriented axial distributed loads on frame members", () => {
    const model: PlanarStructureModel = {
      name: "Carga distribuída axial",
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 4, y: 0 },
      ],
      members: [
        {
          id: "AB",
          kind: "frame",
          startNodeId: "A",
          endNodeId: "B",
          E: 200_000_000,
          A: 0.02,
          I: 0.0001,
        },
      ],
      supports: [{ nodeId: "A", ux: true, uy: true, rz: true }],
      pointLoads: [],
      linearLoads: [{ id: "q", memberId: "AB", qStart: 2, qEnd: 2, angle: 0 }],
    };
    const result = solve(model);
    near(itemAt(result.reactions, 0).fx, -8);
    near(result.equilibrium.sumFx, 0);
    near(result.equilibrium.sumMz, 0);
  });

  it("releases the end moment at an internal frame hinge", () => {
    const model: PlanarStructureModel = {
      name: "Viga com rótula",
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 4, y: 0 },
      ],
      members: [
        {
          id: "AB",
          kind: "frame",
          startNodeId: "A",
          endNodeId: "B",
          E: 200_000_000,
          A: 0.02,
          I: 0.0001,
          releaseEnd: true,
        },
      ],
      supports: [{ nodeId: "A", ux: true, uy: true, rz: true }],
      pointLoads: [{ nodeId: "B", fx: 0, fy: -10, mz: 0 }],
      linearLoads: [],
    };
    const result = solve(model);
    near(itemAt(result.memberForces, 0).momentEnd, 0);
    near(itemAt(result.reactions, 0).fy, 10);
    near(itemAt(result.reactions, 0).mz, 40);
    near(result.equilibrium.sumMz, 0);
  });

  it("activates tension-only ties and compression-only struts", () => {
    const model: PlanarStructureModel = {
      name: "Tirante e escora",
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 4, y: 0 },
      ],
      members: [
        { id: "T", kind: "tie", startNodeId: "A", endNodeId: "B", E: 200_000_000, A: 0.01 },
        { id: "S", kind: "strut", startNodeId: "A", endNodeId: "B", E: 200_000_000, A: 0.01 },
      ],
      supports: [
        { nodeId: "A", ux: true, uy: true, rz: false },
        { nodeId: "B", ux: false, uy: true, rz: false },
      ],
      pointLoads: [{ nodeId: "B", fx: 10, fy: 0, mz: 0 }],
      linearLoads: [],
    };
    const tension = solve(model);
    near(itemAt(tension.memberForces, 0).axialStart, 10);
    near(itemAt(tension.memberForces, 1).axialStart, 0);
    near(tension.equilibrium.sumFx, 0);

    const compression = solve({
      ...model,
      pointLoads: [{ nodeId: "B", fx: -10, fy: 0, mz: 0 }],
    });
    near(itemAt(compression.memberForces, 0).axialStart, 0);
    near(itemAt(compression.memberForces, 1).axialStart, -10);
    near(compression.equilibrium.sumFx, 0);
  });

  it("analyzes the portal-frame and triangular-truss editor examples", () => {
    const portal = solve(portalExample());
    expect(portal.method).toBe("direct-stiffness-2d");
    expect(portal.memberForces).toHaveLength(3);
    near(
      portal.reactions.reduce((sum, reaction) => sum + reaction.fy, 0),
      20,
    );
    near(portal.equilibrium.sumFy, 0);
    near(portal.equilibrium.sumMz, 0);

    const truss = solve(trussExample());
    expect(truss.memberForces.every((force) => force.kind === "truss")).toBe(true);
    near(
      truss.reactions.reduce((sum, reaction) => sum + reaction.fy, 0),
      10,
    );
    near(truss.equilibrium.sumFy, 0);
    near(truss.equilibrium.sumMz, 0);

    const threeHinged = solve(threeHingedPortalExample());
    near(itemAt(threeHinged.memberForces, 1).momentEnd, 0);
    near(itemAt(threeHinged.memberForces, 2).momentStart, 0);
    near(threeHinged.equilibrium.sumFy, 0);
    near(threeHinged.equilibrium.sumMz, 0);
    expect(solve(simplePortalExample()).memberForces).toHaveLength(3);
    expect(itemAt(solve(hingedPortalExample()).memberForces, 3).kind).toBe("strut");
  });

  it("solves the portal with triangular roof load, lateral column loads, and a point load", () => {
    const model = portalDistributedLoadsExample();
    const result = solve(model);
    expect(model.linearLoads).toHaveLength(5);
    expect(result.memberForces).toHaveLength(5);
    near(itemAt(result.reactions, 0).fx, -1);
    near(itemAt(result.reactions, 0).fy, 23 / 12);
    near(itemAt(result.reactions, 5).fy, 29 / 6);
    near(result.equilibrium.sumFx, 0);
    near(result.equilibrium.sumFy, 0);
    near(result.equilibrium.sumMz, 0);
  });

  it("rejects unstable structures and invalid distributed loads explicitly", () => {
    const unstable: PlanarStructureModel = {
      name: "Instável",
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 2, y: 0 },
      ],
      members: [
        {
          id: "AB",
          kind: "frame",
          startNodeId: "A",
          endNodeId: "B",
          E: 200_000_000,
          A: 0.02,
          I: 0.0001,
        },
      ],
      supports: [{ nodeId: "A", ux: true, uy: true, rz: false }],
      pointLoads: [],
      linearLoads: [],
    };
    expect(analyzePlanarStructure(unstable)).toMatchObject({ ok: false, code: "unstable" });
    expect(
      analyzePlanarStructure({
        ...unstable,
        supports: [{ nodeId: "A", ux: true, uy: true, rz: true }],
        members: [
          { id: "AB", kind: "truss", startNodeId: "A", endNodeId: "B", E: 200_000_000, A: 0.02 },
        ],
        linearLoads: [{ id: "q", memberId: "AB", qStart: -2, qEnd: 0 }],
      }),
    ).toMatchObject({ ok: false, code: "unsupported" });
  });

  it("handles a fully restrained frame without a singular empty free-DOF system", () => {
    const model: PlanarStructureModel = {
      name: "Barra bi-engastada",
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 2, y: 0 },
      ],
      members: [
        {
          id: "AB",
          kind: "frame",
          startNodeId: "A",
          endNodeId: "B",
          E: 200_000_000,
          A: 0.02,
          I: 0.0001,
        },
      ],
      supports: [
        { nodeId: "A", ux: true, uy: true, rz: true },
        { nodeId: "B", ux: true, uy: true, rz: true },
      ],
      pointLoads: [{ nodeId: "B", fx: 0, fy: -8, mz: 0 }],
      linearLoads: [],
    };
    const result = solve(model);
    near(itemAt(result.displacements, 1).uy, 0);
    near(
      result.reactions.reduce((sum, reaction) => sum + reaction.fy, 0),
      8,
    );
    near(result.equilibrium.sumFy, 0);
    near(result.equilibrium.sumMz, 0);
  });
});
