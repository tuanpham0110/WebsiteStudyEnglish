import { test, expect } from '@playwright/test';
import { fixtures, mockBackend, signIn } from './mocks';
import { encodeWav } from '../src/lib/audio/pcm';

test('admin creates a reading draft with ordinary form fields',async ({ page }) => {
    await mockBackend(page); await signIn(page);
    let saved: Record<string,unknown> | undefined;
    await page.route('https://e2e.supabase.co/rest/v1/lessons*',async (route) => {
        if (route.request().method() !== 'POST') return route.fallback();
        saved = route.request().postDataJSON(); await route.fulfill({ status: 201,json: [] });
    });
    await page.goto('/app/admin');
    await page.getByLabel('Loại bài học').selectOption('reading');
    await page.getByRole('button',{ name: 'Thêm bài học',exact: true }).click();
    const dialog = page.getByRole('dialog',{ name: 'Biên tập bài học',exact: true });
    await dialog.getByLabel('Tiêu đề tiếng Anh').fill('A day in Hue');
    await dialog.getByLabel('Tiêu đề tiếng Việt').fill('Một ngày ở Huế');
    await dialog.getByLabel('Bài đọc',{ exact: true }).fill('We visited Hue last weekend.');
    await dialog.getByRole('button',{ name: 'Lưu bài học',exact: true }).click();
    await expect(page.getByText('Đã lưu bài học.',{ exact: true })).toBeVisible();
    expect(saved).toMatchObject({ kind: 'reading',is_published: false,content: { passage: 'We visited Hue last weekend.',wordCount: 5 } });
    await expect(dialog.getByRole('button',{ name: 'Thêm câu hỏi' })).toBeVisible();
});

test('listening fetches the recorded audio instead of requiring browser TTS',async ({ page }) => {
    await mockBackend(page,{ lessons: [{ ...fixtures.lessons[0],id: 'recorded-lesson',kind: 'listening',title: 'Recorded listening',content: { script: [{ speaker: 'A',text: 'Good morning.',audioUrl: '/audio/test.wav' }],dictation: [],summaryVi: '' } }] });
    await signIn(page);
    await page.route('**/audio/test.wav',(route) => route.fulfill({ contentType: 'audio/wav',body: Buffer.from(encodeWav(new Int16Array(16000),16000)) }));
    await page.goto('/app/listening/recorded-lesson');
    await expect(page.getByText('Phát bản thu âm của bài học.')).toBeVisible();
    const requested = page.waitForRequest('**/audio/test.wav');
    await page.getByRole('button',{ name: 'Phát',exact: true }).click(); await requested;
    await expect(page.getByText('Câu 1/1',{ exact: true })).toBeVisible();
});

test('voice journal retains an opt-in recording after reload without uploading it',async ({ page }) => {
    await mockBackend(page,{ lessons: [{ ...fixtures.lessons[0],kind: 'pronunciation',content: { sentences: [{ text: 'Think about the future.' }],tipsVi: 'Speak clearly.' } }] });
    await signIn(page);
    let uploads = 0;
    page.on('request',(request) => { if (/\/api\/(stt|pronunciation)/.test(request.url())) uploads++; });
    await page.addInitScript(() => {
        Object.defineProperty(navigator.mediaDevices,'getUserMedia',{ configurable: true,value: async () => {
            const context = new AudioContext(); await context.resume();
            const destination = context.createMediaStreamDestination(); const tone = context.createOscillator();
            tone.connect(destination); tone.start();
            for (const track of destination.stream.getTracks()) { const stop = track.stop.bind(track); track.stop = () => { stop(); tone.stop(); void context.close(); }; }
            return destination.stream;
        } });
    });
    await page.goto('/app/pronunciation');
    await page.getByRole('button',{ name: 'Ghi và lưu trên thiết bị' }).click();
    await expect(page.getByRole('button',{ name: 'Dừng và lưu bản ghi' })).toBeVisible();
    await page.waitForTimeout(700);
    await page.getByRole('button',{ name: 'Dừng và lưu bản ghi' }).click();
    await expect(page.getByText('Đã lưu giọng nói trên thiết bị này.')).toBeVisible();
    await expect(page.locator('audio')).toHaveCount(1);
    await page.reload(); await expect(page.locator('audio')).toHaveCount(1); expect(uploads).toBe(0);
    await page.getByRole('button',{ name: 'Xóa bản ghi',exact: true }).click(); await expect(page.locator('audio')).toHaveCount(0);
});

test.describe('offline library',() => {
    test.use({ serviceWorkers: 'allow' });
    test('downloads catalog cards, opens offline and avoids caching authenticated responses',async ({ page,context }) => {
        await mockBackend(page); await signIn(page);
        await page.goto('/app/vocabulary');
        await page.getByRole('button',{ name: 'Tải để học offline' }).click();
        await expect(page.getByText('Đã tải vào thư viện offline trên thiết bị này.')).toBeVisible();
        await context.setOffline(true);
        await page.goto('/offline.html'); await expect(page.getByRole('heading',{ name: 'Thư viện offline' })).toBeVisible();
        await page.getByRole('button',{ name: 'Mở để học' }).click();
        await expect(page.getByText('deadline',{ exact: true })).toBeVisible();
        await page.getByRole('button',{ name: 'Hiện nghĩa' }).click(); await expect(page.getByText('hạn chót',{ exact: true })).toBeVisible();
        await page.reload(); await expect(page.getByRole('button',{ name: 'Mở để học' })).toBeVisible();
        const cached = await page.evaluate(async () => { const urls: string[] = []; for (const key of await caches.keys()) for (const request of await (await caches.open(key)).keys()) urls.push(request.url); return urls; });
        expect(cached.length).toBeGreaterThan(0); expect(cached.some((url) => url.includes('/api/') || url.includes('supabase'))).toBe(false);
    });
});
