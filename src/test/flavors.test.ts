import { describe, it, expect } from "vitest";
import { sortedFlavors, pickInitialVariant } from "@/lib/format";

describe("sortedFlavors", () => {
  it("ordena sabores A–Z respeitando acentos, mesmo quando o primeiro cadastrado não é o primeiro alfabético", () => {
    const variants = [
      { flavor: "Chá Verde" },
      { flavor: "Abacaxi" },
      { flavor: "Água de Coco" },
      { flavor: "Ébano" },
      { flavor: "Abacaxi" }, // duplicado não repete
    ];
    expect(sortedFlavors(variants)).toEqual([
      "Abacaxi",
      "Água de Coco",
      "Chá Verde",
      "Ébano",
    ]);
  });

  it("ignora variações sem sabor", () => {
    expect(sortedFlavors([{ flavor: null }, { flavor: "Baunilha" }])).toEqual(["Baunilha"]);
  });
});

describe("pickInitialVariant", () => {
  it("sem deep link, seleciona o primeiro sabor em ordem alfabética, não o primeiro cadastrado", () => {
    const variants = [
      { id: "v1", flavor: "Chá Verde", stock: 5, price: 100 },
      { id: "v2", flavor: "Abacaxi", stock: 3, price: 90 },
      { id: "v3", flavor: "Ébano", stock: 1, price: 80 },
    ];
    expect(pickInitialVariant(variants, null)?.id).toBe("v2");
  });

  it("no primeiro sabor A–Z, prefere a variação com estoque", () => {
    const variants = [
      { id: "v1", flavor: "Chá Verde", stock: 5, price: 100 },
      { id: "v2", flavor: "Abacaxi", stock: 0, price: 90 },
      { id: "v4", flavor: "Abacaxi", stock: 2, price: 95 },
    ];
    expect(pickInitialVariant(variants, null)?.id).toBe("v4");
  });

  it("deep link (?variante=) continua tendo prioridade", () => {
    const variants = [
      { id: "v1", flavor: "Chá Verde", stock: 5, price: 100 },
      { id: "v2", flavor: "Abacaxi", stock: 3, price: 90 },
    ];
    expect(pickInitialVariant(variants, "v1")?.id).toBe("v1");
  });
});
