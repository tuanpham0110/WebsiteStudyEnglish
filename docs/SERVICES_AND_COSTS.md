# Dịch vụ, chi phí và giới hạn

Thông tin dưới đây được đọc từ trang chính thức ngày **10/10/2026**. Giá và hạn mức có thể thay đổi — hãy kiểm tra lại trước khi mở cho nhiều người dùng. Mục nào chưa xác minh được trên trang chính thức đều được ghi rõ.

## Tóm tắt

| Thành phần | Dịch vụ | Gói dùng | Chi phí khởi đầu |
|---|---|---|---|
| Hosting frontend (static) | Cloudflare Pages | Free | 0 đ |
| Backend (API) | Cloudflare Pages Functions (Workers) | Free | 0 đ |
| Database + Auth | Supabase | Free | 0 đ |
| AI văn bản + realtime voice | Google Gemini API (AI Studio key) | Free tier | 0 đ |
| Dự phòng giọng nói | Web Speech API của trình duyệt | — | 0 đ |
| Domain | `*.pages.dev` kèm HTTPS | — | 0 đ (domain riêng là tùy chọn) |
| Email xác minh / đặt lại mật khẩu | SMTP riêng | **Cần chọn** | Xem mục Supabase |

## Google Gemini API

Nguồn: [Pricing](https://ai.google.dev/gemini-api/docs/pricing) (trang cập nhật 09/10/2026), [Models](https://ai.google.dev/gemini-api/docs/models), [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [Ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), [Session management](https://ai.google.dev/gemini-api/docs/live-api/session-management).

| Model (mặc định trong dự án) | Dùng cho | Free tier | Giá trả phí (Standard, USD / 1M token) |
|---|---|---|---|
| `gemini-3.5-flash-lite` (stable) | chat, sửa lỗi, dịch, chấm bài, báo cáo, nhận dạng giọng nói phía server | Miễn phí input & output | input $0.30 (text/image/video/audio) · output $2.50 |
| `gemini-3.8-live` (stable) | hội thoại giọng nói realtime | Miễn phí input & output | input text $0.75, audio $3.00 (≈ $0.005/phút) · output text $4.50, audio $12.00 (≈ $0.018/phút) |

Đã xác minh:
- Free tier: **"Content used to improve our products" = Yes** (gói trả phí: No). Chính sách quyền riêng tư của ứng dụng đã ghi điều này và khuyên người học không nhập thông tin nhạy cảm.
- Gói miễn phí không cần bật thanh toán. **Hãy tạo API key trong một Google Cloud project không bật billing**: khi hết hạn mức miễn phí, API trả HTTP 429 thay vì tính tiền. Ứng dụng xử lý 429 bằng thông báo "đã hết hạn mức miễn phí tạm thời" và không chuyển sang dịch vụ trả phí.
- Hạn mức tính theo project (không theo API key); RPD đặt lại lúc 00:00 giờ Thái Bình Dương; model preview bị giới hạn chặt hơn.
- Ephemeral token: tạo qua `POST /v1beta/auth_tokens`; mặc định hết hạn sau 30 phút, phải mở phiên trong 1 phút; chỉ dùng cho Live API; dùng ở endpoint `v1beta`.
- Phiên audio không nén ngữ cảnh tối đa 15 phút; một kết nối sống khoảng 10 phút. Ứng dụng giới hạn mỗi phiên 5 phút (cấu hình được, tối đa 9 phút).

**Chưa xác minh được:** con số RPM/TPM/RPD cụ thể của free tier cho từng model và số phiên Live đồng thời — trang Rate limits không công bố bảng số, chỉ trỏ tới AI Studio (cần đăng nhập). Các bài viết bên thứ ba nêu khoảng 10–30 RPM và 1.000–1.500 RPD cho Flash/Flash-Lite nhưng không thống nhất. **Sau khi tạo key, mở [AI Studio → Rate limits](https://aistudio.google.com/rate-limit) và chỉnh `LIMIT_GLOBAL_AI_PER_DAY`, `LIMIT_VOICE_CONCURRENT_GLOBAL` cho thấp hơn hạn mức thật.**

Lịch ngừng model đã công bố (trang Deprecations): `gemini-3.1-flash-live-preview` và `gemini-2.5-flash-native-audio-preview-12-2025` ngừng sớm nhất 17/11/2026 → dự án dùng `gemini-3.8-live` (stable, chưa có ngày ngừng).

## Cloudflare (Pages + Functions)

Nguồn: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

- Gói Free: **100.000 request/ngày** cho Workers/Pages Functions, **10 ms CPU mỗi lần gọi**. Thời gian chờ mạng (gọi Gemini, Supabase, stream SSE) không tính vào CPU.
- Request tới file tĩnh **miễn phí, không giới hạn** (không tính vào 100.000).
- Ứng dụng giữ CPU thấp: xác minh JWT bằng WebCrypto, audio realtime không đi qua Worker.
- Gói Workers Paid (nếu cần mở rộng) có trần CPU cao hơn; giá xem trang pricing ở trên.

## Supabase

Nguồn: [Pricing](https://supabase.com/pricing), [API keys](https://supabase.com/docs/guides/api/api-keys), [Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

- Free: **500 MB database**, **50.000 MAU**, 5 GB egress, 1 GB file storage, tối đa **2 project đang hoạt động**, **tạm dừng sau 1 tuần không hoạt động** (khôi phục từ dashboard). Pro từ $25/tháng (không tạm dừng).
- Khóa API: dùng `sb_publishable_…` ở frontend và `sb_secret_…` ở server. Supabase thông báo **ngừng khóa cũ `anon`/`service_role` vào cuối năm 2026**; mã nguồn vẫn chấp nhận khóa cũ nhưng nên dùng khóa mới.
- **Email:** SMTP có sẵn của Supabase chỉ gửi **2 email/giờ** và **chỉ tới địa chỉ thuộc team của project** (địa chỉ khác bị từ chối "Email address not authorized"). Vì vậy với người dùng công khai cần một trong hai:
  1. Cấu hình SMTP riêng (Authentication → SMTP Settings). Nhiều nhà cung cấp email có gói miễn phí nhưng điều kiện (ví dụ phải xác minh domain) và hạn mức thay đổi — hãy kiểm tra trên trang của họ; một số yêu cầu domain riêng.
  2. Tạm tắt "Confirm email" khi thử nghiệm nội bộ (người dùng đăng nhập ngay sau khi đăng ký). **Đặt lại mật khẩu vẫn cần SMTP.**
- Ước tính dung lượng: mỗi tin nhắn ~0,5–2 KB, mỗi phiên nói 5 phút ~3–8 KB transcript → 500 MB đủ cho hàng trăm nghìn tin nhắn.

## Web Speech API (dự phòng)

Miễn phí, do trình duyệt cung cấp. Chrome/Edge xử lý nhận dạng giọng nói trên dịch vụ của nhà phát triển trình duyệt (ví dụ Google với Chrome); Firefox không hỗ trợ `SpeechRecognition` (khi đó luyện phát âm dùng nhận dạng phía server nếu đã bật AI). Chất lượng giọng đọc phụ thuộc giọng cài trên thiết bị.

## Phương án không chọn

- **OpenAI Realtime API**: không có hạn mức miễn phí. Các nguồn bên thứ ba (tháng 7/2026) nêu `gpt-realtime-2.1` khoảng $32 / 1M token audio input và $64 / 1M output; bản mini khoảng $10 / $20. Chưa đối chiếu trên trang giá chính thức vì không dùng. Có thể thêm sau qua `RealtimeVoiceProvider` (WebRTC + client secret).

## Ước tính chi phí khi chuyển sang trả phí Gemini (tham khảo)

Chỉ áp dụng nếu bạn bật billing. Đây là **ước tính thô**, chưa tính token ngữ cảnh tích lũy và thinking token:

| Hoạt động | Giả định | Ước tính |
|---|---|---|
| 1 tin nhắn chat + sửa lỗi | ~2 lượt gọi, mỗi lượt ~1.500 token vào, ~200 token ra | ≈ $0.002 |
| 1 phiên nói realtime 5 phút | 5 phút audio vào ($0.005/phút) + ~2 phút AI nói ($0.018/phút) | ≈ $0.06 |
| 1 bài viết được chấm | ~1.500 token vào, ~1.500 token ra | ≈ $0.004 |

Theo dõi chi phí thật trong Google Cloud Billing; ứng dụng chỉ đo được số yêu cầu và số giây nói (trang Quản trị), không đo được hóa đơn của nhà cung cấp.

## Biến cấu hình giới hạn

Đặt trong `wrangler.toml` (`[vars]`). Mặc định:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `AI_TEXT_ENABLED` / `AI_VOICE_ENABLED` | `false` | bật tính năng tốn phí |
| `LIMIT_CHAT_PER_DAY` | 60 | tin nhắn chat / người / ngày |
| `LIMIT_ASSIST_PER_DAY` | 40 | dịch, giải thích, viết lại, nhận dạng giọng nói |
| `LIMIT_EVAL_PER_DAY` | 15 | chấm bài viết, báo cáo |
| `LIMIT_AI_PER_MINUTE` | 8 | yêu cầu AI / người / phút |
| `LIMIT_VOICE_SECONDS_PER_DAY` | 900 | giây nói realtime / người / ngày |
| `LIMIT_VOICE_SESSION_SECONDS` | 300 | độ dài tối đa một phiên (60–540) |
| `LIMIT_GLOBAL_AI_PER_DAY` | 900 | trần yêu cầu AI toàn hệ thống / ngày |
| `LIMIT_GLOBAL_VOICE_SECONDS_PER_DAY` | 7200 | trần giây nói toàn hệ thống / ngày |
| `LIMIT_VOICE_CONCURRENT_GLOBAL` | 3 | số phiên nói đồng thời toàn hệ thống |
