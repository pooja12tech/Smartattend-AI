import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.resolve(FRONTEND_DIR, 'screenshots');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = process.env.APP_URL || 'https://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

const VIEWPORTS = [
  { name: '320x640', width: 320, height: 640, isMobile: true },
  { name: '390x844', width: 390, height: 844, isMobile: true },
  { name: '844x390', width: 844, height: 390, isMobile: true, isLandscape: true },
  { name: '768x1024', width: 768, height: 1024, isMobile: false, isTablet: true },
  { name: '1280x720', width: 1280, height: 720, isMobile: false },
  { name: '1366x768', width: 1366, height: 768, isMobile: false },
  { name: '1920x1080', width: 1920, height: 1080, isMobile: false }
];

const ROLES = {
  student: {
    credentials: { roll_no: 'STU01', password: 'studentpassword', device_id: 'DEV-TEST-STU' },
    screens: [
      { name: 'student_home', path: '/student/home' },
      { name: 'student_classes', path: '/student/classes' },
      { name: 'student_attendance', path: '/student/subject-attendance' },
      { name: 'student_history', path: '/student/history' },
      { name: 'student_profile', path: '/student/profile' },
      { name: 'student_notifications', path: '/student/notifications' }
    ]
  },
  faculty: {
    credentials: { roll_no: 'faculty', password: 'facultypassword', device_id: 'DEV-TEST-FAC' },
    screens: [
      { name: 'faculty_home', path: '/faculty/home' },
      { name: 'faculty_timetable', path: '/faculty/timetable' },
      { name: 'faculty_live', path: '/faculty/live' },
      { name: 'faculty_roster', path: '/faculty/roster' },
      { name: 'faculty_setup', path: '/faculty/setup' }
    ]
  },
  admin: {
    credentials: { roll_no: 'admin', password: 'adminpassword', device_id: 'DEV-TEST-ADM' },
    screens: [
      { name: 'admin_overview', path: '/admin/overview' },
      { name: 'admin_live', path: '/admin/live' },
      { name: 'admin_students', path: '/admin/students' },
      { name: 'admin_faculty', path: '/admin/faculty' },
      { name: 'admin_timetable', path: '/admin/timetable' },
      { name: 'admin_manual_mark', path: '/admin/manual-mark' },
      { name: 'admin_reports', path: '/admin/reports' }
    ]
  }
};

async function authenticateRole(roleKey, credentials) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(`Login failed for ${roleKey}: ${JSON.stringify(data)}`);
    }
    return { token: data.access_token, user: data.user };
  } catch (err) {
    console.error(`[Auth Error] Failed to login as ${roleKey}:`, err.message);
    throw err;
  }
}

async function run() {
  console.log('====================================================');
  console.log('SmartAttend-AI Playwright Verification & Screenshot Engine');
  console.log(`Frontend: ${BASE_URL} | Backend: ${BACKEND_URL}`);
  console.log('====================================================\n');

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  // 1. Pre-authenticate all roles
  console.log('[1/3] Pre-authenticating seeded test accounts...');
  const authData = {};
  for (const [roleKey, roleConfig] of Object.entries(ROLES)) {
    authData[roleKey] = await authenticateRole(roleKey, roleConfig.credentials);
    console.log(`  ✓ Authenticated ${roleKey}: ${authData[roleKey].user?.name || authData[roleKey].user?.roll_no}`);
  }

  // 2. Launch Chromium browser
  console.log('\n[2/3] Launching Playwright Chromium...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox']
  });

  const auditIssues = [];

  try {
    // 3. Iterate through each viewport
    console.log('\n[3/3] Capturing screenshots across viewports...');
    for (const vp of VIEWPORTS) {
      console.log(`\n--- Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
      const vpDir = path.join(SCREENSHOTS_DIR, vp.name);
      if (!fs.existsSync(vpDir)) {
        fs.mkdirSync(vpDir, { recursive: true });
      }

      // First, capture unauthenticated login screen
      {
        const unauthContext = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          ignoreHTTPSErrors: true
        });
        await unauthContext.addInitScript(() => {
          sessionStorage.setItem('smartattend_splash_dismissed', 'true');
        });
        const unauthPage = await unauthContext.newPage();
        try {
          await unauthPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await unauthPage.waitForTimeout(600);
          const loginFile = path.join(vpDir, 'login.png');
          const flatLoginFile = path.join(SCREENSHOTS_DIR, `login_${vp.name}.png`);
          await unauthPage.screenshot({ path: loginFile, fullPage: false });
          fs.copyFileSync(loginFile, flatLoginFile);
          console.log(`  [Login] Captured: ${loginFile}`);
        } catch (e) {
          console.warn(`  [Login Warning] ${e.message}`);
        } finally {
          await unauthContext.close();
        }
      }

      // Next, capture screens for each authenticated role
      for (const [roleKey, roleConfig] of Object.entries(ROLES)) {
        const { token, user } = authData[roleKey];
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          ignoreHTTPSErrors: true
        });

        // Set storage before page scripts run
        await context.addInitScript(({ authToken, authUser, deviceId }) => {
          localStorage.setItem('smartattend_jwt_token', authToken);
          localStorage.setItem('smartattend_current_user', JSON.stringify(authUser));
          localStorage.setItem('smartattend_device_id', deviceId);
          sessionStorage.setItem('smartattend_splash_dismissed', 'true');
        }, {
          authToken: token,
          authUser: user,
          deviceId: roleConfig.credentials.device_id
        });

        for (const screen of roleConfig.screens) {
          const page = await context.newPage();
          try {
            const url = `${BASE_URL}${screen.path}`;
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForFunction(() => {
              const text = document.body ? document.body.innerText : '';
              return !text.includes('Loading SmartAttend...') && text.trim().length > 30;
            }, { timeout: 8000 }).catch(() => {});
            await page.waitForTimeout(300);

            // Audit: Check for horizontal overflow (horizontal scroll)
            const overflow = await page.evaluate(() => {
              const el = document.documentElement;
              const hasOverflow = el.scrollWidth > window.innerWidth + 1;
              return {
                hasOverflow,
                scrollWidth: el.scrollWidth,
                innerWidth: window.innerWidth
              };
            });

            if (overflow.hasOverflow) {
              const msg = `Horizontal overflow detected on ${screen.name} at ${vp.name} (scrollWidth: ${overflow.scrollWidth}px > innerWidth: ${overflow.innerWidth}px)`;
              auditIssues.push({ viewport: vp.name, screen: screen.name, issue: msg });
              console.warn(`  ⚠️  ${msg}`);
            }

            // Audit: Check for blank screen (body has zero text or under 50 chars)
            const bodyTextLength = await page.evaluate(() => document.body.innerText.trim().length);
            if (bodyTextLength < 30) {
              const msg = `Potential blank screen on ${screen.name} at ${vp.name} (body text length: ${bodyTextLength})`;
              auditIssues.push({ viewport: vp.name, screen: screen.name, issue: msg });
              console.warn(`  ⚠️  ${msg}`);
            }

            // Capture screenshot
            const screenFile = path.join(vpDir, `${screen.name}.png`);
            const flatScreenFile = path.join(SCREENSHOTS_DIR, `${screen.name}_${vp.name}.png`);
            await page.screenshot({ path: screenFile, fullPage: false });
            fs.copyFileSync(screenFile, flatScreenFile);
            console.log(`  [${roleKey}] ${screen.name}: saved`);
          } catch (err) {
            console.error(`  [${roleKey}] Failed ${screen.name} at ${vp.name}:`, err.message);
            auditIssues.push({ viewport: vp.name, screen: screen.name, issue: err.message });
          } finally {
            await page.close();
          }
        }

        // Special test for student role on desktop viewports (>= 1024px):
        // Verify clicking the scan action opens DesktopMobileOnlyModal!
        if (roleKey === 'student' && vp.width >= 1024) {
          const modalPage = await context.newPage();
          try {
            await modalPage.goto(`${BASE_URL}/student/home`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await modalPage.waitForTimeout(600);

            // Find scan button in sidebar or header
            const scanBtn = modalPage.locator('button:has-text("How to Scan"), #hero-scan-cta, button:has-text("Mark Attendance")').first();
            if (await scanBtn.isVisible()) {
              await scanBtn.click();
              await modalPage.waitForTimeout(500);

              // Check if DesktopMobileOnlyModal opened
              const modalVisible = await modalPage.locator('text="Mark Attendance from Your Mobile Phone", text="Anti-Proxy Security Policy", text="How to Mark Your Attendance"').first().isVisible().catch(() => false);
              const modalFile = path.join(vpDir, 'student_desktop_scan_modal.png');
              const flatModalFile = path.join(SCREENSHOTS_DIR, `student_desktop_scan_modal_${vp.name}.png`);
              await modalPage.screenshot({ path: modalFile, fullPage: false });
              fs.copyFileSync(modalFile, flatModalFile);
              console.log(`  [student] student_desktop_scan_modal: saved (modal confirmed: ${modalVisible})`);
            }
          } catch (e) {
            console.warn(`  [student desktop scan notice check note] ${e.message}`);
          } finally {
            await modalPage.close();
          }
        }

        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\n====================================================');
  console.log('Screenshot Generation Completed!');
  console.log(`Output Directory: ${SCREENSHOTS_DIR}`);
  if (auditIssues.length > 0) {
    console.log(`\nAudit Warnings Found (${auditIssues.length}):`);
    auditIssues.forEach((i, idx) => {
      console.log(`  ${idx + 1}. [${i.viewport}] [${i.screen}]: ${i.issue}`);
    });
  } else {
    console.log('No layout overflow or blank screen warnings detected!');
  }
  console.log('====================================================\n');
}

run().catch((e) => {
  console.error('Fatal execution error:', e);
  process.exit(1);
});
