if (!API.getToken()) {
  window.location.href = "login.html";
}

let revenueChart;
let medicinesChart;

function formatCurrency(v) {
  return `₹${Number(v || 0).toFixed(2)}`;
}

function logout() {
  API.clearToken();
  window.location.href = "login.html";
}

function injectStaticNavbar() {
  const root = document.getElementById("navbar-root");
  if (!root) return;
  root.innerHTML = `
    <div class="navbar no-print">
      <div class="brand">PharmaTrackPro</div>
      <div class="store-name">Business Dashboard</div>
      <div class="nav-links">
        <a class="nav-link active" href="dashboard.html">Dashboard</a>
        <a class="nav-link" href="sales.html">Sales</a>
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
    logout();
  });
}

function computeGrowth(currentMonthRevenue, lastMonthRevenue) {
  if (!lastMonthRevenue) return currentMonthRevenue > 0 ? 100 : 0;
  return ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
}

function renderRevenueChart(currentMonthRevenue, lastMonthRevenue) {
  const el = document.getElementById("monthlyRevenueChart");
  if (!el || typeof ApexCharts === "undefined") return;
  if (revenueChart) revenueChart.destroy();

  const totalRevenue = Number(currentMonthRevenue || 0) + Number(lastMonthRevenue || 0);
  const growth = computeGrowth(Number(currentMonthRevenue || 0), Number(lastMonthRevenue || 0));

  const options = {
    chart: {
      type: "donut",
      height: 320,
      foreColor: "#ffffff",
      background: "transparent",
      animations: {
        enabled: true,
        easing: "easeout",
        speed: 900,
      },
      dropShadow: {
        enabled: true,
        blur: 16,
        color: "#000",
        opacity: 0.38,
      },
    },
    series: [Number(currentMonthRevenue || 0), Number(lastMonthRevenue || 0)],
    labels: ["Current Month", "Last Month"],
    colors: ["#f59e0b", "#2563eb"],
    stroke: {
      width: 3,
      colors: ["#0f172a"],
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: "dark",
        type: "vertical",
        gradientToColors: ["#fcd34d", "#38bdf8"],
        stops: [0, 100],
      },
    },
    dataLabels: {
      enabled: true,
      style: { colors: ["#ffffff"] },
      formatter: (val) => `${val.toFixed(1)}%`,
    },
    legend: {
      labels: { colors: "#ffffff" },
      position: "bottom",
    },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            name: { color: "#e2e8f0" },
            value: {
              color: "#ffffff",
              formatter: (v) => formatCurrency(v),
            },
            total: {
              show: true,
              label: growth >= 0 ? `▲ ${growth.toFixed(1)}%` : `▼ ${Math.abs(growth).toFixed(1)}%`,
              color: growth >= 0 ? "#22c55e" : "#ef4444",
              formatter: () => formatCurrency(totalRevenue),
            },
          },
        },
      },
    },
    tooltip: {
      y: {
        formatter: (v) => formatCurrency(v),
      },
    },
  };

  revenueChart = new ApexCharts(el, options);
  revenueChart.render();
}

function renderTopMedicinesChart(rows = []) {
  const el = document.getElementById("topMedicinesChart");
  if (!el || typeof ApexCharts === "undefined") return;
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state">No sales data available</div>`;
    return;
  }
  if (medicinesChart) medicinesChart.destroy();

  const options = {
    chart: {
      type: "bar",
      height: 320,
      foreColor: "#ffffff",
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: "easeout",
        speed: 900,
      },
      dropShadow: {
        enabled: true,
        blur: 10,
        color: "#22c55e",
        opacity: 0.35,
      },
    },
    series: [
      {
        name: "Total Sold",
        data: rows.map((r) => Number(r.totalSold || 0)),
      },
    ],
    xaxis: {
      categories: rows.map((r) => r.name),
      labels: {
        style: { colors: "#e2e8f0", fontSize: "12px" },
      },
      axisBorder: { color: "rgba(148,163,184,.2)" },
      axisTicks: { color: "rgba(148,163,184,.2)" },
    },
    yaxis: {
      labels: {
        style: { colors: "#e2e8f0", fontSize: "12px" },
      },
    },
    grid: {
      borderColor: "rgba(148,163,184,.16)",
      strokeDashArray: 4,
    },
    plotOptions: {
      bar: {
        horizontal: false,
        borderRadius: 14,
        columnWidth: "46%",
      },
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: "dark",
        type: "vertical",
        shadeIntensity: 0.45,
        gradientToColors: ["#22c55e"],
        stops: [0, 100],
      },
    },
    colors: ["#16a34a"],
    dataLabels: { enabled: false },
    tooltip: {
      theme: "dark",
      y: {
        formatter: (v, opts) => `${opts.w.globals.labels[opts.dataPointIndex]}: ${v}`,
      },
    },
  };

  medicinesChart = new ApexCharts(el, options);
  medicinesChart.render();
}

async function initDashboard() {
  injectStaticNavbar();
  try {
    const [cardsData, statsData] = await Promise.all([
  API.get("/dashboard/cards"),
  API.get("/dashboard/stats"),
]);

    const cards = [
      ["Today Revenue", formatCurrency(cardsData.todayRevenue)],
      ["Today Profit", formatCurrency(cardsData.todayProfit)],
      ["Credit Outstanding", formatCurrency(cardsData.creditOutstanding)],
      ["Low Stock Count", cardsData.lowStockCount],
      ["Expiry Alert", cardsData.expiryAlert],
    ];
    const root = document.getElementById("snapshotCards");
    if (root) {
      root.innerHTML = cards
        .map(([k, v]) => `<div class="card"><div class="muted">${k}</div><h2>${v}</h2></div>`)
        .join("");
    }

    renderRevenueChart(statsData?.currentMonthRevenue || 0, statsData?.lastMonthRevenue || 0);
    renderTopMedicinesChart(statsData?.topMedicines || []);
  } catch (error) {
    console.error(error);
    const root = document.getElementById("snapshotCards");
    if (root) root.innerHTML = `<div class="card">Failed to load dashboard.</div>`;
  }
}

initDashboard();