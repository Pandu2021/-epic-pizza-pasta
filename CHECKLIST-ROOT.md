# Epic Pizza & Pasta — Project Checklist (Root)

This root checklist consolidates high-level tasks for the project. Use it as the single source of truth for progress tracking and handover.

## Project setup
- [ ] Confirm scope and finalize milestone schedule (3- or 5-milestone option).
- [ ] Secure initial payment / deposit as per milestone agreement.
- [ ] Create project repo and branch strategy (main, develop, feature/*).

## Environment & hosting
- [ ] Provision hosting (dev, staging, production) and enable TLS.
- [ ] Create production domain DNS records (epicfoodorders.com).
- [ ] Add server environment variables securely (.env management).

## Integrations
- [ ] Obtain PromptPay workflow details and merchant info.
- [ ] Create/obtain Omise (or chosen) merchant account and API keys (if required).
- [ ] Obtain Google Maps API key with billing enabled.
- [ ] Create Gmail API credentials or app-password plan for order emails.
- [ ] Prepare Google Sheets and share with service account email.
- [ ] Gather Xprinter model and network details; choose print approach (direct vs proxy).

## Development & testing
- [ ] Implement core menu and cart functionality.
- [ ] Implement checkout flow and payment flows (PromptPay first).
- [ ] Implement order processing: email, Google Sheets log, print job.
- [ ] Implement distance-based delivery calculation & admin fee rules.
- [ ] Bilingual UI: English and Thai translation files.
- [ ] Create automated tests: unit + integration for critical flows.

## QA & acceptance
- [ ] Run E2E tests for placing orders (happy path + payment failure + address edge cases).
- [ ] Confirm email arrives for paid orders.
- [ ] Confirm Google Sheets row append for each order.
- [ ] Confirm Xprinter prints receipts reliably (or proxy works).
- [ ] Verify delivery fee calculation accuracy on sample addresses.

## Deployment & post-launch
- [ ] Deploy to production, test live payments in sandbox then live mode.
- [ ] Run security checklist (secrets, HTTPS, minimal ports open).
- [ ] Staff training session and training docs delivered.
- [ ] 2-week live support window begins and monitoring is active.

## Documentation & handover
- [ ] Add this checklist and `Project-Summary.md` to repo root.
- [ ] Create short deployment README with exact steps and credentials locations (privately stored).
- [ ] Provide a staff-training checklist and short video or screenshots if possible.

---

Keep this file updated; mark items done as progress is made.
