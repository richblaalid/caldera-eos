declare module 'intuit-oauth' {
  interface OAuthClientConfig {
    clientId: string
    clientSecret: string
    environment: 'sandbox' | 'production'
    redirectUri: string
  }

  interface AuthorizeUriOptions {
    scope: string[]
    state?: string
  }

  interface TokenResponse {
    getJson(): {
      access_token: string
      refresh_token: string
      token_type: string
      expires_in: number
      x_refresh_token_expires_in: number
      realmId?: string
    }
    getToken(): {
      access_token: string
      refresh_token: string
      realmId?: string
    }
  }

  class OAuthClient {
    constructor(config: OAuthClientConfig)
    authorizeUri(options: AuthorizeUriOptions): string
    createToken(url: string): Promise<TokenResponse>
    refresh(): Promise<TokenResponse>
    refreshUsingToken(refreshToken: string): Promise<TokenResponse>
    makeApiCall(options: { url: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<{ json: unknown; response: unknown }>
    getToken(): { access_token: string; refresh_token: string; realmId?: string }
    setToken(token: { access_token: string; refresh_token: string; realmId?: string }): void
    static scopes: {
      Accounting: string
      Payment: string
      Payroll: string
      TimeTracking: string
      Benefits: string
      Profile: string
      Email: string
      Phone: string
      Address: string
      OpenId: string
    }
  }

  export default OAuthClient
}
