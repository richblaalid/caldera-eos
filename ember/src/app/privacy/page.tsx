import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
}

export default function PrivacyPage() {
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

        <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: February 23, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ember is an internal business operations tool operated by Caldera LLC (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
              for use by authorized members of the Caldera leadership team. This Privacy Policy describes how we
              collect, use, and protect information when you use Ember.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              When you use Ember, we collect and process the following categories of information:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span><strong className="text-foreground">Account information:</strong> Name, email address, and profile photo from your Google account, used for authentication.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span><strong className="text-foreground">Email data:</strong> Subject lines, senders, and snippets from your Gmail account to provide briefing context. Email bodies are not stored.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span><strong className="text-foreground">Calendar data:</strong> Event titles, times, and attendees from your Google Calendar to support meeting preparation.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span><strong className="text-foreground">CRM data:</strong> Deal information, contacts, and company records from HubSpot for sales pipeline intelligence.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span><strong className="text-foreground">Financial data:</strong> Invoices, payments, profit and loss reports, and accounts receivable from QuickBooks for financial analysis.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span><strong className="text-foreground">Meeting transcripts:</strong> AI-generated meeting notes and transcripts from Grain for meeting intelligence and follow-up tracking.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span><strong className="text-foreground">Slack interactions:</strong> Messages sent to or from the Ember bot in Slack for command processing and briefing delivery.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Information collected is used exclusively for:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span>Generating personalized morning briefings and business intelligence reports</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span>Preparing meeting context and pre-call intelligence</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span>Tracking EOS metrics including Rocks, Scorecard, Issues, and To-dos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span>Providing financial and sales pipeline analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span>Delivering proactive reminders and accountability nudges</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Data Storage and Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Data is stored securely in a Supabase-hosted PostgreSQL database with row-level security
              policies ensuring that users can only access data belonging to their organization. OAuth
              tokens are stored encrypted and are never exposed to the client. All data is transmitted
              over HTTPS. The application is hosted on Vercel with enterprise-grade infrastructure security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Ember integrates with the following third-party services. Each integration is optional and
              can be disconnected at any time:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span><strong className="text-foreground">Google Workspace</strong> (Gmail, Calendar) &mdash; email and calendar data access</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span><strong className="text-foreground">Slack</strong> &mdash; message delivery and command processing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span><strong className="text-foreground">HubSpot</strong> &mdash; CRM and sales pipeline data</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span><strong className="text-foreground">QuickBooks Online</strong> &mdash; financial data including invoices, payments, and reports</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span><strong className="text-foreground">Grain</strong> &mdash; meeting transcripts and AI-generated notes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-ember-500 mt-1 font-bold">&bull;</span>
                <span><strong className="text-foreground">Anthropic (Claude)</strong> &mdash; AI processing for analysis and content generation</span>
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Data shared with AI services (Anthropic) is used solely for generating responses and is not
              retained by the AI provider for training purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Data Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell, rent, or share your personal or business data with third parties for marketing
              or any purpose unrelated to the operation of the Service. Data is shared only with the
              third-party service providers listed above, and only to the extent necessary to provide the
              Service&apos;s features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ingested data is retained for the period necessary to provide business intelligence and
              historical trend analysis. OAuth tokens are retained as long as the integration is active.
              You may request deletion of your data or disconnect integrations at any time through the
              Settings page or by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may at any time: disconnect any third-party integration, request a copy of your stored data,
              request deletion of your data, or revoke Ember&apos;s access to any connected service by revoking
              permissions directly in that service&apos;s settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. Changes will be posted on this page with
              an updated &quot;Last updated&quot; date. Continued use of the Service after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about this Privacy Policy or to exercise your data rights, contact us at{' '}
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
