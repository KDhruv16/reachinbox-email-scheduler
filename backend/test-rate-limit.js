// Test rate limiting rescheduling
const BASE_URL = 'http://localhost:5000';

async function testRateLimit() {
  console.log('⚡ Testing Rate Limiter & Automatic Reschedule into Next Hour Window...');

  // Dev login
  const loginRes = await fetch(`${BASE_URL}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rate.limit.tester@reachinbox.ai' }),
  });
  const authData = await loginRes.json();
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authData.token}`,
  };

  // Schedule with hourlyLimit = 1 for a dedicated sender
  const senderEmail = `limiter.${Date.now()}@ethereal.email`;
  const schedulePayload = {
    sender: senderEmail,
    recipients: [
      `limit.recipient.1.${Date.now()}@reachinbox-test.com`,
      `limit.recipient.2.${Date.now()}@reachinbox-test.com`,
    ],
    subject: `Rate Limit Test ${Date.now()}`,
    body: `<p>Testing hourly rate limit reschedule</p>`,
    delayBetweenEmails: 500,
    hourlyLimit: 1, // only 1 allowed per hour!
  };

  const scheduleRes = await fetch(`${BASE_URL}/api/emails/schedule`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(schedulePayload),
  });
  const scheduleData = await scheduleRes.json();
  console.log('   Scheduled 2 emails with hourlyLimit=1:');
  console.log(`   Job 1 ID: ${scheduleData.jobs[0]?.id}`);
  console.log(`   Job 2 ID: ${scheduleData.jobs[1]?.id}`);

  // Wait 6 seconds for worker to process
  console.log('   Waiting for worker to process both jobs...');
  await new Promise((res) => setTimeout(res, 6000));

  // Check database status of both emails
  const email1Res = await fetch(`${BASE_URL}/api/emails/${scheduleData.jobs[0]?.id}`, {
    headers: authHeaders,
  });
  const email1 = await email1Res.json();

  const email2Res = await fetch(`${BASE_URL}/api/emails/${scheduleData.jobs[1]?.id}`, {
    headers: authHeaders,
  });
  const email2 = await email2Res.json();

  console.log(`\n   Email 1 Status: ${email1?.status} (MessageId: ${email1?.messageId || 'none'})`);
  console.log(`   Email 2 Status: ${email2?.status} (Scheduled for: ${email2?.scheduledAt})`);

  if (email1?.status === 'SENT' && (email2?.status === 'SCHEDULED' || email2?.status === 'DELAYED')) {
    const scheduledDate = new Date(email2.scheduledAt);
    const now = new Date();
    const diffMinutes = (scheduledDate.getTime() - now.getTime()) / 60000;
    console.log(`\n   ✅ Rate Limiting PASSED!`);
    console.log(`   Email 1 was sent immediately.`);
    console.log(`   Email 2 was rescheduled ~${Math.round(diffMinutes)} minutes into the future (next hour window)!`);
    console.log(`   The job was NOT dropped or marked as failed.`);
  } else {
    console.log('\n   Status result:', { email1Status: email1?.status, email2Status: email2?.status });
  }
}

testRateLimit().catch(console.error);
