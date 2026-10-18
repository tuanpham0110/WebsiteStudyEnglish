import type { Level } from './constants';

export type RoleplayScenario = {
  id: string;
  category: string;
  title: string;
  titleVi: string;
  setting: string;
  settingVi: string;
  aiRole: string;
  userRole: string;
  goals: string[];
  vocabulary: { word: string; vi: string }[];
  levels: Level[];
  opening: string;
};

// The API builds the system prompt from these definitions by id, so clients
// cannot inject their own role instructions.
export const ROLEPLAY_SCENARIOS: RoleplayScenario[] = [
  {
    id: 'restaurant-order',
    category: 'Nhà hàng',
    title: 'Ordering dinner',
    titleVi: 'Gọi món ở nhà hàng',
    setting: 'A busy Italian restaurant on a Friday evening. The learner has a table for two.',
    settingVi: 'Nhà hàng Ý đông khách tối thứ Sáu. Bạn đã có bàn cho hai người.',
    aiRole: 'a friendly waiter named Marco',
    userRole: 'a customer',
    goals: ['Ask about the menu', 'Order a main course and a drink', 'Mention a food allergy', 'Ask for the bill'],
    vocabulary: [
      { word: 'starter', vi: 'món khai vị' },
      { word: 'main course', vi: 'món chính' },
      { word: 'I am allergic to…', vi: 'Tôi bị dị ứng với…' },
      { word: 'Could we have the bill, please?', vi: 'Cho chúng tôi xin hóa đơn' },
      { word: 'recommend', vi: 'gợi ý, giới thiệu' },
    ],
    levels: ['A1', 'A2', 'B1'],
    opening: "Good evening and welcome! My name is Marco and I'll be your waiter tonight. Can I get you something to drink first?",
  },
  {
    id: 'airport-checkin',
    category: 'Sân bay',
    title: 'Airport check-in',
    titleVi: 'Làm thủ tục ở sân bay',
    setting: 'The check-in counter for an international flight. The learner has one suitcase and wants a window seat.',
    settingVi: 'Quầy làm thủ tục chuyến bay quốc tế. Bạn có một vali và muốn ngồi cạnh cửa sổ.',
    aiRole: 'an airline check-in agent',
    userRole: 'a passenger',
    goals: ['Show your passport', 'Check in one bag', 'Ask for a window seat', 'Ask about the boarding gate and time'],
    vocabulary: [
      { word: 'boarding pass', vi: 'thẻ lên máy bay' },
      { word: 'carry-on', vi: 'hành lý xách tay' },
      { word: 'aisle seat', vi: 'ghế cạnh lối đi' },
      { word: 'gate', vi: 'cửa ra máy bay' },
      { word: 'overweight', vi: 'quá cân' },
    ],
    levels: ['A2', 'B1'],
    opening: 'Hello, good morning! Where are you flying to today? May I see your passport, please?',
  },
  {
    id: 'hotel-problem',
    category: 'Khách sạn',
    title: 'A problem with your hotel room',
    titleVi: 'Phản ánh vấn đề phòng khách sạn',
    setting: 'A hotel reception desk. The air conditioner in the learner’s room is not working and it is very hot.',
    settingVi: 'Quầy lễ tân khách sạn. Điều hòa trong phòng bạn bị hỏng và trời rất nóng.',
    aiRole: 'a hotel receptionist',
    userRole: 'a hotel guest',
    goals: ['Explain the problem politely', 'Ask for a solution', 'Negotiate a room change or discount', 'Confirm the arrangement'],
    vocabulary: [
      { word: 'reception', vi: 'quầy lễ tân' },
      { word: 'out of order', vi: 'bị hỏng' },
      { word: 'complimentary', vi: 'miễn phí (tặng kèm)' },
      { word: 'upgrade', vi: 'nâng hạng' },
      { word: 'I would appreciate it if…', vi: 'Tôi rất cảm kích nếu…' },
    ],
    levels: ['A2', 'B1', 'B2'],
    opening: 'Good afternoon, front desk. How can I help you today?',
  },
  {
    id: 'travel-directions',
    category: 'Du lịch',
    title: 'Asking for directions',
    titleVi: 'Hỏi đường khi đi du lịch',
    setting: 'A street in London. The learner is looking for the nearest train station and a good place to eat.',
    settingVi: 'Một con phố ở London. Bạn đang tìm ga tàu gần nhất và một chỗ ăn ngon.',
    aiRole: 'a helpful local resident',
    userRole: 'a tourist',
    goals: ['Ask how to get to the station', 'Check how long it takes', 'Ask for a food recommendation', 'Thank the person'],
    vocabulary: [
      { word: 'go straight', vi: 'đi thẳng' },
      { word: 'turn left/right', vi: 'rẽ trái/phải' },
      { word: 'opposite', vi: 'đối diện' },
      { word: 'a five-minute walk', vi: 'đi bộ năm phút' },
      { word: 'Excuse me, could you…', vi: 'Xin lỗi, bạn có thể…' },
    ],
    levels: ['A1', 'A2', 'B1'],
    opening: 'Oh, hello! You look a little lost. Can I help you find something?',
  },
  {
    id: 'job-interview',
    category: 'Phỏng vấn',
    title: 'Job interview',
    titleVi: 'Phỏng vấn xin việc',
    setting: 'A video interview for a marketing assistant position at an international company.',
    settingVi: 'Phỏng vấn trực tuyến vị trí trợ lý marketing ở một công ty quốc tế.',
    aiRole: 'a hiring manager named Ms. Taylor',
    userRole: 'a job candidate',
    goals: ['Introduce yourself', 'Describe your strengths with an example', 'Explain why you want the job', 'Ask the interviewer a question'],
    vocabulary: [
      { word: 'strength', vi: 'điểm mạnh' },
      { word: 'team player', vi: 'người làm việc nhóm tốt' },
      { word: 'deadline', vi: 'hạn chót' },
      { word: 'I am responsible for…', vi: 'Tôi chịu trách nhiệm…' },
      { word: 'achievement', vi: 'thành tựu' },
    ],
    levels: ['B1', 'B2', 'C1'],
    opening: 'Hi, thanks for joining the call today. To start, could you tell me a little about yourself?',
  },
  {
    id: 'school-teacher',
    category: 'Trường học',
    title: 'Talking to your teacher',
    titleVi: 'Trao đổi với giáo viên',
    setting: 'After class at a language school. The learner wants an extension for an assignment and advice on studying.',
    settingVi: 'Sau giờ học ở trường ngôn ngữ. Bạn muốn xin gia hạn bài tập và hỏi cách học.',
    aiRole: 'a supportive teacher',
    userRole: 'a student',
    goals: ['Ask for an extension politely', 'Give a reason', 'Ask for study advice', 'Agree on a new deadline'],
    vocabulary: [
      { word: 'assignment', vi: 'bài tập' },
      { word: 'extension', vi: 'sự gia hạn' },
      { word: 'hand in', vi: 'nộp bài' },
      { word: 'I was wondering if…', vi: 'Em đang muốn hỏi liệu…' },
      { word: 'feedback', vi: 'nhận xét' },
    ],
    levels: ['A2', 'B1', 'B2'],
    opening: 'Hi there! You wanted to talk to me after class? What can I do for you?',
  },
  {
    id: 'work-meeting',
    category: 'Công việc',
    title: 'Team meeting update',
    titleVi: 'Báo cáo trong cuộc họp nhóm',
    setting: 'A weekly team meeting. The learner must give a project update and explain a delay.',
    settingVi: 'Cuộc họp nhóm hằng tuần. Bạn cần cập nhật tiến độ dự án và giải thích việc chậm trễ.',
    aiRole: 'a project manager leading the meeting',
    userRole: 'a team member',
    goals: ['Summarise your progress', 'Explain the delay and its cause', 'Propose a solution', 'Agree on next steps'],
    vocabulary: [
      { word: 'on track', vi: 'đúng tiến độ' },
      { word: 'behind schedule', vi: 'chậm tiến độ' },
      { word: 'action item', vi: 'việc cần làm' },
      { word: 'stakeholder', vi: 'bên liên quan' },
      { word: 'follow up', vi: 'theo dõi, liên hệ lại' },
    ],
    levels: ['B1', 'B2', 'C1'],
    opening: "Okay everyone, let's get started. Could you give us a quick update on your part of the project?",
  },
  {
    id: 'daily-neighbor',
    category: 'Giao tiếp hằng ngày',
    title: 'Meeting a new neighbour',
    titleVi: 'Làm quen hàng xóm mới',
    setting: 'In the hallway of an apartment building. A new neighbour has just moved in next door.',
    settingVi: 'Ở hành lang chung cư. Một người hàng xóm mới vừa chuyển đến bên cạnh.',
    aiRole: 'a friendly new neighbour named Sam',
    userRole: 'a resident who has lived here for a year',
    goals: ['Introduce yourself', 'Find out where Sam is from', 'Recommend places nearby', 'Offer help'],
    vocabulary: [
      { word: 'move in', vi: 'chuyển đến' },
      { word: 'neighbourhood', vi: 'khu phố' },
      { word: 'grocery store', vi: 'cửa hàng tạp hóa' },
      { word: 'Let me know if…', vi: 'Cứ nói với tôi nếu…' },
      { word: 'nice to meet you', vi: 'rất vui được gặp bạn' },
    ],
    levels: ['A1', 'A2', 'B1'],
    opening: "Hi! I'm Sam, I just moved in next door. Sorry about all the noise with the boxes!",
  },
  {
    id: 'tech-standup',
    category: 'Công nghệ & phần mềm',
    title: 'Software stand-up and code review',
    titleVi: 'Daily stand-up và review code',
    setting: 'A remote software team. The learner is a developer reporting work and discussing a bug in code review.',
    settingVi: 'Nhóm phần mềm làm việc từ xa. Bạn là lập trình viên báo cáo công việc và thảo luận lỗi khi review code.',
    aiRole: 'a senior engineer and tech lead',
    userRole: 'a software developer',
    goals: ['Say what you did yesterday and today', 'Describe a blocker', 'Explain a bug and your fix', 'Respond to review feedback'],
    vocabulary: [
      { word: 'blocker', vi: 'vấn đề cản trở' },
      { word: 'pull request', vi: 'yêu cầu hợp nhất code' },
      { word: 'edge case', vi: 'trường hợp biên' },
      { word: 'refactor', vi: 'tái cấu trúc code' },
      { word: 'deploy', vi: 'triển khai' },
    ],
    levels: ['B1', 'B2', 'C1'],
    opening: "Morning! Let's do a quick stand-up. What did you work on yesterday, and is anything blocking you?",
  },
  {
    id: 'presentation-qa',
    category: 'Thuyết trình',
    title: 'Presentation and Q&A',
    titleVi: 'Thuyết trình và trả lời câu hỏi',
    setting: 'The end of a short presentation about a new product idea. The audience asks questions.',
    settingVi: 'Cuối bài thuyết trình ngắn về ý tưởng sản phẩm mới. Khán giả đặt câu hỏi.',
    aiRole: 'a curious audience member and then the session moderator',
    userRole: 'the presenter',
    goals: ['Summarise the main idea in two sentences', 'Answer a challenging question', 'Use signposting language', 'Close the presentation'],
    vocabulary: [
      { word: 'to sum up', vi: 'tóm lại' },
      { word: 'That is a great question', vi: 'Câu hỏi rất hay' },
      { word: 'target audience', vi: 'đối tượng mục tiêu' },
      { word: 'moving on to…', vi: 'chuyển sang…' },
      { word: 'benefit', vi: 'lợi ích' },
    ],
    levels: ['B1', 'B2', 'C1', 'C2'],
    opening: 'Thank you for the presentation! Before we open the floor, could you summarise your main idea in two sentences?',
  },
];

export function getScenario(id: string | undefined | null): RoleplayScenario | undefined {
  if (!id) return undefined;
  return ROLEPLAY_SCENARIOS.find((s) => s.id === id);
}
