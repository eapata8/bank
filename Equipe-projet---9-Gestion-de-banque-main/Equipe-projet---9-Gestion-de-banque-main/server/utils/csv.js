/**
 * Convertit un tableau de lignes en chaîne CSV.
 * @param {object[]} rows  - données à exporter
 * @param {{ key: string, label: string }[]} columns - colonnes à inclure
 */
export function toCSV(rows, columns) {
  const escape = (val) => {
    const str = val == null ? "" : String(val);
    const needsQuotes =
      str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r");
    return needsQuotes ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escape(row[c.key])).join(","))
    .join("\n");

  // BOM UTF-8 pour Excel (sinon les accents sont mal encodés)
  return "\uFEFF" + header + "\n" + body;
}

/**
 * Envoie la réponse CSV avec les bons headers.
 */
export function sendCSV(res, filename, csv) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}
