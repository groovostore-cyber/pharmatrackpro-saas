// WhatsApp Integration Service

const db = require("./database");

function normalizePhone(phone = "") {
  // Remove all non-digits, ensure 10-12 digit Indian number
  const cleaned = String(phone || "").replace(/[^0-9]/g, "");
  if (!cleaned || cleaned.length < 10) return null;
  // Return last 10 digits for Indian numbers
  return cleaned.slice(-10);
}

function buildWhatsAppUrl(phoneNumber, message) {
  const phone = normalizePhone(phoneNumber);
  if (!phone) return null;
  const text = encodeURIComponent(message || "");
  return `https://wa.me/91${phone}?text=${text}`;
}

function getCreditReminderTemplate(customerName, dueAmount, storeName = "PharmaTrackPro") {
  return `Dear ${customerName}, this is a reminder from ${storeName}.\n\nYou have an outstanding amount of ₹${dueAmount} pending.\n\nKindly clear the dues at your earliest convenience.\n\nThank you for your business!`;
}

function getPaymentConfirmationTemplate(customerName, amount, storeName = "PharmaTrackPro") {
  return `Payment Confirmation\n\nDear ${customerName},\n\nWe have received your payment of ₹${amount} towards your outstanding credit.\n\nThank you for your prompt payment!\n\nStay healthy!`;
}

function getWelcomeTemplate(customerName, storeName = "PharmaTrackPro") {
  return `Welcome to ${storeName}!\n\nDear ${customerName},\n\nThank you for becoming our valued customer. We provide quality medicines and health products.\n\nFor any queries, feel free to reach out.\n\nBest wishes for your health!`;
}

function buildCreditReminderMessage(customer, storeName = "PharmaTrackPro") {
  if (!customer || !customer.phone) return null;
  const message = getCreditReminderTemplate(customer.name, customer.outstanding_credit, storeName);
  return {
    phone: customer.phone,
    url: buildWhatsAppUrl(customer.phone, message),
    message,
    customerId: customer.id,
    type: "credit_reminder",
  };
}

function buildPaymentConfirmationMessage(customer, paidAmount, storeName = "PharmaTrackPro") {
  if (!customer || !customer.phone) return null;
  const message = getPaymentConfirmationTemplate(customer.name, paidAmount, storeName);
  return {
    phone: customer.phone,
    url: buildWhatsAppUrl(customer.phone, message),
    message,
    customerId: customer.id,
    type: "payment_confirmation",
  };
}

function buildWelcomeMessage(customer, storeName = "PharmaTrackPro") {
  if (!customer || !customer.phone) return null;
  const message = getWelcomeTemplate(customer.name, storeName);
  return {
    phone: customer.phone,
    url: buildWhatsAppUrl(customer.phone, message),
    message,
    customerId: customer.id,
    type: "welcome",
  };
}

function logWhatsAppMessage(customerId, type, message, phoneNumber, status = "pending") {
  try {
    db.execute(
      `INSERT INTO whatsapp_log (customer_id, message_type, message_text, phone_number, status, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [customerId, type, message, phoneNumber, status]
    );
  } catch (error) {
    console.error("whatsappService.logWhatsAppMessage error:", error);
    // Silently fail - logging is non-critical
  }
}

function ensureWhatsAppLogTable() {
  try {
    db.db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        message_type TEXT NOT NULL,
        message_text TEXT,
        phone_number TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );
      CREATE INDEX IF NOT EXISTS idx_customer_whatsapp ON whatsapp_log(customer_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_created ON whatsapp_log(created_at);
    `);
  } catch (error) {
    console.error("whatsappService.ensureWhatsAppLogTable error:", error);
  }
}

ensureWhatsAppLogTable();

module.exports = {
  normalizePhone,
  buildWhatsAppUrl,
  getCreditReminderTemplate,
  getPaymentConfirmationTemplate,
  getWelcomeTemplate,
  buildCreditReminderMessage,
  buildPaymentConfirmationMessage,
  buildWelcomeMessage,
  logWhatsAppMessage,
};
