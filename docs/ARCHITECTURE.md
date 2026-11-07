# Kiến trúc EnglishAI

## Tổng quan

```mermaid
flowchart LR
  subgraph Browser["Trình duyệt"]
    SPA["React SPA<br/>(static assets)"]
    Mic["Micro → AudioWorklet<br/>PCM 16 kHz"]
    WS["Gemini Live client<br/>(WebSocket)"]
    WebSpeech["Web Speech API<br/>(dự phòng)"]
  end
  subgraph CF["Cloudflare Pages"]
    Static["dist/ (HTML, JS, CSS)"]
    API["Pages Functions /api/*<br/>Hono"]
  end
  subgraph SB["Supabase"]
    Auth["Auth (JWT)"]
    PG["PostgreSQL + RLS<br/>quota functions"]
  end
  Gemini["Gemini API<br/>generateContent / auth_tokens"]
  Live["Gemini Live<br/>BidiGenerateContentConstrained"]

  SPA -->|HTML/JS| Static
  SPA -->|"Bearer JWT"| API
  SPA -->|"supabase-js (RLS)"| PG
  SPA --> Auth
  API -->|"verify JWT (JWKS)"| Auth
  API -->|"user JWT → RLS<br/>secret key → quota RPC"| PG
  API -->|"x-goog-api-key (server only)"| Gemini
  Mic --> WS
  WS -->|"access_token = ephemeral"| Live
```

- Frontend là site tĩnh. Đọc/ghi dữ liệu học tập thông thường (từ vựng, tiến độ, hội thoại…) đi thẳng tới Supabase bằng khóa **publishable**; Row Level Security bảo đảm mỗi người chỉ chạm được dữ liệu của mình.
- Mọi thứ cần **secret** (Gemini API key, Supabase secret key) chỉ ở Pages Functions.
- Âm thanh realtime **không đi qua server của chúng ta**: server chỉ cấp ephemeral token, trình duyệt kết nối trực tiếp tới Gemini Live → độ trễ thấp và không tốn CPU Worker.

## Luồng luyện nói realtime

```mermaid
sequenceDiagram
  participant U as Người học
  participant B as Trình duyệt
  participant A as /api (Worker)
  participant D as Postgres
  participant G as Gemini API
  participant L as Gemini Live (WS)
  U->>B: Bắt đầu phiên
  B->>B: getUserMedia (xin quyền micro)
  B->>A: POST /api/speaking/sessions {level, topic, voice}
  A->>A: xác minh JWT
  A->>D: start_voice_session() — 1 phiên/người, ngân sách ngày, giới hạn đồng thời toàn hệ thống
  A->>G: POST /v1beta/auth_tokens {uses:1, expireTime, bidiGenerateContentSetup}
  G-->>A: auth_tokens/…
  A-->>B: token, wsUrl, setup, maxSeconds
  B->>L: WebSocket ?access_token=…, gửi setup
  L-->>B: setupComplete
  loop hội thoại
    B->>L: realtimeInput.audio (PCM 16 kHz, 100 ms/chunk)
    L-->>B: modelTurn audio 24 kHz + transcription
    L-->>B: interrupted (khi người học ngắt lời) → dừng phát ngay
  end
  U->>B: Kết thúc (hoặc hết giờ)
  B->>B: dừng micro, đóng WS, đóng AudioContext
  B->>A: POST /end {transcript}
  A->>D: finish_speaking_session() — thời lượng đo bằng đồng hồ server, giới hạn bởi ngân sách đã cấp
```

Các điểm then chốt:
- Token **dùng 1 lần**, phải mở phiên trong 60 giây, hết hạn sau `maxSeconds + 20 s` → kể cả khi client gian lận, phiên không thể kéo dài quá ngân sách.
- Toàn bộ cấu hình phiên (model, system prompt, giọng) **nằm trong token** và không có `fieldMask`; theo tài liệu API, khi đó setup lấy hoàn toàn từ token, client không thể đổi model hay prompt.
- Phiên tối đa mặc định 5 phút (< 10 phút vòng đời kết nối, < 15 phút giới hạn phiên audio không nén) nên không cần session resumption.
- Trạng thái "Đang nghe" chỉ hiển thị khi WebSocket đã `setupComplete` **và** track micro đang `live`. "AI đang suy nghĩ" dựa trên VAD phía client (năng lượng RMS) sau khi người học ngừng nói.

## Ba cấp luyện nói

| Cấp | Điều kiện | Cách hoạt động |
|---|---|---|
| 1. Realtime voice | `AI_VOICE_ENABLED` + trình duyệt có AudioWorklet/WebSocket + HTTPS + micro | Gemini Live, voice-to-voice, có ngắt lời |
| 2. Dự phòng | `AI_TEXT_ENABLED` + Web Speech hoặc micro/AudioWorklet | Trình duyệt nhận dạng; nếu thiếu Web Speech thì ghi từng lượt tối đa 15 giây → `/api/stt` → `/turn`. Đọc to nếu có TTS. Với nhận dạng server, mỗi lượt bắt đầu bằng nút Nói. |
| 3. Văn bản | `AI_TEXT_ENABLED` | Gõ câu trả lời; AI trả lời bằng văn bản (đọc to nếu có speech synthesis) |

## Luồng AI Chat

1. `POST /api/chat/stream` (SSE). Server kiểm tra quota (`consume_ai_quota`), tải 20 tin nhắn gần nhất **từ DB** (không tin lịch sử từ client), lưu tin nhắn người học.
2. Song song: stream câu trả lời và gọi riêng bộ sửa lỗi (JSON có schema).
3. Sự kiện SSE: `meta` → `delta`… → `correction` → `done` (hoặc `error`). Câu trả lời được lưu khi stream kết thúc.
4. Khi nhà cung cấp trả 429, người học thấy thông báo dịch vụ đang giới hạn số yêu cầu, lượt bị đánh dấu lỗi và **không trừ** vào quota ngày của người học. Request lỗi vẫn được tính vào trần hệ thống và giới hạn theo phút.

## Lớp AI (provider abstraction)

`server/ai/types.ts` định nghĩa `TextChatProvider`, `RealtimeVoiceProvider`, `SpeechToTextProvider`; `src/lib/speech` có `TextToSpeechProvider`/`SpeechToTextProvider` phía trình duyệt; `server/services/evaluation.ts` là `EnglishEvaluationService` (sửa lỗi, trợ giúp, chấm bài viết, báo cáo phiên). Route chỉ phụ thuộc vào interface — đổi nhà cung cấp chỉ cần thêm một implementation trong `server/ai/` và nối trong `registry.ts`. Model được chọn ở server (biến môi trường), client không gửi tên model.

## Kiểm soát chi phí

| Cơ chế | Vị trí |
|---|---|
| Tắt mặc định tính năng tốn phí; tự tắt nếu thiếu API key | `server/env.ts` |
| Hạn mức/ngày theo người (chat, trợ giúp, chấm bài, giây nói) | `consume_ai_quota`, `start_voice_session` |
| Rate limit theo phút (mọi loại AI) | cùng các hàm trên |
| Trần toàn hệ thống/ngày (yêu cầu AI, giây nói) và số phiên nói đồng thời | cùng các hàm trên |
| Khóa tư vấn (advisory lock) để kiểm tra + ghi nguyên tử | plpgsql |
| Thời lượng nói đo bằng đồng hồ server, giới hạn bởi ngân sách cấp; phiên bỏ dở tính đủ ngân sách | `finish_speaking_session`, nhánh `expired` |
| Xóa phiên/tài khoản không hoàn lại quota (`usage_logs` không xóa được; khi xóa tài khoản chỉ ẩn danh) | schema |
| Không tự động chuyển sang dịch vụ trả phí | không có provider dự phòng trả phí nào được cấu hình |

Ngày quota tính theo UTC (7:00 sáng giờ Việt Nam). Hạn mức miễn phí của Gemini đặt lại theo giờ Thái Bình Dương; trần hệ thống mặc định (900 yêu cầu/ngày) đặt thấp hơn hạn mức để tránh lệch.

## Bảo mật

- **Xác thực:** Supabase Auth (PKCE). API xác minh JWT bằng `auth.getClaims()` (JWKS khi dự án dùng khóa ký bất đối xứng, fallback Auth server cho dự án HS256 cũ); user id chỉ lấy từ token.
- **Phân quyền dữ liệu:** RLS trên mọi bảng riêng tư + **grant theo cột** (ví dụ người dùng chỉ được sửa `display_name, level, onboarded_at` của `profiles`, không sửa được `role`; không chèn được `occurred_at` để giả mạo chuỗi ngày học). Bảng `speaking_sessions`, `usage_logs` chỉ server ghi.
- **Admin:** `profiles.role = 'admin'` chỉ đặt được bằng SQL; `admin_overview()` kiểm tra quyền trong DB, chỉ trả số liệu tổng hợp.
- **API:** validate mọi body bằng Zod, giới hạn kích thước, CORS allowlist (kèm wildcard cho preview), lỗi trả về thông điệp an toàn, log đã che khóa/token.
- **Trình duyệt:** CSP chặt (`script-src 'self'`), `X-Frame-Options: DENY`, `Permissions-Policy: microphone=(self)`.
- **Âm thanh:** không lưu file âm thanh trên máy chủ; audio AI chỉ giữ trong bộ nhớ để phát lại; micro tắt khi kết thúc phiên hoặc rời trang. Nhật ký phát âm lưu WAV trong IndexedDB khi người học chủ động ghi, theo user id (100 bản/32 MB); có tải xuống và xóa.

## Mô hình dữ liệu

| Bảng | Nội dung | Ai ghi |
|---|---|---|
| `profiles`, `user_settings`, `learning_preferences` | hồ sơ, cài đặt, mục tiêu | trigger khi đăng ký; người dùng (cột được phép) |
| `learning_plans` | kế hoạch theo quy tắc | người dùng |
| `lessons`, `exercises`, `vocabulary` (catalog) | nội dung học | seed khởi tạo; admin biên tập trực tiếp qua RLS |
| `vocabulary` (owner_id = user), `user_vocabulary`, `vocabulary_reviews` | sổ từ cá nhân, trạng thái SRS | người dùng |
| `exercise_attempts`, `learning_progress` | kết quả, thời gian học | người dùng (thời điểm do server quyết định) |
| `conversations`, `messages` | AI chat & nhập vai | API (với JWT người dùng) |
| `speaking_sessions`, `speaking_transcripts` | phiên nói, bản ghi văn bản | API (secret key) |
| `usage_logs` | siêu dữ liệu sử dụng (không có nội dung) | API (secret key) |

Bảng điều khiển dùng RPC `get_dashboard_stats(tz)` (security invoker) tính từ hoạt động thật; chuỗi ngày theo múi giờ người dùng.

## Gợi ý học tập

Kế hoạch học và gợi ý trên Dashboard được tạo bằng **quy tắc cố định** (`src/lib/recommendations.ts`) từ dữ liệu thật: từ đến hạn ôn, kỹ năng có độ chính xác thấp, số ngày chưa luyện nói, mục tiêu phút/ngày. Giao diện ghi rõ đây là recommendation logic, không phải mô hình AI cá nhân hóa.

## Bổ sung sau rà soát 08/11/2026

- CMS ở trang Quản trị: biểu mẫu cho 4 loại bài, câu hỏi, từ catalog, bản nháp/xuất bản. Quyền ghi nằm trong RLS; câu hỏi của bản nháp cũng bị ẩn. Seed chỉ thêm dữ liệu thiếu, không ghi đè/xóa nội dung giáo viên sửa.
- `LIMIT_GLOBAL_AI_PER_MINUTE` giới hạn tổng số request theo provider/model bằng advisory lock trong DB, bao gồm request lỗi; chat có sửa lỗi dự trữ 2 request. Đây là trần cấu hình của ứng dụng, không thay thế hạn mức RPM/TPM/RPD của nhà cung cấp.
- `/api/pronunciation/assess`: Azure Speech tùy chọn, tắt mặc định, khóa chỉ ở server. Kiểm tra WAV PCM 16 kHz mono 0,4–15 giây trước khi trừ quota. Điểm âm học/âm vị tách khỏi độ khớp transcript. Chưa bật prosody/stress.
- Bài nghe ưu tiên `script[].audioUrl` (audio theo câu), TTS cho câu chưa có audio; lỗi file không tự đổi nguồn âm thanh. URL HTTPS hoặc đường dẫn cùng website.
- Chấm viết xác minh trích dẫn thực sự nằm trong bài gốc và bản sửa; dùng rubric mạch lạc cố định. Đây là kiểm tra tính bám sát văn bản, không chứng minh mọi sửa ngữ pháp đều đúng. Không dùng hạ temperature cho Gemini 3 vì hướng dẫn nhà cung cấp khuyến nghị giữ mặc định.
- Tùy chọn loa ngoài ngừng gửi micro khi AI phát âm thanh và thêm khoảng chờ 350 ms. Chế độ mặc định vẫn cho ngắt lời; luôn yêu cầu echo cancellation/noise suppression khi mở micro. Cần thử trên thiết bị thật.
- `/api/health` truy vấn DB với timeout 5 giây và trả 503 khi không truy cập được, để giám sát phát hiện project pause/sự cố. Không tự khôi phục dự án Supabase.
- PWA chỉ cache shell công khai `/offline.html` cùng tài nguyên của nó. IndexedDB riêng chứa bài đọc/thẻ catalog được tải chủ động (25 mục). Không cache API, JWT, chat hay dữ liệu người học; tự luyện thẻ offline không đồng bộ SRS.
- SRS vẫn là SM-2 đơn giản; nhãn `mastered` không còn loại từ khỏi lịch ôn. FSRS cần một dự án chuyển đổi và đánh giá riêng.
