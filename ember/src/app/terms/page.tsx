import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-8"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: February 23, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Ember (&quot;the Service&quot;), provided by Caldera LLC (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;),
              you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ember is an internal AI-powered business operations tool that integrates with third-party services
              including Google Workspace, Slack, HubSpot, QuickBooks, and Grain to provide business intelligence,
              meeting preparation, and EOS (Entrepreneurial Operating System) process support for authorized
              members of the Caldera leadership team.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Access and Authorization</h2>
            <p className="text-muted-foreground leading-relaxed">
              Access to Ember is restricted to authorized users of the Caldera organization. Access is granted
              via Google OAuth and is subject to an allowlist maintained by the organization administrator.
              Unauthorized access is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Third-Party Integrations</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service connects to third-party platforms to retrieve and process business data. By connecting
              a third-party account, you authorize Ember to access data from that service on your behalf in
              accordance with the permissions granted during the OAuth authorization process. Each integration
              accesses only the minimum scopes necessary for its function. You may disconnect any integration
              at any time through the Settings page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Data Usage</h2>
            <p className="text-muted-foreground leading-relaxed">
              Data retrieved from connected services is used solely for generating business intelligence,
              briefings, and operational insights for authorized users. We do not sell, share, or distribute
              your data to any third parties beyond what is necessary to operate the Service. For full details
              on data handling, see our <Link href="/privacy" className="text-ember-600 dark:text-ember-400 hover:underline">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. AI-Generated Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ember uses artificial intelligence to analyze data and generate briefings, recommendations, and
              insights. AI-generated content is provided for informational purposes and should not be treated
              as professional financial, legal, or business advice. Users are responsible for reviewing and
              validating AI-generated outputs before taking action.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is provided &quot;as is&quot; without warranties of any kind, either express or implied.
              Caldera LLC shall not be liable for any indirect, incidental, special, consequential, or punitive
              damages arising from your use of the Service, including but not limited to decisions made based on
              AI-generated content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Modifications</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these terms at any time. Changes will be effective when posted to
              this page. Continued use of the Service after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms of Service, contact us at{' '}
              <a href="mailto:rich@withcaldera.com" className="text-ember-600 dark:text-ember-400 hover:underline">
                rich@withcaldera.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
