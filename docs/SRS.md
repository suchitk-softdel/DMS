# IDEP Dealer App — Software Requirements Specification

| | |
|---|---|
| **Document** | Software Requirements Specification (SRS) |
| **Product** | IDEP Dealer App (Dealer Portal / Dealer Mobile App) |
| **Version** | 1.0 |
| **Prepared by** | Softdel Technologies — Product & Engineering |
| **Source material** | Dealer Management System.pptx; IDEP Execution & Development Flow; IDEP Platform Architecture; Dealer App UI Design Concept |

Specifies the functional and non-functional requirements for the dealer-facing experience layer
of Softdel's Intelligent Dealer Ecosystem Platform (IDEP).

## Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Functional Requirements](#3-functional-requirements)
4. [External Interface Requirements](#4-external-interface-requirements)
5. [System Architecture Overview](#5-system-architecture-overview)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Data Requirements](#7-data-requirements)
8. [Appendices](#8-appendices)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements for the Dealer App, the
dealer-facing application within Softdel's Intelligent Dealer Ecosystem Platform (IDEP). It is
intended for the product, engineering, QA and design teams responsible for building, testing and
evolving the application, and for manufacturer stakeholders reviewing scope.

### 1.2 Scope

The Dealer App gives a manufacturer's network dealers (illustrative persona: NorthStar HVAC) a
single application to manage orders and quotes, inventory, incentives, training, warranty claims
and sales opportunities — augmented throughout by an AI Dealer Copilot, an explainable Dealer 360
performance view, and predictive intelligence for inventory and incentives.

**Out of scope** for this document: manufacturer/executive-facing modules of IDEP — the AI
Channel Command Center and the Dealer Ecosystem Digital Twin — which are specified separately,
though they consume the same Unified Dealer Data and AI Intelligence layers described in
Section 5.

### 1.3 Definitions, Acronyms and Abbreviations

| Term | Meaning |
|---|---|
| IDEP | Intelligent Dealer Ecosystem Platform |
| SRS | Software Requirements Specification |
| Dealer 360 | The unified, explainable view of a single dealer's performance, health and history |
| Health Score | A weighted, explainable 0–100 score summarizing dealer performance |
| Copilot | The AI conversational assistant embedded in the Dealer App |
| RAG | Retrieval-Augmented Generation — grounding AI responses in retrieved data |
| SKU | Stock-Keeping Unit, a distinct inventory item |
| KPI | Key Performance Indicator |
| RBAC | Role-Based Access Control |
| API | Application Programming Interface |

### 1.4 References

- "Dealer Management System.pptx" — Softdel Dealer Ecosystem Transformation / IDEP deck
- "IDEP Execution and Development Flow.pdf" — Softdel Technologies
- "IDEP Platform Architecture — Block Diagram.pdf" — Softdel Technologies
- "Dealer App — UI Design Concept.pptx/.pdf" — Softdel Technologies

### 1.5 Document Overview

Section 2 describes the product at a high level. Section 3 lists detailed functional
requirements by module. Section 4 covers external interfaces. Section 5 summarizes the platform
architecture the app sits within. Section 6 lists non-functional requirements. Section 7 covers
data requirements, and Section 8 contains supporting appendices.

---

## 2. Overall Description

### 2.1 Product Perspective

The Dealer App is the dealer-facing portion of IDEP's Experience Layer (Dealer Portal and Dealer
Mobile App). It consumes services from the Integration Layer (APIs, events, orchestration,
identity), which in turn connects to the Unified Dealer Data Layer, the AI Intelligence Layer,
and underlying Enterprise Systems (ERP, CRM, Inventory, Warranty, Pricing, Service, Marketing).
See Section 5 for the full architecture.

### 2.2 Product Functions (Summary)

- **Home / Dashboard** — daily priorities, KPIs, AI insight, quick actions
- **Dealer Copilot** — conversational AI assistant available on every screen
- **Dealer 360** — the dealer's own performance, health score and timeline
- **Orders & Quotes** — create, track and fulfil orders
- **Inventory Intelligence** — demand forecasting and AI reorder recommendations
- **Incentives & Training** — program tracking, milestones and certifications
- **Warranty & Claims** — registration and kanban-style claim tracking
- **Sales Coach** — opportunity briefs, bundle recommendations and proposals

### 2.3 User Classes and Characteristics

| User Class | Description | Technical Expertise |
|---|---|---|
| Dealer Principal / Owner | Oversees overall dealership performance, incentives and strategic decisions. | Low–Medium |
| Dealer Sales Representative | Primary daily user: creates quotes/orders, uses Copilot and Sales Coach. | Medium |
| Dealer Service Technician | Registers warranties and submits/tracks claims; limited access to sales data. | Low |
| Manufacturer Administrator | Configures Health Score weights, incentive programs and access control (outside this app's UI, via admin tooling). | Medium–High |
| AI Copilot (system actor) | Automated actor that answers questions and triggers actions on the dealer's behalf, subject to guardrails. | N/A |

### 2.4 Operating Environment

- Responsive web application supporting desktop and tablet viewports, plus a companion mobile
  app (iOS and Android).
- Hosted on Microsoft Azure; current-generation evergreen browsers (Chrome, Edge, Safari).
- Mobile app requires camera access (claim photo capture) and microphone access (Copilot voice
  input).

### 2.5 Design and Implementation Constraints

- Must integrate with existing manufacturer ERP, CRM, Inventory, Warranty, Pricing, Service and
  Marketing systems exclusively through the Integration Layer's API Gateway and Event Bus — no
  direct point-to-point integrations.
- Must consume the shared Design System for all UI components to keep the experience consistent
  across Dealer App, Dealer Mobile App and Executive Portal.
- All AI-generated content and actions must pass through the AI Guardrails service before
  reaching the user.
- Must enforce Role-Based Access Control (RBAC) aligned with the user classes in Section 2.3.
- Target technology foundation: React, Next.js, Node.js, Python, Azure OpenAI, Microsoft Fabric,
  Power BI, Azure Maps.

### 2.6 Assumptions and Dependencies

- Enterprise systems expose the data and events required (orders, inventory levels, claims,
  training records) through APIs or an event stream.
- Dealer identity is federated through the manufacturer's identity provider via the Integration
  Layer.
- Sufficient historical transaction data exists to train and continuously improve forecasting
  and scoring models.
- Dealers have reviewed and recorded consent for their data to be used in AI-driven
  recommendations (see Section 7).

---

## 3. Functional Requirements

Requirements are grouped by application module, matching the screens defined in the Dealer App
UI Design Concept. Each requirement has a unique ID and a priority (High / Medium / Low) for
release planning.

### 3.1 Home / Dashboard (FR-HOME-#)

| ID | Requirement | Priority |
|---|---|---|
| FR-HOME-1 | The system shall display a personalized greeting with the dealer's name, loyalty tier and region. | High |
| FR-HOME-2 | The system shall display KPI tiles for Revenue (YTD), Health Score, Open Orders and Pending Claims, each with a trend indicator. | High |
| FR-HOME-3 | The system shall surface a single AI Insight banner generated by the AI Intelligence Layer, including supporting evidence and a one-click action. | High |
| FR-HOME-4 | The system shall provide Quick Action shortcuts (Create Quote, Register Warranty, Place Reorder, Submit Claim) reachable in one click from Home. | High |
| FR-HOME-5 | The system shall display a Recent Activity timeline of the dealer's most recent transactions and events. | Medium |
| FR-HOME-6 | The system shall refresh KPI tiles and the AI Insight at least once per session and on a configurable background interval. | Medium |

### 3.2 Dealer Copilot (FR-COP-#)

| ID | Requirement | Priority |
|---|---|---|
| FR-COP-1 | The system shall provide a persistent conversational AI interface accessible from every screen of the application. | High |
| FR-COP-2 | The Copilot shall answer natural-language questions using Retrieval-Augmented Generation (RAG) grounded in the dealer's own orders, inventory, claims, training and customer data. | High |
| FR-COP-3 | Every Copilot response containing a recommendation shall display the evidence used to generate it (e.g., sell-through, open quotes, regional forecast). | High |
| FR-COP-4 | The Copilot shall offer one-click actions (Place Reorder, Create Quote, Register Warranty, Submit Claim) directly from its responses. | High |
| FR-COP-5 | The system shall present suggested prompts relevant to the dealer's current context. | Medium |
| FR-COP-6 | The Copilot shall support voice input and search across product manuals, pricing sheets and internal documents. | Medium |
| FR-COP-7 | All Copilot outputs shall pass through the AI Guardrails service before being displayed to the user. | High |

### 3.3 Dealer 360 (My Performance) (FR-D360-#)

| ID | Requirement | Priority |
|---|---|---|
| FR-D360-1 | The system shall display the dealer's Revenue, Growth %, Health Score and Territory Coverage as summary tiles. | High |
| FR-D360-2 | The system shall render a Revenue Trend chart over a rolling, user-selectable window (e.g., 6 or 12 months). | High |
| FR-D360-3 | The system shall display an explainable Health Score broken down into weighted components (e.g., Revenue Growth, Order Velocity, Warranty Compliance, Training Completion). | High |
| FR-D360-4 | The system shall present AI-generated recommendations tied to specific Health Score components, each with an evidence trace. | High |
| FR-D360-5 | The system shall display a chronological Dealer Timeline of key events (orders, claims, training, escalations). | Medium |
| FR-D360-6 | Health Score component weights shall be configurable by a Manufacturer Administrator without a code change. | Medium |

### 3.4 Orders & Quotes (FR-ORD-#)

| ID | Requirement | Priority |
|---|---|---|
| FR-ORD-1 | The system shall allow dealers to create, save as draft, submit and track quotes and orders. | High |
| FR-ORD-2 | The system shall display a filterable, sortable list of orders showing Order ID, Customer, Amount, Status and Date. | High |
| FR-ORD-3 | The system shall support filtering by status (Draft, Submitted, Approved, Fulfilled) and free-text search. | High |
| FR-ORD-4 | The system shall render order status using a consistent status-chip visual pattern shared across the application. | Medium |
| FR-ORD-5 | The system shall surface an AI-generated Order Insight predicting which open quotes are likely to close, linking to Sales Coach for action. | Medium |
| FR-ORD-6 | The system shall notify the dealer of orders awaiting approval. | High |

### 3.5 Inventory Intelligence (FR-INV-#)

| ID | Requirement | Priority |
|---|---|---|
| FR-INV-1 | The system shall display Inventory Risk level, 30-day Stock-out count, Overstock value and Forecast Accuracy as summary tiles. | High |
| FR-INV-2 | The system shall render a Demand vs. Supply trend chart over a rolling multi-week horizon. | High |
| FR-INV-3 | The system shall identify the single highest-risk SKU and present a recommended action with its projected financial or operational impact. | High |
| FR-INV-4 | The system shall provide a ranked AI Reorder Recommendations table (SKU, Risk level, Recommendation, Impact). | High |
| FR-INV-5 | The system shall allow the dealer to approve and trigger a reorder directly from a recommendation. | High |
| FR-INV-6 | Risk levels shall be visually encoded consistently with the rest of the application (e.g., High = red, Medium = amber). | Medium |

### 3.6 Incentives & Training (FR-INC-#)

| ID | Requirement | Priority |
|---|---|---|
| FR-INC-1 | The system shall display forecasted incentive earnings for the current period and the dealer's rank among peer dealers. | High |
| FR-INC-2 | The system shall show a progress bar for each active incentive program with percentage to next milestone and amount earned. | High |
| FR-INC-3 | The system shall recommend a specific action to help the dealer reach the next incentive tier. | Medium |
| FR-INC-4 | The system shall display the dealer's certifications and in-progress training courses with completion percentage. | High |
| FR-INC-5 | The system shall list upcoming training events and webinars relevant to the dealer. | Low |
| FR-INC-6 | The system shall allow the dealer to invite team members to training. | Medium |

### 3.7 Warranty & Claims (FR-WAR-#)

| ID | Requirement | Priority |
|---|---|---|
| FR-WAR-1 | The system shall allow dealers to register a warranty and submit a claim with required evidence (SKU, amount, description, supporting photo). | High |
| FR-WAR-2 | The system shall present claims on a kanban board with stages: Submitted, Under Review, Approved, Reimbursed. | High |
| FR-WAR-3 | Each claim card shall display Claim ID, SKU, Amount and Age (days in current stage). | High |
| FR-WAR-4 | The system shall display summary metrics: Open Claims, Average Resolution Time and Approval Rate. | Medium |
| FR-WAR-5 | The system shall notify the dealer when a claim ages beyond a configurable threshold (default 10 days). | Medium |

### 3.8 Sales Coach (FR-SC-#)

| ID | Requirement | Priority |
|---|---|---|
| FR-SC-1 | The system shall generate a customer brief summarizing opportunity context (budget, decision timeline, stated need). | Medium |
| FR-SC-2 | The system shall recommend a product/solution bundle ranked by fit, with a rationale per recommended item. | Medium |
| FR-SC-3 | The system shall display a win-probability score for the opportunity. | Medium |
| FR-SC-4 | The system shall generate a draft proposal document from the recommended bundle. | Low |
| FR-SC-5 | The system shall suggest competitive positioning guidance when a competitor is identified on the opportunity. | Low |

---

## 4. External Interface Requirements

### 4.1 User Interfaces

The application shall implement the screens and interaction patterns defined in the "Dealer
App — UI Design Concept" deliverable: a persistent left navigation rail, a top bar with global
search and notifications, card-based KPI tiles, filterable list views with status chips, kanban
boards for claims, and progress trackers for incentives and training. The UI shall meet WCAG 2.1
Level AA accessibility guidelines and remain usable down to tablet viewport widths.

### 4.2 Hardware Interfaces

- Mobile device camera — for capturing warranty claim evidence photos.
- Mobile device microphone — for Dealer Copilot voice input.

### 4.3 Software Interfaces

| System | Data / Capability Exchanged |
|---|---|
| ERP | Orders, pricing, financials |
| CRM | Accounts, contacts, opportunities |
| Inventory Management | Stock levels, SKU master data, demand signals |
| Warranty Management | Warranty registrations, claims, resolution status |
| Pricing Engine | List and promotional pricing |
| Field Service | Service history relevant to claims |
| Marketing Automation | Promotions, campaign eligibility |

All of the above are accessed exclusively through the Integration Layer; the Dealer App holds no
direct connections to enterprise systems.

### 4.4 Communication Interfaces

- REST/GraphQL APIs via the Integration Layer's API Gateway for request/response operations.
- An Event Bus (publish/subscribe) for near-real-time updates such as order status changes and
  inventory level changes.
- OAuth2 / OIDC for dealer identity federation and session management.

---

## 5. System Architecture Overview

The Dealer App is the dealer-facing part of the Experience Layer in IDEP's five-layer
architecture. This section is a summary; see "IDEP Platform Architecture — Block Diagram" for
the full diagram.

| Layer | Contents |
|---|---|
| **Experience Layer** | Dealer Portal (this app) • Dealer Mobile App • Executive Portal • Shared Design System |
| **Integration Layer** | APIs • Events • Orchestration • Identity |
| **Unified Dealer Data Layer** | Dealer 360 semantic model • History • Consent |
| **AI Intelligence Layer** | RAG • Forecasting • Scoring • Agents • Guardrails |
| **Enterprise Systems** | ERP • CRM • Inventory • Warranty • Pricing • Service • Marketing |

The Dealer App itself implements only the Experience Layer. All data access, AI reasoning and
enterprise-system integration are delegated to the layers beneath it, so the app remains a thin,
configurable presentation layer that can be re-skinned per manufacturer without touching
business logic.

---

## 6. Non-Functional Requirements

### 6.1 Performance

- Home dashboard and list views (Orders, Inventory) shall load within 2 seconds (P95) under
  normal load.
- Dealer Copilot responses shall begin streaming within 1.5 seconds of the user's query.

### 6.2 Security

- Role-Based Access Control (RBAC) shall govern feature and data visibility per user class.
- Data shall be encrypted at rest and in transit.
- The AI Guardrails service shall screen all AI outputs for prompt injection, data leakage and
  policy violations before display.
- All write actions (orders, claims, reorders) shall be audit-logged.

### 6.3 Availability and Reliability

- The Dealer App shall target a 99.5% uptime SLA.
- Core transactional features (viewing orders, submitting claims) shall remain usable in a
  degraded mode if the AI Intelligence Layer is temporarily unavailable.

### 6.4 Scalability

- The application shall support at least 10,000 concurrent dealer users across a manufacturer's
  network, scaling horizontally via the shared API Gateway and Event Bus.

### 6.5 Usability

- Interaction patterns shall follow established enterprise-app conventions (per the UI Design
  Concept, informed by Salesforce and Zoho CRM) so a first-time dealer can complete common tasks
  (create a quote, submit a claim) without training.

### 6.6 Compliance and Data Privacy

- Dealer consent for use of their data in AI-driven recommendations shall be captured and stored
  in the Unified Dealer Data Layer.
- Data retention and access shall align with applicable data-protection regulations.
- Personally identifiable information shall be minimized in AI prompts and logs.

### 6.7 Maintainability

- All UI components shall be sourced from the shared Design System so visual and interaction
  changes propagate without per-screen rework.
- AI prompts, guardrail policies and Health Score weights shall be configurable outside of code
  deployments.

### 6.8 AI Explainability

- Every AI-driven score or recommendation (Health Score, reorder suggestion, incentive forecast)
  shall expose the factors or evidence that produced it.

---

## 7. Data Requirements

The Dealer App reads from and writes to the Unified Dealer Data Layer; it does not maintain its
own system of record. Key data entities required to support the functional requirements in
Section 3:

| Entity | Description | Used By |
|---|---|---|
| Dealer Profile | Identity, tier, territory, certifications | Home, Dealer 360 |
| Transaction History | Orders, quotes, claims, incentive payouts | Orders, Warranty, Incentives |
| Consent Record | Dealer's consent for AI use of their data | All AI features |
| SKU / Inventory Master | Product catalog, stock levels, demand signals | Inventory Intelligence |
| Health Score Weights | Configurable weighting per score component | Dealer 360 |
| Training Records | Courses, completion status, certifications | Incentives & Training |

---

## 8. Appendices

### 8.1 Module-to-Build-Phase Traceability

Cross-references the modules in Section 3 to the phased development roadmap defined in "IDEP
Execution and Development Flow.pdf".

| Module | Requirement IDs | Build Phase |
|---|---|---|
| Home / Dashboard | FR-HOME-1 – FR-HOME-6 | Phase 1 |
| Dealer Copilot | FR-COP-1 – FR-COP-7 | Phase 1 |
| Dealer 360 | FR-D360-1 – FR-D360-6 | Phase 2 |
| Orders & Quotes | FR-ORD-1 – FR-ORD-6 | Phase 2 |
| Inventory Intelligence | FR-INV-1 – FR-INV-6 | Phase 2–3 |
| Incentives & Training | FR-INC-1 – FR-INC-6 | Phase 2 |
| Warranty & Claims | FR-WAR-1 – FR-WAR-5 | Phase 1–2 |
| Sales Coach | FR-SC-1 – FR-SC-5 | Phase 3 |

### 8.2 Open Items for Review

- Confirm final RBAC matrix (which user classes may approve reorders vs. only recommend them).
- Confirm data retention periods for claim photos and Copilot conversation logs.
- Confirm whether Sales Coach proposal generation (FR-SC-4) requires manufacturer legal/branding
  review before send.

*End of document.*
