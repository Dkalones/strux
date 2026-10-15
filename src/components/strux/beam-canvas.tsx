import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import {
  clamp,
  isLoad,
  labels,
  roundPosition,
  type BeamElement,
  type BeamModel,
  type ElementKind,
} from "@/lib/beam-model";

type Props = {
  model: BeamModel;
  selected: string | null;
  tool: ElementKind | null;
  zoom: number;
  showGrid: boolean;
  onSelect: (id: string) => void;
  onAdd: (position: number) => void;
  onMove: (id: string, position: number) => void;
  onSetPosition: (id: string, position: number) => boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
};
export function BeamCanvas({
  model,
  selected,
  tool,
  zoom,
  showGrid,
  onSelect,
  onAdd,
  onDragStart,
  onMove,
  onSetPosition,
  onDragEnd,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; offset: number } | null>(null);
  const [editingDimension, setEditingDimension] = useState<{
    id: string;
    value: string;
    error: string | null;
  } | null>(null);
  const start = 500 - 410 * zoom;
  const scale = (820 * zoom) / model.length;
  const angle = model.angle ?? 0;
  const radians = (angle * Math.PI) / 180;
  const verticalSpan = Math.abs(Math.sin(radians)) * model.length * scale;
  const topOffset = angle > 0 ? verticalSpan : 0;
  const pivotY = 235;
  const x = (position: number) => start + position * scale;
  const getPosition = (event: PointerEvent<SVGSVGElement | SVGGElement>) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return 0;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const dx = point.x - start;
    const dy = point.y - topOffset - pivotY;
    const beamX = start + dx * Math.cos(radians) - dy * Math.sin(radians);
    return (beamX - start) / scale;
  };
  const beginDrag = (event: PointerEvent<SVGGElement>, element: BeamElement) => {
    event.stopPropagation();
    if (tool) {
      onAdd(clamp(getPosition(event), 0, model.length));
      return;
    }
    onSelect(element.id);
    onDragStart();
    setDrag({ id: element.id, offset: getPosition(event) - element.position });
    svgRef.current?.setPointerCapture(event.pointerId);
  };
  const rawStep = 100 / scale;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  const step =
    (normalizedStep < 1.5 ? 1 : normalizedStep < 3.5 ? 2 : normalizedStep < 7.5 ? 5 : 10) *
    magnitude;
  const ticks = Array.from({ length: Math.floor(model.length / step) + 1 }, (_, i) =>
    roundPosition(i * step),
  ).filter((tick) => tick < model.length);
  ticks.push(model.length);
  const dimensionsLaneEnds: number[] = [];
  const dimensions = [...model.elements]
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((element) => {
      const labelX = clamp(x(element.position), 46, 954);
      let lane = 0;
      while (
        lane < 100 &&
        dimensionsLaneEnds[lane] !== undefined &&
        labelX - (dimensionsLaneEnds[lane] ?? 0) < 86
      )
        lane++;
      dimensionsLaneEnds[lane] = labelX + 40;
      return { element, labelX, lane };
    });
  const laneCount = Math.max(1, ...dimensions.map((dimension) => dimension.lane + 1));
  const axisY = Math.max(395, 349 + laneCount * 22);
  const canvasHeight = axisY + 45 + verticalSpan;
  const fmtPosition = (position: number) =>
    `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(position)} m`;
  const confirmDimension = () => {
    if (!editingDimension) return;
    const target = Number(editingDimension.value.trim().replace(",", "."));
    if (!Number.isFinite(target)) {
      setEditingDimension((current) =>
        current ? { ...current, error: "Digite uma posição numérica válida." } : current,
      );
      return;
    }
    if (!onSetPosition(editingDimension.id, target)) {
      const element = model.elements.find((item) => item.id === editingDimension.id);
      const maxPosition =
        model.length - (element?.kind === "distributed" ? (element.length ?? 1) : 0);
      setEditingDimension((current) =>
        current
          ? { ...current, error: `A posição deve estar entre 0 e ${fmtPosition(maxPosition)}.` }
          : current,
      );
      return;
    }
    setEditingDimension(null);
  };
  return (
    <svg
      ref={svgRef}
      className={`beam-canvas ${tool ? "placing" : ""}`}
      viewBox={`0 0 1000 ${canvasHeight}`}
      style={{ aspectRatio: `1000 / ${530 + verticalSpan}` }}
      role="group"
      aria-label={`Modelo estrutural de ${model.length} metros`}
      onPointerDown={(event) => {
        if (tool) onAdd(roundPosition(clamp(getPosition(event), 0, model.length)));
        else onSelect("beam");
      }}
      onPointerMove={(event) => {
        if (drag) onMove(drag.id, roundPosition(getPosition(event) - drag.offset));
      }}
      onPointerUp={(event) => {
        if (drag) {
          setDrag(null);
          onDragEnd();
          if (svgRef.current?.hasPointerCapture(event.pointerId))
            svgRef.current.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        setDrag(null);
        onDragEnd();
      }}
    >
      <defs>
        <pattern id="grid-small" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" className="grid-line" fill="none" />
        </pattern>
        <pattern id="grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="url(#grid-small)" />
          <path d="M100 0H0V100" className="grid-major-line" fill="none" />
        </pattern>
      </defs>
      {showGrid && <rect width="1000" height={canvasHeight} fill="url(#grid-major)" />}
      <g transform={`translate(0 ${topOffset}) rotate(${-angle} ${start} ${pivotY})`}>
        <rect width="1000" height="48" className="ruler-background" />
        <line x1="0" y1="48" x2="1000" y2="48" className="ruler-line" />
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={x(tick)} y1="37" x2={x(tick)} y2="48" className="ruler-line" />
            <text x={x(tick)} y="27" textAnchor="middle" className="ruler-text">
              {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(tick)}
            </text>
          </g>
        ))}
        <text x="975" y="27" textAnchor="end" className="ruler-text">
          m
        </text>
        <line
          x1={x(0)}
          y1="235"
          x2={x(model.length)}
          y2="235"
          className={`beam-line ${selected === "beam" ? "beam-selected" : ""}`}
        />
        <line x1={x(0)} y1="320" x2={x(model.length)} y2="320" className="dimension-line" />
        {[0, model.length].map((position) => (
          <g key={position}>
            <line x1={x(position)} y1="301" x2={x(position)} y2="331" className="dimension-line" />
            <path d={`M${x(position) - 4} 324l8-8`} className="dimension-line" />
          </g>
        ))}
        <rect x="451" y="307" width="98" height="26" rx="4" className="dimension-label-bg" />
        <text x="500" y="325" textAnchor="middle" className="dimension-text">
          {model.length.toLocaleString("pt-BR")} m
        </text>
        {dimensions.map(({ element, labelX, lane }) => {
          const y = 349 + lane * 22;
          const editing = editingDimension?.id === element.id;
          return (
            <g key={`dimension-${element.id}`} className="editable-dimension">
              <line
                x1={x(0)}
                y1={y - 7}
                x2={x(element.position)}
                y2={y - 7}
                className="dimension-line"
              />
              <line x1={x(0)} y1={y - 11} x2={x(0)} y2={y - 3} className="dimension-line" />
              <line
                x1={x(element.position)}
                y1={y - 11}
                x2={x(element.position)}
                y2={y - 3}
                className="dimension-line"
              />
              {editing ? (
                <foreignObject
                  x={labelX - 43}
                  y={y - 14}
                  width="86"
                  height="42"
                  className="dimension-editor"
                >
                  <div className="dimension-editor-content">
                    <input
                      aria-label={`Editar cota de ${labels[element.kind]}`}
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      value={editingDimension.value}
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        setEditingDimension((current) =>
                          current
                            ? { ...current, value: event.target.value, error: null }
                            : current,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          confirmDimension();
                        }
                        if (event.key === "Escape") setEditingDimension(null);
                      }}
                      onBlur={() => setEditingDimension(null)}
                    />
                    {editingDimension.error && (
                      <span className="dimension-error">{editingDimension.error}</span>
                    )}
                  </div>
                </foreignObject>
              ) : (
                <text
                  x={labelX}
                  y={y + 4}
                  textAnchor="middle"
                  className="dimension-text dimension-editable"
                  role="button"
                  tabIndex={0}
                  aria-label={`Cota de ${labels[element.kind]}, ${fmtPosition(element.position)}. Duplo clique para editar.`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    setEditingDimension({
                      id: element.id,
                      value: String(element.position),
                      error: null,
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ")
                      setEditingDimension({
                        id: element.id,
                        value: String(element.position),
                        error: null,
                      });
                  }}
                >
                  {fmtPosition(element.position)}
                </text>
              )}
            </g>
          );
        })}
        {model.elements.map((element) => {
          const active = selected === element.id;
          const px = x(element.position);
          const support = !isLoad(element);
          const supportAngle = isLoad(element) ? angle : (element.angle ?? angle);
          const upward = isLoad(element) && element.magnitude < 0;
          return (
            <g
              key={element.id}
              className={`structural-element ${support ? "support-symbol" : "load-symbol"} ${active ? "element-selected" : ""}`}
              onPointerDown={(event) => beginDrag(event, element)}
              role="button"
              tabIndex={0}
              aria-label={`${labels[element.kind]}, posição ${element.position} metros`}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect(element.id);
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  onDragStart();
                  onMove(
                    element.id,
                    roundPosition(element.position + (event.key === "ArrowLeft" ? -0.1 : 0.1)),
                  );
                  onDragEnd();
                }
              }}
            >
              <title>{`${labels[element.kind]} · ${element.position.toLocaleString("pt-BR")} m`}</title>
              {support && (
                <g
                  className="support-orientation"
                  transform={`rotate(${angle - supportAngle} ${px} 235)`}
                >
                  {element.kind === "pinned" && (
                    <>
                      <rect x={px - 25} y="230" width="50" height="67" className="hit-area" />
                      <path d={`M${px} 241l-18 28h36Z`} className="symbol-fill" />
                      <line x1={px - 26} y1="275" x2={px + 26} y2="275" />
                      {[-20, -10, 0, 10, 20].map((a) => (
                        <path key={a} d={`M${px + a} 275l-6 7`} />
                      ))}
                    </>
                  )}
                  {element.kind === "roller" && (
                    <>
                      <rect x={px - 25} y="230" width="50" height="67" className="hit-area" />
                      <path d={`M${px} 241l-17 25h34Z`} className="symbol-fill" />
                      <circle cx={px - 10} cy="273" r="4" />
                      <circle cx={px + 10} cy="273" r="4" />
                      <line x1={px - 24} y1="282" x2={px + 24} y2="282" />
                    </>
                  )}
                  {element.kind === "fixed" && (
                    <>
                      <rect x={px - 26} y="202" width="45" height="70" className="hit-area" />
                      <line x1={px} y1="203" x2={px} y2="269" strokeWidth="4" />
                      {[207, 219, 231, 243, 255, 267].map((a) => (
                        <path key={a} d={`M${px} ${a}l-15 10`} />
                      ))}
                    </>
                  )}
                </g>
              )}
              {element.kind === "force" && (
                <>
                  <rect x={px - 26} y="74" width="52" height="165" className="hit-area" />
                  <g transform={`rotate(${angle} ${px} 235)`}>
                    <text x={px} y="78" textAnchor="middle" className="load-label">
                      {element.magnitude} kN
                    </text>
                    <line x1={px} y1="94" x2={px} y2="225" strokeWidth="2.5" />
                    <path
                      d={upward ? `M${px - 7} 107l7-13 7 13` : `M${px - 7} 212l7 13 7-13`}
                      strokeWidth="2.5"
                    />
                  </g>
                </>
              )}
              {element.kind === "distributed" &&
                (() => {
                  const end = x(element.position + (element.length ?? 1));
                  const count = Math.max(2, Math.ceil((end - px) / 28));
                  const labelX =
                    (px + end) / 2 +
                    (model.elements.some(
                      (e) =>
                        e.kind === "force" &&
                        e.position === element.position + (element.length ?? 1) / 2,
                    )
                      ? 70
                      : 0);
                  const gravity = element.direction !== "normal";
                  const loadHeight = 71;
                  const offsetX = gravity ? loadHeight * Math.sin(radians) : 0;
                  const offsetY = -loadHeight * (gravity ? Math.cos(radians) : 1);
                  const topY = 235 + offsetY;
                  const topX = px + offsetX;
                  const labelOffset = loadHeight + 18;
                  const labelXOffset = gravity ? labelOffset * Math.sin(radians) : 0;
                  const labelYOffset = -labelOffset * (gravity ? Math.cos(radians) : 1);
                  const shownLabelX = labelX + labelXOffset;
                  const shownLabelY = 235 + labelYOffset;
                  return (
                    <>
                      <rect
                        x={px - 8}
                        y="119"
                        width={end - px + 16}
                        height="112"
                        className="hit-area"
                      />
                      <path
                        d={`M${topX} ${topY}L${end + offsetX} ${topY}L${end} 235L${px} 235Z`}
                        className="distributed-fill"
                      />
                      <g transform={`rotate(${angle} ${shownLabelX} ${shownLabelY})`}>
                        <text
                          x={shownLabelX}
                          y={shownLabelY}
                          textAnchor="middle"
                          className="load-label"
                        >
                          {element.magnitude} kN/m
                        </text>
                      </g>
                      <line x1={topX} y1={topY} x2={end + offsetX} y2={topY} />
                      {Array.from({ length: count + 1 }, (_, i) => {
                        const ax = px + ((end - px) * i) / count;
                        const arrowX = ax + offsetX;
                        return (
                          <g
                            key={i}
                            transform={gravity ? `rotate(${angle} ${arrowX} ${topY})` : undefined}
                          >
                            <line x1={arrowX} y1={topY} x2={arrowX} y2={topY + loadHeight} />
                            <path
                              d={
                                upward
                                  ? `M${arrowX - 4} ${topY + 10}l4-10 4 10`
                                  : `M${arrowX - 4} 225l4 10 4-10`
                              }
                            />
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              {element.kind === "moment" && (
                <>
                  <rect x={px - 42} y="174" width="84" height="85" className="hit-area" />
                  <g transform={`rotate(${angle} ${px} 235)`}>
                    <path
                      d={
                        element.magnitude < 0
                          ? `M${px + 25} 230a29 29 0 1 0-50 0m-1-10 1 10 10-2`
                          : `M${px - 25} 230a29 29 0 1 1 50 0m-10-2 10 2 1-10`
                      }
                    />
                    <text x={px} y="180" textAnchor="middle" className="load-label">
                      {element.magnitude} kN·m
                    </text>
                  </g>
                </>
              )}
              {support && (
                <text x={px} y="298" textAnchor="middle" className="support-label">
                  {String.fromCharCode(
                    65 +
                      model.elements
                        .filter((e) => !isLoad(e))
                        .findIndex((e) => e.id === element.id),
                  )}
                </text>
              )}
              {active && <circle cx={px} cy="235" r="6" className="selection-point" />}
            </g>
          );
        })}
      </g>
      <g className="axis-symbol">
        <path d={`M35 ${axisY}h40m-6-4 6 4-6 4M35 ${axisY}v-35m-4 6 4-6 4 6`} />
        <text x="83" y={axisY + 5}>
          x
        </text>
        <text x="30" y={axisY - 45}>
          y
        </text>
      </g>
    </svg>
  );
}
