(async () => {
  const base = '/';
  const fetch = global.fetch;
  function log(...args) { console.log(...args); }
  try {
    const username = `smoke_${Date.now()}`;
    const password = 'Test123!';
    log('Signing up user:', username);
    let res = await fetch(`${base}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const body = await res.json().catch(()=>null);
    if (!body || !body.success) {
      log('Signup failed, trying login...');
      const loginRes = await fetch(`${base}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
      });
      const loginBody = await loginRes.json();
      if (!loginBody || !loginBody.success) throw new Error('Signup and login failed: ' + JSON.stringify(loginBody));
      var token = loginBody.data?.token || loginBody.token || null;
    } else {
      var token = body.data?.token || body.token || null;
    }
    if (!token) throw new Error('No token returned from auth');
    log('Got token');

    const authHeader = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // create medicine
    log('Creating medicine');
    res = await fetch(`${base}/api/medicines`, { method: 'POST', headers: authHeader, body: JSON.stringify({ name: 'SMOKE MED', mrp: 100, sellingPrice: 80, stock: 10 }) });
    const medBody = await res.json();
    if (!medBody?.success) throw new Error('Create medicine failed: ' + JSON.stringify(medBody));
    const medicine = medBody.data;
    log('Medicine created:', medicine._id);

    // create customer
    log('Creating customer');
    res = await fetch(`${base}/api/customers`, { method: 'POST', headers: authHeader, body: JSON.stringify({ name: 'SMOKE CUSTOMER', phone: String(Date.now()).slice(-10), address: 'Smoke Addr' }) });
    const custBody = await res.json();
    if (!custBody?.success) throw new Error('Create customer failed: ' + JSON.stringify(custBody));
    const customer = custBody.data;
    log('Customer created:', customer._id);

    // create sale
    log('Creating sale');
    const items = [{ medicine: medicine._id, quantity: 1, price: medicine.sellingPrice, lineTotal: medicine.sellingPrice }];
    res = await fetch(`${base}/api/sales`, { method: 'POST', headers: authHeader, body: JSON.stringify({ customer: customer._id, items, subtotal: medicine.sellingPrice, total: medicine.sellingPrice, finalTotal: medicine.sellingPrice, paid: medicine.sellingPrice, due: 0 }) });
    const saleBody = await res.json();
    if (!saleBody?.success) throw new Error('Create sale failed: ' + JSON.stringify(saleBody));
    log('Sale created:', saleBody.data?._id || saleBody.data);

    // export sales csv
    log('Fetching export CSV (first 400 chars)');
    res = await fetch(`${base}/api/export/sales/csv`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    const text = await res.text();
    log(text.slice(0,400));

    log('SMOKE TEST: SUCCESS');
    process.exit(0);
  } catch (err) {
    console.error('SMOKE TEST ERROR:', err);
    process.exit(2);
  }
})();
