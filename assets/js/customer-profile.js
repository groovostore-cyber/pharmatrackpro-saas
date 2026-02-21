requireAuth();
injectNavbar();

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function money(v) {
  return `₹${Number(v || 0).toFixed(2)}`;
}

function renderSummary(customer, sales = []) {
  const totalPurchases = sales.reduce((a, s) => a + Number(s.finalTotal ?? s.total ?? 0), 0);
  const totalDue = sales.reduce((a, s) => a + Number(s.due || 0), 0);
  const root = document.getElementById("customerSummary");
  root.innerHTML = `
    <h3 style="margin:0 0 8px;">${customer?.name || "Customer"}</h3>
    <div class="toolbar" style="justify-content:space-between;">
      <span class="muted">Phone: ${customer?.phone || "-"}</span>
      <span>Total Purchases: <strong>${money(totalPurchases)}</strong></span>
      <span>Total Due: <strong class="${totalDue > 0 ? "danger" : "success"}">${money(totalDue)}</strong></span>
    </div>
  `;
}

function formatMedicineNames(items = []) {
  return items
    .map((i) => i.name || i.medicineId?.name || i.medicine?.name || "Medicine")
    .join(", ");
}

function renderSalesRows(sales = []) {
  const body = document.getElementById("customerSalesRows");
  if (!sales.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">No purchase history available.</td></tr>`;
    return;
  }

  body.innerHTML = sales.map((s) => {
    const meds = formatMedicineNames(s.items || []);
    const qty = (s.items || []).reduce((a, i) => a + Number(i.qty ?? i.quantity ?? 0), 0);
    return `
      <tr>
        <td>${new Date(s.createdAt).toLocaleString()}</td>
        <td>${meds || "-"}</td>
        <td>${qty}</td>
        <td>${money(s.finalTotal ?? s.total)}</td>
        <td>${money(s.paid)}</td>
        <td class="${Number(s.due || 0) > 0 ? "danger" : "success"}">${money(s.due)}</td>
      </tr>
    `;
  }).join("");
}

async function init() {
  const id = qs("id");
  if (!id) {
    document.getElementById("customerSalesRows").innerHTML = `<tr><td colspan="6" class="empty-state">Invalid customer.</td></tr>`;
    return;
  }
  try {
    const data = await API.get(`/api/customers/${id}/sales`);
    renderSummary(data.customer, data.sales || []);
    renderSalesRows(data.sales || []);
  } catch (error) {
    console.error(error);
    document.getElementById("customerSalesRows").innerHTML = `<tr><td colspan="6" class="empty-state">Failed to load customer profile.</td></tr>`;
  }
}

init();
