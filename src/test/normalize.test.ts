import { describe, it, expect } from "vitest";
import { normalizeFlavor } from "@/lib/normalize";

describe("normalizeFlavor", () => {
  it("preserva números junto com letras no sabor", () => {
    expect(normalizeFlavor("Própolis Verde 70").trim()).toBe("Própolis Verde 70");
  });

  it("preserva vírgulas e acentos", () => {
    expect(normalizeFlavor("Chá Verde, Gengibre, Cacau").trim()).toBe(
      "Chá Verde, Gengibre, Cacau",
    );
  });

  it("compacta espaços duplicados", () => {
    expect(normalizeFlavor("Chá  Verde 70").trim()).toBe("Chá Verde 70");
  });

  it("remove caracteres que não são letras, números, espaços ou vírgulas", () => {
    expect(normalizeFlavor("Chocolate @#!").trim()).toBe("Chocolate");
  });
});
