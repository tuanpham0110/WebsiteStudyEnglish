# EnglishAI

Nền tảng học tiếng Anh với AI: chat có sửa lỗi, luyện nói bằng giọng nói realtime, nhập vai, từ vựng (spaced repetition), ngữ pháp, nghe, đọc, viết, phát âm và theo dõi tiến độ.

- **Frontend:** React 19 + Vite 8 + TypeScript + Tailwind CSS 4, build thành site tĩnh.
- **Backend:** Cloudflare Pages Functions (Hono) — cùng domain với frontend.
- **Database & Auth:** Supabase (PostgreSQL, Auth, Row Level Security).
- **AI:** Google Gemini API — `gemini-3.5-flash-lite` cho văn bản, `gemini-3.8-live` cho hội thoại giọng nói realtime (WebSocket trực tiếp từ trình duyệt bằng ephemeral token).

Chi phí khởi đầu có thể là **0 đ** với gói miễn phí của Cloudflare, Supabase và Gemini API — xem giới hạn thật trong [docs/SERVICES_AND_COSTS.md](docs/SERVICES_AND_COSTS.md).

## Trạng thái

| Phần | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện 18 trang, responsive, sáng/tối | Hoạt động | Kiểm thử e2e trên desktop và mobile |
| Schema DB, RLS, quota, migrations, seed | Hoạt động | Kiểm thử trên PostgreSQL thật (PGlite); cần chạy trên Supabase của bạn |
| API (chat streaming, đánh giá, phiên nói, xóa tài khoản) | Hoạt động | Kiểm thử trong runtime Workers (`wrangler pages dev`) |
| Đường ống realtime voice trong trình duyệt | Hoạt động | Kiểm thử với micro giả + server giả lập giao thức Gemini Live |
| Gọi Gemini thật (text + Live) | **Chờ cấu hình** | Cần `GEMINI_API_KEY`; chạy `npm run smoke:gemini` |
| Supabase thật (đăng ký, RLS hai tài khoản) | **Chờ cấu hình** | Cần project Supabase; chạy `npm run test:rls:remote` |
| Email xác minh / đặt lại mật khẩu | **Chờ cấu hình** | SMTP mặc định của Supabase chỉ gửi 2 email/giờ và chỉ tới email thành viên team |
| URL công khai | **Chưa deploy** | Cần tài khoản Cloudflare của bạn — xem [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |

Các tính năng AI **tắt mặc định** (`AI_TEXT_ENABLED`, `AI_VOICE_ENABLED` = `false`) cho đến khi bạn bật và cấu hình khóa. Khi tắt, giao diện báo rõ "chưa được bật" thay vì hiển thị kết quả giả.

## Chạy trên máy

Yêu cầu Node.js ≥ 22.12.

```bash
npm install
cp .env.example .env.local          # điền VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
cp .dev.vars.example .dev.vars      # điền khóa phía server (không commit)
npm run dev:api                     # build + chạy API ở http://127.0.0.1:8788
npm run dev                         # frontend ở http://localhost:5173 (proxy /api → 8788)
```

Không có Supabase vẫn mở được trang giới thiệu; các trang cần đăng nhập sẽ hiện hướng dẫn cấu hình.

## Lệnh

| Lệnh | Mô tả |
|---|---|
| `npm run build` | Typecheck toàn bộ + build `dist/` |
| `npm test` | Unit/integration: DB (RLS, quota), API, logic frontend |
| `npm run test:e2e` | Playwright trên Chromium (desktop + mobile) |
| `npm run smoke:gemini` | Kiểm tra Gemini thật (text, JSON, ephemeral token, phiên Live) |
| `npm run test:rls:remote` | Kiểm tra RLS với 2 tài khoản thật trên Supabase của bạn |
| `npm run gen:seed` | Sinh lại migration nội dung từ `content/*.mjs` |
| `npm run deploy` | Build + `wrangler pages deploy` |

## Tài liệu

- [Đối chiếu nhận xét, các sửa đổi và cấu hình cần bổ sung](docs/REVIEW_AND_FIXES.md)
- [Kiến trúc & luồng dữ liệu](docs/ARCHITECTURE.md)
- [Dịch vụ, chi phí, giới hạn miễn phí đã xác minh](docs/SERVICES_AND_COSTS.md)
- [Hướng dẫn deploy từng bước](docs/DEPLOYMENT.md)
- [Kiểm thử & checklist kiểm thử thực tế](docs/TESTING.md)

## Cấu trúc thư mục

```
src/            Frontend (React)
  features/     Mỗi trang/tính năng một thư mục (chat, speaking, vocabulary…)
  components/   UI kit, layout, component dùng chung
  lib/          API client, audio/PCM, realtime client, speech, SRS, so khớp văn bản
server/         API (Hono) — routes, AI providers, evaluation service, data layer
functions/      Điểm vào Cloudflare Pages Functions (/api/*)
shared/         Hằng số, schema Zod, kịch bản nhập vai — dùng chung FE/BE
supabase/       migrations/ (schema + seed) và tests/ (RLS trên PGlite)
content/        Nội dung học gốc (từ vựng, ngữ pháp, bài đọc, bài nghe…)
e2e/            Playwright
scripts/        Sinh seed, smoke test tích hợp thật
```
#
