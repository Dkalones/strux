import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { labels } from "@/lib/beam-model";
import type { BeamAnalysisOutcome, DiagramPoint } from "@/lib/structural";

const fmt = (v: number, d = 2) => (Math.abs(v) < 5e-10 ? 0 : v).toFixed(d).replace(".", ",");
const W = 1000,
  H = 260,
  PADX = 90,
  PADY = 34;

function Diagram({
  points,
  field,
  unit,
  length,
  invert,
}: {
  points: DiagramPoint[];
  field: "V" | "M" | "N";
  unit: string;
  length: number;
  invert?: boolean;
}) {
  const values = points.map((p) => p[field]);
  const peak = Math.max(1e-9, ...values.map(Math.abs));
  // physical x (m) → SVG units; value → SVG units (scale only for drawing)
  const sx = (x: number) => PADX + (x / length) * (W - 2 * PADX);
  const sy = (v: number) => H / 2 - (invert ? -1 : 1) * (v / peak) * (H / 2 - PADY);
  const path =
    `M${sx(0)} ${sy(0)} ` +
    points.map((p) => `L${sx(p.x)} ${sy(p[field])}`).join(" ") +
    ` L${sx(length)} ${sy(0)} Z`;
  const marks = new Map<string, DiagramPoint>();
  points.forEach((p, i) => {
    const prev = points[i - 1],
      next = points[i + 1];
    const v = p[field];
    const magnitude = Math.abs(v);
    const previousMagnitude = prev ? Math.abs(prev[field]) : -Infinity;
    const nextMagnitude = next ? Math.abs(next[field]) : -Infinity;
    const isPeak =
      (magnitude > previousMagnitude + 1e-9 && magnitude >= nextMagnitude - 1e-9) ||
      (magnitude >= previousMagnitude - 1e-9 && magnitude > nextMagnitude + 1e-9);
    if (Math.abs(v) > peak * 0.02 && (isPeak || prev?.x === p.x || next?.x === p.x))
      marks.set(`${p.x.toFixed(3)}:${fmt(v)}`, p);
  });
  const visibleMarks: DiagramPoint[] = [];
  for (const p of marks.values()) {
    const previous = visibleMarks[visibleMarks.length - 1];
    if (
      !previous ||
      Math.abs(sx(p.x) - sx(previous.x)) >= 64 ||
      (p.x === previous.x && Math.abs(sy(p[field]) - sy(previous[field])) >= 24)
    ) {
      visibleMarks.push(p);
    }
    if (visibleMarks.length === 14) break;
  }
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="result-diagram"
      role="img"
      aria-label={
        field === "V"
          ? "Diagrama de esforço cortante"
          : field === "M"
            ? "Diagrama de momento fletor"
            : "Diagrama de esforço normal"
      }
    >
      <path d={path} className="diagram-fill" />
      <line x1={sx(0)} x2={sx(length)} y1={H / 2} y2={H / 2} className="diagram-axis" />
      {visibleMarks.map((p, i) => (
        <g key={i}>
          <circle cx={sx(p.x)} cy={sy(p[field])} r="3" className="diagram-dot" />
          <text
            x={sx(p.x)}
            y={sy(p[field]) + (p[field] > 0 !== !!invert ? -9 : 17)}
            textAnchor="middle"
            className="diagram-label"
          >
            {fmt(p[field])}
          </text>
        </g>
      ))}
      <text x={sx(0)} y={H - 6} className="diagram-tick" textAnchor="middle">
        0
      </text>
      <text x={sx(length)} y={H - 6} className="diagram-tick" textAnchor="middle">
        {fmt(length)} m
      </text>
      <text x={12} y={18} className="diagram-tick">
        {unit}
      </text>
    </svg>
  );
}

const tabs = ["Esforço cortante", "Momento fletor", "Esforço normal", "Reações de apoio"];

export function ResultsPanel({
  analysis,
  stale,
  length,
  tab,
  onTab,
}: {
  analysis: BeamAnalysisOutcome | null;
  stale: boolean;
  length: number;
  tab: number;
  onTab: (i: number) => void;
}) {
  return (
    <>
      <div className="results-top">
        <h2>Diagramas e resultados</h2>
        {analysis?.ok ? (
          <span className="pending-badge result-ok">
            <CheckCircle2 size={12} />
            Calculado · modelo atual
          </span>
        ) : analysis ? (
          <span className="pending-badge result-error">
            <AlertTriangle size={12} />
            Falha no cálculo
          </span>
        ) : stale ? (
          <span className="pending-badge result-stale">
            <AlertTriangle size={12} />
            Resultados desatualizados
          </span>
        ) : (
          <span className="pending-badge">
            <Info size={12} />
            Não calculado
          </span>
        )}
      </div>
      <div className="result-tabs" role="tablist" aria-label="Resultados estruturais">
        {tabs.map((name, i) => (
          <Button
            key={name}
            id={`result-tab-${i}`}
            role="tab"
            aria-selected={tab === i}
            aria-controls="result-content"
            variant="ghost"
            className={`result-tab ${tab === i ? "active" : ""}`}
            onClick={() => onTab(i)}
          >
            {name}
          </Button>
        ))}
      </div>
      <div role="tabpanel" id="result-content" aria-labelledby={`result-tab-${tab}`}>
        {!analysis ? (
          <div className="result-empty">
            {stale ? <AlertTriangle size={25} /> : <Info size={25} />}
            <strong>{stale ? "Resultados desatualizados" : "Cálculo ainda não executado"}</strong>
            <p>
              {stale
                ? "O modelo foi alterado desde a última análise. Clique em Calcular para atualizar os resultados."
                : "Edite o modelo e clique em Calcular para analisar a estrutura."}
            </p>
          </div>
        ) : !analysis.ok ? (
          <div className="result-empty">
            <AlertTriangle size={25} />
            <strong>Modelo fora do escopo de cálculo</strong>
            <p>{analysis.message}</p>
          </div>
        ) : tab === 3 ? (
          <table className="reactions-table">
            <thead>
              <tr>
                <th>Apoio</th>
                <th>x local (m)</th>
                <th>Rx global (kN)</th>
                <th>Ry global (kN) ↑+</th>
                <th>M (kN·m) ↺+</th>
              </tr>
            </thead>
            <tbody>
              {analysis.reactions.map((r) => (
                <tr key={r.supportId}>
                  <td>{labels[r.type]}</td>
                  <td>{fmt(r.x)}</td>
                  <td>{fmt(r.rx)}</td>
                  <td>{fmt(r.ry)}</td>
                  <td>{r.type === "fixed" ? fmt(r.mz) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>
                  Equilíbrio global: ΣFx = {analysis.equilibrium.sumFx.toExponential(1)} kN · ΣFy ={" "}
                  {analysis.equilibrium.sumFy.toExponential(1)} kN · ΣM ={" "}
                  {analysis.equilibrium.sumMz.toExponential(1)} kN·m
                </td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <div className="diagram-wrap">
            <Diagram
              points={analysis.diagram}
              field={tab === 0 ? "V" : tab === 1 ? "M" : "N"}
              unit={tab === 0 ? "V (kN)" : tab === 1 ? "M (kN·m)" : "N (kN)"}
              length={length}
              invert={tab === 1}
            />
            <p className="diagram-summary">
              {tab === 0
                ? `Vmáx = ${fmt(analysis.maxShear.value)} kN (x = ${fmt(analysis.maxShear.x)} m) · Vmín = ${fmt(analysis.minShear.value)} kN (x = ${fmt(analysis.minShear.x)} m)`
                : tab === 1
                  ? `Mmáx = ${fmt(analysis.maxMoment.value)} kN·m (x = ${fmt(analysis.maxMoment.x)} m) · Mmín = ${fmt(analysis.minMoment.value)} kN·m (x = ${fmt(analysis.minMoment.x)} m) · positivo tracionando a face inferior, desenhado abaixo do eixo`
                  : `Nmáx = ${fmt(analysis.maxAxial.value)} kN (x = ${fmt(analysis.maxAxial.x)} m) · Nmín = ${fmt(analysis.minAxial.value)} kN (x = ${fmt(analysis.minAxial.x)} m) · positivo em tração`}
            </p>
          </div>
        )}
      </div>
      <div className="prototype-notice">
        <Info size={14} />
        <span>
          Motor isostático por equilíbrio, verificado por testes analíticos. Suporta biapoiada
          (articulado + rolete) e balanço (engaste). Sem deslocamentos nem hiperestáticas. Não
          substitui verificação profissional.
        </span>
      </div>
    </>
  );
}
