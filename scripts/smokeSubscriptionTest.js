(async () => {
  const base = 'http://localhost:5000';
  const make = async (url, opts = {}) => {
    const res = await fetch(base + url, opts);
    const text = await res.text();
    let body = text;
    try { body = JSON.parse(text); } catch (e) {}
    return { status: res.status, body };
  };

  try {
    console.log('1) Signup');
    const signup = await make('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'smoke_node_user', password: 'Sm0keTest!', shopName: 'Smoke Shop Node', ownerName: 'Smoke', email: `smoke.node.${Date.now()}@example.com` })
    });
    console.log('signup status:', signup.status);
    console.log('signup body:', JSON.stringify(signup.body));

    if (!signup.body || !signup.body.data || !signup.body.data.token) {
      console.error('Signup did not return token; aborting.');
      process.exit(2);
    }

    const token = signup.body.data.token;

    console.log('\n2) Activate monthly plan');
    const activate = await make('/api/subscription/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ planType: 'monthly' })
    });
    console.log('activate status:', activate.status);
    console.log('activate body:', JSON.stringify(activate.body));

    console.log('\n3) Get subscription status');
    const status = await make('/api/subscription/status', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('status status:', status.status);
    console.log('status body:', JSON.stringify(status.body));

    console.log('\nSmoke test completed');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test error', err);
    process.exit(1);
  }
})();
