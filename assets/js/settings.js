requireAuth();
injectNavbar();

const statusMsg = document.getElementById("statusMsg");

function showStatus(message, type = "info") {
  statusMsg.textContent = message;
  statusMsg.className = `status-message show ${type}`;
  setTimeout(() => {
    statusMsg.classList.remove("show");
  }, 5000);
}

async function loadSettings() {
  try {
    const settings = await API.get("/api/settings");
    document.getElementById("shopName").value = settings.store_name || "";
    document.getElementById("ownerName").value = settings.owner_name || "";
    document.getElementById("shopAddress").value = settings.shop_address || "";
    document.getElementById("phoneNumber").value = settings.phone_number || "";
    document.getElementById("whatsappNumber").value = settings.whatsapp_number || "";
    document.getElementById("gstNumber").value = settings.gst_number || "";
    document.getElementById("invoicePrefix").value = settings.invoice_prefix || "INV";
    document.getElementById("currency").value = settings.currency || "INR";
  } catch (error) {
    console.error("Failed to load settings:", error);
    showStatus("Could not load settings", "error");
  }
}

async function loadDatabaseStats() {
  try {
    const customers = await API.get("/api/customers");
    const sales = await API.get("/api/sales") || [];
    const medicines = await API.get("/api/medicines") || [];

    document.getElementById("totalCustomers").textContent = (Array.isArray(customers) ? customers.length : 0).toString();
    document.getElementById("totalSales").textContent = "N/A";
    document.getElementById("totalMedicines").textContent = (Array.isArray(medicines) ? medicines.length : 0).toString();

    let totalRevenue = 0;
    if (Array.isArray(sales) && sales.length > 0) {
      totalRevenue = sales.reduce((sum, s) => sum + (Number(s.final_total) || 0), 0);
    }
    document.getElementById("totalRevenue").textContent = "₹" + totalRevenue.toFixed(2);
  } catch (error) {
    console.error("Failed to load stats:", error);
    document.getElementById("totalCustomers").textContent = "0";
    document.getElementById("totalMedicines").textContent = "0";
    document.getElementById("totalRevenue").textContent = "₹0.00";
  }
}

async function loadSubscriptionInfo() {
  try {
    const subscription = await API.get("/api/subscription/status");
    
    // Format status badge
    const status = subscription.subscriptionStatus || "unknown";
    const statusBadge = {
      inactive: "⏳ Inactive",
      trial: "🎉 Trial Active",
      active: "✓ Active",
      expired: "⚠️ Expired",
      suspended: "🚫 Suspended",
      superadmin: "👑 Superadmin",
    }[status] || status;

    // Format plan type
    const planType = {
      trial: "Free Trial",
      monthly: "Monthly",
      quarterly: "Quarterly",
      halfYearly: "Half-Yearly",
      yearly: "Yearly",
    }[subscription.subscriptionType] || (subscription.subscriptionType || "N/A");

    document.getElementById("planType").textContent = planType;
    document.getElementById("subscriptionStatus").textContent = statusBadge;

    // Format dates
    if (subscription.trialEndsAt) {
      const date = new Date(subscription.trialEndsAt);
      const formatted = date.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const daysLeft = Math.ceil((new Date(subscription.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24));
      document.getElementById("trialEnds").textContent = `${formatted} (${Math.max(0, daysLeft)} days)`;
    }

    if (subscription.subscriptionExpiresAt) {
      const date = new Date(subscription.subscriptionExpiresAt);
      const formatted = date.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      document.getElementById("subscriptionExpires").textContent = formatted;
    }
  } catch (error) {
    console.error("Failed to load subscription info:", error);
    document.getElementById("planType").textContent = "Unable to load";
    document.getElementById("subscriptionStatus").textContent = "Error";
  }
}

function downloadFile(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Form submission
document.getElementById("settingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const settingsData = {
    store_name: document.getElementById("shopName").value.trim(),
    owner_name: document.getElementById("ownerName").value.trim(),
    shop_address: document.getElementById("shopAddress").value.trim(),
    phone_number: document.getElementById("phoneNumber").value.trim(),
    whatsapp_number: document.getElementById("whatsappNumber").value.trim(),
    gst_number: document.getElementById("gstNumber").value.trim(),
    invoice_prefix: document.getElementById("invoicePrefix").value.trim() || "INV",
    currency: document.getElementById("currency").value,
  };

  if (!settingsData.store_name) {
    showStatus("Shop name is required", "error");
    return;
  }

  try {
    const btn = document.querySelector(".btn-submit");
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Saving...";

    await API.put("/api/settings", settingsData);
    
    showStatus("✓ Settings saved successfully", "success");
    btn.disabled = false;
    btn.textContent = originalText;
    
    // Refresh navbar in case store name changed
    await injectNavbar();
  } catch (error) {
    console.error("Settings save error:", error);
    showStatus("Error: " + (error.message || "Failed to save settings"), "error");
    document.querySelector(".btn-submit").disabled = false;
    document.querySelector(".btn-submit").textContent = originalText || "Save Settings";
  }
});

// Export CSV
document.getElementById("exportCsvBtn").addEventListener("click", async () => {
  try {
    const btn = document.getElementById("exportCsvBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Generating...';

    const token = localStorage.getItem("ptp_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    const response = await fetch("/api/export/sales/csv", { headers });
    if (!response.ok) throw new Error("Export failed");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    downloadFile(url, "sales-report.csv");
    window.URL.revokeObjectURL(url);

    showStatus("✓ CSV exported successfully", "success");
    btn.disabled = false;
    btn.innerHTML = '<span>📄</span> Export CSV';
  } catch (error) {
    console.error("CSV export error:", error);
    showStatus("Error: " + error.message, "error");
    document.getElementById("exportCsvBtn").disabled = false;
    document.getElementById("exportCsvBtn").innerHTML = '<span>📄</span> Export CSV';
  }
});

// Export XLSX
document.getElementById("exportXlsxBtn").addEventListener("click", async () => {
  try {
    const btn = document.getElementById("exportXlsxBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Generating...';

    const token = localStorage.getItem("ptp_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    const response = await fetch("/api/export/sales/xlsx", { headers });
    if (!response.ok) throw new Error("Export failed");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    downloadFile(url, "sales-report.xlsx");
    window.URL.revokeObjectURL(url);

    showStatus("✓ Excel file exported successfully", "success");
    btn.disabled = false;
    btn.innerHTML = '<span>📊</span> Export XLSX';
  } catch (error) {
    console.error("XLSX export error:", error);
    showStatus("Error: " + error.message, "error");
    document.getElementById("exportXlsxBtn").disabled = false;
    document.getElementById("exportXlsxBtn").innerHTML = '<span>📊</span> Export XLSX';
  }
});

// Full Backup
document.getElementById("exportBackupBtn").addEventListener("click", async () => {
  try {
    const btn = document.getElementById("exportBackupBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Creating...';

    const token = localStorage.getItem("ptp_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    const response = await fetch("/api/export/full-backup", { headers });
    if (!response.ok) throw new Error("Backup failed");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    downloadFile(url, `pharmatrack-backup-${new Date().toISOString().split("T")[0]}.json`);
    window.URL.revokeObjectURL(url);

    showStatus("✓ Full backup downloaded successfully", "success");
    btn.disabled = false;
    btn.innerHTML = '<span>💾</span> Full Backup';
  } catch (error) {
    console.error("Backup error:", error);
    showStatus("Error: " + error.message, "error");
    document.getElementById("exportBackupBtn").disabled = false;
    document.getElementById("exportBackupBtn").innerHTML = '<span>💾</span> Full Backup';
  }
});

// Initialize on page load
loadSettings();
loadDatabaseStats();
loadSubscriptionInfo();

// Refresh stats every 60 seconds
setInterval(loadDatabaseStats, 60000);
setInterval(loadSubscriptionInfo, 120000); // Refresh subscription info every 2 minutes
