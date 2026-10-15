import type {
  FrameNode,
  FramePointLoad,
  FrameSupport,
  LinearMemberLoad,
  MemberEndForces,
  NodeDisplacement,
  NodeReaction,
  PlanarAnalysisError,
  PlanarAnalysisOutcome,
  PlanarMember,
  PlanarStructureModel,
} from "./frame-types";

type Geometry = { length: number; c: number; s: number };

interface MemberSystem {
  member: PlanarMember;
  dofs: number[];
  transform: number[][];
  localStiffness: number[][];
  localLoads: number[];
}

const FAILURE_PIVOT_TOLERANCE = 1e-12;

function error(code: PlanarAnalysisError["code"], message: string): PlanarAnalysisError {
  return { ok: false, code, message };
}

function zeroMatrix(size: number): number[][] {
  return Array.from({ length: size }, () => Array<number>(size).fill(0));
}

function rotateVector(x: number, y: number, angle: number): [number, number] {
  const radians = (angle * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [cosine * x - sine * y, sine * x + cosine * y];
}

function addVector(target: number[], source: number[], indices: number[]) {
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i];
    const value = source[i];
    if (index !== undefined && value !== undefined) target[index] = (target[index] ?? 0) + value;
  }
}

function addMatrix(target: number[][], source: number[][], indices: number[]) {
  for (let i = 0; i < indices.length; i++) {
    const row = indices[i];
    const sourceRow = source[i];
    if (row === undefined || !sourceRow) continue;
    for (let j = 0; j < indices.length; j++) {
      const column = indices[j];
      const value = sourceRow[j];
      if (column !== undefined && value !== undefined) {
        const targetRow = target[row];
        if (targetRow) targetRow[column] = (targetRow[column] ?? 0) + value;
      }
    }
  }
}

function transpose(matrix: number[][]): number[][] {
  return matrix[0]?.map((_, column) => matrix.map((row) => row[column] ?? 0)) ?? [];
}

function multiply(left: number[][], right: number[][]): number[][] {
  const result = zeroMatrix(left.length);
  for (let i = 0; i < left.length; i++) {
    const resultRow = result[i];
    const leftRow = left[i];
    if (!resultRow || !leftRow) continue;
    for (let k = 0; k < right.length; k++) {
      const factor = leftRow[k] ?? 0;
      const rightRow = right[k];
      if (!rightRow) continue;
      for (let j = 0; j < rightRow.length; j++) {
        resultRow[j] = (resultRow[j] ?? 0) + factor * (rightRow[j] ?? 0);
      }
    }
  }
  return result;
}

function multiplyVector(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0),
  );
}

function validateModel(model: PlanarStructureModel): PlanarAnalysisError | null {
  if (model.nodes.length < 2 || model.members.length === 0) {
    return error("invalid-input", "A estrutura precisa ter pelo menos dois nós e uma barra.");
  }
  const nodes = new Map<string, FrameNode>();
  for (const node of model.nodes) {
    if (!node.id || nodes.has(node.id) || !Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      return error("invalid-input", "Há nós com identificador duplicado ou coordenadas inválidas.");
    }
    nodes.set(node.id, node);
  }
  const memberIds = new Set<string>();
  for (const member of model.members) {
    if (!member.id || memberIds.has(member.id))
      return error("invalid-input", "Há barras com identificador duplicado.");
    memberIds.add(member.id);
    const start = nodes.get(member.startNodeId);
    const end = nodes.get(member.endNodeId);
    if (!start || !end || start.id === end.id)
      return error("invalid-input", `A barra ${member.id} referencia nós inválidos.`);
    if (![member.E, member.A].every(Number.isFinite) || member.E <= 0 || member.A <= 0) {
      return error("invalid-input", `A barra ${member.id} precisa de E e A positivos.`);
    }
    if (member.kind === "frame" && (!Number.isFinite(member.I) || member.I <= 0)) {
      return error(
        "invalid-input",
        `A barra de pórtico ${member.id} precisa de inércia I positiva.`,
      );
    }
    if (Math.hypot(end.x - start.x, end.y - start.y) <= 1e-12) {
      return error("invalid-input", `A barra ${member.id} tem comprimento nulo.`);
    }
  }
  const supportNodes = new Set<string>();
  for (const support of model.supports) {
    if (
      !nodes.has(support.nodeId) ||
      supportNodes.has(support.nodeId) ||
      (support.angle !== undefined && !Number.isFinite(support.angle)) ||
      !(support.ux || support.uy || support.rz)
    ) {
      return error(
        "invalid-input",
        "Há vínculos sem nó, duplicados ou sem graus de liberdade restringidos.",
      );
    }
    supportNodes.add(support.nodeId);
  }
  for (const load of model.pointLoads) {
    if (
      !nodes.has(load.nodeId) ||
      ![load.fx, load.fy, load.mz].every(Number.isFinite) ||
      (load.angle !== undefined && !Number.isFinite(load.angle))
    ) {
      return error("invalid-input", "Há cargas nodais inválidas.");
    }
  }
  const loadIds = new Set<string>();
  for (const load of model.linearLoads) {
    if (
      !load.id ||
      loadIds.has(load.id) ||
      !memberIds.has(load.memberId) ||
      ![load.qStart, load.qEnd].every(Number.isFinite) ||
      (load.angle !== undefined && !Number.isFinite(load.angle))
    ) {
      return error(
        "invalid-input",
        "Há cargas distribuídas inválidas ou associadas a barras inexistentes.",
      );
    }
    if (model.members.find((member) => member.id === load.memberId)?.kind !== "frame") {
      return error(
        "unsupported",
        "Carga distribuída transversal só está disponível em barras de pórtico; barras de treliça recebem cargas nodais.",
      );
    }
    loadIds.add(load.id);
  }
  return null;
}

function getLocalStiffness(member: PlanarMember, length: number): number[][] {
  const axial = (member.E * member.A) / length;
  if (member.kind !== "frame") {
    return [
      [axial, 0, 0, -axial, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [-axial, 0, 0, axial, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ];
  }
  const flexural = member.E * member.I;
  const a = (12 * flexural) / length ** 3;
  const b = (6 * flexural) / length ** 2;
  const c = (4 * flexural) / length;
  const d = (2 * flexural) / length;
  return [
    [axial, 0, 0, -axial, 0, 0],
    [0, a, b, 0, -a, b],
    [0, b, c, 0, -b, d],
    [-axial, 0, 0, axial, 0, 0],
    [0, -a, -b, 0, a, -b],
    [0, b, d, 0, -b, c],
  ];
}

function getTransform(c: number, s: number): number[][] {
  return [
    [c, s, 0, 0, 0, 0],
    [-s, c, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, c, s, 0],
    [0, 0, 0, -s, c, 0],
    [0, 0, 0, 0, 0, 1],
  ];
}

function equivalentLinearLoad(
  length: number,
  qStart: number,
  qEnd: number,
  qxStart: number,
  qxEnd: number,
): number[] {
  return [
    (length * (2 * qxStart + qxEnd)) / 6,
    (length * (7 * qStart + 3 * qEnd)) / 20,
    (length ** 2 * (3 * qStart + 2 * qEnd)) / 60,
    (length * (qxStart + 2 * qxEnd)) / 6,
    (length * (3 * qStart + 7 * qEnd)) / 20,
    (-(length ** 2) * (2 * qStart + 3 * qEnd)) / 60,
  ];
}

function supportCoordinateTransform(
  model: PlanarStructureModel,
  nodeDofs: Map<string, number[]>,
  dofCount: number,
): number[][] {
  const transform = zeroMatrix(dofCount);
  for (let dof = 0; dof < dofCount; dof++) {
    const row = transform[dof];
    if (row) row[dof] = 1;
  }
  for (const support of model.supports) {
    const dofs = nodeDofs.get(support.nodeId);
    if (!dofs) continue;
    const radians = ((support.angle ?? 0) * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const ux = dofs[0];
    const uy = dofs[1];
    if (ux === undefined || uy === undefined) continue;
    const uxRow = transform[ux];
    const uyRow = transform[uy];
    if (!uxRow || !uyRow) continue;
    uxRow[ux] = cosine;
    uxRow[uy] = sine;
    uyRow[ux] = -sine;
    uyRow[uy] = cosine;
  }
  return transform;
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const size = vector.length;
  if (size === 0) return [];
  const augmented = matrix.map((row, index) => [...row, vector[index] ?? 0]);
  let scale = 0;
  for (const row of matrix) for (const value of row) scale = Math.max(scale, Math.abs(value));
  if (scale === 0) return null;
  const tolerance = scale * FAILURE_PIVOT_TOLERANCE;

  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(augmented[row]?.[column] ?? 0) > Math.abs(augmented[pivot]?.[column] ?? 0))
        pivot = row;
    }
    const pivotRow = augmented[pivot];
    if (!pivotRow || Math.abs(pivotRow[column] ?? 0) <= tolerance) return null;
    [augmented[column], augmented[pivot]] = [pivotRow, augmented[column] ?? []];
    const activeRow = augmented[column];
    if (!activeRow) return null;
    const pivotValue = activeRow[column] ?? 0;
    for (let j = column; j <= size; j++) activeRow[j] = (activeRow[j] ?? 0) / pivotValue;
    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const targetRow = augmented[row];
      if (!targetRow) continue;
      const factor = targetRow[column] ?? 0;
      for (let j = column; j <= size; j++)
        targetRow[j] = (targetRow[j] ?? 0) - factor * (activeRow[j] ?? 0);
    }
  }
  return augmented.map((row) => row[size] ?? 0);
}

function memberGlobalDofs(member: PlanarMember, nodeDofs: Map<string, number[]>): number[] | null {
  const start = nodeDofs.get(member.startNodeId);
  const end = nodeDofs.get(member.endNodeId);
  if (!start || !end) return null;
  return [...start, ...end];
}

function getMemberGeometry(member: PlanarMember, nodes: Map<string, FrameNode>): Geometry | null {
  const start = nodes.get(member.startNodeId);
  const end = nodes.get(member.endNodeId);
  if (!start || !end) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  return { length, c: dx / length, s: dy / length };
}

function nodeAt(model: PlanarStructureModel, nodeId: string): FrameNode {
  const node = model.nodes.find((item) => item.id === nodeId);
  if (!node) throw new Error(`Validated node ${nodeId} was not found.`);
  return node;
}

function globalLoadResultants(model: PlanarStructureModel): { fx: number; fy: number; mz: number } {
  let fx = 0;
  let fy = 0;
  let mz = 0;
  for (const load of model.pointLoads) {
    const node = nodeAt(model, load.nodeId);
    const [loadFx, loadFy] = rotateVector(load.fx, load.fy, load.angle ?? 0);
    fx += loadFx;
    fy += loadFy;
    mz += node.x * loadFy - node.y * loadFx + load.mz;
  }
  for (const load of model.linearLoads) {
    const member = model.members.find((item) => item.id === load.memberId);
    if (!member || member.kind !== "frame") continue;
    const start = nodeAt(model, member.startNodeId);
    const geometry = getMemberGeometry(member, new Map(model.nodes.map((node) => [node.id, node])));
    if (!geometry) continue;
    const { length, c, s } = geometry;
    const direction =
      load.angle === undefined
        ? [-s, c]
        : [Math.cos((load.angle * Math.PI) / 180), Math.sin((load.angle * Math.PI) / 180)];
    const averageForce = (length * (load.qStart + load.qEnd)) / 2;
    const globalFx = (direction[0] ?? 0) * averageForce;
    const globalFy = (direction[1] ?? 0) * averageForce;
    const localMoment =
      (length ** 2 *
        (c * (direction[1] ?? 0) - s * (direction[0] ?? 0)) *
        (load.qStart + 2 * load.qEnd)) /
      6;
    fx += globalFx;
    fy += globalFy;
    mz += start.x * globalFy - start.y * globalFx + localMoment;
  }
  return { fx, fy, mz };
}

function solvePlanarStructure(
  model: PlanarStructureModel,
  activeUnilateralMembers: Set<string>,
): PlanarAnalysisOutcome {
  const invalid = validateModel(model);
  if (invalid) return invalid;

  const rotationActiveNodes = new Set<string>();
  for (const member of model.members) {
    if (member.kind !== "frame") continue;
    if (!member.releaseStart) rotationActiveNodes.add(member.startNodeId);
    if (!member.releaseEnd) rotationActiveNodes.add(member.endNodeId);
  }
  const nodeDofs = new Map<string, number[]>();
  let dofCount = 0;
  for (const node of model.nodes) {
    nodeDofs.set(node.id, [dofCount++, dofCount++, dofCount++]);
  }
  const releasedRotationDofs = new Map<string, number>();
  for (const member of model.members) {
    if (member.kind !== "frame") continue;
    if (member.releaseStart) releasedRotationDofs.set(`${member.id}:start`, dofCount++);
    if (member.releaseEnd) releasedRotationDofs.set(`${member.id}:end`, dofCount++);
  }

  const stiffness = zeroMatrix(dofCount);
  const loads = Array<number>(dofCount).fill(0);
  for (const load of model.pointLoads) {
    const dofs = nodeDofs.get(load.nodeId);
    if (!dofs) continue;
    const fxDof = dofs[0];
    const fyDof = dofs[1];
    const rzDof = dofs[2];
    const [loadFx, loadFy] = rotateVector(load.fx, load.fy, load.angle ?? 0);
    if (fxDof !== undefined) loads[fxDof] = (loads[fxDof] ?? 0) + loadFx;
    if (fyDof !== undefined) loads[fyDof] = (loads[fyDof] ?? 0) + loadFy;
    if (load.mz !== 0 && !rotationActiveNodes.has(load.nodeId))
      return error(
        "unsupported",
        `O nó ${load.nodeId} não tem rotação ativa para receber momento nodal.`,
      );
    if (rzDof !== undefined && rotationActiveNodes.has(load.nodeId))
      loads[rzDof] = (loads[rzDof] ?? 0) + load.mz;
  }

  const loadByMember = new Map<string, LinearMemberLoad[]>();
  for (const load of model.linearLoads) {
    const list = loadByMember.get(load.memberId) ?? [];
    list.push(load);
    loadByMember.set(load.memberId, list);
  }
  const memberSystems: MemberSystem[] = [];
  for (const member of model.members) {
    if (
      (member.kind === "tie" || member.kind === "strut") &&
      !activeUnilateralMembers.has(member.id)
    )
      continue;
    const geometry = getMemberGeometry(member, new Map(model.nodes.map((node) => [node.id, node])));
    const dofs = memberGlobalDofs(member, nodeDofs);
    if (!geometry || !dofs)
      return error("invalid-input", `Não foi possível montar a barra ${member.id}.`);
    if (member.kind === "frame") {
      if (member.releaseStart) {
        const dof = releasedRotationDofs.get(`${member.id}:start`);
        if (dof !== undefined) dofs[2] = dof;
      }
      if (member.releaseEnd) {
        const dof = releasedRotationDofs.get(`${member.id}:end`);
        if (dof !== undefined) dofs[5] = dof;
      }
    }
    const transform = getTransform(geometry.c, geometry.s);
    const localStiffness = getLocalStiffness(member, geometry.length);
    const globalStiffness = multiply(multiply(transpose(transform), localStiffness), transform);
    addMatrix(stiffness, globalStiffness, dofs);

    const localLoads = Array<number>(6).fill(0);
    for (const distributed of loadByMember.get(member.id) ?? []) {
      const globalDirection =
        distributed.angle === undefined
          ? [-geometry.s, geometry.c]
          : [
              Math.cos((distributed.angle * Math.PI) / 180),
              Math.sin((distributed.angle * Math.PI) / 180),
            ];
      const localX =
        geometry.c * (globalDirection[0] ?? 0) + geometry.s * (globalDirection[1] ?? 0);
      const localY =
        -geometry.s * (globalDirection[0] ?? 0) + geometry.c * (globalDirection[1] ?? 0);
      const equivalent = equivalentLinearLoad(
        geometry.length,
        distributed.qStart * localY,
        distributed.qEnd * localY,
        distributed.qStart * localX,
        distributed.qEnd * localX,
      );
      for (let i = 0; i < localLoads.length; i++)
        localLoads[i] = (localLoads[i] ?? 0) + (equivalent[i] ?? 0);
    }
    addVector(loads, multiplyVector(transpose(transform), localLoads), dofs);
    memberSystems.push({ member, dofs, transform, localStiffness, localLoads });
  }

  const supportTransform = supportCoordinateTransform(model, nodeDofs, dofCount);
  const analysisStiffness = multiply(
    multiply(supportTransform, stiffness),
    transpose(supportTransform),
  );
  const analysisLoads = multiplyVector(supportTransform, loads);
  const restrained = new Set<number>();
  for (const node of model.nodes) {
    if (!rotationActiveNodes.has(node.id)) {
      const rotation = nodeDofs.get(node.id)?.[2];
      if (rotation !== undefined) restrained.add(rotation);
    }
  }
  for (const support of model.supports) {
    const dofs = nodeDofs.get(support.nodeId);
    if (!dofs) continue;
    if (support.ux && dofs[0] !== undefined) restrained.add(dofs[0]);
    if (support.uy && dofs[1] !== undefined) restrained.add(dofs[1]);
    if (support.rz) {
      const rotation = dofs[2];
      if (!rotationActiveNodes.has(support.nodeId))
        return error(
          "unsupported",
          `O nó ${support.nodeId} pertence apenas a barras de treliça e não possui rotação restringível.`,
        );
      if (rotation === undefined)
        return error("invalid-input", `Não foi possível montar a rotação do nó ${support.nodeId}.`);
      restrained.add(rotation);
    }
  }
  const freeDofs = Array.from({ length: dofCount }, (_, index) => index).filter(
    (index) => !restrained.has(index),
  );
  const reducedStiffness = freeDofs.map((row) =>
    freeDofs.map((column) => analysisStiffness[row]?.[column] ?? 0),
  );
  const reducedLoads = freeDofs.map((index) => analysisLoads[index] ?? 0);
  const freeDisplacements = solveLinearSystem(reducedStiffness, reducedLoads);
  if (!freeDisplacements) {
    return error(
      "unstable",
      "A estrutura é instável ou possui graus de liberdade sem rigidez. Verifique os vínculos, a conectividade e a geometria.",
    );
  }

  const localDisplacements = Array<number>(dofCount).fill(0);
  freeDofs.forEach((dof, index) => {
    localDisplacements[dof] = freeDisplacements[index] ?? 0;
  });
  const displacements = multiplyVector(transpose(supportTransform), localDisplacements);
  const residual = stiffness.map((row) =>
    row.reduce((sum, value, index) => sum + value * (displacements[index] ?? 0), 0),
  );
  residual.forEach((value, index) => {
    residual[index] = value - (loads[index] ?? 0);
  });

  const reactions: NodeReaction[] = model.nodes.map((node) => {
    const support = model.supports.find((item) => item.nodeId === node.id);
    const dofs = nodeDofs.get(node.id) ?? [];
    const hasTranslationRestraint = support?.ux || support?.uy;
    return {
      nodeId: node.id,
      fx: hasTranslationRestraint ? (residual[dofs[0] ?? -1] ?? 0) : 0,
      fy: hasTranslationRestraint ? (residual[dofs[1] ?? -1] ?? 0) : 0,
      mz: support?.rz ? (residual[dofs[2] ?? -1] ?? 0) : 0,
    };
  });
  const nodeDisplacements: NodeDisplacement[] = model.nodes.map((node) => {
    const dofs = nodeDofs.get(node.id) ?? [];
    return {
      nodeId: node.id,
      ux: displacements[dofs[0] ?? -1] ?? 0,
      uy: displacements[dofs[1] ?? -1] ?? 0,
      rz: rotationActiveNodes.has(node.id) ? (displacements[dofs[2] ?? -1] ?? 0) : 0,
    };
  });
  const activeMemberForces = new Map<string, MemberEndForces>();
  for (const system of memberSystems) {
    const localDisplacement = multiplyVector(
      system.transform,
      system.dofs.map((dof) => displacements[dof] ?? 0),
    );
    const endActions = multiplyVector(system.localStiffness, localDisplacement).map(
      (value, index) => value - (system.localLoads[index] ?? 0),
    );
    activeMemberForces.set(system.member.id, {
      memberId: system.member.id,
      kind: system.member.kind,
      axialStart: -(endActions[0] ?? 0),
      shearStart: endActions[1] ?? 0,
      momentStart: endActions[2] ?? 0,
      axialEnd: endActions[3] ?? 0,
      shearEnd: endActions[4] ?? 0,
      momentEnd: endActions[5] ?? 0,
    });
  }
  const memberForces = model.members.map(
    (member) =>
      activeMemberForces.get(member.id) ?? {
        memberId: member.id,
        kind: member.kind,
        axialStart: 0,
        shearStart: 0,
        momentStart: 0,
        axialEnd: 0,
        shearEnd: 0,
        momentEnd: 0,
      },
  );

  const applied = globalLoadResultants(model);
  let sumFx = applied.fx;
  let sumFy = applied.fy;
  let sumMz = applied.mz;
  for (const reaction of reactions) {
    const node = nodeAt(model, reaction.nodeId);
    sumFx += reaction.fx;
    sumFy += reaction.fy;
    sumMz += node.x * reaction.fy - node.y * reaction.fx + reaction.mz;
  }
  return {
    ok: true,
    method: "direct-stiffness-2d",
    displacements: nodeDisplacements,
    reactions,
    memberForces,
    equilibrium: { sumFx, sumFy, sumMz },
  };
}

function trialAxialForce(
  member: PlanarMember,
  model: PlanarStructureModel,
  displacements: NodeDisplacement[],
): number {
  const geometry = getMemberGeometry(member, new Map(model.nodes.map((node) => [node.id, node])));
  const start = displacements.find((node) => node.nodeId === member.startNodeId);
  const end = displacements.find((node) => node.nodeId === member.endNodeId);
  if (!geometry || !start || !end) return 0;
  const extension = geometry.c * (end.ux - start.ux) + geometry.s * (end.uy - start.uy);
  return (member.E * member.A * extension) / geometry.length;
}

export function analyzePlanarStructure(model: PlanarStructureModel): PlanarAnalysisOutcome {
  const unilateralMembers = model.members.filter(
    (member) => member.kind === "tie" || member.kind === "strut",
  );
  const active = new Set(unilateralMembers.map((member) => member.id));
  const visitedStates = new Set<string>();
  const tolerance = 1e-8;
  const maximumIterations = Math.max(20, unilateralMembers.length * 4 + 10);

  for (let iteration = 0; iteration < maximumIterations; iteration++) {
    const state = [...active].sort().join("|");
    if (visitedStates.has(state)) {
      return error(
        "unstable",
        "O sistema de tirantes e escoras não convergiu para um conjunto estável de barras ativas.",
      );
    }
    visitedStates.add(state);

    const result = solvePlanarStructure(model, active);
    if (!result.ok) return result;

    const next = new Set(active);
    for (const member of unilateralMembers) {
      const memberResult = result.memberForces.find((force) => force.memberId === member.id);
      const force = active.has(member.id)
        ? (memberResult?.axialStart ?? 0)
        : trialAxialForce(member, model, result.displacements);
      if (member.kind === "tie") {
        if (active.has(member.id) && force < -tolerance) next.delete(member.id);
        else if (!active.has(member.id) && force > tolerance) next.add(member.id);
      } else if (active.has(member.id) && force > tolerance) next.delete(member.id);
      else if (!active.has(member.id) && force < -tolerance) next.add(member.id);
    }

    if (next.size === active.size && [...active].every((id) => next.has(id))) return result;
    active.clear();
    next.forEach((id) => active.add(id));
  }

  return error(
    "unstable",
    "O sistema de tirantes e escoras excedeu o limite de iterações sem convergir.",
  );
}
