import type { PlanarStructureModel } from "./frame-types";

const STEEL_E = 200_000_000;
const DEFAULT_AREA = 0.02;
const DEFAULT_INERTIA = 0.0002;

export function portalExample(): PlanarStructureModel {
  return {
    name: "Pórtico plano",
    nodes: [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 0, y: 3 },
      { id: "C", x: 4, y: 3 },
      { id: "D", x: 4, y: 0 },
    ],
    members: [
      {
        id: "AB",
        kind: "frame",
        startNodeId: "A",
        endNodeId: "B",
        E: STEEL_E,
        A: DEFAULT_AREA,
        I: DEFAULT_INERTIA,
      },
      {
        id: "BC",
        kind: "frame",
        startNodeId: "B",
        endNodeId: "C",
        E: STEEL_E,
        A: DEFAULT_AREA,
        I: DEFAULT_INERTIA,
      },
      {
        id: "CD",
        kind: "frame",
        startNodeId: "C",
        endNodeId: "D",
        E: STEEL_E,
        A: DEFAULT_AREA,
        I: DEFAULT_INERTIA,
      },
    ],
    supports: [
      { nodeId: "A", ux: true, uy: true, rz: true },
      { nodeId: "D", ux: true, uy: true, rz: true },
    ],
    pointLoads: [],
    linearLoads: [{ id: "q1", memberId: "BC", qStart: 0, qEnd: -10 }],
  };
}

export function portalDistributedLoadsExample(): PlanarStructureModel {
  const frameMember = (id: string, startNodeId: string, endNodeId: string) => ({
    id,
    kind: "frame" as const,
    startNodeId,
    endNodeId,
    E: STEEL_E,
    A: DEFAULT_AREA,
    I: DEFAULT_INERTIA,
  });
  return {
    name: "Pórtico com cargas triangulares e laterais",
    nodes: [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 0, y: 1.5 },
      { id: "C", x: 0, y: 3 },
      { id: "D", x: 4.5, y: 3 },
      { id: "E", x: 4.5, y: 1.5 },
      { id: "F", x: 4.5, y: 0 },
    ],
    members: [
      frameMember("AB", "A", "B"),
      frameMember("BC", "B", "C"),
      frameMember("CD", "C", "D"),
      frameMember("DE", "D", "E"),
      frameMember("EF", "E", "F"),
    ],
    supports: [
      { nodeId: "A", ux: true, uy: true, rz: false },
      { nodeId: "F", ux: false, uy: true, rz: false },
    ],
    pointLoads: [{ nodeId: "E", fx: -2, fy: 0, mz: 0 }],
    linearLoads: [
      { id: "q1", memberId: "AB", qStart: 2, qEnd: 2, angle: 0 },
      { id: "q2", memberId: "BC", qStart: 2, qEnd: 2, angle: 0 },
      { id: "q3", memberId: "CD", qStart: 0, qEnd: 3, angle: 270 },
      { id: "q4", memberId: "DE", qStart: 1, qEnd: 1, angle: 180 },
      { id: "q5", memberId: "EF", qStart: 1, qEnd: 1, angle: 180 },
    ],
  };
}

export function trussExample(): PlanarStructureModel {
  return {
    name: "Treliça triangular",
    nodes: [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 4, y: 0 },
      { id: "C", x: 2, y: 3 },
    ],
    members: [
      { id: "AB", kind: "truss", startNodeId: "A", endNodeId: "B", E: STEEL_E, A: DEFAULT_AREA },
      { id: "AC", kind: "truss", startNodeId: "A", endNodeId: "C", E: STEEL_E, A: DEFAULT_AREA },
      { id: "BC", kind: "truss", startNodeId: "B", endNodeId: "C", E: STEEL_E, A: DEFAULT_AREA },
    ],
    supports: [
      { nodeId: "A", ux: true, uy: true, rz: false },
      { nodeId: "B", ux: false, uy: true, rz: false },
    ],
    pointLoads: [{ nodeId: "C", fx: 0, fy: -10, mz: 0 }],
    linearLoads: [],
  };
}

export function simplePortalExample(): PlanarStructureModel {
  const model = portalExample();
  return {
    ...model,
    name: "Pórtico simples",
    supports: [
      { nodeId: "A", ux: true, uy: true, rz: false },
      { nodeId: "D", ux: false, uy: true, rz: false },
    ],
  };
}

export function threeHingedPortalExample(): PlanarStructureModel {
  return {
    name: "Pórtico triarticulado",
    nodes: [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 0, y: 3 },
      { id: "C", x: 2, y: 4 },
      { id: "D", x: 4, y: 3 },
      { id: "E", x: 4, y: 0 },
    ],
    members: [
      {
        id: "AB",
        kind: "frame",
        startNodeId: "A",
        endNodeId: "B",
        E: STEEL_E,
        A: DEFAULT_AREA,
        I: DEFAULT_INERTIA,
      },
      {
        id: "BC",
        kind: "frame",
        startNodeId: "B",
        endNodeId: "C",
        E: STEEL_E,
        A: DEFAULT_AREA,
        I: DEFAULT_INERTIA,
        releaseEnd: true,
      },
      {
        id: "CD",
        kind: "frame",
        startNodeId: "C",
        endNodeId: "D",
        E: STEEL_E,
        A: DEFAULT_AREA,
        I: DEFAULT_INERTIA,
        releaseStart: true,
      },
      {
        id: "DE",
        kind: "frame",
        startNodeId: "D",
        endNodeId: "E",
        E: STEEL_E,
        A: DEFAULT_AREA,
        I: DEFAULT_INERTIA,
      },
    ],
    supports: [
      { nodeId: "A", ux: true, uy: true, rz: false },
      { nodeId: "E", ux: true, uy: true, rz: false },
    ],
    pointLoads: [{ nodeId: "C", fx: 0, fy: -10, mz: 0 }],
    linearLoads: [],
  };
}

export function hingedPortalExample(): PlanarStructureModel {
  return {
    name: "Pórtico rotulado com escora",
    nodes: [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 0, y: 3 },
      { id: "C", x: 4, y: 3 },
      { id: "D", x: 4, y: 0 },
    ],
    members: [
      {
        id: "AB",
        kind: "frame",
        startNodeId: "A",
        endNodeId: "B",
        E: STEEL_E,
        A: DEFAULT_AREA,
        I: DEFAULT_INERTIA,
        releaseStart: true,
        releaseEnd: true,
      },
      {
        id: "BC",
        kind: "frame",
        startNodeId: "B",
        endNodeId: "C",
        E: STEEL_E,
        A: DEFAULT_AREA,
        I: DEFAULT_INERTIA,
        releaseStart: true,
        releaseEnd: true,
      },
      {
        id: "CD",
        kind: "frame",
        startNodeId: "C",
        endNodeId: "D",
        E: STEEL_E,
        A: DEFAULT_AREA,
        I: DEFAULT_INERTIA,
        releaseStart: true,
        releaseEnd: true,
      },
      {
        id: "AC",
        kind: "strut",
        startNodeId: "A",
        endNodeId: "C",
        E: STEEL_E,
        A: DEFAULT_AREA,
      },
    ],
    supports: [
      { nodeId: "A", ux: true, uy: true, rz: false },
      { nodeId: "D", ux: true, uy: true, rz: false },
    ],
    pointLoads: [{ nodeId: "C", fx: 0, fy: -10, mz: 0 }],
    linearLoads: [],
  };
}
