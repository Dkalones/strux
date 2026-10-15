import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StruxEditor } from "@/components/strux/strux-editor";

describe("STRUX calculation workflow", () => {
  it("calculates only on request and marks results stale after an edit", () => {
    render(<StruxEditor />);

    expect(screen.getByText("Não calculado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    expect(screen.getByText("Calculado · modelo atual")).toBeInTheDocument();
    expect(screen.getByText(/Vmáx =/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("spinbutton", { name: "Comprimento da viga" }), {
      target: { value: "5" },
    });

    const resultsPanel = within(screen.getByRole("tabpanel"));
    expect(resultsPanel.getByText("Resultados desatualizados")).toBeInTheDocument();
    expect(resultsPanel.queryByText(/Vmáx =/)).not.toBeInTheDocument();
    expect(resultsPanel.getByText(/clique em Calcular/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    expect(screen.getByText("Calculado · modelo atual")).toBeInTheDocument();
    expect(within(screen.getByRole("tabpanel")).getByText(/Vmáx =/)).toBeInTheDocument();
  });

  it("edits a support or load coordinate by double-clicking its dimension", () => {
    render(<StruxEditor />);

    fireEvent.doubleClick(
      screen.getByRole("button", {
        name: "Cota de Força concentrada, 3 m. Duplo clique para editar.",
      }),
    );
    const coordinateInput = screen.getByRole("textbox", {
      name: "Editar cota de Força concentrada",
    });
    fireEvent.change(coordinateInput, { target: { value: "4,25" } });
    fireEvent.keyDown(coordinateInput, { key: "Enter" });

    expect(
      screen.getByRole("button", {
        name: "Cota de Força concentrada, 4,25 m. Duplo clique para editar.",
      }),
    ).toBeInTheDocument();

    fireEvent.doubleClick(
      screen.getByRole("button", {
        name: "Cota de Apoio articulado, 0 m. Duplo clique para editar.",
      }),
    );
    const supportInput = screen.getByRole("textbox", {
      name: "Editar cota de Apoio articulado",
    });
    fireEvent.change(supportInput, { target: { value: "6,1" } });
    fireEvent.keyDown(supportInput, { key: "Enter" });

    expect(
      screen.getByRole("textbox", { name: "Editar cota de Apoio articulado" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/A posição deve estar entre/)).toBeInTheDocument();
  });

  it("switches to the frame/truss solver and reports results on demand", () => {
    render(<StruxEditor />);

    fireEvent.click(screen.getByRole("button", { name: "Pórticos e treliças" }));
    expect(screen.getByText("Pórtico plano")).toBeInTheDocument();
    expect(screen.getByText(/0 → -10 kN\/m/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));

    expect(screen.getByText("Calculado para o modelo atual")).toBeInTheDocument();
    expect(screen.getByText(/Resíduo do equilíbrio global:/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Exemplo de pórtico ou treliça" }), {
      target: { value: "truss" },
    });
    expect(screen.getByText("Treliça triangular")).toBeInTheDocument();
    expect(screen.getByText("Modelo alterado; resultados anteriores ocultos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    expect(screen.getByText("Calculado para o modelo atual")).toBeInTheDocument();
    expect(screen.getByText("AB (treliça)")).toBeInTheDocument();
  });

  it("loads and calculates the portal example with combined distributed loads", () => {
    render(<StruxEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Pórticos e treliças" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Exemplo de pórtico ou treliça" }), {
      target: { value: "portalLoads" },
    });

    expect(
      screen.getByRole("heading", { name: "Pórtico com cargas triangulares e laterais" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    expect(screen.getByText("Calculado para o modelo atual")).toBeInTheDocument();
  });

  it("draws a truss member by selecting two existing nodes", () => {
    render(<StruxEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Pórticos e treliças" }));

    const memberCount = document.querySelectorAll(".frame-member-row").length;
    fireEvent.click(screen.getByRole("button", { name: "Treliça" }));
    const firstNode = document.querySelector(".frame-node-group");
    if (!firstNode) throw new Error("The example should render selectable nodes");
    fireEvent.click(firstNode);
    expect(document.querySelector(".frame-node-pending")).toBeInTheDocument();
    const secondNode = document.querySelectorAll(".frame-node-group")[0];
    if (!secondNode) throw new Error("The example should render at least two nodes");
    fireEvent.click(secondNode);

    expect(document.querySelectorAll(".frame-member-row")).toHaveLength(memberCount + 1);
    expect(document.querySelector(".frame-node-pending")).not.toBeInTheDocument();
  });

  it("loads the three-hinged and hinged portal examples", () => {
    render(<StruxEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Pórticos e treliças" }));
    const examples = screen.getByRole("combobox", { name: "Exemplo de pórtico ou treliça" });

    fireEvent.change(examples, { target: { value: "threeHinged" } });
    expect(screen.getByRole("heading", { name: "Pórtico triarticulado" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Rótula no fim da barra BC" })).toBeChecked();

    fireEvent.change(examples, { target: { value: "hinged" } });
    expect(
      screen.getByRole("heading", { name: "Pórtico rotulado com escora" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Tipo da barra AC" })).toHaveValue("strut");
  });

  it("rotates a support in the 2D model", () => {
    render(<StruxEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Pórticos e treliças" }));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Ângulo do apoio no nó A" }), {
      target: { value: "90" },
    });
    expect(
      document.querySelector(".frame-support")?.parentElement?.getAttribute("transform"),
    ).toContain("rotate(-90");
  });

  it("sets an inclined beam and the direction of its distributed load", () => {
    render(<StruxEditor />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Inclinação da viga" }), {
      target: { value: "30" },
    });
    expect(
      document.querySelector(".beam-line")?.parentElement?.getAttribute("transform"),
    ).toContain("rotate(-30");

    fireEvent.keyDown(screen.getByRole("button", { name: "Carga distribuída, posição 1 metros" }), {
      key: "Enter",
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Direção da carga distribuída" }), {
      target: { value: "normal" },
    });
    expect(screen.getByRole("combobox", { name: "Direção da carga distribuída" })).toHaveValue(
      "normal",
    );
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    fireEvent.click(screen.getByRole("tab", { name: "Esforço normal" }));
    expect(screen.getByRole("img", { name: "Diagrama de esforço normal" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Reações de apoio" }));
    expect(screen.getByText("Rx global (kN)")).toBeInTheDocument();
  });

  it("loads the inclined beam example with horizontal-projection load intensity", () => {
    render(<StruxEditor />);
    fireEvent.change(screen.getByRole("combobox", { name: "Exemplos iniciais" }), {
      target: { value: "inclined-projection" },
    });

    expect(
      screen.getByRole("heading", { name: "Viga inclinada com carga e momentos" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Carga distribuída, posição 0 metros" }), {
      key: "Enter",
    });
    expect(screen.getByRole("combobox", { name: "Direção da carga distribuída" })).toHaveValue(
      "horizontal-projection",
    );
    expect(screen.getByText(/por metro de projeção horizontal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    expect(screen.getByText("Calculado · modelo atual")).toBeInTheDocument();
  });

  it("shows the requested course-specific welcome text", () => {
    render(<StruxEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Sobre o STRUX" }));
    expect(screen.getByText("Bem-vindo ao sétimo item de preguiçoso do JD")).toBeInTheDocument();
    expect(screen.getByText("Feito apenas para as disciplinas de estruturas.")).toBeInTheDocument();
  });

  it("allows a roller support angle independent of the inclined beam", () => {
    render(<StruxEditor />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Inclinação da viga" }), {
      target: { value: "30" },
    });
    fireEvent.keyDown(screen.getByRole("button", { name: "Apoio rolete, posição 6 metros" }), {
      key: "Enter",
    });

    const followsBeam = screen.getByRole("checkbox", { name: "Acompanhar inclinação da viga" });
    expect(followsBeam).toBeChecked();
    fireEvent.click(followsBeam);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Ângulo do apoio" }), {
      target: { value: "0" },
    });

    expect(
      document.querySelectorAll(".support-orientation")[1]?.getAttribute("transform"),
    ).toContain("rotate(30");
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    fireEvent.click(screen.getByRole("tab", { name: "Reações de apoio" }));
    expect(screen.getByText("Rx global (kN)")).toBeInTheDocument();
  });
});
