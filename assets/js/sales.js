const state = { medicines: [], customers: [], selectedCustomer: null, rowId: 1, lastSaleData: null };
const money = (v) => Number(v || 0).toFixed(2);

function safe(s = "") {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

if (!API.getToken()) window.location.href = "login.html";

function injectStaticNavbar() {
  const root = document.getElementById("navbar-root");
  if (!root) return;
  root.innerHTML = `
    <div class="navbar no-print">
      <div class="brand">PharmaTrackPro</div>
      <div class="store-name">Sales</div>
      <div class="nav-links">
        <a class="nav-link" href="dashboard.html">Dashboard</a>
        <a class="nav-link active" href="sales.html">Sales</a>
        <a class="nav-link" href="customers.html">Customers</a>
        <a class="nav-link" href="inventory.html">Inventory</a>
        <a class="nav-link" href="credit.html">Credit</a>
        <a class="nav-link" href="settings.html">Settings</a>
        <a class="nav-link" href="#" id="logoutBtn">Logout</a>
      </div>
    </div>
  `;
  document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    API.clearToken();
    window.location.href = "login.html";
  });
}

function normalizeMedicine(m, idx) {
  return {
    id: m._id || m.id || m.medicine_id || String(idx + 1),
    name: m.name || m.medicine_name || "Unknown Medicine",
    selling_price: Number(m.selling_price ?? m.sellingPrice ?? m.price ?? 0),
    stock_quantity: Number(m.stock_quantity ?? m.stock ?? 0),
  };
}

function normalizeCustomer(c, idx) {
  return {
    id: c._id || c.id || String(idx + 1),
    name: c.name || "Walk-in",
    phone: c.phone || "",
  };
}

function addRow(prefill = {}) {
  const tbody = document.getElementById("salesRows");
  const id = state.rowId++;
  const tr = document.createElement("tr");
  tr.dataset.rowId = String(id);
  tr.innerHTML = `
    <td>
      <input list="medList_${id}" class="med-search" placeholder="Search medicine" value="${prefill.name || ""}" />
      <datalist id="medList_${id}"></datalist>
      <input type="hidden" class="med-id" value="${prefill.medicine_id || prefill.medicine || ""}" />
    </td>
    <td>
      <div class="qty-control">
        <button type="button" class="qty-btn qty-minus">-</button>
        <input type="number" class="qty" min="1" step="1" value="${prefill.quantity || 1}" />
        <button type="button" class="qty-btn qty-plus">+</button>
      </div>
    </td>
    <td><input type="number" class="price" min="0" step="0.01" value="${prefill.price || 0}" readonly /></td>
    <td>
      <select class="disc">
        ${[0, 5, 10, 15, 20, 25, 30, 50].map((v) => `<option value="${v}" ${Number(prefill.discount_percent || 0) === v ? "selected" : ""}>${v}%</option>`).join("")}
      </select>
    </td>
    <td>₹<span class="line-total">0.00</span></td>
    <td><button class="btn-danger remove-row">Remove</button></td>
  `;
  tbody.appendChild(tr);
  bindRow(tr);
  recalc();
}

function bindRow(tr) {
  const search = tr.querySelector(".med-search");
  const list = tr.querySelector("datalist");
  const medIdInput = tr.querySelector(".med-id");
  const priceInput = tr.querySelector(".price");

  search.addEventListener("input", () => {
    const q = search.value.toLowerCase();
    const filtered = state.medicines.filter((m) => m.name.toLowerCase().includes(q));
    list.innerHTML = filtered.map((m) => `<option value="${m.name}"></option>`).join("");

    const exact = state.medicines.find((m) => m.name.toLowerCase() === q);
    if (exact) {
      medIdInput.value = exact.id;
      priceInput.value = exact.selling_price;
      recalc();
    }
  });

  ["input", "change"].forEach((evt) => {
    tr.querySelector(".qty").addEventListener(evt, recalc);
    tr.querySelector(".disc").addEventListener(evt, recalc);
  });

  tr.querySelector(".qty-minus").addEventListener("click", () => {
    const qtyInput = tr.querySelector(".qty");
    qtyInput.value = Math.max(1, Number(qtyInput.value || 1) - 1);
    recalc();
  });

  tr.querySelector(".qty-plus").addEventListener("click", () => {
    const qtyInput = tr.querySelector(".qty");
    qtyInput.value = Math.max(1, Number(qtyInput.value || 1) + 1);
    recalc();
  });

  tr.querySelector(".remove-row").addEventListener("click", () => {
    tr.remove();
    recalc();
  });
}

function recalc() {
  let subtotal = 0;
  document.querySelectorAll("#salesRows tr").forEach((tr) => {
    const qty = Number(tr.querySelector(".qty").value || 0);
    if (qty < 1) tr.querySelector(".qty").value = 1;
    const price = Number(tr.querySelector(".price").value || 0);
    const disc = Number(tr.querySelector(".disc").value || 0);
    const line = (price * qty) - ((price * qty) * (disc / 100));
    subtotal += line;
    tr.querySelector(".line-total").textContent = money(line);
  });

  const overallDiscPct = Number(document.getElementById("overallDiscount").value || 0);
  const gstPct = Number(document.getElementById("gstPercent").value || 0);
  const paid = Number(document.getElementById("paidAmount").value || 0);

  const discountAmount = subtotal * (overallDiscPct / 100);
  const gstAmount = (subtotal - discountAmount) * (gstPct / 100);
  const finalTotal = subtotal - discountAmount + gstAmount;
  const due = finalTotal - paid;

  document.getElementById("subtotal").textContent = money(subtotal);
  document.getElementById("discountAmount").textContent = money(discountAmount);
  document.getElementById("gstAmount").textContent = money(gstAmount);
  document.getElementById("finalTotal").textContent = money(finalTotal);
  document.getElementById("paidView").textContent = money(paid);
  document.getElementById("dueAmount").textContent = money(due);
}

async function loadMedicines() {
  const raw = await API.get("/api/medicines");
  state.medicines = (raw || []).map(normalizeMedicine);
}

async function loadCustomers(query = "") {
  const raw = await API.get(`/api/customers?q=${encodeURIComponent(query)}`);
  const all = (raw || []).map(normalizeCustomer);
  const q = String(query || "").toLowerCase();
  state.customers = q ? all.filter((c) => c.name.toLowerCase().includes(q) || String(c.phone || "").toLowerCase().includes(q)) : all;
  renderCustomerDropdown(state.customers);
}

function renderCustomerDropdown(customers = []) {
  const box = document.getElementById("customerDropdown");
  if (!box) return;
  if (!customers.length) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }
  box.innerHTML = customers
    .map(
      (c) => `
      <div class="dropdown-item customer-option" data-id="${safe(c.id)}">
        <span class="customer-option-name">${safe(c.name)}</span>
        <span class="customer-option-phone">${safe(c.phone || "No phone")}</span>
      </div>`
    )
    .join("");
  box.style.display = "block";
}

function updateSelectedCustomerView() {
  const el = document.getElementById("selectedCustomer");
  if (!state.selectedCustomer) {
    el.textContent = "Walk-in customer";
    return;
  }
  el.textContent = `${state.selectedCustomer.name} ${state.selectedCustomer.phone ? `(${state.selectedCustomer.phone})` : ""}`;
}

function bindCustomerControls() {
  const search = document.getElementById("customerSearch");
  const newBox = document.getElementById("newCustomerBox");
  const dropdown = document.getElementById("customerDropdown");
  search.addEventListener("input", async () => {
    const term = search.value.trim();
    await loadCustomers(term);
    if (!term) {
      state.selectedCustomer = null;
      dropdown.style.display = "none";
      newBox.style.display = "none";
      updateSelectedCustomerView();
      return;
    }

    const value = term.toLowerCase();
    const found = state.customers.find((c) => c.name.toLowerCase() === value || String(c.phone || "").toLowerCase() === value);
    state.selectedCustomer = found || null;
    newBox.style.display = found ? "none" : "block";
    updateSelectedCustomerView();
  });

  dropdown?.addEventListener("click", (e) => {
    const item = e.target.closest(".customer-option");
    if (!item) return;
    const id = item.getAttribute("data-id");
    const found = state.customers.find((c) => String(c.id) === String(id));
    if (!found) return;
    state.selectedCustomer = found;
    search.value = found.name;
    dropdown.style.display = "none";
    newBox.style.display = "none";
    updateSelectedCustomerView();
  });

  document.getElementById("saveCustomerBtn").addEventListener("click", async () => {
    const name = document.getElementById("newCustomerName").value.trim() || search.value.trim();
    const phone = document.getElementById("newCustomerPhone").value.trim();
    if (!name || !phone) {
      document.getElementById("salesMsg").textContent = "Name and phone are required for new customer.";
      return;
    }
    const newCustomer = await API.post("/api/customers", { name, phone, address: "" });
    state.selectedCustomer = newCustomer;
    search.value = newCustomer.name;
    document.getElementById("newCustomerBox").style.display = "none";
    if (dropdown) dropdown.style.display = "none";
    updateSelectedCustomerView();
    await loadCustomers();
  });

  document.addEventListener("click", (e) => {
    const wrap = document.querySelector(".customer-search-wrapper");
    if (!wrap || wrap.contains(e.target)) return;
    if (dropdown) dropdown.style.display = "none";
  });
}

function collectItems() {
  const items = [];
  document.querySelectorAll("#salesRows tr").forEach((tr) => {
    const medicineId = String(tr.querySelector(".med-id").value || "").trim();
    const quantity = Number(tr.querySelector(".qty").value || 0);
    const discount_percent = Number(tr.querySelector(".disc").value || 0);
    if (medicineId && quantity > 0) items.push({ medicine_id: medicineId, quantity, discount_percent });
  });
  return items;
}

function printInvoice(saleData) {
  if (!saleData) return;
  const settings = { storeName: "PharmaTrackPro Store", storeAddress: "", gstNumber: "" };
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;

  const rows = saleData.items.map((item) => `
    <tr>
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>₹${money(item.price)}</td>
      <td>${money(item.itemDiscount ?? item.discount_percent)}%</td>
      <td>₹${money(item.lineTotal ?? item.line_total)}</td>
    </tr>
  `).join("");

  w.document.write(`
    <html>
    <head>
      <title>Invoice ${saleData.invoice_no}</title>
      <style>
        body{font-family:Arial,sans-serif;background:#fff;color:#000;padding:24px}
        h2,h3,p{margin:4px 0}
        .center{text-align:center}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid #000;padding:8px;text-align:left}
        .totals{margin-top:14px;max-width:320px;margin-left:auto}
        .totals div{display:flex;justify-content:space-between;padding:4px 0}
        .bold{font-weight:700}
      </style>
    </head>
    <body>
      <div class="center">
        <h2>${settings.storeName}</h2>
        <p>${settings.storeAddress}</p>
        <p>GST: ${settings.gstNumber}</p>
      </div>
      <hr/>
      <p><b>Invoice:</b> ${saleData._id || saleData.id}</p>
      <p><b>Date:</b> ${new Date(saleData.createdAt || Date.now()).toLocaleString()}</p>
      <p><b>Customer:</b> ${saleData.customer?.name || "Walk-in Customer"}</p>
      <p><b>Phone:</b> ${saleData.customer?.phone || "-"}</p>

      <table>
        <thead><tr><th>Medicine</th><th>Qty</th><th>Price</th><th>Disc %</th><th>Line Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">
        <div><span>Subtotal</span><span>₹${money(saleData.subtotal)}</span></div>
        <div><span>GST</span><span>₹${money(saleData.gst)}</span></div>
        <div><span>Discount</span><span>₹${money(saleData.discount)}</span></div>
        <div class="bold"><span>Final Total</span><span>₹${money(saleData.total)}</span></div>
        <div><span>Paid</span><span>₹${money(saleData.paid)}</span></div>
        <div><span>Due</span><span>₹${money(saleData.due)}</span></div>
      </div>
      <p class="center" style="margin-top:16px;">Thank you for your business</p>
      <script>window.print();</script>
    </body>
    </html>
  `);
  w.document.close();
}

async function submitSale() {
  const msg = document.getElementById("salesMsg");
  msg.textContent = "";
  const itemsInput = collectItems();
  if (!itemsInput.length) {
    msg.textContent = "Please add at least one valid medicine row.";
    return;
  }

  const hasUnknown = itemsInput.some((row) => !state.medicines.find((m) => m.id === row.medicine_id));
  if (hasUnknown) {
    msg.textContent = "Please select valid medicines from the list.";
    return;
  }

  const inventory = (await API.get("/api/medicines")).map(normalizeMedicine);
  const rowMap = new Map(itemsInput.map((i) => [String(i.medicine_id), i]));
  for (const med of inventory) {
    const row = rowMap.get(String(med.id));
    if (!row) continue;
    if (med.stock_quantity - row.quantity < 0) {
      msg.textContent = `Insufficient stock: ${med.name}`;
      return;
    }
  }

  const overall_discount_percent = Number(document.getElementById("overallDiscount").value || 0);
  const gst_percent = Number(document.getElementById("gstPercent").value || 0);
  const paid = Number(document.getElementById("paidAmount").value || 0);
  const subtotal = Number(document.getElementById("subtotal").textContent || 0);
  const discount_amount = Number(document.getElementById("discountAmount").textContent || 0);
  const gst_amount = Number(document.getElementById("gstAmount").textContent || 0);
  const final_total = Number(document.getElementById("finalTotal").textContent || 0);
  const due = Number(document.getElementById("dueAmount").textContent || 0);

  const detailedItems = itemsInput.map((row) => {
    const med = inventory.find((m) => String(m.id) === String(row.medicine_id));
    const safePrice = Number(med?.selling_price || 0);
    const line_total = (safePrice * row.quantity) - ((safePrice * row.quantity) * (row.discount_percent / 100));
    return {
      medicine: row.medicine_id,
      name: med?.name || "Medicine",
      price: safePrice,
      quantity: row.quantity,
      itemDiscount: row.discount_percent,
      lineTotal: line_total,
    };
  });

  const payload = {
    customer: state.selectedCustomer?.id || null,
    customerPhone: state.selectedCustomer?.phone || "",
    items: detailedItems,
    subtotal,
    gst: gst_amount,
    discount: discount_amount,
    finalTotal: final_total,
    total: final_total,
    paid,
    due,
    overall_discount_percent,
    gst_percent,
  };

  const saleData = await API.post("/api/sales", payload);
  state.lastSaleData = saleData;
  msg.textContent = "Sale submitted successfully.";
  document.getElementById("printInvoiceBtn").classList.add("show");
}

function bindSummaryControls() {
  ["overallDiscount", "gstPercent", "paidAmount"].forEach((id) => {
    document.getElementById(id).addEventListener("input", recalc);
    document.getElementById(id).addEventListener("change", recalc);
  });
}

async function initSales() {
  try {
    injectStaticNavbar();
    await loadMedicines();
    await loadCustomers();
    updateSelectedCustomerView();
    bindCustomerControls();
    bindSummaryControls();

    document.getElementById("addMedicineRow").addEventListener("click", () => addRow());
    document.getElementById("submitSale").addEventListener("click", () => {
      submitSale().catch((error) => {
        console.error(error);
        document.getElementById("salesMsg").textContent = error.message || "Failed to submit sale.";
      });
    });
    document.getElementById("printInvoiceBtn").addEventListener("click", () => {
      if (state.lastSaleData) {
        printInvoice(state.lastSaleData);
      }
    });

    addRow();
  } catch (error) {
    console.error(error);
    document.getElementById("salesMsg").textContent = "Failed to initialize sales page.";
  }
}

initSales();
