import { generateA6ReceiptPdf } from '../src/utils/receipt'

async function run() {
  const sample = {
    id: 'sample-order-1',
    dateISO: new Date().toISOString(),
    customer: { name: 'John Doe', phone: '+66123456789', address: '123 Sample St' },
    items: [
      { name: 'Margherita', qty: 1, price: 180 },
      { name: 'Spaghetti Bolognese', qty: 2, price: 150 },
    ],
    delivery: { type: 'delivery', fee: 30 },
    paymentMethod: 'card',
    subtotal: 480,
    deliveryFee: 30,
    tax: 36,
    discount: 0,
    total: 546,
    vatRate: 0.07,
  }

  try {
    const filePath = await generateA6ReceiptPdf(sample as any)
    console.log('Generated sample receipt:', filePath)
  } catch (e) {
    console.error('Failed to generate sample receipt:', (e as any)?.message || e)
    process.exitCode = 1
  }
}

run()
