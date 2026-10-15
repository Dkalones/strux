import { Box, Info, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isLoad, labels, type BeamElement, type BeamModel } from "@/lib/beam-model";
import { Symbol } from "./symbol";

function NumberField({
  label,
  value,
  unit,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="property-field">
      <span>{label}</span>
      <div className="unit-input">
        <Input
          aria-label={label}
          type="number"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          step="0.1"
          onChange={(e) => {
            if (e.target.value !== "" && Number.isFinite(e.target.valueAsNumber))
              onChange(e.target.valueAsNumber);
          }}
        />
        <span>{unit}</span>
      </div>
    </label>
  );
}
export function PropertiesPanel({
  model,
  selected,
  onLength,
  onAngle,
  onUpdate,
  onDelete,
}: {
  model: BeamModel;
  selected: BeamElement | undefined;
  onLength: (length: number) => void;
  onAngle: (angle: number) => void;
  onUpdate: (updates: Partial<BeamElement>) => void;
  onDelete: () => void;
}) {
  return (
    <aside className="properties-panel">
      <div className="panel-heading">
        <SlidersHorizontal size={16} />
        <h2>Propriedades</h2>
      </div>
      <div className="properties-content">
        <div className="object-heading">
          <div className="object-icon">
            {selected ? <Symbol kind={selected.kind} /> : <Box size={22} />}
          </div>
          <div>
            <h3>{selected ? labels[selected.kind] : "Viga"}</h3>
            <span>{selected ? "Elemento selecionado" : "Elemento estrutural"}</span>
          </div>
        </div>
        <div className="property-section-title">GEOMETRIA</div>
        {selected ? (
          <>
            <NumberField
              label="Posição no eixo local"
              value={selected.position}
              unit="m"
              min={0}
              max={model.length}
              onChange={(position) => onUpdate({ position })}
            />
            {selected.kind === "distributed" && (
              <NumberField
                label="Comprimento da carga"
                value={selected.length ?? 1}
                unit="m"
                min={0.1}
                max={model.length - selected.position}
                onChange={(length) => onUpdate({ length })}
              />
            )}
          </>
        ) : (
          <>
            <NumberField
              label="Comprimento da viga"
              value={model.length}
              unit="m"
              min={0.5}
              onChange={onLength}
            />
            <NumberField
              label="Inclinação da viga"
              value={model.angle ?? 0}
              unit="°"
              min={-60}
              max={60}
              onChange={onAngle}
            />
            <p className="field-note">
              Ângulo anti-horário a partir do eixo horizontal. Apoios acompanham a viga.
            </p>
          </>
        )}
        {selected && !isLoad(selected) && (
          <>
            <div className="property-section-title">ORIENTAÇÃO DO APOIO</div>
            <label className="property-field">
              <span>
                <input
                  aria-label="Acompanhar inclinação da viga"
                  type="checkbox"
                  checked={selected.angle == null}
                  onChange={(event) =>
                    onUpdate({ angle: event.target.checked ? null : (model.angle ?? 0) })
                  }
                />{" "}
                Acompanhar inclinação da viga
              </span>
            </label>
            <NumberField
              label="Ângulo do apoio"
              value={selected.angle ?? model.angle ?? 0}
              unit="°"
              min={-180}
              max={180}
              disabled={selected.angle == null}
              onChange={(angle) => onUpdate({ angle })}
            />
            <p className="field-note">
              Ângulo anti-horário a partir do eixo global x. No rolete, a reação é normal ao apoio.
            </p>
          </>
        )}
        {selected && isLoad(selected) && (
          <>
            <div className="property-section-title">CARREGAMENTO</div>
            <NumberField
              label={selected.kind === "moment" ? "Momento" : "Intensidade"}
              value={selected.magnitude}
              unit={selected.kind === "force" ? "kN" : selected.kind === "moment" ? "kN·m" : "kN/m"}
              onChange={(magnitude) => onUpdate({ magnitude })}
            />
            {selected.kind === "distributed" && (
              <label className="property-field">
                <span>Direção da carga</span>
                <select
                  className="property-select"
                  aria-label="Direção da carga distribuída"
                  value={selected.direction ?? "vertical"}
                  onChange={(event) => {
                    if (event.target.value === "vertical" || event.target.value === "normal")
                      onUpdate({ direction: event.target.value });
                  }}
                >
                  <option value="vertical">Vertical (gravidade)</option>
                  <option value="horizontal-projection">Vertical (por projeção horizontal)</option>
                  <option value="normal">Perpendicular à viga</option>
                </select>
              </label>
            )}
            <p className="field-note">
              {selected.kind === "moment"
                ? "Positivo: sentido horário."
                : selected.kind === "force"
                  ? "Gravidade vertical; o cálculo decompõe a força nos eixos locais."
                  : selected.direction === "normal"
                    ? "Carga uniforme perpendicular ao eixo local da viga."
                    : selected.direction === "horizontal-projection"
                      ? "Intensidade por metro de projeção horizontal; o comprimento da carga é medido ao longo da viga."
                      : "Carga vertical por metro ao longo da viga; a inclinação é considerada no cálculo."}
            </p>
          </>
        )}
        {!selected && (
          <>
            <div className="property-section-title">UNIDADES DO MODELO</div>
            <div className="unit-row">
              <span>Comprimento</span>
              <strong>m</strong>
            </div>
            <div className="unit-row">
              <span>Força</span>
              <strong>kN</strong>
            </div>
            <div className="unit-row">
              <span>Momento</span>
              <strong>kN·m</strong>
            </div>
          </>
        )}
        {selected && (
          <Button variant="ghost" className="delete-element" onClick={onDelete}>
            <Trash2 size={15} />
            Remover elemento
          </Button>
        )}
      </div>
      <div className="properties-bottom">
        <Info size={16} />
        <div>
          <strong>Modelo em edição</strong>
          <p>Após alterar, clique em Calcular para atualizar os resultados.</p>
        </div>
      </div>
    </aside>
  );
}
