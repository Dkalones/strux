export interface FrameNode {
  id: string;
  x: number;
  y: number;
}

export interface FrameSupport {
  nodeId: string;
  ux: boolean;
  uy: boolean;
  rz: boolean;
  angle?: number;
}

export interface FramePointLoad {
  nodeId: string;
  fx: number;
  fy: number;
  mz: number;
  angle?: number;
}

export interface FrameElementProperties {
  E: number;
  A: number;
}

export interface FrameMember extends FrameElementProperties {
  id: string;
  kind: "frame";
  startNodeId: string;
  endNodeId: string;
  I: number;
  releaseStart?: boolean;
  releaseEnd?: boolean;
}

export interface TrussMember extends FrameElementProperties {
  id: string;
  kind: "truss";
  startNodeId: string;
  endNodeId: string;
}

export interface TieMember extends FrameElementProperties {
  id: string;
  kind: "tie";
  startNodeId: string;
  endNodeId: string;
}

export interface StrutMember extends FrameElementProperties {
  id: string;
  kind: "strut";
  startNodeId: string;
  endNodeId: string;
}

export type PlanarMember = FrameMember | TrussMember | TieMember | StrutMember;

/** qStart and qEnd are signed kN/m in the member's positive local-y direction. */
export interface LinearMemberLoad {
  id: string;
  memberId: string;
  qStart: number;
  qEnd: number;
  angle?: number;
}

export interface PlanarStructureModel {
  name: string;
  nodes: FrameNode[];
  members: PlanarMember[];
  supports: FrameSupport[];
  pointLoads: FramePointLoad[];
  linearLoads: LinearMemberLoad[];
}

export interface NodeDisplacement {
  nodeId: string;
  ux: number;
  uy: number;
  rz: number;
}

export interface NodeReaction {
  nodeId: string;
  fx: number;
  fy: number;
  mz: number;
}

export interface MemberEndForces {
  memberId: string;
  kind: PlanarMember["kind"];
  axialStart: number;
  shearStart: number;
  momentStart: number;
  axialEnd: number;
  shearEnd: number;
  momentEnd: number;
}

export interface PlanarAnalysisResult {
  ok: true;
  method: "direct-stiffness-2d";
  displacements: NodeDisplacement[];
  reactions: NodeReaction[];
  memberForces: MemberEndForces[];
  equilibrium: { sumFx: number; sumFy: number; sumMz: number };
}

export type PlanarAnalysisErrorCode = "invalid-input" | "unstable" | "unsupported";

export interface PlanarAnalysisError {
  ok: false;
  code: PlanarAnalysisErrorCode;
  message: string;
}

export type PlanarAnalysisOutcome = PlanarAnalysisResult | PlanarAnalysisError;
