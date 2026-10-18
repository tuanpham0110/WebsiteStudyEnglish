// Original grammar lessons. Exercise types:
//  mc      -> multiple_choice  { options, answer: index }
//  fill    -> fill_blank       { prompt with ___, accepted: [...] }
//  reorder -> reorder          { tokens (shuffled), answer: sentence }
//  fix     -> error_correction { prompt (wrong sentence), accepted: [...] }
export const grammarLessons = [
  {
    id: 'present-simple',
    level: 'A1',
    topic: 'tenses',
    title: 'Present simple',
    titleVi: 'Thì hiện tại đơn',
    summary: 'Nói về thói quen, sự thật và lịch trình.',
    explanationVi:
      'Dùng thì hiện tại đơn để nói về thói quen (I drink coffee every morning), sự thật hiển nhiên (Water boils at 100°C) và lịch trình cố định (The train leaves at 8).\n\nVới chủ ngữ he/she/it, thêm -s hoặc -es vào động từ: work → works, watch → watches, study → studies. Câu phủ định và câu hỏi dùng do/does: She doesn’t like tea. Do you work here?',
    explanationEn:
      'Use the present simple for habits, general truths and fixed schedules. Add -s/-es to the verb after he, she or it. Use do/does for negatives and questions.',
    structure: ['I/You/We/They + V', 'He/She/It + V-s/es', 'S + do/does + not + V', 'Do/Does + S + V?'],
    examples: [
      { en: 'She works in a hospital.', vi: 'Cô ấy làm việc ở bệnh viện.', correct: true },
      { en: 'She work in a hospital.', correct: false, fix: 'She works in a hospital.', note: 'Chủ ngữ she → động từ thêm -s.' },
      { en: 'Do you live near here?', vi: 'Bạn sống gần đây à?', correct: true },
      { en: 'He don’t like coffee.', correct: false, fix: 'He doesn’t like coffee.', note: 'He dùng doesn’t, không dùng don’t.' },
    ],
    tips: ['Trạng từ tần suất (always, usually, often, never) thường đứng trước động từ thường: I usually walk to school.'],
    exercises: [
      { type: 'mc', prompt: 'My brother ___ football every Sunday.', options: ['play', 'plays', 'playing', 'is play'], answer: 1, vi: 'Chủ ngữ “my brother” là ngôi thứ ba số ít → plays.' },
      { type: 'fill', prompt: 'She ___ (watch) TV in the evening.', accepted: ['watches'], vi: 'Động từ tận cùng -ch thêm -es: watches.' },
      { type: 'mc', prompt: '___ your parents speak English?', options: ['Does', 'Do', 'Are', 'Is'], answer: 1, vi: '“Your parents” là số nhiều → Do.' },
      { type: 'reorder', tokens: ['never', 'eats', 'meat', 'He'], answer: 'He never eats meat', vi: 'Trạng từ tần suất đứng trước động từ thường.' },
      { type: 'fix', prompt: 'My sister study English every day.', accepted: ['My sister studies English every day.', 'My sister studies English every day'], vi: 'study → studies (phụ âm + y → ies).' },
      { type: 'fill', prompt: 'We ___ (not / work) on Sundays.', accepted: ["don't work", 'do not work', 'don’t work'], vi: 'We + don’t + V.' },
    ],
  },
  {
    id: 'present-continuous',
    level: 'A1',
    topic: 'tenses',
    title: 'Present continuous',
    titleVi: 'Thì hiện tại tiếp diễn',
    summary: 'Hành động đang diễn ra và kế hoạch gần.',
    explanationVi:
      'Dùng thì hiện tại tiếp diễn cho hành động đang xảy ra ngay lúc nói (I’m reading now), tình huống tạm thời (She’s staying with her aunt this week) và kế hoạch đã sắp xếp trong tương lai gần (We’re meeting at 6 tonight).\n\nCấu trúc: am/is/are + V-ing. Một số động từ chỉ trạng thái (like, know, want, need) thường không dùng ở dạng tiếp diễn.',
    explanationEn:
      'Use am/is/are + -ing for actions happening now, temporary situations and arranged future plans. State verbs such as know, like and want are usually not used in the continuous form.',
    structure: ['S + am/is/are + V-ing', 'S + am/is/are + not + V-ing', 'Am/Is/Are + S + V-ing?'],
    examples: [
      { en: 'Look! It’s raining.', vi: 'Nhìn kìa! Trời đang mưa.', correct: true },
      { en: 'I am knowing the answer.', correct: false, fix: 'I know the answer.', note: '“Know” là động từ trạng thái, không dùng tiếp diễn.' },
      { en: 'They are having dinner right now.', vi: 'Họ đang ăn tối.', correct: true },
    ],
    tips: ['Dấu hiệu: now, right now, at the moment, Look!, Listen!'],
    exercises: [
      { type: 'mc', prompt: 'Listen! Someone ___ at the door.', options: ['knocks', 'is knocking', 'knock', 'knocked'], answer: 1, vi: '“Listen!” → hành động đang xảy ra.' },
      { type: 'fill', prompt: 'I ___ (cook) dinner at the moment.', accepted: ["am cooking", "i'm cooking", 'I’m cooking'], vi: 'I + am + V-ing.' },
      { type: 'reorder', tokens: ['are', 'what', 'doing', 'you'], answer: 'what are you doing', vi: 'Từ để hỏi + are + S + V-ing.' },
      { type: 'fix', prompt: 'She is wanting a new phone.', accepted: ['She wants a new phone.', 'She wants a new phone'], vi: '“Want” là động từ trạng thái → dùng hiện tại đơn.' },
      { type: 'mc', prompt: 'We ___ my grandparents this weekend. It’s all arranged.', options: ['visit', 'are visiting', 'visited', 'were visiting'], answer: 1, vi: 'Kế hoạch đã sắp xếp → hiện tại tiếp diễn.' },
    ],
  },
  {
    id: 'past-simple',
    level: 'A2',
    topic: 'tenses',
    title: 'Past simple',
    titleVi: 'Thì quá khứ đơn',
    summary: 'Hành động đã kết thúc trong quá khứ.',
    explanationVi:
      'Dùng thì quá khứ đơn cho hành động đã xảy ra và kết thúc ở một thời điểm xác định trong quá khứ (I visited Hoi An last year).\n\nĐộng từ có quy tắc thêm -ed (work → worked). Động từ bất quy tắc phải học thuộc (go → went, see → saw, buy → bought). Câu phủ định và câu hỏi dùng did + động từ nguyên mẫu: I didn’t go. Did you see it?',
    explanationEn:
      'Use the past simple for finished actions at a specific time in the past. Regular verbs add -ed; irregular verbs have special forms. Use did + base verb in negatives and questions.',
    structure: ['S + V-ed / V2', 'S + did not + V', 'Did + S + V?'],
    examples: [
      { en: 'We went to the beach yesterday.', vi: 'Hôm qua chúng tôi đi biển.', correct: true },
      { en: 'Did you went to school?', correct: false, fix: 'Did you go to school?', note: 'Sau did dùng động từ nguyên mẫu.' },
      { en: 'I bought a new laptop last week.', vi: 'Tuần trước tôi mua laptop mới.', correct: true },
    ],
    tips: ['Dấu hiệu: yesterday, last week/month/year, ago, in 2020.'],
    exercises: [
      { type: 'mc', prompt: 'I ___ my keys yesterday.', options: ['lose', 'lost', 'losed', 'have lose'], answer: 1, vi: 'lose → lost (bất quy tắc).' },
      { type: 'fill', prompt: 'They ___ (not / come) to the party.', accepted: ["didn't come", 'did not come', 'didn’t come'], vi: 'didn’t + V nguyên mẫu.' },
      { type: 'fill', prompt: 'She ___ (study) for three hours last night.', accepted: ['studied'], vi: 'study → studied.' },
      { type: 'reorder', tokens: ['you', 'did', 'where', 'go'], answer: 'where did you go', vi: 'Wh- + did + S + V?' },
      { type: 'fix', prompt: 'He didn’t called me.', accepted: ['He didn’t call me.', "He didn't call me.", 'He did not call me.'], vi: 'Sau didn’t dùng V nguyên mẫu: call.' },
      { type: 'mc', prompt: 'We ___ in Da Lat two years ago.', options: ['live', 'have lived', 'lived', 'are living'], answer: 2, vi: '“two years ago” → quá khứ đơn.' },
    ],
  },
  {
    id: 'comparatives-superlatives',
    level: 'A2',
    topic: 'adjectives',
    title: 'Comparatives and superlatives',
    titleVi: 'So sánh hơn và so sánh nhất',
    summary: 'So sánh người, vật và địa điểm.',
    explanationVi:
      'So sánh hơn: tính từ ngắn thêm -er + than (cheaper than); tính từ dài dùng more + adj + than (more expensive than).\n\nSo sánh nhất: the + adj-est (the cheapest); the most + adj dài (the most expensive). Bất quy tắc: good → better → the best; bad → worse → the worst; far → farther/further.',
    explanationEn:
      'Short adjectives take -er/-est; long adjectives use more/most. Good, bad and far are irregular.',
    structure: ['adj-er + than', 'more + adj + than', 'the + adj-est', 'the most + adj'],
    examples: [
      { en: 'Hanoi is colder than Ho Chi Minh City in winter.', vi: 'Hà Nội lạnh hơn TP.HCM vào mùa đông.', correct: true },
      { en: 'This is the more beautiful beach in Vietnam.', correct: false, fix: 'This is the most beautiful beach in Vietnam.', note: 'So sánh nhất dùng the most.' },
      { en: 'My English is better than last year.', vi: 'Tiếng Anh của tôi tốt hơn năm ngoái.', correct: true },
    ],
    tips: ['Tính từ hai âm tiết tận cùng -y: happy → happier → the happiest.'],
    exercises: [
      { type: 'mc', prompt: 'Phở is ___ than bread for breakfast, in my opinion.', options: ['tastier', 'more tasty', 'tastiest', 'the tastier'], answer: 0, vi: 'tasty → tastier.' },
      { type: 'fill', prompt: 'This is the ___ (good) coffee in town.', accepted: ['best'], vi: 'good → the best.' },
      { type: 'fill', prompt: 'A taxi is ___ (expensive) than a bus.', accepted: ['more expensive'], vi: 'Tính từ dài → more expensive.' },
      { type: 'fix', prompt: 'She is more tall than her sister.', accepted: ['She is taller than her sister.', 'She is taller than her sister'], vi: 'tall là tính từ ngắn → taller.' },
      { type: 'reorder', tokens: ['the', 'is', 'Everest', 'mountain', 'highest'], answer: 'Everest is the highest mountain', vi: 'the + adj-est + noun.' },
    ],
  },
  {
    id: 'present-perfect',
    level: 'B1',
    topic: 'tenses',
    title: 'Present perfect',
    titleVi: 'Thì hiện tại hoàn thành',
    summary: 'Kinh nghiệm, kết quả hiện tại, hành động kéo dài đến nay.',
    explanationVi:
      'Dùng thì hiện tại hoàn thành (have/has + V3) khi:\n• nói về kinh nghiệm mà không nêu thời điểm (I have been to Japan);\n• hành động vừa xảy ra còn kết quả ở hiện tại (I’ve lost my keys — giờ vẫn chưa tìm thấy);\n• hành động bắt đầu trong quá khứ và kéo dài đến nay với for/since (She has worked here since 2021).\n\nKhông dùng với mốc thời gian quá khứ cụ thể (yesterday, last year) — khi đó dùng quá khứ đơn.',
    explanationEn:
      'Use have/has + past participle for experiences, recent actions with present results, and situations continuing up to now (for/since). Do not use it with a finished past time like yesterday.',
    structure: ['S + have/has + V3', 'S + have/has + not + V3', 'Have/Has + S + V3?'],
    examples: [
      { en: 'I have never tried durian.', vi: 'Tôi chưa bao giờ ăn thử sầu riêng.', correct: true },
      { en: 'I have seen that film yesterday.', correct: false, fix: 'I saw that film yesterday.', note: '“Yesterday” là thời điểm quá khứ cụ thể → quá khứ đơn.' },
      { en: 'They have lived here for ten years.', vi: 'Họ đã sống ở đây mười năm.', correct: true },
    ],
    tips: ['for + khoảng thời gian (for two years); since + mốc thời gian (since 2020, since Monday).'],
    exercises: [
      { type: 'mc', prompt: 'She ___ in this company since 2022.', options: ['works', 'worked', 'has worked', 'is working'], answer: 2, vi: '“since 2022” → hiện tại hoàn thành.' },
      { type: 'mc', prompt: 'We have known each other ___ ten years.', options: ['since', 'for', 'ago', 'during'], answer: 1, vi: 'for + khoảng thời gian.' },
      { type: 'fill', prompt: 'Have you ever ___ (be) to Singapore?', accepted: ['been'], vi: 'be → been.' },
      { type: 'fix', prompt: 'I have finished the report last night.', accepted: ['I finished the report last night.', 'I finished the report last night'], vi: '“last night” → quá khứ đơn.' },
      { type: 'reorder', tokens: ['already', 'has', 'the', 'left', 'train'], answer: 'the train has already left', vi: '“already” đứng giữa has và V3.' },
      { type: 'fill', prompt: 'He ___ (not / finish) his homework yet.', accepted: ["hasn't finished", 'has not finished', 'hasn’t finished'], vi: 'hasn’t + V3; “yet” dùng trong câu phủ định/hỏi.' },
    ],
  },
  {
    id: 'conditionals-first-second',
    level: 'B1',
    topic: 'conditionals',
    title: 'First and second conditionals',
    titleVi: 'Câu điều kiện loại 1 và loại 2',
    summary: 'Khả năng có thật và tình huống giả định.',
    explanationVi:
      'Loại 1 — điều có thể xảy ra ở hiện tại/tương lai: If + hiện tại đơn, will + V. (If it rains, we will stay home.)\n\nLoại 2 — tình huống giả định, không có thật hoặc khó xảy ra ở hiện tại: If + quá khứ đơn, would + V. (If I had more time, I would learn Japanese.) Với “be” ở loại 2, dùng were cho mọi ngôi trong văn phong trang trọng: If I were you, …',
    explanationEn:
      'First conditional: real possibility (if + present, will + verb). Second conditional: imaginary or unlikely situations (if + past, would + verb).',
    structure: ['If + present simple, will + V', 'If + past simple, would + V'],
    examples: [
      { en: 'If you study hard, you will pass.', vi: 'Nếu bạn học chăm, bạn sẽ đậu.', correct: true },
      { en: 'If I will see him, I will tell him.', correct: false, fix: 'If I see him, I will tell him.', note: 'Mệnh đề if không dùng will.' },
      { en: 'If I were rich, I would travel the world.', vi: 'Nếu tôi giàu, tôi sẽ đi du lịch khắp thế giới.', correct: true },
    ],
    tips: ['Có thể đảo mệnh đề: We will stay home if it rains (không cần dấu phẩy).'],
    exercises: [
      { type: 'mc', prompt: 'If it ___ tomorrow, we’ll cancel the picnic.', options: ['rains', 'will rain', 'rained', 'would rain'], answer: 0, vi: 'Loại 1: mệnh đề if dùng hiện tại đơn.' },
      { type: 'mc', prompt: 'If I ___ you, I would accept the offer.', options: ['am', 'was being', 'were', 'will be'], answer: 2, vi: 'Loại 2: If I were you.' },
      { type: 'fill', prompt: 'If she had a car, she ___ (drive) to work.', accepted: ['would drive', "she'd drive", "'d drive"], vi: 'Loại 2: would + V.' },
      { type: 'fix', prompt: 'If you will heat ice, it melts.', accepted: ['If you heat ice, it melts.', 'If you heat ice, it melts'], vi: 'Mệnh đề if không dùng will.' },
      { type: 'reorder', tokens: ['would', 'what', 'you', 'do', 'if', 'won', 'you', 'the lottery'], answer: 'what would you do if you won the lottery', vi: 'Câu hỏi loại 2: What would you do if + past?' },
    ],
  },
  {
    id: 'passive-voice',
    level: 'B1',
    topic: 'voice',
    title: 'The passive voice',
    titleVi: 'Câu bị động',
    summary: 'Nhấn mạnh hành động hoặc đối tượng chịu tác động.',
    explanationVi:
      'Câu bị động dùng khi người thực hiện không quan trọng, không rõ, hoặc khi muốn nhấn mạnh đối tượng: be + V3 (past participle).\n\nVí dụ: People speak English here → English is spoken here. Hiện tại: is/are + V3; quá khứ: was/were + V3; hiện tại hoàn thành: has/have been + V3; tương lai: will be + V3. Muốn nêu người thực hiện, dùng by: The book was written by a Vietnamese author.',
    explanationEn: 'Form the passive with be + past participle. Use it when the doer is unknown, unimportant or obvious. Add “by + agent” only when useful.',
    structure: ['S + am/is/are + V3', 'S + was/were + V3', 'S + has/have been + V3', 'S + will be + V3'],
    examples: [
      { en: 'The bridge was built in 1990.', vi: 'Cây cầu được xây năm 1990.', correct: true },
      { en: 'The emails are send every morning.', correct: false, fix: 'The emails are sent every morning.', note: 'Bị động dùng V3: sent.' },
      { en: 'Your order has been shipped.', vi: 'Đơn hàng của bạn đã được gửi đi.', correct: true },
    ],
    tips: ['Văn bản trang trọng, khoa học, tin tức thường dùng nhiều câu bị động.'],
    exercises: [
      { type: 'mc', prompt: 'Coffee ___ in the Central Highlands.', options: ['grows', 'is grown', 'is growing', 'grew'], answer: 1, vi: 'Cà phê được trồng → is grown.' },
      { type: 'fill', prompt: 'The results ___ (announce) next week.', accepted: ['will be announced'], vi: 'Tương lai bị động: will be + V3.' },
      { type: 'fill', prompt: 'My bike ___ (steal) last night.', accepted: ['was stolen'], vi: 'Quá khứ bị động: was + V3.' },
      { type: 'fix', prompt: 'The meeting has been cancel.', accepted: ['The meeting has been cancelled.', 'The meeting has been canceled.', 'The meeting has been cancelled', 'The meeting has been canceled'], vi: 'has been + V3: cancelled.' },
      { type: 'reorder', tokens: ['was', 'the', 'by', 'painted', 'picture', 'my', 'grandfather'], answer: 'the picture was painted by my grandfather', vi: 'S + was + V3 + by + agent.' },
    ],
  },
  {
    id: 'reported-speech',
    level: 'B2',
    topic: 'reporting',
    title: 'Reported speech',
    titleVi: 'Câu tường thuật',
    summary: 'Thuật lại lời người khác nói.',
    explanationVi:
      'Khi thuật lại lời nói với động từ tường thuật ở quá khứ (said, told), ta thường lùi thì: hiện tại đơn → quá khứ đơn; hiện tại tiếp diễn → quá khứ tiếp diễn; quá khứ đơn/hiện tại hoàn thành → quá khứ hoàn thành; will → would; can → could.\n\nĐổi đại từ và trạng từ cho phù hợp: today → that day, tomorrow → the next day, here → there. “Tell” cần tân ngữ (He told me…), “say” thì không (He said…). Câu hỏi tường thuật dùng trật tự câu khẳng định: She asked where I lived.',
    explanationEn:
      'After a past reporting verb, tenses usually move back one step and pronouns/time words change. Tell takes an object; say does not. Reported questions use statement word order.',
    structure: ['S + said (that) + clause (backshift)', 'S + told + O + (that) + clause', 'S + asked + (O) + if/wh- + S + V'],
    examples: [
      { en: '“I’m tired.” → She said she was tired.', correct: true, vi: 'Cô ấy nói rằng cô ấy mệt.' },
      { en: 'He said me that he was busy.', correct: false, fix: 'He told me that he was busy.', note: 'Có tân ngữ “me” → dùng told.' },
      { en: 'She asked me where did I live.', correct: false, fix: 'She asked me where I lived.', note: 'Câu hỏi tường thuật không đảo ngữ.' },
    ],
    tips: ['Nếu điều được nói vẫn đúng ở hiện tại, có thể không lùi thì: He said he lives in Hanoi.'],
    exercises: [
      { type: 'mc', prompt: '“I will call you.” → He said he ___ me.', options: ['will call', 'would call', 'calls', 'called'], answer: 1, vi: 'will → would.' },
      { type: 'mc', prompt: 'She ___ me that the store was closed.', options: ['said', 'told', 'spoke', 'talked'], answer: 1, vi: 'Có tân ngữ → told.' },
      { type: 'fill', prompt: '“Are you ready?” → He asked me ___ I was ready.', accepted: ['if', 'whether'], vi: 'Câu hỏi Yes/No → if/whether.' },
      { type: 'fix', prompt: 'They asked me what was my name.', accepted: ['They asked me what my name was.', 'They asked me what my name was'], vi: 'Trật tự câu khẳng định: what my name was.' },
      { type: 'reorder', tokens: ['she', 'said', 'she', 'had', 'finished', 'the', 'project'], answer: 'she said she had finished the project', vi: 'Hiện tại hoàn thành → quá khứ hoàn thành.' },
    ],
  },
  {
    id: 'relative-clauses',
    level: 'B2',
    topic: 'clauses',
    title: 'Relative clauses',
    titleVi: 'Mệnh đề quan hệ',
    summary: 'Nối câu và bổ sung thông tin cho danh từ.',
    explanationVi:
      'Mệnh đề quan hệ bổ sung thông tin cho danh từ đứng trước. Dùng who cho người, which cho vật, that cho cả hai (trong mệnh đề xác định), whose chỉ sở hữu, where cho nơi chốn.\n\nMệnh đề xác định (không dấu phẩy) cho biết “cái nào”: The man who lives next door is a doctor. Mệnh đề không xác định (có dấu phẩy) chỉ thêm thông tin, không dùng that: My mother, who is 60, still runs every day.',
    explanationEn:
      'Use who (people), which (things), that (people or things, defining only), whose (possession) and where (places). Non-defining clauses take commas and never use that.',
    structure: ['N + who/which/that + V…', 'N + whose + N…', 'N + where + S + V…'],
    examples: [
      { en: 'The app that I use every day is free.', vi: 'Ứng dụng tôi dùng hằng ngày là miễn phí.', correct: true },
      { en: 'Hanoi, that is the capital, is busy.', correct: false, fix: 'Hanoi, which is the capital, is busy.', note: 'Mệnh đề không xác định không dùng that.' },
      { en: 'That’s the café where we first met.', vi: 'Đó là quán cà phê nơi chúng ta gặp nhau lần đầu.', correct: true },
    ],
    tips: ['Trong mệnh đề xác định, có thể lược who/which/that khi nó là tân ngữ: The book (that) I read was great.'],
    exercises: [
      { type: 'mc', prompt: 'The teacher ___ helped me is from Canada.', options: ['which', 'who', 'whose', 'where'], answer: 1, vi: 'Người → who.' },
      { type: 'mc', prompt: 'This is the town ___ I grew up.', options: ['which', 'that', 'where', 'who'], answer: 2, vi: 'Nơi chốn → where.' },
      { type: 'fill', prompt: 'I met a girl ___ brother works at Google.', accepted: ['whose'], vi: 'Sở hữu → whose.' },
      { type: 'fix', prompt: 'My laptop, that I bought last year, is already slow.', accepted: ['My laptop, which I bought last year, is already slow.', 'My laptop, which I bought last year, is already slow'], vi: 'Có dấu phẩy → which, không dùng that.' },
      { type: 'reorder', tokens: ['the', 'movie', 'which', 'we', 'watched', 'was', 'boring'], answer: 'the movie which we watched was boring', vi: 'N + which + S + V.' },
    ],
  },
  {
    id: 'modals-deduction',
    level: 'B2',
    topic: 'modals',
    title: 'Modals of deduction',
    titleVi: 'Động từ khuyết thiếu chỉ suy đoán',
    summary: 'must, might, can’t — đoán mức độ chắc chắn.',
    explanationVi:
      'Dùng động từ khuyết thiếu để suy đoán dựa trên bằng chứng:\n• must: gần như chắc chắn đúng (She must be tired — cô ấy làm việc 12 tiếng);\n• might / may / could: có thể (He might be at the gym);\n• can’t: gần như chắc chắn sai (That can’t be true).\n\nSuy đoán về quá khứ: modal + have + V3 (They must have left early. She can’t have seen us.)',
    explanationEn:
      'must = almost certain, might/may/could = possible, can’t = almost certainly not. For the past use modal + have + past participle.',
    structure: ['must / might / can’t + V', 'must / might / can’t + have + V3'],
    examples: [
      { en: 'The lights are off. They must be asleep.', vi: 'Đèn tắt rồi. Chắc họ ngủ rồi.', correct: true },
      { en: 'He mustn’t be at home; his car isn’t there.', correct: false, fix: 'He can’t be at home; his car isn’t there.', note: 'Suy đoán phủ định dùng can’t, không dùng mustn’t.' },
      { en: 'She might have missed the bus.', vi: 'Có thể cô ấy lỡ xe buýt.', correct: true },
    ],
    tips: ['“Mustn’t” nghĩa là “cấm”, không dùng để suy đoán.'],
    exercises: [
      { type: 'mc', prompt: 'You’ve been travelling all day. You ___ be exhausted.', options: ['must', 'can’t', 'mustn’t', 'shouldn’t'], answer: 0, vi: 'Gần như chắc chắn → must.' },
      { type: 'mc', prompt: 'That ___ be Tom — he’s in Japan this week.', options: ['must', 'might', 'can’t', 'should'], answer: 2, vi: 'Gần như chắc chắn không phải → can’t.' },
      { type: 'fill', prompt: 'The ground is wet. It ___ (rain) last night.', accepted: ['must have rained'], vi: 'Suy đoán quá khứ chắc chắn: must have + V3.' },
      { type: 'fix', prompt: 'She mustn’t be the manager; she looks too young.', accepted: ['She can’t be the manager; she looks too young.', "She can't be the manager; she looks too young.", 'She cannot be the manager; she looks too young.'], vi: 'Suy đoán phủ định → can’t.' },
    ],
  },
  {
    id: 'inversion-emphasis',
    level: 'C1',
    topic: 'advanced',
    title: 'Inversion for emphasis',
    titleVi: 'Đảo ngữ để nhấn mạnh',
    summary: 'Never have I…, Not only… but also…',
    explanationVi:
      'Trong văn phong trang trọng, khi đặt trạng từ phủ định hoặc hạn chế ở đầu câu (never, rarely, seldom, not only, no sooner, hardly, little, under no circumstances), ta đảo trợ động từ lên trước chủ ngữ.\n\nVí dụ: I have never seen such a view → Never have I seen such a view. She not only sings but also writes songs → Not only does she sing, but she also writes songs.',
    explanationEn:
      'After negative or restrictive adverbials at the start of a clause, invert the auxiliary and subject. This is typical of formal writing and speeches.',
    structure: ['Never/Rarely/Seldom + aux + S + V', 'Not only + aux + S + V, but S + also + V', 'No sooner + had + S + V3 + than…'],
    examples: [
      { en: 'Rarely do we see such dedication.', vi: 'Hiếm khi chúng ta thấy sự tận tâm như vậy.', correct: true },
      { en: 'Never I have been so surprised.', correct: false, fix: 'Never have I been so surprised.', note: 'Đảo trợ động từ “have” lên trước chủ ngữ.' },
      { en: 'No sooner had we arrived than it started to rain.', vi: 'Chúng tôi vừa đến thì trời đổ mưa.', correct: true },
    ],
    tips: ['Không lạm dụng trong hội thoại thân mật — nghe sẽ rất trang trọng.'],
    exercises: [
      { type: 'mc', prompt: 'Seldom ___ such a clear explanation.', options: ['I have heard', 'have I heard', 'I heard', 'heard I'], answer: 1, vi: 'Seldom + aux + S + V3.' },
      { type: 'fill', prompt: 'Not only ___ (he / speak) French, but he also speaks Arabic.', accepted: ['does he speak'], vi: 'Not only + does + S + V.' },
      { type: 'fix', prompt: 'Under no circumstances you should share your password.', accepted: ['Under no circumstances should you share your password.', 'Under no circumstances should you share your password'], vi: 'Đảo “should” lên trước “you”.' },
      { type: 'reorder', tokens: ['had', 'no sooner', 'I', 'sat down', 'than', 'the phone rang'], answer: 'no sooner had I sat down than the phone rang', vi: 'No sooner + had + S + V3 + than.' },
    ],
  },
];
