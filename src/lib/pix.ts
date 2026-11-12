// Geração de BR Code Pix estático (padrão EMV/Banco Central) com valor.

const tlv = (id: string, value: string) =>
  `${id}${String(value.length).padStart(2, "0")}${value}`;

/** Remove acentos, caracteres não-ASCII e normaliza espaços. */
const sanitize = (input: string, maxLength: number) =>
  input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, maxLength);

/** CRC16-CCITT/FALSE (polinômio 0x1021, init 0xFFFF). */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixPayloadParams {
  key: string;
  amount: number;
  merchantName: string;
  merchantCity: string;
  txid?: string;
}

interface TlvField {
  id: string;
  length: number;
  value: string;
}

export interface PixPayloadValidation {
  valid: boolean;
  errors: string[];
  keyType: "email" | "phone" | "cpf" | "cnpj" | "random" | "unknown";
  keyLength: number;
  amount: string;
  crcValid: boolean;
}

function parseTlv(input: string): { fields: TlvField[]; errors: string[] } {
  const fields: TlvField[] = [];
  const errors: string[] = [];
  let offset = 0;

  while (offset < input.length) {
    if (offset + 4 > input.length) {
      errors.push(`Cabeçalho TLV incompleto na posição ${offset}.`);
      break;
    }

    const id = input.slice(offset, offset + 2);
    const lengthText = input.slice(offset + 2, offset + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lengthText)) {
      errors.push(`Cabeçalho TLV inválido na posição ${offset}.`);
      break;
    }

    const length = Number(lengthText);
    const valueStart = offset + 4;
    const valueEnd = valueStart + length;
    if (valueEnd > input.length) {
      errors.push(`Tamanho declarado do campo ${id} excede o payload.`);
      break;
    }

    fields.push({ id, length, value: input.slice(valueStart, valueEnd) });
    offset = valueEnd;
  }

  return { fields, errors };
}

function identifyKeyType(key: string): PixPayloadValidation["keyType"] {
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(key)) return "email";
  if (/^\+55\d{10,11}$/.test(key)) return "phone";
  if (/^\d{11}$/.test(key)) return "cpf";
  if (/^\d{14}$/.test(key)) return "cnpj";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return "random";
  return "unknown";
}

/** Valida localmente a estrutura do BR Code antes de sua renderização. */
export function validatePixPayload(
  payload: string,
  expected: Pick<PixPayloadParams, "key" | "amount">,
): PixPayloadValidation {
  const errors: string[] = [];
  const parsed = parseTlv(payload);
  errors.push(...parsed.errors);

  const expectedOrder = ["00", "26", "52", "53", "54", "58", "59", "60", "62", "63"];
  if (parsed.fields.map((field) => field.id).join(",") !== expectedOrder.join(",")) {
    errors.push("Ordem dos campos raiz inválida.");
  }

  const fields = new Map(parsed.fields.map((field) => [field.id, field]));
  if (fields.get("00")?.value !== "01") errors.push("Payload Format Indicator inválido.");
  if (fields.get("52")?.value !== "0000") errors.push("Merchant Category Code inválido.");
  if (fields.get("53")?.value !== "986") errors.push("Transaction Currency inválida.");
  if (fields.get("58")?.value !== "BR") errors.push("Country Code inválido.");

  const expectedAmount = expected.amount.toFixed(2);
  if (fields.get("54")?.value !== expectedAmount) errors.push("Transaction Amount divergente.");

  const merchantAccount = parseTlv(fields.get("26")?.value ?? "");
  errors.push(...merchantAccount.errors.map((error) => `Campo 26: ${error}`));
  const merchantFields = new Map(merchantAccount.fields.map((field) => [field.id, field]));
  if (merchantFields.get("00")?.value !== "br.gov.bcb.pix") errors.push("GUI Pix inválido no campo 26.00.");
  if (merchantFields.get("01")?.value !== expected.key) errors.push("Chave Pix divergente no campo 26.01.");

  const additionalData = parseTlv(fields.get("62")?.value ?? "");
  errors.push(...additionalData.errors.map((error) => `Campo 62: ${error}`));
  const additionalFields = new Map(additionalData.fields.map((field) => [field.id, field]));
  if (additionalFields.get("05")?.value !== "***") errors.push("Txid inválido no campo 62.05.");

  const crcField = fields.get("63");
  const crcInput = payload.slice(0, -4);
  const calculatedCrc = crc16(crcInput);
  const crcValid = crcField?.length === 4 && crcField.value === calculatedCrc;
  if (!crcValid) errors.push("CRC16 divergente.");

  return {
    valid: errors.length === 0,
    errors,
    keyType: identifyKeyType(expected.key),
    keyLength: expected.key.length,
    amount: expectedAmount,
    crcValid,
  };
}

/**
 * Normaliza a chave somente para o BR Code: telefone nacional com 11 dígitos
 * (DDD + número) vira formato internacional E.164 (+55...). Outros formatos
 * (e-mail, CPF, CNPJ, aleatória ou já em +55) são usados sem alteração.
 */
export function normalizePixKeyForBRCode(key: string): string {
  if (/^\d{11}$/.test(key)) return `+55${key}`;
  return key;
}

export function buildPixPayload({
  key,
  amount,
  merchantName,
  merchantCity,
  txid = "***",
}: PixPayloadParams): string {
  const brCodeKey = normalizePixKeyForBRCode(key);
  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", brCodeKey);

  const payload =
    tlv("00", "01") +
    tlv("26", merchantAccount) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", amount.toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", sanitize(merchantName, 25)) +
    tlv("60", sanitize(merchantCity, 15)) +
    tlv("62", tlv("05", txid)) +
    "6304";

  const result = payload + crc16(payload);
  const validation = validatePixPayload(result, { key: brCodeKey, amount });

  if (import.meta.env.DEV && validation.valid) {
    console.info("[Pix] Validação do BR Code", {
      valid: validation.valid,
      keyType: validation.keyType,
      keyLength: validation.keyLength,
      amount: validation.amount,
      crcValid: validation.crcValid,
      errors: validation.errors,
    });
  }

  if (!validation.valid) {
    throw new Error(`BR Code Pix inválido: ${validation.errors.join(" ")}`);
  }

  return result;
}
