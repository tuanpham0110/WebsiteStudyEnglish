# Kiểm thử

## Chạy

```bash
npm test               # 114 test: DB/RLS (PostgreSQL thật qua PGlite), API, logic frontend
npm run test:e2e       # 48 test Playwright: Chromium desktop 1280×800 + Pixel 7 (mobile)
npm run smoke:gemini   # Gemini thật — cần GEMINI_API_KEY
npm run test:rls:remote  # Supabase thật — cần SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY
```

Lần chạy gần nhất (10/10/2026): `npm test` 114/114 pass, `npm run test:e2e` 48/48 pass, `tsc -b` sạch, build thành công, API chạy được trong `wrangler pages dev` (runtime workerd). Hai smoke test tích hợp thật **chưa chạy** vì chưa có khóa/tài khoản (integration pending).

## Các lớp kiểm thử

| Lớp | Công cụ | Nội dung |
|---|---|---|
| Database | Vitest + PGlite (PostgreSQL 18 trong WASM) với stub schema `auth` và các role `anon`/`authenticated`/`service_role` giống Supabase | Chạy **chính các file migration**. RLS cô lập hai tài khoản trên 13 bảng riêng tư; chặn đăng bài vào hội thoại người khác; chặn tự nâng quyền admin; chặn ghi `usage_logs`, `speaking_sessions`; chặn gọi hàm quota từ client; chặn giả mạo `occurred_at`; anon không đọc được gì; CRUD từ vựng cá nhân; quota ngày/phút/toàn hệ thống; refund khi lỗi provider; một phiên nói/người; ngân sách giây nói; giới hạn đồng thời; phiên bỏ dở hết hạn; xóa phiên không hoàn quota; thống kê dashboard và chuỗi ngày; xóa tài khoản cascade + ẩn danh log. Đã kiểm "mutation": tắt RLS hoặc mở grant thì test đỏ. |
| API | Vitest + Hono `app.request` với repo/provider giả trong bộ nhớ | 401 khi thiếu/giả token; 503 khi chưa cấu hình; tính năng AI tắt mặc định; CORS allowlist + wildcard preview; validate input; SSE chat (meta/delta/correction/done), lưu tin nhắn, lịch sử lấy từ DB, bỏ qua trường `model` client gửi; 404 khi dùng hội thoại người khác; quota/rate limit/global cap; 429 của provider → lỗi rõ ràng + hoàn quota; prompt nhập vai chỉ từ kịch bản phía server; dịch/viết bài; output AI sai schema bị chặn; phiên nói realtime/dự phòng/kết thúc/báo cáo; xóa tài khoản cần xác nhận. |
| Provider | Vitest + `fetch` giả | Đúng endpoint `streamGenerateContent?alt=sse`, key ở header (không ở URL), bỏ phần "thought", phân loại 429/blocked, JSON schema; **body tạo ephemeral token** (`uses:1`, toàn bộ setup trong `bidiGenerateContentSetup`, không có `fieldMask`, thời hạn ngắn), token không chứa API key; che khóa trong log. |
| Frontend logic | Vitest + jsdom | State machine phiên nói: từ chối quyền micro, trình duyệt không hỗ trợ, quota bị từ chối (micro được giải phóng), kết nối thất bại, chỉ gửi audio sau `setupComplete`, Listening/Thinking/Speaking, ngắt lời, tắt micro, kết thúc lưu transcript, tự dừng khi hết giờ, socket đóng bất ngờ, hủy khi đang kết nối (giải phóng phiên phía server); dự phòng Web Speech và chế độ gõ; chọn cấp; SRS; so khớp transcript; diff bài viết; chấm bài tập; ước lượng trình độ; kế hoạch & gợi ý; PCM/WAV. |
| E2E | Playwright; Supabase REST và `/api` được giả lập ở tầng mạng (chỉ trong test) | Trang công khai, dark mode, validate form đăng ký, chuyển hướng khi chưa đăng nhập, chính sách quyền riêng tư; dashboard với dữ liệu từ RPC, điều hướng sidebar/bottom tab theo viewport; chat stream + thẻ sửa lỗi; trang nói trung thực về các cấp + phiên chế độ văn bản; bài tập ngữ pháp; **mọi route trong app render không lỗi và không cuộn ngang** ở cả hai viewport. |
| Realtime trong trình duyệt thật | Playwright + micro giả của Chromium + server WebSocket giả lập giao thức Gemini Live | getUserMedia → AudioWorklet → PCM **16 kHz, chunk 100 ms (1600 mẫu)**, mimeType `audio/pcm;rate=16000`; token qua `access_token`; gửi `setup` trước; nhận frame nhị phân; phát audio 24 kHz; transcript hai chiều; tắt micro gửi `audioStreamEnd` và ngừng gửi; kết thúc đóng socket, gửi transcript lên `/end`, micro tắt, nút phát lại hiện ra; phiên bị từ chối do quota hiển thị lý do và không giữ micro. |

Ảnh chụp từ e2e được lưu ở `e2e-screens/` (không commit) để xem lại giao diện.

## Giới hạn của kiểm thử tự động

- Server giả lập Live chỉ kiểm chứng **client của chúng ta** theo tài liệu giao thức; chất lượng, độ trễ, VAD và khả năng ngắt lời của Gemini thật cần kiểm thử thủ công.
- PGlite chạy cùng SQL với Supabase nhưng không phải Supabase: hành vi của PostgREST, Auth, grant mặc định trên project thật được kiểm bằng `npm run test:rls:remote`.
- jsdom/Chromium không thay thế được kiểm thử trên Safari iOS và Firefox thật.

## Checklist kiểm thử thực tế

Sau khi deploy (đánh dấu khi đã làm):

**Tích hợp**
- [ ] `npm run smoke:gemini` — 4/4 PASS (text, JSON, ephemeral token, phiên Live có audio).
- [ ] `npm run test:rls:remote` — tất cả PASS trên project Supabase thật.
- [ ] `https://<url>/api/health` trả `database: true`, `aiText/aiVoice: true`.

**Tài khoản**
- [ ] Đăng ký → nhận email xác minh (nếu bật) → mở link → vào Onboarding.
- [ ] Đăng nhập sai mật khẩu → thông báo tiếng Việt; đăng xuất → không vào được `/app`.
- [ ] Quên mật khẩu → email → đặt mật khẩu mới → đăng nhập được.
- [ ] Xóa tài khoản (gõ DELETE) → đăng nhập lại thất bại; trong SQL: `select count(*) from profiles where id = '<id>'` = 0.

**AI**
- [ ] Chat ở 2–3 chế độ, câu trả lời stream dần, thẻ sửa lỗi xuất hiện khi viết sai; dịch, từ vựng, "tự nhiên hơn", đọc to, sao chép; đổi tên, xóa hội thoại; tải lại trang vẫn còn lịch sử.
- [ ] Giảm tạm `LIMIT_CHAT_PER_DAY` xuống 2 → tin thứ 3 báo hết lượt; trang Cài đặt hiển thị đúng số đã dùng.
- [ ] Viết bài: nhận bản sửa, diff, giải thích; Dashboard ghi nhận hoạt động "Viết".

**Luyện nói realtime** (Chrome desktop, Chrome Android, Safari iOS)
- [ ] Bắt đầu → trình duyệt hỏi quyền micro → "Đang kết nối" → AI chào trước → "Đang nghe bạn nói" chỉ khi micro bật.
- [ ] Nói một câu → "AI đang suy nghĩ" → "AI đang nói" → nghe được giọng AI, transcript hai bên đúng.
- [ ] Nói chen khi AI đang nói → AI dừng ngay (bị ngắt lời).
- [ ] Tắt/bật micro; kết thúc → biểu tượng ghi âm của trình duyệt tắt; "Phân tích buổi nói" trả báo cáo; Tiến độ có phiên mới với thời lượng hợp lý.
- [ ] Để phiên chạy tới hết thời lượng → tự kết thúc với thông báo.
- [ ] Mở 2 tab cùng tài khoản, bắt đầu phiên ở cả hai → tab thứ hai báo đang có phiên khác.
- [ ] Từ chối quyền micro → thông báo hướng dẫn, gợi ý chế độ văn bản.

**Dự phòng**
- [ ] Đặt `AI_VOICE_ENABLED = "false"` → trang Luyện nói chỉ cho chọn dự phòng/văn bản và ghi rõ "không phải realtime".
- [ ] Firefox: chế độ dự phòng bị vô hiệu với lý do; chế độ văn bản hoạt động; Phát âm dùng nhận dạng phía server.

**Học tập & giao diện**
- [ ] Từ vựng: thêm/sửa/xóa từ của tôi, yêu thích, ôn flashcard (lịch ôn thay đổi), quiz.
- [ ] Ngữ pháp/Đọc/Nghe: làm hết bài → kết quả lưu, danh sách hiện "Đã học · %".
- [ ] Đọc: chạm một từ → nghĩa; từ không có trong kho → "Hỏi AI"; lưu từ.
- [ ] Nghe: phát, tạm dừng, câu trước/sau, tốc độ 0.75×/1.25×, bật/tắt transcript, chính tả.
- [ ] Phát âm: ghi âm câu mẫu → độ khớp bản ghi, từ thiếu/sai được tô màu.
- [ ] Dashboard: chuỗi ngày, phút hôm nay, biểu đồ 14 ngày khớp hoạt động thật.
- [ ] Quản trị (tài khoản admin): số liệu tổng hợp; tài khoản thường mở `/app/admin` bị chuyển về Dashboard.
- [ ] Bàn phím: Tab qua menu, Enter/Space, phím mũi tên trong tab; chế độ tối dễ đọc.
