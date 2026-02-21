requireAuth();
injectNavbar();

function money(v) {
  return `₹${Number(v || 0).toFixed(2)}`;
}

function fmtDate(v) {
  if (!v) return "-";
  return new Date(v).toLocaleString();
}

function renderRows(rows = []) {
  const body = document.getElementById("customersRows");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">No customers found.</td></tr>`;
    return;
  }

  body.innerHTML = rows.map((c) => `
    <tr>
      <td>${c.name || "-"}</td>
      <td>${c.phone || "-"}</td>
      <td>${money(c.totalPurchases)}</td>
      <td class="${Number(c.totalDue || 0) > 0 ? "danger" : "success"}">${money(c.totalDue)}</td>
      <td>${fmtDate(c.lastPurchaseDate || c.updatedAt)}</td>
      <td><a class="btn-link" href="/ui/pages/customer-profile.html?id=${c._id}">View Details</a></td>
    </tr>
  `).join("");
}

async function loadCustomers() {
  try {
    const q = document.getElementById("customerSearch").value || "";
    const rows = await API.get(`/api/customers?q=${encodeURIComponent(q)}`);
    renderRows(rows || []);
  } catch (error) {
    console.error(error);
    renderRows([]);
  }
}

document.getElementById("customerSearch")?.addEventListener("input", loadCustomers);
loadCustomers();
