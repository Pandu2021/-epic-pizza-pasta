## Epic Pizza & Pasta — Project Summary

This document is a complete English summary of the project materials, decisions, milestones, technical notes, and next steps for the "Epic Pizza and Pasta" online ordering website. Keep this file as the canonical short-hand guide for development, deployment, and handover.

---

## 1 Project Overview

- Project: Custom online ordering website for Epic Pizza & Pasta.
- Goal: Build a user-friendly web ordering system that supports PromptPay QR payments (Thai QR), optional card payments (Omise or alternative), distance-based delivery fees, order automation (email + Google Sheets), and LAN kitchen printing (Xprinter). Website must support English and Thai.
- Deadline: Target to be fully tested and ready before Sep 30, 2025 (owner travels).

## 2 Primary Features / Scope

- Dynamic menu system with complex customizations (half-and-half pizzas, add-ons, sizes).
- Full checkout flow with support for PromptPay QR and ability to add card gateway (Omise as primary candidate).
- Distance-based delivery calculation via Google Maps API and tiered fee rules.
- Order automation: send order notifications to a Gmail address and log orders into Google Sheets.
- Kitchen printing: print order tickets to an Xprinter over LAN.
- Bilingual UI (English + Thai) and pricing in Thai Baht (THB).

## 3 Deliverables

- Functional web app (frontend + backend) with menu editor.
- Payment integrations wired and tested (PromptPay live; Omise prepared or ready-to-enable).
- Google Maps integration for distance calculation.
- Working Gmail notifications and Google Sheets logging.
- Xprinter configuration and proof of print from the deployed site (or clear instructions for local network setup).
- Staff training docs and a 2-week live support period after go-live.

## 4 Milestones & Payment (as-proposed)

- Option A (original / 3 milestones):
  - Milestone 1 (50%) — Kickoff: core site, UI, menu, checkout & payment integration.
  - Milestone 2 (40%) — Order management automation, testing.
  - Milestone 3 (10%) — Go-live, staff training, final handover and 2-week support.

- Option B (revised / 5 milestones):
  - M1 (25%) Foundational setup & UI/UX
  - M2 (25%) Dynamic menu & checkout
  - M3 (20%) Payment gateway + delivery system
  - M4 (20%) Order automation + system testing
  - M5 (10%) Live deployment, training, final handover



## 5 Timeline (recommended phased plan)

- Week 1: Core setup, UI, dynamic menu.
- Week 2: Checkout and payment integrations (PromptPay live, Omise prepared).
- Week 3: Order automation (Gmail, Google Sheets), Xprinter setup.
- Week 4: End-to-end testing and staff training.
- Weeks 5–6 (post-launch): Live monitoring and support (2 weeks).

## 6 Important Contacts & Business Data

- Business name: Epic Pizza and Pasta
- Domain: epicfoodorders.com
- Contact phone: +66 95 569 7525
- Contact email: epicpizzaandpasta@gmail.com
- Address: 1, 15 ซ. นนทบุรี 18/1 Bang Krasor, อำเภอเมืองนนทบุรี นนทบุรี 11000, Thailand
- Instagram: https://www.instagram.com/epicpizzaandpasta/
- Facebook: https://www.facebook.com/epicpizzapasta
- Opening hours: Daily 12:00 PM - 11:00 PM
- Currency: Thai Baht (THB)

## 7 Technical Notes & Implementation Options

- Hosting and domain
  - Host the site on a managed provider (VPS, PaaS, or shared hosting). Ensure HTTPS (TLS/SSL) for payment flows.

- Payments
  - PromptPay QR: generate QR code during checkout or redirect to wallet app; no merchant card gateway required for QR flows.
  - Card payments: Omise is recommended for Thailand; developer needs Omise account credentials (API keys) and verified merchant info to enable live mode.

- Google Maps API
  - Required for distance calculation. Needs API key with billing enabled. Use Directions API or Distance Matrix to compute driving distance/time from restaurant to customer address.

- Delivery fee rules
  - Implement tiered fees (example): 0–3 km = 40 THB, 3–6 km = 60 THB, >6 km = 100 THB (adjustable via admin UI).

- Gmail notifications
  - Use Gmail API with OAuth credentials or send via SMTP with an app password (prefer Gmail API for reliability). Email should include full order details and printer/receipt reference.

- Google Sheets logging
  - Two options: 1 Server-side Google Sheets API with a service account (recommended) and append rows per order. 2. Use Apps Script / webhook or third-party automation (Zapier/Integromat) if preferred.

- Xprinter (LAN)
  - Xprinter supports ESC/POS over raw TCP to printer IP:port. Approaches:
    1) Server sends print job directly to printer IP (if server has network access to LAN) — requires VPN or local network hosting.
    2) Use a small local print proxy (a tiny app running on a LAN machine) that receives print requests from server and forwards to the printer locally.
  - Gather printer model, network configuration (IP/static or DHCP), and any existing credentials.

- i18n (English + Thai)
  - Use resource files or i18n library on frontend. Make sure all text in config and admin UI is translatable.

## 8 Data to Collect for Each Order (suggested schema)

- Order ID, timestamp
- Customer name, phone
- Delivery address (full), geocoded lat/lon
- Items (name, qty, options, modifiers), subtotal
- Delivery distance, delivery fee
- Taxes, discounts, total amount
- Payment method (PromptPay / Card / COD), payment status
- Order status (received, preparing, out-for-delivery, delivered)

## 9 Owner / Client TODOs (What Eric should provide)

1. Printer details and network access: Xprinter model, IP, any admin password, example successful print from the current app.
2. PromptPay merchant details or instructions (if any) and preferred QR workflow.
3. Omise or alternative card gateway account details (or confirm no card gateway needed now).
4. Google Maps API key with billing enabled (or permission to create one).
5. Gmail account and permission method (OAuth client, or app password) for order emails.
6. Google Sheets blank spreadsheet and sharing permissions for the service account/email.
7. Hosting access (server/FTP/SSH or hosting control panel) and domain DNS control for deployment.
8. Any legal/tax requirements and invoice or receipt text that must appear on orders.

## 10 Security & Configuration Notes (.env placeholders)

Store secrets in an environment file on the server (never commit to Git). Example variables:

- NODE_ENV=production
- PORT=3000
- DATABASE_URL=<if used>
- OMISE_PUBLIC_KEY=pk_test_...
- OMISE_SECRET_KEY=sk_test_...
- PROMPTPAY_MERCHANT_ID=<if used>
- GOOGLE_MAPS_API_KEY=AIza...
- GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON=<file or path>
- GMAIL_OAUTH_CLIENT_ID=...
- GMAIL_OAUTH_CLIENT_SECRET=...
- GMAIL_OAUTH_REFRESH_TOKEN=...

## 11 Testing & Acceptance Criteria

- Checkout must produce a successful order record and trigger both email and Google Sheets append.
- PromptPay QR must be scannable and mark order as paid (or flag pending until manual confirmation if async).
- Distance calculation must be within an acceptable tolerance and apply the correct fee.
- Xprinter must accept and print an order receipt from the deployed system or via the local print proxy.
- UI must be toggleable between English and Thai.

## 12 Quick Troubleshooting Tips

- If emails fail: check Gmail API credentials, OAuth consent, and that the sender address is allowed.
- If Sheets append fails: verify service account access and that the sheet is shared to the service account email.
- If distance looks wrong: check the address parsing and ensure the Maps API key has the Distance Matrix or Directions API enabled.

## 13 Next Steps (Immediate)

1. Client provides items listed in section 9.
2. Developer sets up dev environment, provisioning hosting and TLS.
3. Implement core menu + checkout, integrate PromptPay QR for quick wins.
4. Test printing approach with Xprinter on LAN (decide proxy vs direct).
5. Complete Google Sheets + Gmail automations and run acceptance tests.

---

If anything needs to be expanded into a separate technical README or a step-by-step deployment guide, create a follow-up issue and we will produce a dedicated deployment doc and a short staff-training checklist.
