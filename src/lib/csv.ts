/**
 * Utilitas Parser dan Generator CSV RFC-4180 Murni TypeScript
 * Tanpa dependensi pihak ketiga, mendukung quote, koma dalam string, newline, dan escaping.
 */

export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  rawRows: string[][];
  errors: string[];
}

/**
 * Mem-parsing string CSV mentah menjadi baris-baris array string
 */
export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  // Normalisasi line endings: \r\n -> \n, \r -> \n
  const text = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote: "" -> "
        currentField += '"';
        i++; // lewati quote kedua
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      // Akhir kolom
      currentRow.push(currentField.trim());
      currentField = "";
    } else if (char === "\n" && !insideQuotes) {
      // Akhir baris
      currentRow.push(currentField.trim());
      // Hanya masukkan jika baris tidak kosong sama sekali
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  // Tambahkan field terakhir jika ada
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Mem-parsing CSV dengan baris pertama sebagai header objek
 */
export function parseCsv(csvText: string): ParsedCsvResult {
  const rawRows = parseCsvRows(csvText);
  const errors: string[] = [];

  if (rawRows.length === 0) {
    return { headers: [], rows: [], rawRows: [], errors: ["File CSV kosong."] };
  }

  // Header dinormalisasi ke lowercase & snake_case
  const headers = rawRows[0].map((h) =>
    h.toLowerCase().trim().replace(/[\s\t-]+/g, "_")
  );

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const rawCols = rawRows[i];
    const rowObj: Record<string, string> = {};

    headers.forEach((header, colIdx) => {
      rowObj[header] = rawCols[colIdx] !== undefined ? rawCols[colIdx].trim() : "";
    });

    rows.push(rowObj);
  }

  return { headers, rows, rawRows, errors };
}

/**
 * Menghasilkan string CSV dari array data
 */
export function generateCsv(headers: string[], dataRows: (string | number | null | undefined)[][]): string {
  const escapeField = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeField).join(",");
  const bodyLines = dataRows.map((row) => row.map(escapeField).join(","));

  return [headerLine, ...bodyLines].join("\r\n");
}
