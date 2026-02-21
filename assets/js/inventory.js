requireAuth();
injectNavbar();

function renderInventoryRows(rows = []) {
  const body = document.getElementById("inventoryRows");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="8" class="empty-state">No medicines available.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map((m) => `
    <tr>
      <td>${m.name}</td>
      <td>₹${Number(m.mrp || 0).toFixed(2)}</td>
      <td>₹${Number(m.selling_price ?? m.sellingPrice ?? 0).toFixed(2)}</td>
      <td class="${Number(m.stock_quantity ?? m.stock ?? 0) < 10 ? "low-stock" : ""}">${Number(m.stock_quantity ?? m.stock ?? 0)}</td>
      <td>${m.expiry_date || m.expiry || "-"}</td>
      <td><input id="addStock_${m._id || m.id}" class="inventory-inline-input" type="number" min="0" step="1" placeholder="0" /></td>
      <td><input id="expiry_${m._id || m.id}" class="inventory-inline-input" type="date" value="${m.expiry ? String(m.expiry).slice(0, 10) : ""}" /></td>
      <td>
        <button class="inventory-update-btn" onclick="updateStock('${m._id || m.id}')">Update Stock</button>
      </td>
    </tr>
  `).join("");
}

function showToast(message) {
  const toast = document.getElementById("invToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

async function loadInventory() {
  try {
    const q = document.getElementById("inventorySearch").value || "";
    const rows = await API.get(`/api/medicines?q=${encodeURIComponent(q)}`);
    renderInventoryRows(rows || []);
  } catch (error) {
    console.error(error);
    renderInventoryRows([]);
  }
}

window.updateStock = async function (id) {
  const addStockInput = document.getElementById(`addStock_${id}`);
  const expiryInput = document.getElementById(`expiry_${id}`);
  const addStock = Number(addStockInput?.value || 0);
  const expiry = String(expiryInput?.value || "").trim();

  if (Number.isNaN(addStock) || addStock < 0) {
    document.getElementById("invMsg").textContent = "Add stock cannot be negative.";
    return;
  }

  try {
    await API.put(`/api/medicines/update-stock/${id}`, { addStock, expiry });
    document.getElementById("invMsg").textContent = "Stock updated successfully";
    showToast("Stock updated successfully");
    if (addStockInput) addStockInput.value = "";
    await loadInventory();
  } catch (error) {
    console.error(error);
    document.getElementById("invMsg").textContent = error.message;
  }
};

document.getElementById("medicineForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById("medName").value.trim(),
    mrp: Number(document.getElementById("medMrp").value || 0),
    selling_price: Number(document.getElementById("medPrice").value || 0),
    stock_quantity: Number(document.getElementById("medStock").value || 0),
    expiry_date: document.getElementById("medExpiry").value || null,
  };

  try {
    await API.post("/api/medicines", payload);
    document.getElementById("invMsg").textContent = "Medicine saved.";
    e.target.reset();
    await loadInventory();
  } catch (error) {
    console.error(error);
    document.getElementById("invMsg").textContent = error.message;
  }
});

document.getElementById("refreshInventory").addEventListener("click", loadInventory);
document.getElementById("inventorySearch").addEventListener("input", loadInventory);

loadInventory();
