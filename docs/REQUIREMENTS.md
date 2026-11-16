# Manufacturer & Dealer Management Portal with AI-Powered Analytics

**Project Overview & Functional Requirements** — Project scope: initial requirement.

> **Reference only.** The main requirements document is [`SRS.md`](SRS.md). From this document
> the project adopts one decision: the AI part is built with our own logic and algorithms, with
> no third-party AI service, API or key (sections 7–9).

**Document purpose:** organized initial project scope, application modules, functional
requirements, AI approach, and mock-data strategy for a centralized manufacturer and dealer
management portal. Initial implementation will use hardcoded/mock data rather than a live
database or production user data.

## Contents

1. [Project Overview](#1-project-overview)
2. [Application Modules](#2-application-modules)
3. [Manufacturer Management Module](#3-manufacturer-management-module)
4. [Dealer Management Module](#4-dealer-management-module)
5. [Order Management Module](#5-order-management-module)
6. [Product Claims Management Module](#6-product-claims-management-module)
7. [AI Module – Sales Forecasting](#7-ai-module--sales-forecasting)
8. [AI Module – Intelligent Data Query and Business Insights](#8-ai-module--intelligent-data-query-and-business-insights)
9. [AI Implementation Approach](#9-ai-implementation-approach)
10. [Mock Data Generation Strategy](#10-mock-data-generation-strategy)

---

## 1. Project Overview

The objective of this project is to develop a centralized web application for automobile
manufacturers and their associated dealers to manage dealer information, sales, orders, product
claims, and business analytics.

Automobile manufacturers generally operate through multiple dealers distributed across different
cities and regions. The application will provide a centralized platform for manufacturers to
monitor dealer performance, track sales, manage orders, and analyze business operations.

Similarly, dealers will have access to their own portal, where they can manage orders, monitor
sales performance, submit product claims, and analyze their business data.

The application will also incorporate AI-based capabilities to provide sales forecasting,
historical data analysis, and an intelligent query interface.

> **Initial implementation:** the initial implementation will use hardcoded/mock data rather than
> a live database or production user data.

## 2. Application Modules

- Manufacturer Management
- Dealer Management
- Order Management
- Product Claims Management
- Sales & Business Analytics
- AI-Based Forecasting
- AI-Powered Data Query and Insights

## 3. Manufacturer Management Module

The Manufacturer module will provide manufacturers with a centralized view of all their
associated dealers and their business performance.

### A. Dealer Overview

- Display the total number of dealers associated with a manufacturer.
- View dealers based on city, state, and region.
- Maintain dealer information and contact details.
- Monitor active and inactive dealers.
- View dealer-wise performance.

### B. Sales Analytics

- Total sales across all dealers.
- Dealer-wise sales performance.
- Monthly, quarterly, and yearly sales.
- Current financial year versus previous financial year comparison.
- Product-wise sales analysis.
- Region-wise sales performance.

### C. Order Analytics

- View orders received from different dealers.
- Monitor total orders and ordered quantities.
- Track pending, approved, rejected, and completed orders.
- Analyze order trends across different periods.

> **Expected outcome:** a manufacturer dashboard that provides a complete overview of its dealer
> network, sales performance, and order activities.

## 4. Dealer Management Module

The Dealer module will provide individual dealers with access to their business information,
sales performance, orders, and product claims. Each dealer will have access to its own business
data and activities.

### A. Dealer Dashboard

- Display dealer profile and business information.
- View total orders placed with manufacturers.
- Monitor total sales for the current financial year.
- Compare current-year sales with previous-year sales.
- View product-wise and monthly sales performance.
- Track overall business performance.

### B. Sales Management

- View completed sales.
- Monitor monthly, quarterly, and yearly sales.
- Analyze product-wise sales.
- Compare sales performance across different financial years.
- View revenue and profit-related information.

### C. Order Management

- Place orders directly with the manufacturer.
- Specify the required product and quantity.
- View previously placed orders.
- Track order status and delivery progress.
- Monitor pending and completed orders.

> **Expected outcome:** dealers should have a dedicated portal to manage and monitor their
> business operations.

## 5. Order Management Module

The application will provide an ordering mechanism between dealers and manufacturers.

### Order Placement Workflow

| Step | Activity |
|---|---|
| 1 | Dealer logs into the application. |
| 2 | Dealer selects the required product. |
| 3 | Dealer enters the required quantity. |
| 4 | Dealer submits the order. |
| 5 | The order is received by the manufacturer. |
| 6 | Manufacturer reviews and processes the order. |
| 7 | Dealer can track the order status. |

### Key Functionalities

- Create new orders.
- View order history.
- Edit or cancel orders based on their status.
- Approve or reject orders from the manufacturer side.
- Track order processing and delivery.
- Maintain order-wise quantity and pricing details.

> **Example:** a dealer requires 100 units of a particular product. The dealer can place an order
> for 100 units through the portal, and the manufacturer can review and process the request.

## 6. Product Claims Management Module

Every product sold by a dealer may have an associated warranty or claim policy. If a customer
identifies a defect in a product within the applicable warranty period, the dealer should be able
to submit a claim to the manufacturer.

### A. Dealer Perspective

- Submit new product claims.
- Enter product and customer-related details.
- Provide purchase and warranty information.
- Upload supporting documents or product images.
- View claim history.
- Track claim status.

### B. Manufacturer Perspective

- View claims submitted by different dealers.
- Review claim details and supporting documents.
- Approve or reject claims.
- Update claim status.
- Provide rejection reasons or comments.
- Monitor settled and pending claims.

### C. Claim Analytics

- Total claims submitted.
- Total claims approved.
- Total claims rejected.
- Total claims settled.
- Pending claims.
- Product-wise claim analysis.
- Dealer-wise claim analysis.

> **Expected outcome:** a centralized claim management system that provides transparency into
> product defects, warranty claims, and claim settlement activities.

## 7. AI Module – Sales Forecasting

One of the major objectives of the application is to introduce AI-based forecasting capabilities.
The forecasting system will analyze historical sales data and predict future product
requirements.

### Business Scenario

Consider a dealer preparing for the November–December festive season. The system should analyze
the previous years' sales during the same period and estimate the quantity of products that may
be required for the upcoming festive season.

### Key Functionalities

- Analyze historical sales data.
- Identify seasonal sales patterns.
- Compare November–December sales across previous years.
- Predict upcoming sales demand.
- Estimate the required product quantities.
- Generate suggested order quantities.
- Provide forecasting reports and visualizations.

### Example Workflow

- Dealer selects a forecasting period.
- AI analyzes the previous 3–4 years of sales data.
- The system identifies historical sales trends.
- The forecasting algorithm predicts future demand.
- The application displays estimated product requirements.
- Dealer can use the recommendations to plan and place orders.

> **Expected outcome:** help dealers make informed purchasing decisions, avoid stock shortages,
> and improve inventory planning.

## 8. AI Module – Intelligent Data Query and Business Insights

Another important AI capability is an intelligent query system that allows manufacturers and
dealers to retrieve business information using natural-language questions. The application will
use its historical business data to generate meaningful responses to user queries.

**Sales-related queries**
- What were my total sales last year?
- What is my total sales revenue for the current financial year?
- Which product generated the highest sales?
- Compare my sales performance with the previous year.

**Profit-related queries**
- What was my total profit last year?
- Which products generated the highest profit?
- How has my profit changed over the last three years?

**Claims-related queries**
- How many claims were rejected last year?
- How many claims have been settled?
- What is the total number of pending claims?
- Which product has the highest number of claims?

**Order-related queries**
- How many orders did I place last year?
- What is my total pending order quantity?
- Which manufacturer has received the highest number of orders?

### Expected AI Response

When a user asks a question, the system should:

- Understand the user's question.
- Identify the relevant business information.
- Search and analyze the available historical data.
- Perform the required calculations.
- Generate a meaningful response.
- Display the result in text, tables, or charts wherever appropriate.

**Example**

User query: *What were my total sales last year?*

Expected response: *Your total sales for the previous financial year were ₹5.5 crore.*

- Total units sold: 2,500
- Total revenue: ₹5.5 crore
- Top-performing product: Product A
- Sales growth compared to the previous year: 12%

*The figures above are illustrative examples.*

## 9. AI Implementation Approach

The AI functionality will initially be developed using our own application logic and algorithms.
There is no requirement to integrate external third-party LLM services or APIs at this stage.

### A. Historical Data Generation

Since the application does not currently have a production database or live users, we will
generate mock business data covering approximately 3–4 years.

- Manufacturer information.
- Dealer information.
- Product details.
- Historical sales records.
- Order history.
- Product claims.
- Revenue and profit information.

### B. Data Analysis Engine

Develop an internal data processing and searching mechanism that can:

- Search historical records.
- Filter data based on dates, dealers, products, and regions.
- Perform aggregations and calculations.
- Identify trends and patterns.
- Generate business insights.

### C. Natural Language Query Processing

Develop a basic internal query-processing engine that can interpret predefined business questions
and map them to the appropriate data retrieval and calculation logic.

Example: user asks *"Show my last year's sales."* The system identifies:

- Metric: Sales
- Time period: Previous financial year
- Scope: Logged-in dealer
- Operation: Calculate total sales

It then retrieves the relevant records and generates the response.

> **Important implementation note:** this initial implementation is an internally developed
> AI-like analytics and query engine, not a trained large language model (LLM). The initial focus
> is on reliable business-data retrieval, calculations, forecasting algorithms, and
> natural-language query handling.

## 10. Mock Data Generation Strategy

Since there is no existing live database, the application will initially work entirely with
generated mock data.

### Data Requirements

| Data Category | Historical Coverage |
|---|---|
| Manufacturers | Multiple manufacturers |
| Dealers | Multiple cities and regions |
| Products | Multiple product categories |
| Sales | 3–4 years |
| Orders | 3–4 years |
| Claims | 3–4 years |
| Financial data | 3–4 years |

The generated data should maintain realistic relationships between manufacturers, dealers,
products, sales, orders, and claims.

Example: an order should belong to a valid dealer and manufacturer.
