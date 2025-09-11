# API Contract — Epic Pizza & Pasta (Backend)

## Public / Menu
- GET `/api/menu` — TBD
- GET `/api/menu/:id` — TBD

## Orders / Checkout
- POST `/api/orders`
  - Request
    ```json
    {
      "customer": {"name":"John","phone":"+66999999999","address":"...","lat":13.7,"lng":100.5},
      "items": [{"id":"menu-id","name":"Pizza Margherita XL","qty":1,"price":369}],
      "delivery": {"type":"delivery","distanceKm":3.2,"fee":39},
      "paymentMethod": "promptpay"
    }
    ```
  - Response
    ```json
    {
      "orderId": "uuid",
      "status": "received",
      "amountTotal": 408,
      "payment": {"type":"promptpay","qrPayload":"PROMPTPAY|...","status":"pending"}
    }
    ```
- GET `/api/orders/:id` — returns order with items + payment

## Payments
- POST `/api/payments/promptpay/create`
  - Request: `{ "orderId": "uuid", "amount": 408 }`
  - Response: `{ "qrPayload": "PROMPTPAY|..." }`
- POST `/api/webhooks/promptpay`
  - Headers: `x-signature: <hmac_sha256_hex(payload)>`
  - Body: `{ "orderId": "uuid", "status": "PAID", "providerRefId": "gw_123" }`
  - Response: `{ "ok": true }`

## Auth (TBD)
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`

Notes:
- All money values are integers in THB.
- Webhook signature uses `PROMPTPAY_WEBHOOK_SECRET` with sha256 HMAC.
