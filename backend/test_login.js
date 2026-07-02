const roles = ['admin', 'headnurse', 'nurse', 'manager', 'storekeeper'];

async function testAll() {
  console.log('Testing login for all roles against PROD backend:');
  for (const r of roles) {
    try {
      const res = await fetch('https://medstorage.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: r + '@medsklad.kz', password: 'password123' })
      });
      const data = await res.json();
      if (data.success) {
        console.log(`✅ ${r.toUpperCase()} login successful! Token: ${data.data.token.substring(0, 15)}...`);
      } else {
        console.log(`❌ ${r.toUpperCase()} login failed! Error:`, data.error);
      }
    } catch (e) {
      console.log(`❌ ${r.toUpperCase()} network error:`, e.message);
    }
  }
}

testAll();
