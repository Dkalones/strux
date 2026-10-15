import { useState } from "react";
import type { ChangeEvent, MouseEvent } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  GitBranch,
  Info,
  MousePointer2,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  analyzePlanarStructure,
  hingedPortalExample,
  portalDistributedLoadsExample,
  portalExample,
  simplePortalExample,
  threeHingedPortalExample,
  trussExample,
} from "@/lib/structural";
import type {
  FrameNode,
  FramePointLoad,
  FrameSupport,
  LinearMemberLoad,
  PlanarAnalysisOutcome,
  PlanarMember,
  PlanarStructureModel,
} from "@/lib/structural";

const STEEL_E = 200_000_000;
const DEFAULT_AREA = 0.02;
const DEFAULT_INERTIA = 0.0002;

function format(value: number, digits = 3) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

function parseInput(event: ChangeEvent<HTMLInputElement>, update: (value: number) => void) {
  const value = event.currentTarget.valueAsNumber;
  if (Number.isFinite(value)) update(value);
}

function globalPointForce(load: FramePointLoad) {
  const angle = ((load.angle ?? 0) * Math.PI) / 180;
  return {
    fx: Math.cos(angle) * load.fx - Math.sin(angle) * load.fy,
    fy: Math.sin(angle) * load.fx + Math.cos(angle) * load.fy,
  };
}

function linearLoadDefaultAngle(load: LinearMemberLoad, model: PlanarStructureModel) {
  const member = model.members.find((item) => item.id === load.memberId);
  const start = model.nodes.find((node) => node.id === member?.startNodeId);
  const end = model.nodes.find((node) => node.id === member?.endNodeId);
  if (!start || !end) return 90;
  const memberAngle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
  return (((memberAngle + 90) % 360) + 360) % 360;
}

type GeometryTool = "select" | "node" | "frame" | "truss" | "tie" | "strut";

function FrameDiagram({
  model,
  tool,
  pendingNodeId,
  onAddNode,
  onConnectNodes,
}: {
  model: PlanarStructureModel;
  tool: GeometryTool;
  pendingNodeId: string | null;
  onAddNode: (x: number, y: number) => void;
  onConnectNodes: (nodeId: string) => void;
}) {
  const width = 1400;
  const height = 760;
  const xs = model.nodes.map((node) => node.x);
  const ys = model.nodes.map((node) => node.y);
  const minX = xs.length ? Math.min(...xs) : 0,
    maxX = xs.length ? Math.max(...xs) : 1;
  const minY = ys.length ? Math.min(...ys) : 0,
    maxY = ys.length ? Math.max(...ys) : 1;
  const spanX = Math.max(maxX - minX, 4);
  const spanY = Math.max(maxY - minY, 3);
  const scale = Math.min(1080 / spanX, 520 / spanY);
  const originX = 170 + (1080 - (maxX - minX) * scale) / 2 - minX * scale;
  const originY = 110 + (520 - (maxY - minY) * scale) / 2 + maxY * scale;
  const point = (node: FrameNode) => ({
    x: originX + node.x * scale,
    y: originY - node.y * scale,
  });
  const rawTick = 100 / scale;
  const tickMagnitude = 10 ** Math.floor(Math.log10(rawTick));
  const tickRatio = rawTick / tickMagnitude;
  const tickStep =
    (tickRatio < 1.5 ? 1 : tickRatio < 3.5 ? 2 : tickRatio < 7.5 ? 5 : 10) * tickMagnitude;
  const makeTicks = (minimum: number, maximum: number) => {
    const first = Math.ceil(minimum / tickStep) * tickStep;
    const count = Math.min(40, Math.floor((maximum - first) / tickStep) + 1);
    return Array.from({ length: Math.max(0, count) }, (_, index) => first + index * tickStep);
  };
  const xTicks = makeTicks(minX, maxX);
  const yTicks = makeTicks(minY, maxY);
  const fmtCoordinate = (value: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);
  const addNodeAtPointer = (event: MouseEvent<SVGSVGElement>) => {
    if (tool !== "node" || event.target !== event.currentTarget) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const canvasPoint = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    const worldX = (canvasPoint.x - originX) / scale;
    const worldY = (originY - canvasPoint.y) / scale;
    onAddNode(Math.round(worldX * 1000) / 1000, Math.round(worldY * 1000) / 1000);
  };
  const nodeMap = new Map(model.nodes.map((node) => [node.id, node]));
  const supportMap = new Map(model.supports.map((support) => [support.nodeId, support]));
  const memberMap = new Map(model.members.map((member) => [member.id, member]));
  const arrow = (x: number, y: number, dx: number, dy: number, key: string) => {
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length,
      uy = dy / length;
    return (
      <g key={key} className="frame-load-arrow">
        <line x1={x - ux * 25} y1={y - uy * 25} x2={x} y2={y} />
        <path
          d={`M${x - ux * 7 - uy * 4} ${y - uy * 7 + ux * 4}L${x} ${y}L${x - ux * 7 + uy * 4} ${y - uy * 7 - ux * 4}`}
        />
      </g>
    );
  };
  return (
    <svg
      className={`frame-canvas frame-canvas-${tool}`}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Diagrama do pórtico ou treliça"
      onClick={addNodeAtPointer}
    >
      <rect
        width={width}
        height={height}
        className="frame-canvas-background"
        pointerEvents="none"
      />
      {xTicks.map((tick) => (
        <g key={`x-${tick}`} pointerEvents="none">
          <line
            x1={originX + tick * scale}
            y1="90"
            x2={originX + tick * scale}
            y2="680"
            className="frame-grid-line"
          />
          <line
            x1={originX + tick * scale}
            y1="670"
            x2={originX + tick * scale}
            y2="680"
            className="frame-axis"
          />
          <text x={originX + tick * scale} y="700" textAnchor="middle" className="frame-axis-label">
            {fmtCoordinate(tick)}
          </text>
        </g>
      ))}
      {yTicks.map((tick) => (
        <g key={`y-${tick}`} pointerEvents="none">
          <line
            x1="140"
            y1={originY - tick * scale}
            x2="1260"
            y2={originY - tick * scale}
            className="frame-grid-line"
          />
          <text
            x="128"
            y={originY - tick * scale + 4}
            textAnchor="end"
            className="frame-axis-label"
          >
            {fmtCoordinate(tick)}
          </text>
        </g>
      ))}
      <line x1="140" y1="680" x2="1260" y2="680" className="frame-axis" pointerEvents="none" />
      <text x="1265" y="700" className="frame-axis-label" pointerEvents="none">
        x (m)
      </text>
      <text x="106" y="98" className="frame-axis-label" pointerEvents="none">
        y (m)
      </text>
      {model.members.map((member) => {
        const start = nodeMap.get(member.startNodeId),
          end = nodeMap.get(member.endNodeId);
        if (!start || !end) return null;
        const p1 = point(start),
          p2 = point(end);
        return (
          <g key={member.id}>
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              className={`frame-member ${member.kind}-member`}
              pointerEvents="none"
            />
            {member.kind === "frame" && member.releaseStart && (
              <circle cx={p1.x} cy={p1.y} r="6" className="frame-hinge" pointerEvents="none" />
            )}
            {member.kind === "frame" && member.releaseEnd && (
              <circle cx={p2.x} cy={p2.y} r="6" className="frame-hinge" pointerEvents="none" />
            )}
            <text
              x={(p1.x + p2.x) / 2}
              y={(p1.y + p2.y) / 2 - 9}
              className="frame-member-label"
              textAnchor="middle"
            >
              {member.id} ·
              {member.kind === "frame"
                ? "P"
                : member.kind === "truss"
                  ? "T"
                  : member.kind === "tie"
                    ? "TIR"
                    : "ESC"}
            </text>
          </g>
        );
      })}
      {model.linearLoads.map((load) => {
        const member = memberMap.get(load.memberId),
          start = member && nodeMap.get(member.startNodeId),
          end = member && nodeMap.get(member.endNodeId);
        if (!member || !start || !end) return null;
        const p1 = point(start),
          p2 = point(end);
        const dx = p2.x - p1.x,
          dy = p2.y - p1.y,
          length = Math.hypot(dx, dy) || 1;
        const globalAngle =
          load.angle === undefined
            ? Math.atan2(end.y - start.y, end.x - start.x) + Math.PI / 2
            : (load.angle * Math.PI) / 180;
        const nx = Math.cos(globalAngle),
          ny = -Math.sin(globalAngle);
        return (
          <g key={load.id} pointerEvents="none">
            {Array.from({ length: 7 }, (_, i) => {
              const t = i / 6;
              const intensity = load.qStart + (load.qEnd - load.qStart) * t;
              if (Math.abs(intensity) < 1e-9) return null;
              const sign = Math.sign(intensity);
              return arrow(
                p1.x + dx * t - nx * sign * 30,
                p1.y + dy * t - ny * sign * 30,
                nx * sign,
                ny * sign,
                `${load.id}-${i}`,
              );
            })}
            <text
              x={(p1.x + p2.x) / 2 + nx * 53}
              y={(p1.y + p2.y) / 2 + ny * 53}
              textAnchor="middle"
              className="frame-load-label"
            >
              {format(load.qStart)} → {format(load.qEnd)} kN/m
            </text>
          </g>
        );
      })}
      {model.pointLoads.map((load, index) => {
        const node = nodeMap.get(load.nodeId);
        if (!node) return null;
        const p = point(node);
        const force = globalPointForce(load);
        return (
          <g key={`${load.nodeId}-${index}`} pointerEvents="none">
            {(force.fx !== 0 || force.fy !== 0) &&
              arrow(p.x, p.y, force.fx, -force.fy, `force-${load.nodeId}-${index}`)}
            {load.mz !== 0 && (
              <path
                d={`M${p.x + 22} ${p.y + 5}a23 23 0 1 ${load.mz > 0 ? 1 : 0} ${load.mz > 0 ? -39 : 39} -2m0 0l-1 9 9-4`}
                className="frame-load-arrow"
              />
            )}
            <text x={p.x + 34} y={p.y - 36} className="frame-load-label">
              {load.fx || load.fy ? `F ${format(Math.hypot(load.fx, load.fy))}` : ""}
              {load.mz ? ` Mz ${format(load.mz)}` : ""}
              {load.fx || load.fy ? " kN" : ""}
              {load.mz ? " kN·m" : ""}
              {load.angle ? ` · ${format(load.angle)}°` : ""}
            </text>
          </g>
        );
      })}
      {model.nodes.map((node) => {
        const p = point(node),
          support = supportMap.get(node.id);
        return (
          <g
            key={node.id}
            className={node.id === pendingNodeId ? "frame-node-pending" : "frame-node-group"}
            onClick={(event) => {
              if (tool === "select" || tool === "node") return;
              event.stopPropagation();
              onConnectNodes(node.id);
            }}
            style={{
              cursor: tool === "select" || tool === "node" ? "default" : "crosshair",
            }}
          >
            <circle cx={p.x} cy={p.y} r="12" className="frame-node-hit-area" />
            {support && (support.ux || support.uy) && (
              <g transform={`rotate(${-(support.angle ?? 0)} ${p.x} ${p.y})`}>
                <path d={`M${p.x} ${p.y + 6}l-13 18h26Z`} className="frame-support" />
                {support.rz && (
                  <path
                    d={`M${p.x - 16} ${p.y + 25}h32m-29 0l-6 7m14-7l-6 7m14-7l-6 7m14-7l-6 7`}
                    className="frame-support-hatch"
                  />
                )}
              </g>
            )}
            {support?.rz && !support.ux && !support.uy && (
              <g transform={`rotate(${-(support.angle ?? 0)} ${p.x} ${p.y})`}>
                <path
                  d={`M${p.x - 16} ${p.y + 25}h32m-29 0l-6 7m14-7l-6 7m14-7l-6 7m14-7l-6 7`}
                  className="frame-support-hatch"
                />
              </g>
            )}
            <circle cx={p.x} cy={p.y} r="4" className="frame-node" />
            <text x={p.x + 9} y={p.y - 9} className="frame-node-label">
              {node.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function NumberInput({
  label,
  value,
  unit,
  onChange,
  step = "any",
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  step?: string;
}) {
  return (
    <label className="frame-field">
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          type="number"
          step={step}
          value={value}
          onChange={(event) => parseInput(event, onChange)}
        />
        <small>{unit}</small>
      </div>
    </label>
  );
}

export function FrameEditor() {
  const [model, setModel] = useState<PlanarStructureModel>(() => portalExample());
  const [tool, setTool] = useState<GeometryTool>("select");
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [calculation, setCalculation] = useState<{
    model: PlanarStructureModel;
    result: PlanarAnalysisOutcome;
  } | null>(null);
  const currentResult = calculation?.model === model ? calculation.result : null;
  const stale = calculation !== null && calculation.model !== model;
  const patch = (update: (current: PlanarStructureModel) => PlanarStructureModel) =>
    setModel((current) => update(current));

  const patchNode = (id: string, update: Partial<FrameNode>) =>
    patch((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...update } : node)),
    }));
  const patchMember = (id: string, update: Partial<PlanarMember>) =>
    patch((current) => ({
      ...current,
      members: current.members.map((member) => {
        if (member.id !== id) return member;
        const next = { ...member, ...update };
        if (next.kind !== "frame")
          return {
            id: next.id,
            kind: next.kind,
            startNodeId: next.startNodeId,
            endNodeId: next.endNodeId,
            E: next.E,
            A: next.A,
          };
        return {
          ...next,
          kind: "frame",
          I: "I" in next ? next.I : DEFAULT_INERTIA,
          releaseStart: "releaseStart" in next ? next.releaseStart : false,
          releaseEnd: "releaseEnd" in next ? next.releaseEnd : false,
        };
      }),
      linearLoads: current.linearLoads.filter((load) => {
        if (load.memberId !== id) return true;
        const nextKind = update.kind ?? current.members.find((member) => member.id === id)?.kind;
        return nextKind === "frame";
      }),
    }));
  const patchPointLoad = (index: number, update: Partial<FramePointLoad>) =>
    patch((current) => ({
      ...current,
      pointLoads: current.pointLoads.map((load, i) =>
        i === index ? { ...load, ...update } : load,
      ),
    }));
  const patchLinearLoad = (id: string, update: Partial<LinearMemberLoad>) =>
    patch((current) => ({
      ...current,
      linearLoads: current.linearLoads.map((load) =>
        load.id === id ? { ...load, ...update } : load,
      ),
    }));
  const toggleSupport = (nodeId: string, key: "ux" | "uy" | "rz", checked: boolean) =>
    patch((current) => {
      const old = current.supports.find((support) => support.nodeId === nodeId) ?? {
        nodeId,
        ux: false,
        uy: false,
        rz: false,
        angle: 0,
      };
      const next = { ...old, [key]: checked };
      const supports = current.supports.filter((support) => support.nodeId !== nodeId);
      if (next.ux || next.uy || next.rz) supports.push(next);
      return { ...current, supports };
    });
  const uniqueId = (prefix: string, ids: string[]) => {
    let index = 1;
    while (ids.includes(`${prefix}${index}`)) index++;
    return `${prefix}${index}`;
  };
  const addNode = () =>
    patch((current) => {
      const id = uniqueId(
        "N",
        current.nodes.map((node) => node.id),
      );
      const last = current.nodes[current.nodes.length - 1];
      return {
        ...current,
        nodes: [...current.nodes, { id, x: (last?.x ?? 0) + 1, y: last?.y ?? 0 }],
      };
    });
  const addNodeAt = (x: number, y: number) =>
    patch((current) => ({
      ...current,
      nodes: [
        ...current.nodes,
        {
          id: uniqueId(
            "N",
            current.nodes.map((node) => node.id),
          ),
          x,
          y,
        },
      ],
    }));
  const connectNode = (nodeId: string) => {
    if (!pendingNodeId) {
      setPendingNodeId(nodeId);
      return;
    }
    if (pendingNodeId === nodeId) {
      setPendingNodeId(null);
      return;
    }
    if (tool !== "frame" && tool !== "truss" && tool !== "tie" && tool !== "strut") return;
    const kind = tool;
    patch((current) => {
      const duplicate = current.members.some(
        (member) =>
          member.kind === kind &&
          ((member.startNodeId === pendingNodeId && member.endNodeId === nodeId) ||
            (member.startNodeId === nodeId && member.endNodeId === pendingNodeId)),
      );
      if (duplicate) return current;
      const id = uniqueId(
        "B",
        current.members.map((member) => member.id),
      );
      return {
        ...current,
        members: [
          ...current.members,
          kind === "frame"
            ? {
                id,
                kind,
                startNodeId: pendingNodeId,
                endNodeId: nodeId,
                E: STEEL_E,
                A: DEFAULT_AREA,
                I: DEFAULT_INERTIA,
              }
            : {
                id,
                kind,
                startNodeId: pendingNodeId,
                endNodeId: nodeId,
                E: STEEL_E,
                A: DEFAULT_AREA,
              },
        ],
      };
    });
    setPendingNodeId(null);
  };
  const addMember = () =>
    patch((current) => {
      if (current.nodes.length < 2) return current;
      const id = uniqueId(
        "B",
        current.members.map((member) => member.id),
      );
      return {
        ...current,
        members: [
          ...current.members,
          {
            id,
            kind: "frame",
            startNodeId: current.nodes[0]?.id ?? "",
            endNodeId: current.nodes[1]?.id ?? "",
            E: STEEL_E,
            A: DEFAULT_AREA,
            I: DEFAULT_INERTIA,
          },
        ],
      };
    });
  const addPointLoad = () =>
    patch((current) => {
      const node = current.nodes[current.nodes.length - 1];
      return node
        ? {
            ...current,
            pointLoads: [...current.pointLoads, { nodeId: node.id, fx: 0, fy: -10, mz: 0 }],
          }
        : current;
    });
  const addLinearLoad = () =>
    patch((current) => {
      const member = current.members.find((item) => item.kind === "frame");
      return member
        ? {
            ...current,
            linearLoads: [
              ...current.linearLoads,
              {
                id: uniqueId(
                  "q",
                  current.linearLoads.map((load) => load.id),
                ),
                memberId: member.id,
                qStart: 0,
                qEnd: -5,
              },
            ],
          }
        : current;
    });

  return (
    <div className="frame-workspace">
      <div className="frame-toolbar">
        <div>
          <span className="tool-section-label">ANÁLISE PLANA 2D</span>
          <h2>{model.name}</h2>
        </div>
        <div className="project-actions">
          <select
            aria-label="Exemplo de pórtico ou treliça"
            className="example-select"
            onChange={(event) => {
              const examples = {
                portal: portalExample,
                portalLoads: portalDistributedLoadsExample,
                truss: trussExample,
                simple: simplePortalExample,
                hinged: hingedPortalExample,
                threeHinged: threeHingedPortalExample,
              };
              const next = examples[event.target.value as keyof typeof examples]();
              setModel(next);
              setPendingNodeId(null);
            }}
            defaultValue="portal"
          >
            <option value="portal">Exemplo de pórtico</option>
            <option value="portalLoads">Pórtico com cargas combinadas</option>
            <option value="truss">Exemplo de treliça</option>
            <option value="simple">Pórtico simples</option>
            <option value="hinged">Pórtico rotulado com escora</option>
            <option value="threeHinged">Pórtico triarticulado</option>
          </select>
          <Button
            size="sm"
            className="calculate-button"
            onClick={() => setCalculation({ model, result: analyzePlanarStructure(model) })}
          >
            <Activity size={14} />
            Calcular
          </Button>
        </div>
      </div>
      <div className="frame-design-layout">
        <aside className="frame-tools-panel" role="toolbar" aria-label="Ferramentas de desenho">
          <h3 className="panel-heading">
            <MousePointer2 size={16} />
            Ferramentas
          </h3>
          <Button
            variant="ghost"
            className={`tool-button frame-tool-button ${tool === "select" ? "active" : ""}`}
            aria-pressed={tool === "select"}
            onClick={() => {
              setTool("select");
              setPendingNodeId(null);
            }}
          >
            <MousePointer2 />
            Selecionar
          </Button>
          <span className="tool-section-label">ESTRUTURA</span>
          {(
            [
              ["node", "Nó", Plus],
              ["frame", "Pórtico", Square],
              ["truss", "Treliça", GitBranch],
              ["tie", "Tirante", ArrowUpRight],
              ["strut", "Escora", ArrowDownRight],
            ] as const
          ).map(([value, label, Icon]) => (
            <Button
              key={value}
              variant="ghost"
              className={`tool-button frame-tool-button ${tool === value ? "active" : ""}`}
              aria-pressed={tool === value}
              title={value === "node" ? "Criar nó no desenho" : `Desenhar ${label.toLowerCase()}`}
              onClick={() => {
                setTool(value);
                setPendingNodeId(null);
              }}
            >
              <Icon />
              {label}
              <Plus size={12} className="tool-key" />
            </Button>
          ))}
          <p className="frame-drawing-help">
            {tool === "node"
              ? "Clique no desenho para criar um nó."
              : tool !== "select"
                ? "Selecione dois nós para ligar."
                : "Escolha uma ferramenta para desenhar."}
          </p>
        </aside>
        <FrameDiagram
          model={model}
          tool={tool}
          pendingNodeId={pendingNodeId}
          onAddNode={addNodeAt}
          onConnectNodes={connectNode}
        />
      </div>
      <div className="frame-units-note">
        <Info size={14} />
        <span>Unidades: m, kN e kN·m · Ângulos para vínculos e cargas · Análise elástica 2D.</span>
      </div>
      <div className="frame-edit-grid">
        <section className="frame-edit-card">
          <div className="frame-card-heading">
            <h3>Nós e vínculos</h3>
            <Button variant="outline" size="sm" onClick={addNode}>
              <Plus size={13} />
              Adicionar nó
            </Button>
          </div>
          <div className="frame-table-scroll">
            <table className="frame-edit-table">
              <thead>
                <tr>
                  <th>Nó</th>
                  <th>x (m)</th>
                  <th>y (m)</th>
                  <th>Ux</th>
                  <th>Uy</th>
                  <th>Rz</th>
                  <th>Ângulo (°)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {model.nodes.map((node) => {
                  const support = model.supports.find((item) => item.nodeId === node.id);
                  return (
                    <tr key={node.id}>
                      <th>{node.id}</th>
                      <td>
                        <input
                          aria-label={`${node.id} x`}
                          type="number"
                          step="any"
                          value={node.x}
                          onChange={(event) => parseInput(event, (x) => patchNode(node.id, { x }))}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${node.id} y`}
                          type="number"
                          step="any"
                          value={node.y}
                          onChange={(event) => parseInput(event, (y) => patchNode(node.id, { y }))}
                        />
                      </td>
                      {(["ux", "uy", "rz"] as const).map((key) => (
                        <td key={key}>
                          <input
                            type="checkbox"
                            aria-label={`Restringir ${key.toUpperCase()} local no nó ${node.id}`}
                            checked={support?.[key] ?? false}
                            onChange={(event) => toggleSupport(node.id, key, event.target.checked)}
                          />
                        </td>
                      ))}
                      <td>
                        <input
                          aria-label={`Ângulo do apoio no nó ${node.id}`}
                          type="number"
                          step="1"
                          value={support?.angle ?? 0}
                          disabled={!support}
                          onChange={(event) =>
                            parseInput(event, (angle) =>
                              patch((current) => ({
                                ...current,
                                supports: current.supports.map((item) =>
                                  item.nodeId === node.id ? { ...item, angle } : item,
                                ),
                              })),
                            )
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="frame-icon-button"
                          aria-label={`Remover nó ${node.id}`}
                          onClick={() =>
                            patch((current) => ({
                              ...current,
                              nodes: current.nodes.filter((item) => item.id !== node.id),
                              supports: current.supports.filter((item) => item.nodeId !== node.id),
                              pointLoads: current.pointLoads.filter(
                                (item) => item.nodeId !== node.id,
                              ),
                              members: current.members.filter(
                                (item) =>
                                  item.startNodeId !== node.id && item.endNodeId !== node.id,
                              ),
                              linearLoads: current.linearLoads.filter((load) =>
                                current.members.some(
                                  (member) =>
                                    member.id === load.memberId &&
                                    member.startNodeId !== node.id &&
                                    member.endNodeId !== node.id,
                                ),
                              ),
                            }))
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="frame-help">
            Ux e Uy restringem os eixos locais do apoio. Ajuste o ângulo para girar as direções do
            vínculo; 0° coincide com os eixos globais.
          </p>
        </section>
        <section className="frame-edit-card">
          <div className="frame-card-heading">
            <h3>Barras</h3>
            <Button variant="outline" size="sm" onClick={addMember}>
              <Plus size={13} />
              Adicionar barra
            </Button>
          </div>
          <div className="frame-member-list">
            {model.members.map((member) => (
              <div className="frame-member-row" key={member.id}>
                <strong>{member.id}</strong>
                <select
                  aria-label={`Tipo da barra ${member.id}`}
                  value={member.kind}
                  onChange={(event) => {
                    const kind = event.currentTarget.value;
                    if (kind === "frame") patchMember(member.id, { kind, I: DEFAULT_INERTIA });
                    else if (kind === "truss" || kind === "tie" || kind === "strut")
                      patchMember(member.id, { kind });
                  }}
                >
                  <option value="frame">Pórtico</option>
                  <option value="truss">Treliça</option>
                  <option value="tie">Tirante (tração)</option>
                  <option value="strut">Escora (compressão)</option>
                </select>
                <select
                  aria-label={`Nó inicial da barra ${member.id}`}
                  value={member.startNodeId}
                  onChange={(event) => patchMember(member.id, { startNodeId: event.target.value })}
                >
                  {model.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.id}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Nó final da barra ${member.id}`}
                  value={member.endNodeId}
                  onChange={(event) => patchMember(member.id, { endNodeId: event.target.value })}
                >
                  {model.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.id}
                    </option>
                  ))}
                </select>
                <NumberInput
                  label={`E de ${member.id}`}
                  value={member.E}
                  unit="kN/m²"
                  onChange={(E) => patchMember(member.id, { E })}
                />
                <NumberInput
                  label={`A de ${member.id}`}
                  value={member.A}
                  unit="m²"
                  onChange={(A) => patchMember(member.id, { A })}
                />
                {member.kind === "frame" && (
                  <NumberInput
                    label={`I de ${member.id}`}
                    value={member.I}
                    unit="m⁴"
                    onChange={(I) => patchMember(member.id, { I })}
                  />
                )}
                {member.kind === "frame" && (
                  <label className="frame-release-option">
                    <input
                      type="checkbox"
                      aria-label={`Rótula no início da barra ${member.id}`}
                      checked={member.releaseStart ?? false}
                      onChange={(event) =>
                        patchMember(member.id, { releaseStart: event.target.checked })
                      }
                    />
                    Rótula início
                  </label>
                )}
                {member.kind === "frame" && (
                  <label className="frame-release-option">
                    <input
                      type="checkbox"
                      aria-label={`Rótula no fim da barra ${member.id}`}
                      checked={member.releaseEnd ?? false}
                      onChange={(event) =>
                        patchMember(member.id, { releaseEnd: event.target.checked })
                      }
                    />
                    Rótula fim
                  </label>
                )}
                <button
                  className="frame-icon-button"
                  aria-label={`Remover barra ${member.id}`}
                  onClick={() =>
                    patch((current) => ({
                      ...current,
                      members: current.members.filter((item) => item.id !== member.id),
                      linearLoads: current.linearLoads.filter(
                        (load) => load.memberId !== member.id,
                      ),
                    }))
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="frame-edit-card">
          <div className="frame-card-heading">
            <h3>Cargas nodais</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={addPointLoad}
              disabled={model.nodes.length === 0}
            >
              <Plus size={13} />
              Adicionar carga
            </Button>
          </div>
          {model.pointLoads.map((load, index) => (
            <div className="frame-load-row" key={`${load.nodeId}-${index}`}>
              <select
                aria-label={`Nó da carga nodal ${index + 1}`}
                value={load.nodeId}
                onChange={(event) => patchPointLoad(index, { nodeId: event.target.value })}
              >
                {model.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.id}
                  </option>
                ))}
              </select>
              <NumberInput
                label="Fx local"
                value={load.fx}
                unit="kN"
                onChange={(fx) => patchPointLoad(index, { fx })}
              />
              <NumberInput
                label="Fy local"
                value={load.fy}
                unit="kN"
                onChange={(fy) => patchPointLoad(index, { fy })}
              />
              <NumberInput
                label="Mz"
                value={load.mz}
                unit="kN·m"
                onChange={(mz) => patchPointLoad(index, { mz })}
              />
              <NumberInput
                label="Ângulo"
                value={load.angle ?? 0}
                unit="°"
                step="1"
                onChange={(angle) => patchPointLoad(index, { angle })}
              />
              <button
                className="frame-icon-button"
                aria-label={`Remover carga nodal ${index + 1}`}
                onClick={() =>
                  patch((current) => ({
                    ...current,
                    pointLoads: current.pointLoads.filter((_, i) => i !== index),
                  }))
                }
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </section>
        <section className="frame-edit-card">
          <div className="frame-card-heading">
            <h3>Cargas distribuídas lineares</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={addLinearLoad}
              disabled={!model.members.some((member) => member.kind === "frame")}
            >
              <Plus size={13} />
              Adicionar carga distribuída
            </Button>
          </div>
          {model.linearLoads.map((load) => (
            <div className="frame-load-row" key={load.id}>
              <select
                aria-label={`Barra da carga ${load.id}`}
                value={load.memberId}
                onChange={(event) => patchLinearLoad(load.id, { memberId: event.target.value })}
              >
                {model.members
                  .filter((member) => member.kind === "frame")
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.id}
                    </option>
                  ))}
              </select>
              <NumberInput
                label={`${load.id} q inicial`}
                value={load.qStart}
                unit="kN/m"
                onChange={(qStart) => patchLinearLoad(load.id, { qStart })}
              />
              <NumberInput
                label={`${load.id} q final`}
                value={load.qEnd}
                unit="kN/m"
                onChange={(qEnd) => patchLinearLoad(load.id, { qEnd })}
              />
              <NumberInput
                label="Ângulo global"
                value={load.angle ?? linearLoadDefaultAngle(load, model)}
                unit="°"
                step="1"
                onChange={(angle) => patchLinearLoad(load.id, { angle })}
              />
              <button
                className="frame-icon-button"
                aria-label={`Remover carga ${load.id}`}
                onClick={() =>
                  patch((current) => ({
                    ...current,
                    linearLoads: current.linearLoads.filter((item) => item.id !== load.id),
                  }))
                }
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <p className="frame-help">
            Intensidades nos extremos da barra, interpoladas linearmente. Sinal positivo = eixo
            local +y por padrão; barras axiais (treliça, tirante e escora) recebem apenas cargas
            nodais.
          </p>
        </section>
      </div>
      <section className="frame-results">
        <div className="frame-card-heading">
          <div>
            <h3>Resultados estruturais</h3>
            <p>
              {currentResult
                ? currentResult.ok
                  ? "Calculado para o modelo atual"
                  : "Análise não resolvida"
                : stale
                  ? "Modelo alterado; resultados anteriores ocultos"
                  : "Clique em Calcular para executar a análise"}
            </p>
          </div>
        </div>
        {!currentResult ? (
          <div className="frame-empty">
            {stale
              ? "Recalcule para atualizar os resultados deste modelo."
              : "Os deslocamentos e esforços serão mostrados após o cálculo."}
          </div>
        ) : !currentResult.ok ? (
          <div className="frame-analysis-error" role="alert">
            {currentResult.message}
          </div>
        ) : (
          <div className="frame-result-grid">
            <div>
              <h4>Reações (kN, kN·m)</h4>
              <table className="frame-result-table">
                <thead>
                  <tr>
                    <th>Nó</th>
                    <th>Fx</th>
                    <th>Fy</th>
                    <th>Mz</th>
                  </tr>
                </thead>
                <tbody>
                  {currentResult.reactions
                    .filter((reaction) =>
                      model.supports.some((support) => support.nodeId === reaction.nodeId),
                    )
                    .map((reaction) => (
                      <tr key={reaction.nodeId}>
                        <th>{reaction.nodeId}</th>
                        <td>{format(reaction.fx)}</td>
                        <td>{format(reaction.fy)}</td>
                        <td>{format(reaction.mz)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4>Deslocamentos (m, rad)</h4>
              <table className="frame-result-table">
                <thead>
                  <tr>
                    <th>Nó</th>
                    <th>Ux</th>
                    <th>Uy</th>
                    <th>Rz</th>
                  </tr>
                </thead>
                <tbody>
                  {currentResult.displacements.map((displacement) => (
                    <tr key={displacement.nodeId}>
                      <th>{displacement.nodeId}</th>
                      <td>{format(displacement.ux, 6)}</td>
                      <td>{format(displacement.uy, 6)}</td>
                      <td>{format(displacement.rz, 6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4>Esforços de extremidade (kN, kN·m)</h4>
              <table className="frame-result-table">
                <thead>
                  <tr>
                    <th>Barra</th>
                    <th>N inicial/final</th>
                    <th>V inicial/final</th>
                    <th>M inicial/final</th>
                  </tr>
                </thead>
                <tbody>
                  {currentResult.memberForces.map((force) => (
                    <tr key={force.memberId}>
                      <th>
                        {force.memberId} (
                        {force.kind === "frame"
                          ? "pórtico"
                          : force.kind === "truss"
                            ? "treliça"
                            : force.kind === "tie"
                              ? "tirante"
                              : "escora"}
                        )
                      </th>
                      <td>
                        {format(force.axialStart)} / {format(force.axialEnd)}
                      </td>
                      <td>
                        {format(force.shearStart)} / {format(force.shearEnd)}
                      </td>
                      <td>
                        {format(force.momentStart)} / {format(force.momentEnd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="frame-equilibrium">
              Resíduo do equilíbrio global: ΣFx {currentResult.equilibrium.sumFx.toExponential(2)}{" "}
              kN · ΣFy {currentResult.equilibrium.sumFy.toExponential(2)} kN · ΣM{" "}
              {currentResult.equilibrium.sumMz.toExponential(2)} kN·m
            </p>
          </div>
        )}
        <div className="prototype-notice">
          <Info size={14} />
          <span>
            Solver plano de primeira ordem por rigidez direta. Elementos de pórtico Euler–Bernoulli
            (E, A, I) e treliça axial (E, A), com liberações de rotação e cargas distribuídas
            lineares. Não inclui efeitos de segunda ordem, plasticidade nem dimensionamento
            normativo. Validação independente de projeto profissional continua necessária.
          </span>
        </div>
      </section>
    </div>
  );
}
