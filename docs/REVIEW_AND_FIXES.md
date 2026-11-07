# Rà soát và khắc phục — 08/11/2026

Nhận xét phản ánh đúng nhiều giới hạn của một MVP chi phí thấp, nhưng lẫn giữa lỗi, giới hạn công nghệ và tính năng chưa nằm trong phạm vi sản phẩm. Không phải tất cả đều là lỗi nghiêm trọng cần thay ngay.

| Nhận xét | Đánh giá sau khi đọc mã | Thay đổi / giới hạn còn lại |
|---|---|---|
| So transcript không phải chấm phát âm | Đúng; giao diện cũ đã công bố điều này | Tích hợp Azure Speech tùy chọn để chấm âm học và âm vị. Điểm này tách khỏi độ khớp văn bản; chưa chấm stress/prosody |
| Bài nghe chỉ có TTS | Đúng với nội dung hiện có | Player và CMS hỗ trợ file audio theo từng câu; ưu tiên bản thu. Kho bài mẫu hiện vẫn dùng TTS cho đến khi giáo viên thêm audio có bản quyền phù hợp |
| Không nghe lại giọng qua nhiều tuần | Đúng | Nhật ký WAV cục bộ theo tài khoản, ghi chủ động, nghe/tải/xóa được, 100 bản hoặc 32 MB. Chưa đồng bộ audio giữa thiết bị |
| AI chấm viết có thể sai | Đúng về rủi ro; ứng dụng không hề cấp band IELTS chính thức | Rubric cố định, giữ nguyên câu đúng, từ chối trích dẫn/sửa đổi không tồn tại trong bài. Không thể bảo đảm AI hết ảo giác hoặc cho cùng nhận xét mọi lần |
| Supabase Free có thể pause | Đúng; đây là chính sách dịch vụ | Health check thực sự truy vấn DB, trả 503 khi lỗi. Cần chủ tài khoản khôi phục hoặc chọn gói phù hợp; mã nguồn không tự xóa giới hạn này |
| SMTP mặc định không đủ cho public signup | Đúng; README và hướng dẫn cũ đã ghi nhận | Bổ sung hướng dẫn cấu hình và kiểm chứng cụ thể. Chưa cấu hình tài khoản SMTP thay chủ dự án |
| Gemini dễ vượt quota | Có cơ sở; không có một RPM cố định áp dụng mọi model/project | Bổ sung tổng request/phút theo provider/model trong DB, tính cả chat + sửa lỗi và request thất bại. Hệ thống vốn đã có quota/người, trần/ngày, giới hạn phiên voice |
| Free tier có rủi ro quyền riêng tư | Có cơ sở nhưng tùy billing/khu vực/điều khoản | Cập nhật chính sách cho Gemini, Azure, ghi âm cục bộ, thư viện offline. Không tự chuyển sang trả phí và không tự tuyên bố tuân thủ GDPR/COPPA |
| Firefox không dùng được voice | Nhận xét quá rộng: realtime AudioWorklet và STT server không cần Web Speech; phát âm đã có STT server | Thêm STT server cho chế độ nói dự phòng, ghi từng lượt bằng nút Nói. Chế độ văn bản vẫn có khi thiếu khả năng thu âm |
| Safari/iOS có autoplay policy | Đúng; output AudioContext vốn đã tạo trong lần chạm bắt đầu | Input AudioContext cũng được tạo/resume trước khi chờ quyền micro. Kiểm tra lỗi mở output; dọn micro khi lỗi/rời trang. Cần kiểm thử iPhone thật |
| Tiếng loa có thể gây tự ngắt | Có cơ sở; micro vốn đã yêu cầu echoCancellation/noiseSuppression | Thêm tùy chọn loa ngoài dùng luân phiên: không gửi micro lúc AI nói, chờ thêm 350 ms. Tai nghe và chế độ mặc định vẫn cho phép ngắt lời |
| Nội dung hardcode, thiếu CMS | Thiếu CMS là đúng; nội dung thực tế được đọc từ DB, không cần deploy frontend khi sửa DB | CMS cho bài học/câu hỏi/catalog, draft/publish và RLS. Seed khởi tạo không còn ghi đè nội dung đã sửa hay xóa câu hỏi do giáo viên tạo |
| SRS chưa phải FSRS | Đúng về thuật toán hiện tại; không tự chứng minh SM-2 không dùng được | Sửa lỗi từ “đã thuộc” không bao giờ được ôn lại, đồng bộ thống kê DB. Chưa thay scheduler bằng FSRS; cần lưu/migrate state và đánh giá lịch sử ôn trước |
| Không có offline | Đúng | PWA + thư viện bài đọc/thẻ catalog tải chủ động, mở được khi mất mạng. Không cache auth/API/chat; kết quả tự luyện offline không đồng bộ SRS |
| Thiếu leaderboard, kết bạn, push | Đúng về tính năng xã hội; đã có streak và mục tiêu học | Chưa thêm: cần quyết định mục tiêu retention, quyền riêng tư và cơ chế chống gian lận. Không phải lỗi vận hành |
| Thiếu gói Pro/thanh toán | Đúng về phạm vi kinh doanh | Chưa thêm: cần chọn thị trường, giá, đơn vị nhận tiền, chính sách hoàn tiền và nhà cung cấp. Không tạo nút mua gói không có khả năng cấp quyền thực |

## Áp dụng với dự án đang chạy

1. Sao lưu DB trước khi nâng cấp. Chạy migration mới `supabase/migrations/20261108000001_content_and_rate_limits.sql` **sau** hai migration hiện có, rồi deploy bản build mới. Migration chỉ chạy một lần. Với CLI dùng `supabase db push`; nếu dùng SQL Editor, chỉ chạy file mới trên DB đã khởi tạo.
2. Tài khoản `profiles.role = 'admin'` mở Quản trị để sửa bài học, câu hỏi và từ dùng chung. Tài khoản thường không có quyền ghi những nội dung này. Bài mới mặc định là bản nháp; giáo viên bật xuất bản khi nội dung và câu hỏi hoàn tất.
3. `npm run gen:seed` giờ tạo seed chỉ thêm ID/slug còn thiếu. Sửa bài đã có qua CMS; seed không còn dùng để cập nhật hoặc xóa bài hiện hữu. Không chạy lại bản seed cũ đã được lưu ở nơi khác vì nó có câu lệnh upsert/delete cũ.
4. Đặt `LIMIT_GLOBAL_AI_PER_MINUTE` theo hạn mức model/project thực tế trong [AI Studio](https://aistudio.google.com/rate-limit), chừa khoảng dự phòng. Mặc định ứng dụng là 10 request/phút/model, không phải tuyên bố Gemini luôn cấp 10 RPM. Chat có bật sửa lỗi dùng 2 request. Giới hạn này không xử lý TPM hoặc lưu lượng từ ứng dụng khác dùng chung project.
5. `/api/health` trả HTTP 200 khi truy vấn DB thành công, HTTP 503 khi chưa cấu hình hoặc DB không truy cập được. Đây là kiểm tra DB, không chứng minh SMTP/Gemini hoạt động; kiểm tra riêng bằng email thử và smoke test AI.

## Bật chấm âm vị Azure

Tạo Azure Speech resource và dùng đúng custom endpoint của resource, dạng `https://<resource-name>.cognitiveservices.azure.com`.

- Đặt `AZURE_SPEECH_KEY` và `AZURE_SPEECH_ENDPOINT` phía server (Cloudflare Secrets hoặc `.dev.vars` khi chạy local).
- Đổi `AZURE_PRONUNCIATION_ENABLED = "true"` trong `wrangler.toml`, rồi deploy. Tắt mặc định để tránh phát sinh phí ngoài ý muốn.
- Không đặt khóa Azure trong biến `VITE_*` hay frontend. Trình duyệt chỉ gọi API đã xác thực, có quota.
- Tiếng Anh Mỹ (`en-US`), WAV PCM mono 16 kHz, tối đa 15 giây, đánh giá toàn câu/từ/âm vị. Không bật prosody vì có thể có phí riêng. Không giả lập điểm khi thiếu key.
- Nhật ký giọng nói hoạt động độc lập: bản ghi của nhật ký không dùng để chấm và không được upload. Bản ghi của thao tác chấm Azure có gửi tới Azure.

Nguồn giao thức: [Azure short audio REST + pronunciation assessment](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short). Tích hợp được kiểm thử bằng response theo hợp đồng API; **chưa gọi Azure thật** khi chưa có resource/key.

## Email xác minh và đặt lại mật khẩu

SMTP được cấu hình **trong Supabase Auth**, không chỉ thêm một biến môi trường vào frontend. Ví dụ với Resend:

1. Tạo tài khoản Resend, xác minh domain gửi (DNS theo dashboard), tạo API key có quyền gửi.
2. Trong Supabase → Authentication → Email/SMTP, bật custom SMTP. Host `smtp.resend.com`, port `465`, username `resend`, password là API key. Sender phải thuộc domain đã xác minh. Ưu tiên integration Supabase–Resend nếu tài khoản hỗ trợ.
3. Kiểm tra Site URL, redirect `/auth/callback` và `/reset-password`, hạn mức gửi email và quota phía dịch vụ email.
4. Thử đăng ký và đặt lại mật khẩu với một địa chỉ **không nằm trong team Supabase**, kiểm tra inbox/spam và log Auth. Không đánh dấu hoàn tất chỉ vì cấu hình đã được lưu.

Nguồn: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Resend SMTP](https://resend.com/features/smtp-service), [Supabase–Resend integration](https://supabase.com/partners/catalog/resend). Domain/key và cấu hình dashboard chưa được cấp trong workspace nên phần vận hành này còn cần chủ dự án thực hiện.

## Dữ liệu và điều kiện dịch vụ

Kiểm tra [Gemini terms](https://ai.google.dev/gemini-api/terms) cho project và khu vực đang dùng, gồm điều khoản dữ liệu, đối tượng sử dụng và tuổi người dùng. Bật billing có ảnh hưởng điều khoản xử lý dữ liệu và chi phí, không tự biến ứng dụng thành sản phẩm đã được xác nhận tuân thủ pháp luật. Nếu hướng tới trẻ vị thành niên/doanh nghiệp, cần chọn dịch vụ và mô hình vận hành phù hợp trước khi bật AI cho nhóm đó.

Nguồn đối chiếu khác: [Supabase Free/project pausing](https://supabase.com/pricing), [Gemini project/model rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [Gemini 3 sampling guidance](https://ai.google.dev/gemini-api/docs/gemini-3).

## Kiểm chứng

- `npm test`: kiểm thử RLS trên PostgreSQL/PGlite, quyền CMS, draft visibility, seed không xóa sửa đổi, RPM chung giữa người dùng và request lỗi, kiểm tra phản hồi chấm viết, hợp đồng Azure/WAV, luồng voice.
- `npm run build`: TypeScript + production build.
- `npm run test:e2e`: desktop/mobile, gồm CMS, file audio thật qua player, ghi âm cục bộ tồn tại sau reload và không upload, thư viện có Service Worker khi ngắt mạng.
- Còn cần kiểm thử tài khoản Supabase/SMTP, Gemini, Azure thật và Safari/iOS thiết bị thật. Các test có mock dịch vụ không chứng minh chất lượng chấm âm học hay độ tin cậy vận hành production.
