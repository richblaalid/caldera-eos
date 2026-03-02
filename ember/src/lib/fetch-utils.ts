/**
 * Fetch wrapper with configurable timeout using AbortController.
 * Prevents external API calls from hanging indefinitely and consuming
 * the Vercel function budget.
 */
export async function fetchWithTimeout(
  url: string | URL,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 30_000, ...fetchOptions } = options
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}
