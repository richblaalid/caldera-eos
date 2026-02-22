# ADR-010: Business Model Transformation Support

**Status:** Accepted
**Date:** February 22, 2026
**Decision Makers:** Rich (CEO/Integrator)
**Context:** How the agent system actively supports Caldera's shift from time-based billing to value-based fixed-fee engagements

---

## Context

Caldera is undergoing a fundamental business model transformation. The company historically bills for team capacity (monthly team-based, sized-based billing). AI tooling is making the team faster, but under the current model, faster delivery means less revenue. The strategic shift is toward fixed-fee, value-based engagements where Caldera captures margin from efficiency gains rather than being penalized for speed.

This is not a one-time project — it's an ongoing transformation that affects pricing, positioning, scoping, delivery, sales, and financial modeling. The agent system should be an active partner in this transformation, not just a passive observer.

## Decision

**Every advisory agent has a standing directive related to the business model transformation.** The transformation is not assigned to a single agent — it cross-cuts all domains.

### Agent-Specific Transformation Responsibilities

**Financial Strategist — Modeling and Measurement:**
- Track margin per engagement, segmented by billing model (T&M vs. fixed-fee)
- Model scenarios: "What would this engagement look like as fixed-fee vs. T&M?"
- Track speed-to-delivery improvements and quantify the margin opportunity
- Report on revenue mix (% T&M vs. % fixed-fee) as a Scorecard metric
- Identify engagements where T&M is actively costing Caldera money (team delivers fast but bills less)

**Marketing Strategist — Positioning the Shift:**
- Develop messaging frameworks that sell outcomes, not hours
- Position Caldera as "AI-powered product consultancy" — not staff augmentation
- Create content themes around value delivery, speed-to-market, and business outcomes
- Monitor how competitors are positioning their pricing models
- Develop case study frameworks that quantify client value received (not hours delivered)

**Business Development Strategist — Selling the New Model:**
- Develop pitch frameworks for fixed-fee engagements
- Create talking points for John that reframe client conversations around outcomes
- Identify prospects where fixed-fee positioning is most compelling (startups, speed-sensitive clients)
- Maintain parallel approach: enterprise prospects (longer-cycle T&M) vs. mid-market/startup (fixed-fee)
- Track win rates by billing model to prove which approach wins more

**Operations Architect — Making Fixed-Fee Profitable:**
- Develop scoping methodology that makes fixed-fee bids accurate and profitable
- Build historical database of actual effort vs. estimated effort by engagement type
- Create engagement type templates: "AI consultation sprint," "zero-to-one product build," "platform modernization"
- Implement scope variance tracking specifically for fixed-fee engagements
- Define the internal delivery process that maximizes efficiency (and therefore margin)

**Product Innovation Officer — Building Leverage:**
- Identify opportunities to productize repeatable solution patterns
- Evaluate which delivery accelerators (templates, frameworks, tools) the team builds that could become products
- Model the revenue potential of SaaS/product revenue vs. services revenue
- Propose "build during bench time" product sprints that create long-term value

### Tracking the Transformation

New Scorecard metrics proposed for EOS:

| Metric | Target Direction | Owner |
|--------|-----------------|-------|
| Revenue mix: % fixed-fee vs. % T&M | ↑ fixed-fee over time | Financial Strategist |
| Average margin: fixed-fee engagements | ↑ (target: 40%+) | Financial Strategist |
| Average margin: T&M engagements | Maintain (target: 30%+) | Financial Strategist |
| Speed improvement: avg delivery time vs. 6mo ago | ↓ delivery time | Operations Architect |
| Fixed-fee scoping accuracy: actual vs. estimated | → converge to 1.0 | Operations Architect |
| Pipeline: % prospects pitched on fixed-fee | ↑ over time | BD Strategist |
| Win rate: fixed-fee proposals | Track and improve | BD Strategist |

### Market Segmentation Support

The agents maintain awareness of Caldera's dual-market approach:

**Enterprise Segment (John's thesis):**
- Fortune 500, slower-moving, longer sales cycles
- More likely to accept traditional T&M or retainer models
- Value: stability, predictable revenue, deep relationships
- BD Strategist focuses on partnership and portfolio arrangements

**Mid-Market / Startup Segment:**
- Speed-sensitive, budget-conscious, outcome-oriented
- Natural fit for fixed-fee model
- Value: higher margin per engagement, faster sales cycle, portfolio diversification
- BD Strategist focuses on fixed-fee positioning and rapid qualification

## Consequences

**Positive:**
- The business model transformation is embedded in daily agent operations, not treated as a separate initiative
- Financial tracking provides real data to validate the shift (or course-correct)
- Each agent contributes to the transformation from their domain, creating a coordinated push
- The transformation becomes measurable through EOS Scorecard integration

**Negative:**
- Risk of agents over-emphasizing fixed-fee in situations where T&M is genuinely better for the client
- Transformation metrics add complexity to the Scorecard — start with 2-3 key metrics, expand as EOS matures

**Guardrail:**
Agents should recommend the engagement model that's best for the client and for Caldera — not blindly push fixed-fee. The goal is optionality and intelligence about which model fits each situation, informed by data.
