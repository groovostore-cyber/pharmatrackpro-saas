requireAuth();
injectNavbar();

function money(v) {
  return `₹${Number(v || 0).toFixed(2)}`;
}

function getStatusBadgeClass(status) {
  return status === "paid" ? "badge-success" : "badge-danger";
}

function getStatusText(status) {
  return status === "paid" ? "✓ PAID" : "⚠ PENDING";
}

async function sendWhatsAppReminder(customerId, phone) {
  try {
    // The whatsappUrl is already provided by the API, just open it
    const row = document.querySelector(`tr[data-customer-id="${customerId}"]`);
    const waUrl = row?.dataset.whatsappUrl;
    
    if (!waUrl) {
      alert("WhatsApp URL not available for this customer.");
      return;
    }
    
    window.open(waUrl, "_blank");
    
    // Log the action in backend
    await API.post("/api/whatsapp/send-reminder", { customerId }).catch(err => console.warn(err));
  } catch (error) {
    console.error(error);
    alert("Failed to open WhatsApp: " + error.message);
  }
}

async function markAsPaid(customerId) {
  try {
    const amount = prompt("Enter amount paid:", "");
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return;
    }
    
    // For now, this is a placeholder. In production, connect to payment tracking
    alert(`Recorded payment of ₹${amount} for customer ID ${customerId}.\n\nNote: Integrate with payment gateway for full tracking.`);
  } catch (error) {
    console.error(error);
  }
}

async function loadCreditCustomers() {
  const body = document.getElementById("creditRows");
  try {
    const result = await API.get("/api/credits");
    const rows = result?.rows || [];
    const storeName = result?.storeName || "PharmaTrackPro Store";
    
    // Update stats if function exists
    if (typeof updateStats === "function") {
      updateStats(rows);
    }
    
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="9" class="empty-state">No credit records available.</td></tr>`;
      return;
    }

    body.innerHTML = rows.map((r) => {
      const customerName = r.customer?.name || "Unknown Customer";
      const customerPhone = r.phone || r.customer?.phone || "-";
      const status = r.status === "paid" ? "paid" : "pending";
      const statusClass = getStatusBadgeClass(status);
      const statusText = getStatusText(status);
      
      return `
      <tr data-customer-id="${r.id}" data-whatsapp-url="${(r.whatsappUrl || "").replace(/"/g, "&quot;")}">
        <td class="cell-name"><strong>${customerName}</strong></td>
        <td class="cell-phone"><a href="tel:${customerPhone}">${customerPhone}</a></td>
        <td class="cell-total">${money(r.totalAmount)}</td>
        <td class="cell-paid">${money(r.paid)}</td>
        <td class="cell-due">
          <span class="amount-due">${money(r.due)}</span>
        </td>
        <td class="cell-status">
          <span class="badge ${statusClass}">${statusText}</span>
        </td>
        <td class="cell-days">
          ${r.createdAt ? `${Math.floor((Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days` : "-"}
        </td>
        <td class="cell-actions">
          <button class="btn-whatsapp" onclick="sendWhatsAppReminder(${r.id}, '${customerPhone}')">
            💬 Message
          </button>
        </td>
      </tr>
    `;
    }).join("");
    
  } catch (error) {
    console.error(error);
    body.innerHTML = `<tr><td colspan="9" class="empty-state">Failed to load credit data: ${error.message}</td></tr>`;
  }
}

// Auto-refresh every 30 seconds
loadCreditCustomers();
setInterval(loadCreditCustomers, 30000);
