/**
 * Export data to CSV and trigger browser download.
 * Adds BOM for Excel UTF-8 compatibility.
 */
export function exportToCSV(
  data: Record<string, any>[],
  filename: string,
  columns?: { key: string; label: string }[]
) {
  if (!data || data.length === 0) return

  const cols = columns ?? Object.keys(data[0]).map((key) => ({ key, label: key }))

  // Build CSV rows
  const header = cols.map((c) => csvEscape(c.label)).join(',')
  const rows = data.map((row) =>
    cols.map((c) => csvEscape(String(row[c.key] ?? ''))).join(',')
  )

  const csvContent = [header, ...rows].join('\n')

  // Add BOM for Excel UTF-8 compatibility
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  })

  // Trigger download
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}