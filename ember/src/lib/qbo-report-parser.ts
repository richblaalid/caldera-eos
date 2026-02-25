/**
 * Deterministic parser for QBO report JSON responses.
 *
 * QBO reports use a nested tree structure:
 *   { Rows: { Row: [ { type, group?, ColData?, Rows? } ] } }
 *
 * Row types:
 *   - "Section"  — container with nested Rows and a Summary row
 *   - "Data"     — leaf row with ColData values
 *
 * ColData is an array where index 0 is the label and index 1+ are values
 * (typically just one value column for current-period reports).
 */

type QBORow = {
  type?: string
  group?: string
  ColData?: Array<{ value: string }>
  Rows?: { Row?: QBORow[] }
  Summary?: { ColData?: Array<{ value: string }> }
  Header?: { ColData?: Array<{ value: string }> }
}

type QBOReport = {
  Rows?: { Row?: QBORow[] }
  Header?: Record<string, unknown>
  Columns?: Record<string, unknown>
}

/**
 * Extract the cash balance from a QBO Balance Sheet report.
 * Looks for "Bank Accounts" section total (Summary row).
 * Falls back to "Total Bank Accounts" label in ColData.
 */
export function extractCashBalance(report: Record<string, unknown>): number | null {
  const qbo = report as unknown as QBOReport
  const rows = qbo.Rows?.Row
  if (!rows) return null

  // Strategy 1: Find the "Bank Accounts" section and read its Summary
  const bankSection = findSectionByGroup(rows, 'BankAccounts')
    ?? findSectionByGroup(rows, 'Bank Accounts')
  if (bankSection?.Summary?.ColData?.[1]) {
    const val = parseFloat(bankSection.Summary.ColData[1].value)
    if (!isNaN(val)) return val
  }

  // Strategy 2: Walk all rows and find one labeled "Total Bank Accounts"
  const totalRow = findRowByLabel(rows, 'Total Bank Accounts')
  if (totalRow?.ColData?.[1]) {
    const val = parseFloat(totalRow.ColData[1].value)
    if (!isNaN(val)) return val
  }

  // Strategy 3: Find "Total Current Assets" as broader fallback
  // (some chart-of-accounts don't separate bank accounts)
  const currentAssetsSection = findSectionByGroup(rows, 'CurrentAssets')
    ?? findSectionByGroup(rows, 'Current Assets')
  if (currentAssetsSection?.Summary?.ColData?.[1]) {
    const val = parseFloat(currentAssetsSection.Summary.ColData[1].value)
    if (!isNaN(val)) return val
  }

  return null
}

/**
 * Extract total expenses from a QBO Profit and Loss report.
 * Looks for "Expenses" section total (Summary row).
 */
export function extractTotalExpenses(report: Record<string, unknown>): number | null {
  const qbo = report as unknown as QBOReport
  const rows = qbo.Rows?.Row
  if (!rows) return null

  // Strategy 1: Find "Expenses" section Summary
  const expensesSection = findSectionByGroup(rows, 'Expenses')
  if (expensesSection?.Summary?.ColData?.[1]) {
    const val = parseFloat(expensesSection.Summary.ColData[1].value)
    if (!isNaN(val)) return Math.abs(val)
  }

  // Strategy 2: Look for "Total Expenses" row label
  const totalRow = findRowByLabel(rows, 'Total Expenses')
  if (totalRow?.ColData?.[1]) {
    const val = parseFloat(totalRow.ColData[1].value)
    if (!isNaN(val)) return Math.abs(val)
  }

  return null
}

/** Recursively find a Section row by its `group` property */
function findSectionByGroup(rows: QBORow[], groupName: string): QBORow | null {
  for (const row of rows) {
    if (row.type === 'Section' && row.group === groupName) {
      return row
    }
    // Recurse into nested sections
    if (row.Rows?.Row) {
      const found = findSectionByGroup(row.Rows.Row, groupName)
      if (found) return found
    }
  }
  return null
}

/** Recursively find a Data row whose first ColData value matches a label */
function findRowByLabel(rows: QBORow[], label: string): QBORow | null {
  for (const row of rows) {
    if (row.ColData?.[0]?.value === label) {
      return row
    }
    if (row.Rows?.Row) {
      const found = findRowByLabel(row.Rows.Row, label)
      if (found) return found
    }
    if (row.Summary?.ColData?.[0]?.value === label) {
      return { ColData: row.Summary.ColData }
    }
  }
  return null
}
