import { expect, test } from '@playwright/test';
import { horizontalOverflow, mockBackend, signIn } from './mocks';

const shot = (name: string, project: string) => `e2e-screens/${project}-${name}.png`;

test.describe('public pages', () => {
  test('landing page renders, has no fake stats and fits the viewport', async ({ page }, info) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Nói tiếng Anh tự tin hơn');
    await expect(page.getByText('Ví dụ minh họa')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: shot('landing', info.project.name), fullPage: true });
  });

  test('theme toggle switches to dark mode', async ({ page }, info) => {
    await page.goto('/');
    const html = page.locator('html');
    const toggle = page.getByRole('button', { name: /Giao diện sáng|Theo hệ thống|Giao diện tối/ }).first();
    for (let i = 0; i < 3 && !(await html.getAttribute('class'))?.includes('dark'); i++) await toggle.click();
    await expect(html).toHaveClass(/dark/);
    await page.screenshot({ path: shot('landing-dark', info.project.name) });
  });

  test('register form validates input before calling the server', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
    await expect(page.getByText('Nhập tên hiển thị.')).toBeVisible();
    await expect(page.getByText('Email không hợp lệ.')).toBeVisible();
    await expect(page.getByText('Bạn cần đồng ý với điều khoản để tiếp tục.')).toBeVisible();
  });

  test('protected routes redirect to login when signed out', async ({ page }) => {
    await page.goto('/app/chat');
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fchat/);
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  });

  test('privacy policy discloses free-tier data use and no audio storage', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByText('không lưu file âm thanh', { exact: false })).toBeVisible();
    await expect(page.getByText('nội dung có thể được dùng để cải thiện sản phẩm', { exact: false })).toBeVisible();
  });
});

test.describe('signed-in app', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await mockBackend(page);
  });

  test('dashboard shows data from the database and correct navigation per viewport', async ({ page }, info) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Linh');
    await expect(page.getByText('3 ngày')).toBeVisible();
    await expect(page.getByText('Ôn 4 từ đến hạn')).toBeVisible();
    if (info.project.name === 'mobile') {
      await expect(page.getByRole('navigation', { name: 'Điều hướng nhanh' })).toBeVisible();
    } else {
      await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: shot('dashboard', info.project.name), fullPage: true });
  });

  test('AI chat streams a reply and shows the correction card', async ({ page }, info) => {
    await page.goto('/app/chat');
    const input = page.getByLabel('Tin nhắn');
    await input.fill('I go to Hue yesterday');
    await input.press('Enter');
    await expect(page.getByText('Great! Where did you go?')).toBeVisible();
    await expect(page.getByText('I went to Hue yesterday')).toBeVisible();
    await expect(page.getByText('Quá khứ đơn: go → went.')).toBeVisible();
    await expect(page).toHaveURL(/\/app\/chat\/22222222/);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: shot('chat', info.project.name) });
  });

  test('speaking page is honest about tiers and runs a text-mode session', async ({ page }, info) => {
    await page.goto('/app/speaking');
    // Server has realtime voice disabled in this fixture → that tier must not be selectable.
    await expect(page.getByRole('button', { name: /Realtime voice/ })).toBeDisabled();
    await expect(page.getByText('Chưa được bật trên máy chủ.')).toBeVisible();
    await page.getByRole('button', { name: /Chế độ văn bản/ }).click();
    await page.screenshot({ path: shot('speaking-setup', info.project.name), fullPage: true });
    await page.getByRole('button', { name: 'Bắt đầu phiên' }).click();
    await expect(page.getByText('Hi! How was your day?')).toBeVisible();
    await expect(page.getByText('Micro đang tắt').first()).toBeVisible();
    await page.getByLabel('Gõ câu trả lời').fill('It was great, I cooked pho');
    await page.getByRole('button', { name: 'Gửi' }).click();
    await expect(page.getByText('That sounds nice. What did you eat?')).toBeVisible();
    await page.getByRole('button', { name: 'Kết thúc phiên' }).click();
    await expect(page.getByText(/Phiên đã kết thúc/)).toBeVisible();
    await page.screenshot({ path: shot('speaking-ended', info.project.name), fullPage: true });
  });

  test('grammar lesson: answer an exercise and see feedback', async ({ page }) => {
    await page.goto('/app/grammar/present-perfect');
    await expect(page.getByRole('heading', { name: 'Thì hiện tại hoàn thành' })).toBeVisible();
    await page.getByRole('radio', { name: 'has worked' }).click();
    await page.getByRole('button', { name: 'Kiểm tra' }).click();
    await expect(page.getByText('Chính xác!')).toBeVisible();
  });

  const routes = [
    '/app/roleplay',
    '/app/roleplay/restaurant-order',
    '/app/vocabulary',
    '/app/vocabulary?tab=quiz',
    '/app/grammar',
    '/app/listening',
    '/app/reading',
    '/app/writing',
    '/app/pronunciation',
    '/app/progress',
    '/app/profile',
    '/app/settings',
    '/app/admin',
  ];
  for (const route of routes) {
    test(`renders ${route} without errors or horizontal scroll`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expect(page.getByText('Trang gặp lỗi')).toHaveCount(0);
      expect(errors).toEqual([]);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      await page.screenshot({ path: shot(route.replace(/[/?=]/g, '_'), info.project.name), fullPage: true });
    });
  }
});
