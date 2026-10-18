import { LegalLayout } from './LegalLayout';

export default function TermsPage() {
  return (
    <LegalLayout title="Điều khoản sử dụng" updated="10/10/2026">
      <p>Khi sử dụng EnglishAI, bạn đồng ý với các điều khoản dưới đây.</p>

      <h2>1. Mục đích</h2>
      <p>EnglishAI là công cụ hỗ trợ tự học tiếng Anh. Nội dung do AI tạo ra có thể sai sót; hãy dùng như gợi ý, không phải nguồn tuyệt đối.</p>

      <h2>2. Kết quả đánh giá</h2>
      <p>
        Bài kiểm tra đầu vào, nhận xét bài viết và báo cáo luyện nói chỉ mang tính tham khảo và ước lượng. Chúng không phải chứng chỉ CEFR
        hay kết quả kỳ thi chính thức. Luyện phát âm so sánh bản ghi nhận dạng giọng nói, không phải chấm điểm phát âm chuyên sâu.
      </p>

      <h2>3. Giới hạn sử dụng</h2>
      <p>
        Các tính năng AI có giới hạn lượt dùng mỗi ngày và giới hạn thời lượng mỗi phiên nói để duy trì dịch vụ miễn phí. Giới hạn có thể thay
        đổi. Khi nhà cung cấp AI hết hạn mức miễn phí, tính năng sẽ tạm ngừng đến khi hạn mức được đặt lại.
      </p>

      <h2>4. Hành vi không được phép</h2>
      <ul>
        <li>Cố gắng truy cập dữ liệu của người khác, vượt giới hạn hoặc làm gián đoạn dịch vụ.</li>
        <li>Dùng AI để tạo nội dung bất hợp pháp, quấy rối hoặc gây hại.</li>
        <li>Chia sẻ tài khoản hoặc tự động hóa việc gửi yêu cầu.</li>
      </ul>

      <h2>5. Tài khoản</h2>
      <p>Bạn chịu trách nhiệm bảo mật mật khẩu của mình. Bạn có thể xóa tài khoản bất cứ lúc nào trong mục Hồ sơ.</p>

      <h2>6. Thay đổi dịch vụ</h2>
      <p>Dịch vụ được cung cấp “nguyên trạng”. Tính năng có thể được thay đổi, tạm ngừng hoặc ngừng hẳn, đặc biệt khi nhà cung cấp bên thứ ba thay đổi chính sách.</p>
    </LegalLayout>
  );
}
