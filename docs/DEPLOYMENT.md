# Hướng dẫn deploy

Kết quả: website công khai qua HTTPS tại `https://<tên-project>.pages.dev`, API cùng domain ở `/api/*`, dữ liệu trên Supabase, AI qua Gemini. Không cần mua domain.

Thời gian: khoảng 30–45 phút cho lần đầu.

## 0. Chuẩn bị

- Node.js ≥ 22.12, Git.
- Tài khoản miễn phí: [Cloudflare](https://dash.cloudflare.com/sign-up), [Supabase](https://supabase.com/dashboard), [Google AI Studio](https://aistudio.google.com/).
- `npm install` trong thư mục dự án.

## 1. Supabase — database & đăng nhập

1. **Tạo project** (Dashboard → New project). Chọn region gần người dùng (ví dụ Singapore cho Việt Nam). Lưu mật khẩu database.
2. **Lấy khóa** (Project Settings → API Keys):
   - `Project URL` → `https://<ref>.supabase.co`
   - **Publishable key** (`sb_publishable_…`) → dùng ở frontend và server.
   - **Secret key** (`sb_secret_…`) → **chỉ** dùng ở server. Không dán vào frontend, không commit.
3. **Chạy migrations** — chọn một cách:
   - _SQL Editor_ (đơn giản nhất): mở SQL Editor → New query → dán toàn bộ `supabase/migrations/20261010000001_init_schema.sql` → Run. Sau đó làm tương tự với `20261010000002_seed_content.sql` (nội dung học; chạy lại nhiều lần vẫn an toàn).
   - _Supabase CLI_: `npx supabase@latest login`, `npx supabase@latest init` (nếu chưa có `supabase/config.toml`), `npx supabase@latest link --project-ref <ref>`, rồi `npx supabase@latest db push`.
4. **Kiểm tra RLS**: Table Editor → mỗi bảng trong `public` phải hiện "RLS enabled".
5. **Cấu hình Authentication**:
   - Sign In / Providers → Email: bật.
   - URL Configuration:
     - **Site URL**: `https://<tên-project>.pages.dev` (điền sau khi có URL ở bước 3; tạm thời có thể để `http://localhost:5173`).
     - **Redirect URLs**: thêm `https://<tên-project>.pages.dev/auth/callback`, `https://<tên-project>.pages.dev/reset-password`, và cho dev `http://localhost:5173/**`.
   - **Email**: SMTP mặc định chỉ gửi 2 email/giờ tới thành viên team. Trước khi mở công khai, cấu hình SMTP riêng (Authentication → SMTP Settings). Khi chỉ thử nghiệm, có thể tắt "Confirm email" để đăng ký xong là đăng nhập được (đặt lại mật khẩu vẫn cần SMTP).
6. **Cấp quyền quản trị cho bạn** (sau khi đã đăng ký tài khoản trên web), chạy trong SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'email-cua-ban@example.com');
   ```
   Người dùng không thể tự làm việc này (đã kiểm thử).

## 2. Gemini API key

1. Vào [AI Studio → API keys](https://aistudio.google.com/app/apikey) → Create API key. **Chọn/tạo Google Cloud project không bật billing** để chỉ dùng gói miễn phí (hết hạn mức thì nhận lỗi 429, không bị tính tiền).
2. Mở [AI Studio → Rate limits](https://aistudio.google.com/rate-limit), ghi lại hạn mức của `gemini-3.5-flash-lite` và `gemini-3.8-live`, rồi chỉnh trong `wrangler.toml` sao cho `LIMIT_GLOBAL_AI_PER_DAY` và `LIMIT_VOICE_CONCURRENT_GLOBAL` **thấp hơn** hạn mức thật.
3. Kiểm tra key hoạt động thật (dùng vài lượt quota):
   ```bash
   GEMINI_API_KEY=... npm run smoke:gemini
   ```
   Bốn kiểm tra phải PASS: text, JSON, ephemeral token, phiên Live trả về audio + transcript. Nếu bước Live báo 404/400, đổi `GEMINI_LIVE_MODEL` theo trang [Models](https://ai.google.dev/gemini-api/docs/models); nếu ephemeral token lỗi do phiên bản API, thử `GEMINI_LIVE_API_VERSION=v1alpha`.

## 3. Cloudflare Pages — website + API

`wrangler.toml` chứa `pages_build_output_dir` nên nó là **nguồn cấu hình** cho biến (`[vars]`): sửa biến trong file rồi deploy lại; dashboard chỉ hiển thị, không sửa được. Secret thì đặt riêng bằng lệnh `wrangler pages secret`.

### Cách A — Direct Upload bằng Wrangler (nhanh nhất)

Lưu ý: project tạo kiểu Direct Upload **không chuyển sang Git integration được**. Nếu muốn deploy tự động từ GitHub, dùng Cách B.

```bash
npx wrangler login
npx wrangler pages project create englishai --production-branch main

# Secret phía server (mỗi lệnh sẽ hỏi giá trị; không lưu vào file)
npx wrangler pages secret put SUPABASE_URL --project-name englishai
npx wrangler pages secret put SUPABASE_PUBLISHABLE_KEY --project-name englishai
npx wrangler pages secret put SUPABASE_SECRET_KEY --project-name englishai
npx wrangler pages secret put GEMINI_API_KEY --project-name englishai
npx wrangler pages secret list --project-name englishai
```

Bật tính năng AI khi đã có key: trong `wrangler.toml` sửa

```toml
AI_TEXT_ENABLED = "true"
AI_VOICE_ENABLED = "true"
```

Build với giá trị **công khai** cho frontend rồi deploy (thư mục `functions/` được tải lên tự động khi chạy từ thư mục gốc dự án):

```bash
# PowerShell:  $env:VITE_SUPABASE_URL="https://<ref>.supabase.co"; $env:VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
# Bash:
export VITE_SUPABASE_URL=https://<ref>.supabase.co
export VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
npm run build
npx wrangler pages deploy dist --project-name englishai --branch main
```

Wrangler in ra URL deploy. URL production là `https://englishai.pages.dev` (nếu tên `englishai` đã có người dùng, Cloudflare sẽ cấp tên khác — dùng đúng URL được in ra).

### Cách B — Git integration (deploy tự động khi push)

1. Đẩy mã lên GitHub/GitLab (không commit `.env.local`, `.dev.vars`).
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git → chọn repo.
3. Build settings: Framework preset **React (Vite)**, build command `npm run build`, output `dist`. Node lấy từ file `.node-version` (22).
4. Biến build-time `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`: đặt trong Settings → Variables and Secrets. Nếu dashboard không cho sửa vì `wrangler.toml` là nguồn cấu hình, tạo file `.env.production` chứa **đúng hai giá trị công khai** này (URL và publishable key — không phải secret), bỏ dòng `.env.*` tương ứng trong `.gitignore` để commit file này.
5. Đặt 4 secret như Cách A (`wrangler pages secret put … --project-name <tên>`), rồi Retry deployment.

### Sau khi có URL

1. Quay lại Supabase → Authentication → URL Configuration, đặt **Site URL** và **Redirect URLs** đúng URL thật (bước 1.5).
2. Mở `https://<url>/api/health` → phải thấy `{"ok":true,"database":true,"features":{"aiText":true,"aiVoice":true}}`.
3. CORS: API cùng domain với site nên không cần cấu hình thêm. Chỉ khi gọi API từ domain khác (ví dụ API deploy riêng thành Worker) mới cần thêm domain đó vào `ALLOWED_ORIGINS` và vào `connect-src` của CSP trong `public/_headers`.
4. Domain riêng (tùy chọn): Pages → Custom domains. Nhớ thêm domain vào Supabase Redirect URLs.

## 4. Kiểm thử trên production

Làm theo [TESTING.md → Checklist kiểm thử thực tế](TESTING.md#checklist-kiểm-thử-thực-tế). Tối thiểu:

```bash
# RLS với 2 tài khoản thật (tự tạo và tự xóa tài khoản tạm)
SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... npm run test:rls:remote
```

Rồi trên điện thoại và máy tính: đăng ký → onboarding → chat → luyện nói realtime (cho phép micro) → kết thúc → phân tích buổi nói → kiểm tra Dashboard cập nhật.

## Cập nhật sau này

- Mã nguồn: `npm run deploy` (Cách A) hoặc push lên nhánh chính (Cách B).
- Nội dung học: sửa `content/*.mjs` → `npm run gen:seed` → chạy lại file seed trong SQL Editor.
- Thay đổi schema: thêm file migration mới trong `supabase/migrations/` (không sửa file đã chạy trên production) và chạy nó.

## Xử lý sự cố

| Hiện tượng                          | Nguyên nhân thường gặp                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| Trang "Ứng dụng chưa được cấu hình" | Build thiếu `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`                       |
| `/api/health` báo `database: false` | Thiếu secret `SUPABASE_*` hoặc đặt sai project                                          |
| AI báo "chưa được bật"              | `AI_TEXT_ENABLED`/`AI_VOICE_ENABLED` chưa là `"true"` hoặc thiếu `GEMINI_API_KEY`       |
| Lỗi 429 "hết hạn mức miễn phí"      | Đã chạm hạn mức Gemini free tier trong ngày (đặt lại lúc 0:00 giờ Thái Bình Dương)      |
| Đăng ký không nhận được email       | SMTP mặc định giới hạn 2 email/giờ và chỉ gửi tới thành viên team → cấu hình SMTP riêng |
| Không bật được micro                | Phải mở qua HTTPS; kiểm tra quyền micro của trang trong trình duyệt                     |
| Project Supabase "Paused"           | Gói Free tạm dừng sau 1 tuần không hoạt động → Restore trong dashboard                  |
