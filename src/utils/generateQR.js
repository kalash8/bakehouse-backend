const QRCode = require('qrcode');

/**
 * Generates a QR code as a base64 data URL for a given table number.
 * The QR code points to the customer app URL with the table number.
 */
const generateTableQR = async (tableNumber, clientUrl) => {
  const url = `${clientUrl}/table/${tableNumber}`;
  const dataUrl = await QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: '#1a1a1a', light: '#ffffff' },
  });
  return { tableNumber, url, qrDataUrl: dataUrl };
};

/**
 * Generate QR codes for all tables (returns array)
 */
const generateAllQRs = async (tableCount, clientUrl) => {
  const qrs = [];
  for (let i = 1; i <= tableCount; i++) {
    qrs.push(await generateTableQR(i, clientUrl));
  }
  return qrs;
};

module.exports = { generateTableQR, generateAllQRs };