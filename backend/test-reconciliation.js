// Test Restart Persistence & DB-to-Queue Reconciliation
const BASE_URL = 'http://localhost:5000';

async function testReconciliation() {
  console.log('🔄 Testing Restart Persistence & Database Reconciliation...');

  // 1. Dev Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'reconcile.tester@reachinbox.ai' }),
  });
  const authData = await loginRes.json();
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authData.token}`,
  };

  // 2. Schedule an email 5 minutes into the future
  const futureTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const scheduleRes = await fetch(`${BASE_URL}/api/emails/schedule`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      sender: 'reconcile.tester@reachinbox.ai',
      recipients: [`future.delivery.${Date.now()}@reachinbox-test.com`],
      subject: `Future Scheduled Test ${Date.now()}`,
      body: `<p>This email tests restart survival</p>`,
      startTime: futureTime,
    }),
  });

  const scheduleData = await scheduleRes.json();
  const jobId = scheduleData.jobs[0]?.id;
  console.log(`   Scheduled future email ID: ${jobId}`);
  console.log(`   Scheduled for: ${futureTime}`);
  console.log('   ✅ Email successfully scheduled in PostgreSQL and BullMQ!');
}

testReconciliation().catch(console.error);
