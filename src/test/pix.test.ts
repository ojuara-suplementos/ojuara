import { describe, expect, it, vi } from "vitest";
import { buildPixPayload, crc16, normalizePixKeyForBRCode, validatePixPayload } from "@/lib/pix";

const OFFICIAL_KEY = "123e4567-e12b-12d1-a456-426655440000";
const OFFICIAL_PAYLOAD =
  "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";

describe("BR Code Pix", () => {
  it("reproduz o exemplo oficial do Banco Central e seu CRC", () => {
    expect(crc16(OFFICIAL_PAYLOAD.slice(0, -4))).toBe("1D3D");
    expect(OFFICIAL_PAYLOAD).toContain(`0014br.gov.bcb.pix0136${OFFICIAL_KEY}`);
    expect(OFFICIAL_PAYLOAD).toContain("62070503***6304");
  });

  it("gera e valida a estrutura com valor sem transformar a chave", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const key = "recebedor@example.com";
    const payload = buildPixPayload({
      key,
      amount: 95,
      merchantName: "OJUARA SUPLEMENTOS",
      merchantCity: "OLINDINA",
    });

    const validation = validatePixPayload(payload, { key, amount: 95 });
    expect(validation).toMatchObject({
      valid: true,
      errors: [],
      keyType: "email",
      keyLength: key.length,
      amount: "95.00",
      crcValid: true,
    });
    expect(payload).toContain(`01${String(key.length).padStart(2, "0")}${key}`);
  });

  it("normaliza telefone nacional de 11 dígitos para E.164 (+55) no BR Code", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    expect(normalizePixKeyForBRCode("75999887766")).toBe("+5575999887766");
    // Já em formato internacional não é duplicado; outros tipos não são alterados.
    expect(normalizePixKeyForBRCode("+5575999887766")).toBe("+5575999887766");
    expect(normalizePixKeyForBRCode("recebedor@example.com")).toBe("recebedor@example.com");

    const key = "75999887766";
    const payload = buildPixPayload({
      key,
      amount: 95,
      merchantName: "OJUARA SUPLEMENTOS",
      merchantCity: "OLINDINA",
    });

    const e164Key = "+5575999887766";
    const validation = validatePixPayload(payload, { key: e164Key, amount: 95 });
    expect(validation).toMatchObject({
      valid: true,
      errors: [],
      keyType: "phone",
      keyLength: e164Key.length,
      amount: "95.00",
      crcValid: true,
    });
    expect(payload).toContain(`01${String(e164Key.length).padStart(2, "0")}${e164Key}`);
    expect(crc16(payload.slice(0, -4))).toBe(payload.slice(-4));
  });
});