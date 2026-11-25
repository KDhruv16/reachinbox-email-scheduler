import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const REC_DIR = path.resolve(process.cwd(), 'temp_recording');
if (!fs.existsSync(REC_DIR)) fs.mkdirSync(REC_DIR, { recursive: true });

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

async function smoothMove(page, currentPos, targetX, targetY, durationMs = 600) {
  const startX = currentPos.x;
  const startY = currentPos.y;
  const steps = Math.max(15, Math.round(durationMs / 20));

  for (let i = 1; i <= steps; i++) {
    const progress = easeInOutQuad(i / steps);
    const x = startX + (targetX - startX) * progress;
    const y = startY + (targetY - startY) * progress;
    await page.mouse.move(x, y);
    await page.waitForTimeout(20);
  }

  currentPos.x = targetX;
  currentPos.y = targetY;
  await page.waitForTimeout(100);
}

async function smoothClick(page, currentPos, locator, hoverMs = 400) {
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  const box = await locator.boundingBox();
  if (!box) {
    console.warn('Bounding box not found for locator');
    await locator.click();
    return;
  }
  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;

  await smoothMove(page, currentPos, targetX, targetY, 600);
  await page.waitForTimeout(hoverMs);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

async function smoothType(page, locator, text, delayMs = 45) {
  await locator.focus();
  for (const char of text) {
    await page.keyboard.type(char, { delay: delayMs });
  }
  await page.waitForTimeout(200);
}

async function runRecording() {
  console.log('--- Starting Clean 1080p Screen Recording Walkthrough ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: REC_DIR,
      size: { width: 1920, height: 1080 },
    },
  });

  // Inject sleek cursor
  await context.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      let cursor = document.getElementById('screen-record-cursor');
      if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = 'screen-record-cursor';
        cursor.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 20px;
          height: 20px;
          border: 2.5px solid #ffffff;
          background: rgba(0, 166, 62, 0.95);
          border-radius: 50%;
          pointer-events: none;
          z-index: 2147483647;
          transform: translate(-50%, -50%);
          transition: transform 0.08s ease-out, background-color 0.12s;
          box-shadow: 0 3px 10px rgba(0,0,0,0.35);
        `;
        document.body.appendChild(cursor);

        window.addEventListener('mousemove', (e) => {
          cursor.style.left = e.clientX + 'px';
          cursor.style.top = e.clientY + 'px';
        }, { passive: true });

        window.addEventListener('mousedown', () => {
          cursor.style.transform = 'translate(-50%, -50%) scale(0.65)';
          cursor.style.backgroundColor = '#008532';
        }, { passive: true });

        window.addEventListener('mouseup', () => {
          cursor.style.transform = 'translate(-50%, -50%) scale(1)';
          cursor.style.backgroundColor = 'rgba(0, 166, 62, 0.95)';
        }, { passive: true });
      }
    });
  });

  const page = await context.newPage();
  const currentPos = { x: 960, y: 540 };

  // ==========================================
  // SCENE 1: LOGIN PAGE & INSTANT DEV LOGIN
  // ==========================================
  console.log('[Scene 1] Opening Application...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const devLoginBtn = page.locator('button:has-text("Instant Demo Login")');
  const isDevVisible = await devLoginBtn.isVisible({ timeout: 2000 }).catch(() => false);

  if (isDevVisible) {
    console.log('[Scene 1] Login card detected. Demonstrating login...');
    await smoothMove(page, currentPos, 960, 420, 800);
    await page.waitForTimeout(1200);

    const googleBtn = page.locator('button:has-text("Login with Google")');
    if (await googleBtn.isVisible()) {
      const box = await googleBtn.boundingBox();
      if (box) await smoothMove(page, currentPos, box.x + box.width / 2, box.y + box.height / 2, 600);
      await page.waitForTimeout(1400);
    }

    await smoothClick(page, currentPos, devLoginBtn, 800);
    await page.waitForURL('**/scheduled', { timeout: 10000 });
  } else {
    console.log('[Scene 1] Already on dashboard. Demonstrating logout then login...');
    const profileBtn = page.locator('aside button').first();
    if (await profileBtn.isVisible()) {
      await smoothClick(page, currentPos, profileBtn, 400);
      await page.waitForTimeout(1000);
      const logoutBtn = page.locator('button:has-text("Log out")');
      if (await logoutBtn.isVisible()) {
        await smoothClick(page, currentPos, logoutBtn, 600);
        await page.waitForURL('**/login', { timeout: 10000 });
        await page.waitForTimeout(1500);

        // Hover over Google button
        await smoothMove(page, currentPos, 960, 420, 800);
        await page.waitForTimeout(1200);

        const googleBtn = page.locator('button:has-text("Login with Google")');
        if (await googleBtn.isVisible()) {
          const box = await googleBtn.boundingBox();
          if (box) await smoothMove(page, currentPos, box.x + box.width / 2, box.y + box.height / 2, 600);
          await page.waitForTimeout(1400);
        }

        const devBtn = page.locator('button:has-text("Instant Demo Login")');
        await smoothClick(page, currentPos, devBtn, 800);
        await page.waitForURL('**/scheduled', { timeout: 10000 });
      }
    }
  }

  await page.waitForTimeout(2000);

  // ==========================================
  // SCENE 2: MAIN DASHBOARD & SIDEBAR TOUR
  // ==========================================
  console.log('[Scene 2] Dashboard and Sidebar Tour...');
  // Move to ONB Monogram
  await smoothMove(page, currentPos, 60, 35, 800);
  await page.waitForTimeout(1500);

  // Move to User profile card
  const profileCard = page.locator('aside button').first();
  if (await profileCard.isVisible()) {
    await smoothClick(page, currentPos, profileCard, 400);
    await page.waitForTimeout(1800);
    // Click again to close dropdown
    await page.mouse.click(currentPos.x, currentPos.y);
    await page.waitForTimeout(1000);
  }

  // Hover over Core navigation items
  const scheduledLink = page.locator('aside a[href="/scheduled"]');
  const sentLink = page.locator('aside a[href="/sent"]');
  const monitorLink = page.locator('aside a[href="/monitoring"]');

  if (await scheduledLink.isVisible()) {
    const box = await scheduledLink.boundingBox();
    if (box) await smoothMove(page, currentPos, box.x + box.width / 2, box.y + box.height / 2, 500);
    await page.waitForTimeout(1200);
  }

  if (await sentLink.isVisible()) {
    const box = await sentLink.boundingBox();
    if (box) await smoothMove(page, currentPos, box.x + box.width / 2, box.y + box.height / 2, 500);
    await page.waitForTimeout(1200);
  }

  if (await monitorLink.isVisible()) {
    const box = await monitorLink.boundingBox();
    if (box) await smoothMove(page, currentPos, box.x + box.width / 2, box.y + box.height / 2, 500);
    await page.waitForTimeout(1200);
  }

  // Move across search toolbar
  const searchInput = page.locator('input[placeholder*="Search"]');
  if (await searchInput.isVisible()) {
    const box = await searchInput.boundingBox();
    if (box) await smoothMove(page, currentPos, box.x + 120, box.y + box.height / 2, 700);
    await page.waitForTimeout(1200);
  }

  // ==========================================
  // SCENE 3: COMPOSE EMAIL & RECIPIENT ENTRY
  // ==========================================
  console.log('[Scene 3] Opening Compose Modal and entering recipients...');
  const composeBtn = page.locator('button:has-text("Compose")').first();
  await smoothClick(page, currentPos, composeBtn, 600);
  await page.waitForTimeout(1500);

  // Type 3 realistic recipients
  const recipientInput = page.locator('input[placeholder*="Type email and press Enter"]');
  const recipientsToAdd = [
    'sarah.jenkins@acmecorp.io',
    'marcus.vance@techventure.co',
    'elena.rostova@globalreach.org',
  ];

  for (const r of recipientsToAdd) {
    const box = await recipientInput.boundingBox();
    if (box) await smoothMove(page, currentPos, box.x + 80, box.y + box.height / 2, 400);
    await smoothClick(page, currentPos, recipientInput, 200);
    await smoothType(page, recipientInput, r, 30);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
  }

  // Move over the rendered recipient pill tags
  await smoothMove(page, currentPos, currentPos.x - 100, currentPos.y + 70, 600);
  await page.waitForTimeout(1500);

  // ==========================================
  // SCENE 4: SUBJECT, BODY & HTML PREVIEW
  // ==========================================
  console.log('[Scene 4] Configuring Subject, Body & Preview...');
  const subjectInput = page.locator('input[placeholder*="Elevate your outbound campaign"]');
  await smoothClick(page, currentPos, subjectInput, 400);
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await smoothType(page, subjectInput, 'Q1 Strategic Partnership & Outreach Initiative', 35);
  await page.waitForTimeout(1000);

  // Switch to Preview tab
  const previewTab = page.locator('button:has-text("Preview")');
  if (await previewTab.isVisible()) {
    await smoothClick(page, currentPos, previewTab, 500);
    await page.waitForTimeout(3000); // pause to show rendered HTML preview
    const editorTab = page.locator('button:has-text("Editor")');
    await smoothClick(page, currentPos, editorTab, 400);
    await page.waitForTimeout(1000);
  }

  // ==========================================
  // SCENE 5: SCHEDULING PARAMETERS & DISPATCH
  // ==========================================
  console.log('[Scene 5] Setting parameters and scheduling batch...');
  // Click "+10m" preset then "Now" preset to demonstrate flexibility
  const plus10mBtn = page.locator('button:has-text("+10m")');
  if (await plus10mBtn.isVisible()) {
    await smoothClick(page, currentPos, plus10mBtn, 400);
    await page.waitForTimeout(1200);
  }
  const nowPresetBtn = page.locator('button:has-text("Now")');
  if (await nowPresetBtn.isVisible()) {
    await smoothClick(page, currentPos, nowPresetBtn, 400);
    await page.waitForTimeout(1200);
  }

  // Delay select
  const delaySelect = page.locator('select').first();
  if (await delaySelect.isVisible()) {
    const box = await delaySelect.boundingBox();
    if (box) await smoothMove(page, currentPos, box.x + box.width / 2, box.y + box.height / 2, 400);
    await delaySelect.selectOption('2000');
    await page.waitForTimeout(1000);
  }

  // Hover over the campaign summary banner
  await smoothMove(page, currentPos, 960, 780, 500);
  await page.waitForTimeout(1800);

  // Click Send / Schedule Batch
  const sendBatchBtn = page.locator('form button[type="submit"]');
  await smoothClick(page, currentPos, sendBatchBtn, 600);
  console.log('[Scene 5] Submitted campaign batch...');
  await page.waitForTimeout(3500); // Wait for success banner and modal auto-close

  // ==========================================
  // SCENE 6: SCHEDULED EMAILS LIST
  // ==========================================
  console.log('[Scene 6] Inspecting Scheduled Emails Table...');
  await page.waitForTimeout(2000);
  // Hover over the scheduled email rows
  await smoothMove(page, currentPos, 600, 220, 700);
  await page.waitForTimeout(1500);
  await smoothMove(page, currentPos, 600, 270, 500);
  await page.waitForTimeout(1500);
  await smoothMove(page, currentPos, 600, 320, 500);
  await page.waitForTimeout(2500);

  // ==========================================
  // SCENE 7: QUEUE MONITOR & BULL BOARD
  // ==========================================
  console.log('[Scene 7] Navigating to Queue Monitor...');
  const queueNav = page.locator('aside a[href="/monitoring"]');
  await smoothClick(page, currentPos, queueNav, 600);
  await page.waitForTimeout(2500);

  // Open Bull Board
  console.log('[Scene 7] Opening Bull Board Dashboard...');
  await page.goto('http://localhost:5000/admin/queues', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await smoothMove(page, currentPos, 600, 200, 800);
  await page.waitForTimeout(1800);
  await smoothMove(page, currentPos, 900, 260, 600);
  await page.waitForTimeout(2500);

  // ==========================================
  // SCENE 8: SENT MAILBOX & DELIVERY STATUS
  // ==========================================
  console.log('[Scene 8] Navigating to Sent Mailbox...');
  await page.goto('http://localhost:5173/sent', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);

  // Hover over sent rows
  await smoothMove(page, currentPos, 600, 200, 700);
  await page.waitForTimeout(1500);
  await smoothMove(page, currentPos, 600, 250, 500);
  await page.waitForTimeout(1500);

  // Star an email row to demonstrate interaction
  const starBtn = page.locator('[data-testid="star-btn"]').first();
  if (await starBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await smoothClick(page, currentPos, starBtn, 400);
    await page.waitForTimeout(1200);
  }

  // ==========================================
  // SCENE 9: EMAIL DETAIL DRAWER & ETHEREAL
  // ==========================================
  console.log('[Scene 9] Opening Email Detail Drawer...');
  const firstRow = page.locator('[data-testid="email-row"]').first();
  await smoothClick(page, currentPos, firstRow, 500);
  await page.waitForTimeout(2000);

  // Hover through drawer metadata
  await smoothMove(page, currentPos, 1600, 220, 700);
  await page.waitForTimeout(1200);
  await smoothMove(page, currentPos, 1600, 300, 500);
  await page.waitForTimeout(1200);

  // Click Copy Message ID
  const copyBtn = page.locator('button[title="Copy Message ID"]').first();
  if (await copyBtn.isVisible()) {
    await smoothClick(page, currentPos, copyBtn, 400);
    await page.waitForTimeout(1500);
  }

  // Check for Ethereal Preview button
  const etherealBtn = page.locator('a:has-text("View on Ethereal")').first();
  let etherealUrl = null;
  if (await etherealBtn.isVisible()) {
    etherealUrl = await etherealBtn.getAttribute('href');
  }

  if (etherealUrl) {
    console.log('[Scene 9] Opening Live Ethereal Preview URL:', etherealUrl);
    await page.goto(etherealUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500); // Pause to display actual rendered email on Ethereal
    await smoothMove(page, currentPos, 960, 400, 800);
    await page.waitForTimeout(2000);

    // Return to Sent table
    await page.goto('http://localhost:5173/sent', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
  }

  // ==========================================
  // SCENE 10: SEARCH FILTERING & WRAP-UP
  // ==========================================
  console.log('[Scene 10] Testing Search Filtering...');
  const searchBar = page.locator('input[placeholder*="Search"]');
  if (await searchBar.isVisible()) {
    await smoothClick(page, currentPos, searchBar, 400);
    await smoothType(page, searchBar, 'Strategic Partnership', 45);
    await page.waitForTimeout(2500); // Show filtered list

    // Clear search
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(2000);
  }

  // Smooth final rest
  await smoothMove(page, currentPos, 960, 540, 800);
  await page.waitForTimeout(3000);

  console.log('--- Walkthrough Complete! Closing browser and saving video... ---');
  await page.close();
  await context.close();
  await browser.close();

  const files = fs.readdirSync(REC_DIR);
  console.log('Recording generated:', files);
}

runRecording().catch((err) => {
  console.error('Recording error:', err);
  process.exit(1);
});
