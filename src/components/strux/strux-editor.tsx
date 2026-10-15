import { useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ChartNoAxesCombined,
  ChevronRight,
  CircleHelp,
  Clock3,
  Crosshair,
  Grid2X2,
  Info,
  Maximize,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BeamCanvas } from "./beam-canvas";
import { PropertiesPanel } from "./properties-panel";
import { Symbol } from "./symbol";
import { ResultsPanel } from "./results-panel";
import { FrameEditor } from "./frame-editor";
import { analyzeModel, type BeamAnalysisOutcome } from "@/lib/structural";
import {
  clamp,
  exampleModel,
  isLoad,
  labels,
  normalizeModel,
  type BeamElement,
  type BeamModel,
  type ElementKind,
} from "@/lib/beam-model";

const supportTools: ElementKind[] = ["pinned", "roller", "fixed"];
const loadTools: ElementKind[] = ["force", "distributed", "moment"];

export function StruxEditor() {
  const [workspace, setWorkspace] = useState<"beam" | "frame">("beam");
  const [model, setModel] = useState<BeamModel>(() => exampleModel());
  const [past, setPast] = useState<BeamModel[]>([]);
  const [future, setFuture] = useState<BeamModel[]>([]);
  const [selected, setSelected] = useState<string | null>("beam");
  const [tool, setTool] = useState<ElementKind | null>(null);
  const [zoom, setZoom] = useState(1);
  const [grid, setGrid] = useState(true);
  const [tab, setTab] = useState(0);
  const [dialog, setDialog] = useState<"about" | "results" | "clear" | null>(null);
  const [status, setStatus] = useState("Modelo pronto");
  const [example, setExample] = useState("simple");
  const [calculation, setCalculation] = useState<{
    model: BeamModel;
    result: BeamAnalysisOutcome;
  } | null>(null);
  const dragSnapshot = useRef<BeamModel | null>(null);
  const idCounter = useRef(10);
  const resultsRef = useRef<HTMLElement>(null);
  const resultsAreCurrent = calculation?.model === model;
  const analysis = resultsAreCurrent ? calculation.result : null;
  const resultsAreStale = calculation !== null && !resultsAreCurrent;
  const selectedElement = model.elements.find((element) => element.id === selected);

  function calculate() {
    const result = analyzeModel(model);
    setCalculation({ model, result });
    setStatus(result.ok ? "Cálculo concluído" : `Falha no cálculo: ${result.message}`);
  }

  function commit(next: BeamModel, message = "Modelo atualizado") {
    const normalized = normalizeModel(next);
    if (JSON.stringify(normalized) === JSON.stringify(model)) return;
    setPast((previous) => [...previous.slice(-79), model]);
    setFuture([]);
    setModel(normalized);
    setStatus(message);
  }
  function undo() {
    const previous = past[past.length - 1];
    if (!previous) return;
    setFuture((items) => [model, ...items]);
    setPast((items) => items.slice(0, -1));
    setModel(previous);
    setSelected("beam");
    setStatus("Alteração desfeita");
  }
  function redo() {
    const next = future[0];
    if (!next) return;
    setPast((items) => [...items, model]);
    setFuture((items) => items.slice(1));
    setModel(next);
    setSelected("beam");
    setStatus("Alteração refeita");
  }
  function add(position: number) {
    if (!tool) return;
    const id = `element-${idCounter.current++}`;
    const element: BeamElement =
      tool === "force" || tool === "moment" || tool === "distributed"
        ? {
            id,
            kind: tool,
            position,
            magnitude: tool === "distributed" ? 5 : 10,
            ...(tool === "distributed" ? { length: Math.min(2, model.length - position) } : {}),
          }
        : { id, kind: tool, position };
    commit({ ...model, elements: [...model.elements, element] }, `${labels[tool]} adicionado`);
    setSelected(id);
    setTool(null);
  }
  function removeSelected() {
    if (!selectedElement) return;
    commit(
      { ...model, elements: model.elements.filter((element) => element.id !== selected) },
      "Elemento removido",
    );
    setSelected("beam");
  }
  function updateSelected(updates: Partial<BeamElement>) {
    if (!selectedElement) return;
    commit({
      ...model,
      elements: model.elements.map((element) =>
        element.id === selected ? ({ ...element, ...updates } as BeamElement) : element,
      ),
    });
  }
  function dragMove(id: string, position: number) {
    setModel((previous) => ({
      ...previous,
      elements: previous.elements.map((element) =>
        element.id === id
          ? {
              ...element,
              position: clamp(
                position,
                0,
                previous.length - (element.kind === "distributed" ? (element.length ?? 1) : 0),
              ),
            }
          : element,
      ),
    }));
  }
  function setElementPosition(id: string, position: number) {
    const element = model.elements.find((item) => item.id === id);
    if (!element) return false;
    const maxPosition = model.length - (element.kind === "distributed" ? (element.length ?? 1) : 0);
    if (!Number.isFinite(position) || position < 0 || position > maxPosition) return false;
    commit(
      {
        ...model,
        elements: model.elements.map((item) => (item.id === id ? { ...item, position } : item)),
      },
      "Cota atualizada",
    );
    return true;
  }
  function dragEnd() {
    const before = dragSnapshot.current;
    if (before) {
      setModel((current) => {
        if (JSON.stringify(before) !== JSON.stringify(current)) {
          setPast((items) => [...items.slice(-79), before]);
          setFuture([]);
          setStatus("Posição atualizada");
        }
        return current;
      });
    }
    dragSnapshot.current = null;
  }
  function loadExample(value: string) {
    setExample(value);
    commit(exampleModel(value), "Exemplo carregado");
    setSelected("beam");
    setZoom(1);
    setTool(null);
  }
  function clear() {
    commit(
      { name: "Viga sem título", length: model.length, angle: model.angle ?? 0, elements: [] },
      "Modelo limpo",
    );
    setSelected("beam");
    setTool(null);
    setDialog(null);
  }
  const supports = model.elements.filter((element) => !isLoad(element)).length;
  const toolButton = (kind: ElementKind) => (
    <Button
      key={kind}
      variant="ghost"
      className={`tool-button ${tool === kind ? "active" : ""}`}
      aria-pressed={tool === kind}
      title={`Adicionar ${labels[kind].toLowerCase()}`}
      onClick={() => {
        setTool(tool === kind ? null : kind);
        setStatus(tool === kind ? "Seleção ativa" : `Posicione: ${labels[kind].toLowerCase()}`);
      }}
    >
      <Symbol kind={kind} />
      {labels[kind]
        .replace("Apoio ", "")
        .replace("Força concentrada", "Força pontual")
        .replace("Momento concentrado", "Momento")}
      <Plus size={12} className="tool-key" />
    </Button>
  );

  return (
    <div className="strux-app">
      <header className="app-header">
        <div className="brand">
          <svg
            viewBox="0 0 30 32"
            className="brand-mark"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            aria-hidden="true"
          >
            <path d="M4 25V7h22v18M4 16h22M4 25l11-9 11 9" />
          </svg>
          <span>STRUX</span>
          <span className="brand-divider" />
          <span className="brand-subtitle">Análise estrutural</span>
        </div>
        <nav className="header-navigation" aria-label="Principal">
          <Button
            variant="ghost"
            className={`nav-item ${workspace === "beam" ? "active" : ""}`}
            aria-pressed={workspace === "beam"}
            onClick={() => {
              setWorkspace("beam");
              setDialog(null);
              setStatus("Editor ativo");
            }}
          >
            Vigas
          </Button>
          <Button
            variant="ghost"
            className={`nav-item ${workspace === "frame" ? "active" : ""}`}
            aria-pressed={workspace === "frame"}
            onClick={() => {
              setWorkspace("frame");
              setDialog(null);
            }}
          >
            Pórticos e treliças
          </Button>
          <Button
            variant="ghost"
            className="nav-item"
            onClick={() => {
              resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              setDialog("results");
            }}
          >
            Resultados
          </Button>
          <Button variant="ghost" className="nav-item" onClick={() => setDialog("about")}>
            Sobre o projeto
          </Button>
        </nav>
        <div className="header-right">
          <span className="prototype-tag">PROTÓTIPO v0.2</span>
          <Button
            variant="ghost"
            size="icon"
            className="nav-item"
            title="Sobre o STRUX"
            aria-label="Sobre o STRUX"
            onClick={() => setDialog("about")}
          >
            <CircleHelp size={18} />
          </Button>
        </div>
      </header>
      {workspace === "frame" ? (
        <FrameEditor />
      ) : (
        <>
          <div className="project-bar">
            <div>
              <div className="breadcrumb">
                Projetos
                <ChevronRight size={11} />
                <span>Modelo atual</span>
              </div>
              <div className="project-title">
                <h1>{model.name}</h1>
                <span className="draft-tag">Rascunho</span>
              </div>
            </div>
            <div className="project-actions">
              <select
                className="example-select"
                aria-label="Exemplos iniciais"
                value={example}
                onChange={(e) => loadExample(e.target.value)}
              >
                <option value="simple">Exemplo: viga biapoiada</option>
                <option value="cantilever">Exemplo: balanço</option>
                <option value="uniform">Exemplo: carga uniforme</option>
                <option value="inclined-projection">
                  Exemplo: viga inclinada, carga projetada e momentos
                </option>
              </select>
              <Button size="sm" className="calculate-button" onClick={calculate}>
                <Activity size={14} />
                Calcular
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="new-model"
                onClick={() => setDialog("clear")}
              >
                <Plus size={14} />
                Novo modelo
              </Button>
            </div>
          </div>
          <div className="editor-layout">
            <aside className="tools-panel">
              <div className="panel-heading">
                <Crosshair size={16} />
                <h2>Ferramentas</h2>
              </div>
              <Button
                variant="ghost"
                className={`tool-button ${!tool ? "active" : ""}`}
                onClick={() => {
                  setTool(null);
                  setStatus("Seleção ativa");
                }}
                aria-pressed={!tool}
              >
                <MousePointer2 size={20} />
                Selecionar<span className="tool-key">↖</span>
              </Button>
              <div className="tool-section-label">APOIOS</div>
              {supportTools.map(toolButton)}
              <div className="tool-divider" />
              <div className="tool-section-label">CARREGAMENTOS</div>
              {loadTools.map(toolButton)}
              <div className="units-summary">
                <span>SISTEMA DE UNIDADES</span>
                <p>m · kN · kN/m · kN·m</p>
              </div>
            </aside>
            <main className="workspace">
              <div className="workspace-heading">
                <div>
                  <h2>Modelo estrutural</h2>
                  <p>Geometria, vínculos e carregamentos</p>
                </div>
                <div className="unit-badge">
                  <Ruler size={13} />
                  Unidades: m, kN
                </div>
              </div>
              <div className="editor-surface">
                <div className="canvas-toolbar">
                  <div className="toolbar-group">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="toolbar-icon"
                      title="Desfazer"
                      aria-label="Desfazer"
                      disabled={!past.length}
                      onClick={undo}
                    >
                      <Undo2 />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="toolbar-icon"
                      title="Refazer"
                      aria-label="Refazer"
                      disabled={!future.length}
                      onClick={redo}
                    >
                      <Redo2 />
                    </Button>
                    <span className="toolbar-separator" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`toolbar-icon ${grid ? "active" : ""}`}
                      title="Mostrar grade"
                      aria-label="Mostrar grade"
                      aria-pressed={grid}
                      onClick={() => setGrid(!grid)}
                    >
                      <Grid2X2 />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="toolbar-icon"
                      title="Limpar modelo"
                      aria-label="Limpar modelo"
                      onClick={() => setDialog("clear")}
                    >
                      <RotateCcw />
                    </Button>
                  </div>
                  <div className="toolbar-group">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="toolbar-icon"
                      title="Diminuir zoom"
                      aria-label="Diminuir zoom"
                      disabled={zoom <= 0.6}
                      onClick={() =>
                        setZoom((value) => Math.max(0.6, Math.round((value - 0.1) * 10) / 10))
                      }
                    >
                      <Minus />
                    </Button>
                    <span className="zoom-label">{Math.round(zoom * 100)}%</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="toolbar-icon"
                      title="Aumentar zoom"
                      aria-label="Aumentar zoom"
                      disabled={zoom >= 1.15}
                      onClick={() =>
                        setZoom((value) => Math.min(1.15, Math.round((value + 0.1) * 10) / 10))
                      }
                    >
                      <Plus />
                    </Button>
                    <span className="toolbar-separator" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="toolbar-icon"
                      title="Ajustar à tela"
                      aria-label="Ajustar à tela"
                      onClick={() => {
                        setZoom(1);
                        setStatus("Modelo ajustado à tela");
                      }}
                    >
                      <Maximize />
                    </Button>
                  </div>
                </div>
                <BeamCanvas
                  model={model}
                  selected={selected}
                  tool={tool}
                  zoom={zoom}
                  showGrid={grid}
                  onSelect={setSelected}
                  onAdd={add}
                  onDragStart={() => {
                    dragSnapshot.current = model;
                  }}
                  onMove={dragMove}
                  onSetPosition={setElementPosition}
                  onDragEnd={dragEnd}
                />
                <div className="canvas-footer">
                  <div className="canvas-legend">
                    <span>
                      <i className="legend-beam" />
                      Viga e apoios
                    </span>
                    <span>
                      <i className="legend-load" />
                      Carregamentos
                    </span>
                  </div>
                  <span>
                    {tool
                      ? `${labels[tool]} · aguardando posição`
                      : `${model.elements.length} elementos · ${model.length} m`}
                  </span>
                </div>
              </div>
              <section ref={resultsRef} className="results-section">
                <ResultsPanel
                  analysis={analysis}
                  stale={resultsAreStale}
                  length={model.length}
                  tab={tab}
                  onTab={setTab}
                />
              </section>
            </main>
            <PropertiesPanel
              model={model}
              selected={selectedElement}
              onLength={(length) => commit({ ...model, length })}
              onAngle={(angle) => commit({ ...model, angle })}
              onUpdate={updateSelected}
              onDelete={removeSelected}
            />
          </div>
          <footer className="status-bar" role="status">
            <span className="status-state">
              <i className="status-dot" />
              {status}
            </span>
            <span>{supports} apoios</span>
            <span>{model.elements.length - supports} cargas</span>
            <span className="status-right">
              STRUX 0.2 · Sessão temporária ·{" "}
              {analysis
                ? analysis.ok
                  ? "Calculado"
                  : "Falha no cálculo"
                : resultsAreStale
                  ? "Resultados desatualizados"
                  : "Não calculado"}
            </span>
          </footer>
          <Dialog
            open={dialog !== null}
            onOpenChange={(open) => {
              if (!open) setDialog(null);
            }}
          >
            <DialogContent className="info-dialog">
              <DialogHeader>
                <DialogTitle>
                  {dialog === "clear"
                    ? "Limpar modelo?"
                    : dialog === "results"
                      ? analysis?.ok
                        ? "Resultados do modelo atual"
                        : resultsAreStale
                          ? "Resultados desatualizados"
                          : "Sem resultado"
                      : "Bem-vindo ao sétimo item de preguiçoso do JD"}
                </DialogTitle>
                <DialogDescription>
                  {dialog === "clear"
                    ? "Os apoios e carregamentos serão removidos. O comprimento da viga será mantido e você poderá desfazer a ação."
                    : dialog === "results"
                      ? analysis?.ok
                        ? "Resultados do último cálculo para o modelo atual."
                        : resultsAreStale
                          ? "O modelo mudou desde o último cálculo. Clique em Calcular para atualizar os resultados."
                          : analysis
                            ? analysis.message
                            : "Clique em Calcular para analisar o modelo."
                      : "Feito apenas para as disciplinas de estruturas."}
                </DialogDescription>
              </DialogHeader>
              {dialog === "clear" ? (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialog(null)}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={clear}>
                    Limpar modelo
                  </Button>
                </div>
              ) : (
                <>
                  <Button onClick={() => setDialog(null)}>Voltar ao editor</Button>
                </>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
