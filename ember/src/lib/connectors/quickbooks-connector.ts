import type { DataConnector, ConnectorPullParams, ConnectorResult, ConnectorRecord, ConnectorError } from './types'

const QBO_BASE_URL = process.env.QUICKBOOKS_ENVIRONMENT === 'sandbox'
  ? 'https://sandbox-quickbooks.api.intuit.com'
  : 'https://quickbooks.api.intuit.com'

/**
 * QuickBooks connector that pulls financial data (invoices, payments, P&L, AR aging).
 * Implements DataConnector interface for the data ingestion pipeline.
 */
export const quickbooksConnector: DataConnector = {
  source: 'quickbooks',

  async pull(params: ConnectorPullParams): Promise<ConnectorResult> {
    const { config } = params
    const refreshToken = config.quickbooks_refresh_token as string
    const realmId = config.quickbooks_realm_id as string

    if (!refreshToken || !realmId) {
      return { records: [], errors: [{ code: 'NO_TOKEN', message: 'No QuickBooks credentials', recoverable: false }] }
    }

    const errors: ConnectorError[] = []

    // Refresh the access token (direct HTTP — intuit-oauth library has a bug with url.parse)
    let accessToken: string
    let newRefreshToken: string | undefined
    try {
      const tokenData = await refreshQBOToken(refreshToken)
      accessToken = tokenData.access_token
      newRefreshToken = tokenData.refresh_token
    } catch (error: unknown) {
      const err = error as { message?: string }
      console.error('QBO token refresh failed:', err.message)
      return { records: [], errors: [{ code: 'TOKEN_REFRESH_FAILED', message: err.message || 'Token refresh failed', recoverable: true }] }
    }

    const records: ConnectorRecord[] = []

    // Pull invoices (last 90 days)
    try {
      const invoices = await queryQBO(accessToken, realmId, buildInvoiceQuery())
      for (const invoice of invoices) {
        records.push(normalizeInvoice(invoice))
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      errors.push({ code: 'INVOICE_FETCH_FAILED', message: err.message || 'Invoice fetch failed', recoverable: true })
    }

    // Pull payments (last 30 days)
    try {
      const payments = await queryQBO(accessToken, realmId, buildPaymentQuery())
      for (const payment of payments) {
        records.push(normalizePayment(payment))
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      errors.push({ code: 'PAYMENT_FETCH_FAILED', message: err.message || 'Payment fetch failed', recoverable: true })
    }

    // Pull P&L summary (current month)
    try {
      const pnl = await fetchReport(accessToken, realmId, 'ProfitAndLoss')
      if (pnl) {
        records.push(normalizePnlReport(pnl))
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      errors.push({ code: 'PNL_FETCH_FAILED', message: err.message || 'P&L fetch failed', recoverable: true })
    }

    // Pull AR aging
    try {
      const arAging = await fetchReport(accessToken, realmId, 'AgedReceivableDetail')
      if (arAging) {
        records.push(normalizeArAging(arAging))
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      errors.push({ code: 'AR_FETCH_FAILED', message: err.message || 'AR aging fetch failed', recoverable: true })
    }

    // Pull Balance Sheet (for cash balance — used by scorecard automation)
    try {
      const balanceSheet = await fetchReport(accessToken, realmId, 'BalanceSheet')
      if (balanceSheet) {
        records.push(normalizeBalanceSheet(balanceSheet))
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      errors.push({ code: 'BALANCE_SHEET_FAILED', message: err.message || 'Balance Sheet fetch failed', recoverable: true })
    }

    // Pull trailing 3-month P&L (for expense averaging — used by scorecard automation)
    try {
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      const startDate = threeMonthsAgo.toISOString().split('T')[0]
      const endDate = new Date().toISOString().split('T')[0]

      const pnl3mo = await fetchReport(
        accessToken, realmId, 'ProfitAndLoss',
        { start_date: startDate, end_date: endDate }
      )
      if (pnl3mo) {
        records.push({
          source: 'quickbooks',
          sourceId: `pnl-3mo-${endDate}`,
          dataType: 'financial_report',
          payload: {
            report_type: 'profit_and_loss_3mo',
            report_data: pnl3mo,
            start_date: startDate,
            end_date: endDate,
          },
          rawPayload: pnl3mo,
          entities: { topics: ['profit_loss', 'expense_trend'] },
          relevanceTags: ['financial', 'report', 'pnl_3mo'],
          sourceTimestamp: new Date().toISOString(),
        })
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      errors.push({ code: 'PNL_3MO_FAILED', message: err.message || '3-month P&L fetch failed', recoverable: true })
    }

    return {
      records,
      syncState: newRefreshToken ? { quickbooks_refresh_token: newRefreshToken } : undefined,
      errors,
    }
  },
}

/**
 * Refresh a QBO token via direct HTTP POST (bypasses intuit-oauth library
 * which has a url.parse bug on newer Node.js versions).
 */
async function refreshQBOToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID!
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: body.toString(),
  })

  const data = await response.json()

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Token refresh failed: ${response.status}`)
  }

  return { access_token: data.access_token, refresh_token: data.refresh_token }
}

/**
 * Run a QBO query API call.
 */
async function queryQBO(accessToken: string, realmId: string, query: string): Promise<Record<string, unknown>[]> {
  const url = `${QBO_BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`QBO query failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const queryResponse = data.QueryResponse || {}
  // QBO returns results under the entity type key (Invoice, Payment, etc.)
  const entityKey = Object.keys(queryResponse).find(k => k !== 'startPosition' && k !== 'maxResults' && k !== 'totalCount')
  return entityKey ? (queryResponse[entityKey] as Record<string, unknown>[]) : []
}

/**
 * Fetch a QBO report.
 */
async function fetchReport(
  accessToken: string, realmId: string, reportType: string,
  params?: Record<string, string>
): Promise<Record<string, unknown> | null> {
  let url = `${QBO_BASE_URL}/v3/company/${realmId}/reports/${reportType}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    url += `?${qs}`
  }
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`QBO report failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

function buildInvoiceQuery(): string {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return `SELECT * FROM Invoice WHERE TxnDate >= '${ninetyDaysAgo}' ORDERBY TxnDate DESC MAXRESULTS 100`
}

function buildPaymentQuery(): string {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return `SELECT * FROM Payment WHERE TxnDate >= '${thirtyDaysAgo}' ORDERBY TxnDate DESC MAXRESULTS 50`
}

function normalizeInvoice(invoice: Record<string, unknown>): ConnectorRecord {
  const customerRef = invoice.CustomerRef as { value?: string; name?: string } | undefined
  const totalAmt = invoice.TotalAmt as number || 0
  const balance = invoice.Balance as number || 0
  const dueDate = invoice.DueDate as string || null
  const txnDate = invoice.TxnDate as string || null

  // Calculate days outstanding
  const daysOutstanding = dueDate
    ? Math.floor((Date.now() - new Date(dueDate).getTime()) / (24 * 60 * 60 * 1000))
    : 0

  return {
    source: 'quickbooks',
    sourceId: `invoice-${invoice.Id}`,
    dataType: 'invoice',
    payload: {
      invoice_number: invoice.DocNumber,
      customer_name: customerRef?.name || 'Unknown',
      customer_id: customerRef?.value,
      total_amount: totalAmt,
      balance_due: balance,
      due_date: dueDate,
      txn_date: txnDate,
      status: balance === 0 ? 'paid' : (daysOutstanding > 0 ? 'overdue' : 'open'),
      days_outstanding: daysOutstanding > 0 ? daysOutstanding : 0,
    },
    rawPayload: invoice,
    entities: {
      companies: customerRef?.name ? [customerRef.name] : [],
      topics: ['invoicing', 'accounts_receivable'],
    },
    relevanceTags: [
      'financial',
      balance > 0 ? 'outstanding' : 'paid',
      ...(daysOutstanding > 45 ? ['ar_aging_alert'] : []),
    ],
    sourceTimestamp: txnDate ? new Date(txnDate).toISOString() : null,
  }
}

function normalizePayment(payment: Record<string, unknown>): ConnectorRecord {
  const customerRef = payment.CustomerRef as { value?: string; name?: string } | undefined
  const totalAmt = payment.TotalAmt as number || 0
  const txnDate = payment.TxnDate as string || null

  return {
    source: 'quickbooks',
    sourceId: `payment-${payment.Id}`,
    dataType: 'payment',
    payload: {
      customer_name: customerRef?.name || 'Unknown',
      customer_id: customerRef?.value,
      amount: totalAmt,
      txn_date: txnDate,
      payment_method: payment.PaymentMethodRef,
    },
    rawPayload: payment,
    entities: {
      companies: customerRef?.name ? [customerRef.name] : [],
      topics: ['payment', 'cash_flow'],
    },
    relevanceTags: ['financial', 'payment'],
    sourceTimestamp: txnDate ? new Date(txnDate).toISOString() : null,
  }
}

function normalizePnlReport(report: Record<string, unknown>): ConnectorRecord {
  return {
    source: 'quickbooks',
    sourceId: `pnl-${new Date().toISOString().split('T')[0]}`,
    dataType: 'financial_report',
    payload: {
      report_type: 'profit_and_loss',
      report_data: report,
    },
    rawPayload: report,
    entities: {
      topics: ['profit_loss', 'financial_summary'],
    },
    relevanceTags: ['financial', 'report', 'pnl'],
    sourceTimestamp: new Date().toISOString(),
  }
}

function normalizeBalanceSheet(report: Record<string, unknown>): ConnectorRecord {
  return {
    source: 'quickbooks',
    sourceId: `balance-sheet-${new Date().toISOString().split('T')[0]}`,
    dataType: 'financial_report',
    payload: {
      report_type: 'balance_sheet',
      report_data: report,
    },
    rawPayload: report,
    entities: {
      topics: ['balance_sheet', 'cash_position'],
    },
    relevanceTags: ['financial', 'report', 'balance_sheet'],
    sourceTimestamp: new Date().toISOString(),
  }
}

function normalizeArAging(report: Record<string, unknown>): ConnectorRecord {
  return {
    source: 'quickbooks',
    sourceId: `ar-aging-${new Date().toISOString().split('T')[0]}`,
    dataType: 'financial_report',
    payload: {
      report_type: 'ar_aging',
      report_data: report,
    },
    rawPayload: report,
    entities: {
      topics: ['accounts_receivable', 'aging'],
    },
    relevanceTags: ['financial', 'report', 'ar_aging'],
    sourceTimestamp: new Date().toISOString(),
  }
}
