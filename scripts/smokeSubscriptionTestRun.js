const fs = require('fs');
(async () => {
  const base = '/';
  const out = { steps: [] };
  const make = async (url, opts = {}) => {
    const res = await fetch(base + url, opts);
    const text = await res.text();
    let body = text;
    try { body = JSON.parse(text); } catch (e) {}
    return { status: res.status, body };
  };

  try {
    const signup = await make('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'smoke_node_user_file', password: 'Sm0keTest!', shopName: 'Smoke Shop File', ownerName: 'Smoke', email: `smoke.file.${Date.now()}@example.com` })
    });
    out.steps.push({ name: 'signup', result: signup });

    if (!signup.body || !signup.body.data || !signup.body.data.token) {
      fs.writeFileSync('scripts/smoke_result.json', JSON.stringify(out, null, 2));
      process.exit(2);
    }
    const token = signup.body.data.token;

    const activate = await make('/api/subscription/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ planType: 'monthly' })
    });
    out.steps.push({ name: 'activate', result: activate });

    const status = await make('/api/subscription/status', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    out.steps.push({ name: 'status', result: status });

    fs.writeFileSync('scripts/smoke_result.json', JSON.stringify(out, null, 2));
    process.exit(0);
  } catch (err) {
    out.error = (err && err.message) || String(err);
    fs.writeFileSync('scripts/smoke_result.json', JSON.stringify(out, null, 2));
    process.exit(1);
  }
})();
