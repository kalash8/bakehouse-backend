const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const sendWhatsAppReceipt = async ({ phone, order, restaurantName }) => {
  const itemLines = order.items
    .map(i => `  • ${i.name} x${i.quantity} — ₹${(i.price * i.quantity).toFixed(2)}`)
    .join('\n');

  const message =
    `🧁 *Thank you for visiting ${restaurantName}!*\n\n` +
    `*Table:* ${order.tableNumber}\n` +
    `*Order #:* ${order._id.toString().slice(-6).toUpperCase()}\n\n` +
    `*Items:*\n${itemLines}\n\n` +
    `*Subtotal:* ₹${order.subtotal.toFixed(2)}\n` +
    `*Tax (${order.taxRate}%):* ₹${order.taxAmount.toFixed(2)}\n` +
    `*Total:* ₹${order.totalAmount.toFixed(2)}\n\n` +
    `We hope to see you again! 🎉`;

  await client.messages.create({
    body: message,
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${phone}`,
  });
};

module.exports = { sendWhatsAppReceipt };