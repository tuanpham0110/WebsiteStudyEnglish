import { LegalLayout } from './LegalLayout';

export default function PrivacyPage() {
    return (
        <LegalLayout title="Chính sách quyền riêng tư" updated="08/11/2026">
            <p>
                Trang này giải thích EnglishAI thu thập dữ liệu gì, dùng vào việc gì và bạn kiểm soát dữ liệu của mình như thế nào. Người vận hành
                trang cần bổ sung thông tin liên hệ chính thức trước khi mở cho công chúng.
            </p>

            <h2>1. Dữ liệu chúng tôi lưu</h2>
            <ul>
                <li>Thông tin tài khoản: email, tên hiển thị, trình độ, mục tiêu và cài đặt học tập.</li>
                <li>Dữ liệu học tập: thời gian học, bài đã làm, kết quả bài tập, từ vựng và lịch ôn tập.</li>
                <li>Nội dung hội thoại: tin nhắn trong AI Chat/nhập vai và bản ghi văn bản (transcript) của phiên luyện nói.</li>
                <li>Siêu dữ liệu sử dụng: số lượt dùng AI, thời lượng phiên nói, trạng thái lỗi — không bao gồm nội dung tin nhắn hay âm thanh.</li>
            </ul>

            <h2>2. Âm thanh</h2>
            <p>
                EnglishAI <strong>không lưu file âm thanh trên máy chủ</strong>. Trong chế độ luyện nói realtime, âm thanh được truyền trực tiếp từ trình duyệt tới
                nhà cung cấp AI để xử lý và không đi qua máy chủ của chúng tôi. Âm thanh trả lời của AI chỉ được giữ tạm trong bộ nhớ trình duyệt để
                bạn nghe lại, và mất khi đóng trang. Micro chỉ bật khi bạn bắt đầu phiên và được tắt ngay khi kết thúc.
            </p>
            <p>
                Khi dùng nhận dạng phía máy chủ hoặc chấm âm học Azure, bản thu đi qua API của EnglishAI tới dịch vụ xử lý và không được lưu thành file trên máy chủ.
                Nhật ký giọng nói là tính năng riêng: chỉ khi bạn nhấn “Ghi và lưu trên thiết bị”, bản thu mới được lưu trong trình duyệt, theo tài khoản đang đăng nhập.
                Bản thu nhật ký không được tải lên; bạn có thể nghe, tải WAV hoặc xóa. Giới hạn là 100 bản hoặc 32 MB mỗi tài khoản trên thiết bị. Xóa dữ liệu trình duyệt có thể làm mất bản thu.
            </p>

            <h2>3. Bên thứ ba xử lý dữ liệu</h2>
            <ul>
                <li>
                    <strong>Supabase</strong> — cơ sở dữ liệu và xác thực tài khoản.
                </li>
                <li>
                    <strong>Cloudflare</strong> — lưu trữ website và API.
                </li>
                <li>
                    <strong>Google (Gemini API)</strong> — xử lý tin nhắn, âm thanh luyện nói, bài viết để tạo câu trả lời và nhận xét. Khi dịch vụ
                    chạy trên dịch vụ miễn phí của Gemini API, Google cho biết nội dung có thể được dùng để cải thiện sản phẩm, tùy tài khoản billing và khu vực áp dụng.
                    Xem <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">điều khoản xử lý dữ liệu của Google</a>. Vì vậy,{' '}
                    <strong>đừng nhập thông tin nhạy cảm</strong> (số giấy tờ, mật khẩu, dữ liệu sức khỏe…) vào các tính năng AI.
                </li>
                <li><strong>Microsoft Azure Speech</strong> — xử lý bản thu để chấm độ chính xác, độ trôi chảy và âm vị, chỉ khi quản trị viên bật dịch vụ chấm âm học.</li>
                <li><strong>Nguồn audio bài học</strong> — trình duyệt tải bản thu từ địa chỉ do quản trị viên cung cấp; máy chủ cung cấp audio có thể nhận thông tin kết nối như địa chỉ IP.</li>
                <li>
                    <strong>Trình duyệt của bạn</strong> — ở chế độ dự phòng và luyện phát âm, tính năng nhận dạng giọng nói của trình duyệt có thể gửi
                    âm thanh tới dịch vụ của nhà phát triển trình duyệt (ví dụ Google với Chrome) theo chính sách riêng của họ.
                </li>
            </ul>

            <h2>4. Mục đích sử dụng</h2>
            <ul>
                <li>Cung cấp tính năng học tập và lưu tiến độ của bạn.</li>
                <li>Giới hạn lượt dùng, chống lạm dụng và kiểm soát chi phí dịch vụ.</li>
                <li>Thống kê tổng hợp cho quản trị viên (không bao gồm nội dung tin nhắn hay email).</li>
            </ul>
            <p>Chúng tôi không bán dữ liệu cá nhân và không dùng dữ liệu cho quảng cáo.</p>

            <h2>5. Quyền của bạn</h2>
            <ul>
                <li>Xem và chỉnh sửa hồ sơ, cài đặt bất cứ lúc nào.</li>
                <li>Xóa từng hội thoại hoặc phiên luyện nói.</li>
                <li>
                    Xóa tài khoản trong mục Hồ sơ: toàn bộ dữ liệu cá nhân bị xóa vĩnh viễn; nhật ký sử dụng được ẩn danh (bỏ liên kết với bạn) để giữ
                    đúng thống kê hạn mức hệ thống.
                </li>
            </ul>

            <h2>6. Lưu trữ cục bộ</h2>
            <p>
                Trình duyệt lưu phiên đăng nhập và lựa chọn giao diện (sáng/tối) trong bộ nhớ cục bộ. Chúng tôi không dùng cookie quảng cáo hay công
                cụ theo dõi bên thứ ba.
            </p>
            <p>Bản nháp bài viết, bản ghi nhật ký và bài đọc/thẻ từ bạn chủ động tải offline cũng nằm trên thiết bị. Thư viện offline chỉ chứa nội dung dùng chung và mở được không cần đăng nhập; không chứa tin nhắn, token hay kết quả học tập riêng. Kết quả ôn thẻ offline không đồng bộ lên tài khoản.</p>

            <h2>7. Bảo mật</h2>
            <p>
                Dữ liệu được truyền qua HTTPS. Mỗi người dùng chỉ truy cập được dữ liệu của chính mình nhờ cơ chế Row Level Security của cơ sở dữ liệu.
                Khóa bí mật của các dịch vụ chỉ được lưu ở máy chủ.
            </p>
        </LegalLayout>
    );
}
