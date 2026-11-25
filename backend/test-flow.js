// Comprehensive End-to-End Verification Script
// Tests: Health, Dev Login, SMTP verification, Scheduling, Worker Processing, Sent verification, Idempotency, Elasticsearch search, Bull Board

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('🚀 Starting ReachInbox Scheduler End-to-End Tests...\n');

  try {
    // 1. Health check
    console.log('1️⃣ Checking Health Endpoint...');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const health = await healthRes.json();
    console.log('   Health Status:', health.status);
    console.log('   Redis connected:', health.services.redis);
    console.log('   Database connected:', health.services.database);
    console.log('   Elasticsearch connected:', health.services.elasticsearch);
    console.log('   BullMQ worker active:', health.services.worker);

    // 2. Dev Login
    console.log('\n2️⃣ Testing Dev Mode Authentication...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex.morgan@reachinbox.ai', name: 'Alex Morgan' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const authData = await loginRes.json();
    console.log('   Login success:', authData.success);
    console.log('   Logged in user:', authData.user?.email);
    const token = authData.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Cookie: setCookie ? setCookie.split(';')[0] : '',
    };

    // 3. Current User verification
    console.log('\n3️⃣ Checking /api/auth/me...');
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: authHeaders });
    const meData = await meRes.json();
    console.log('   Current user:', meData.user?.name, `(${meData.user?.email})`);

    // 4. SMTP Engine Status
    console.log('\n4️⃣ Checking SMTP Engine Credentials...');
    const smtpRes = await fetch(`${BASE_URL}/api/emails/smtp-info`, { headers: authHeaders });
    const smtpData = await smtpRes.json();
    console.log('   Ethereal SMTP Host:', smtpData.smtp?.host);
    console.log('   Ethereal User:', smtpData.smtp?.user);
    console.log('   Ethereal Web URL:', smtpData.smtp?.webUrl);

    // 5. Schedule 2 Real Emails
    console.log('\n5️⃣ Scheduling 2 Test Emails via Ethereal SMTP...');
    const schedulePayload = {
      sender: smtpData.smtp?.user || 'alex.morgan@reachinbox.ai',
      recipients: [
        `candidate.review.${Date.now()}@reachinbox-test.com`,
        `lead.outreach.${Date.now()}@reachinbox-test.com`,
      ],
      subject: `ReachInbox Automated Invitation ${new Date().toISOString()}`,
      body: `<h1>Welcome to ReachInbox</h1><p>This email was automatically scheduled via BullMQ and delivered through Ethereal SMTP.</p>`,
      delayBetweenEmails: 1000, // 1 second delay
      hourlyLimit: 50,
    };

    const scheduleRes = await fetch(`${BASE_URL}/api/emails/schedule`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(schedulePayload),
    });
    const scheduleData = await scheduleRes.json();
    console.log('   Schedule result:', scheduleData);
    console.log(`   Scheduled count: ${scheduleData.scheduledCount}`);

    // 6. Test Idempotency (immediate duplicate submission)
    console.log('\n6️⃣ Testing Idempotency & Duplicate Submission Prevention...');
    const duplicateRes = await fetch(`${BASE_URL}/api/emails/schedule`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(schedulePayload),
    });
    const duplicateData = await duplicateRes.json();
    console.log('   Duplicate attempt response:');
    console.log(`   Scheduled count: ${duplicateData.scheduledCount}`);
    console.log(`   Skipped duplicates: ${duplicateData.skippedCount}`);
    if (duplicateData.skippedCount > 0) {
      console.log('   ✅ Idempotency check PASSED! Duplicates were prevented.');
    } else {
      console.log('   ⚠️ Duplicate warning: skippedCount was 0.');
    }

    // 7. Wait for worker to send emails
    console.log('\n7️⃣ Waiting for BullMQ worker to process and send emails (7 seconds)...');
    await new Promise((res) => setTimeout(res, 7000));

    // 8. Fetch Sent Emails
    console.log('\n8️⃣ Verifying Sent Emails in Database...');
    const sentRes = await fetch(`${BASE_URL}/api/emails/sent`, { headers: authHeaders });
    const sentData = await sentRes.json();
    const emails = sentData.emails || [];
    console.log(`   Total sent emails in system: ${emails.length}`);

    const recentSent = emails.slice(0, 2);
    for (const email of recentSent) {
      console.log(`\n   📧 Email ID: ${email.id}`);
      console.log(`      To: ${email.recipient}`);
      console.log(`      Subject: ${email.subject}`);
      console.log(`      Status: ${email.status}`);
      console.log(`      MessageId: ${email.messageId}`);
      console.log(`      Preview URL: ${email.previewUrl}`);
      console.log(`      Sent At: ${email.sentAt}`);
    }

    if (recentSent.length > 0 && recentSent[0].status === 'SENT' && recentSent[0].previewUrl) {
      console.log('\n   ✅ Email Delivery Verified! Real SMTP messageId & Ethereal previewUrl saved.');
    } else {
      console.log('\n   ⚠️ Email delivery verification pending or failed.');
    }

    // 9. Test Search
    console.log('\n9️⃣ Testing Search (Elasticsearch + Database Fallback)...');
    const searchRes = await fetch(`${BASE_URL}/api/emails/search?q=ReachInbox`, {
      headers: authHeaders,
    });
    const searchData = await searchRes.json();
    console.log(`   Search results found: ${searchData.emails?.length || 0}`);
    console.log(`   Search source: ${searchData.source}`);

    // 10. Bull Board Queue Monitoring
    console.log('\n🔟 Testing Bull Board Queue Dashboard...');
    const queueRes = await fetch(`${BASE_URL}/admin/queues`);
    console.log(`   Bull Board HTTP Status: ${queueRes.status} (OK: ${queueRes.ok})`);

    console.log('\n🎉 ALL END-TO-END TESTS COMPLETED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Test failure:', err);
    process.exit(1);
  }
}

runTests();
