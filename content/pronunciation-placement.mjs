// Pronunciation practice sets (transcript comparison only — see UI disclaimer).
export const pronunciationLessons = [
  {
    id: 'pron-th-sounds',
    level: 'A2',
    topic: 'consonants',
    title: 'TH sounds /θ/ and /ð/',
    titleVi: 'Âm TH /θ/ và /ð/',
    summary: 'Người Việt hay đọc “th” thành /t/ hoặc /d/.',
    tipsVi:
      'Đặt nhẹ đầu lưỡi giữa hai hàm răng và thổi hơi ra. /θ/ (think) không rung dây thanh; /ð/ (this) có rung. Đừng đọc “think” thành “tink”.',
    sentences: [
      { text: 'I think this is the third time.' },
      { text: 'Thank you for everything.' },
      { text: 'My brother and father are both there.' },
      { text: 'They threw the ball through the window.' },
    ],
  },
  {
    id: 'pron-final-sounds',
    level: 'A2',
    topic: 'consonants',
    title: 'Final consonants',
    titleVi: 'Âm cuối',
    summary: 'Đọc rõ âm cuối /s/, /t/, /d/, /k/.',
    tipsVi:
      'Tiếng Việt ít âm cuối bật hơi nên người học hay bỏ âm cuối (“like” thành “lai”). Hãy kết thúc từ dứt khoát, đặc biệt với -s số nhiều và -ed quá khứ.',
    sentences: [
      { text: 'She likes cats and dogs.' },
      { text: 'I walked to the market and bought some fruit.' },
      { text: 'He asked for six books.' },
      { text: 'The kids played outside last weekend.' },
    ],
  },
  {
    id: 'pron-ed-endings',
    level: 'B1',
    topic: 'endings',
    title: '-ed endings: /t/, /d/, /ɪd/',
    titleVi: 'Đuôi -ed: /t/, /d/, /ɪd/',
    summary: 'Ba cách đọc đuôi -ed.',
    tipsVi:
      '/ɪd/ sau âm /t/, /d/ (wanted, needed); /t/ sau âm vô thanh /p, k, s, ʃ, tʃ, f/ (stopped, watched); /d/ trong các trường hợp còn lại (played, cleaned).',
    sentences: [
      { text: 'We wanted to visit, but we needed more time.' },
      { text: 'She watched a film and laughed a lot.' },
      { text: 'They cleaned the room and opened the windows.' },
      { text: 'I decided to start again.' },
    ],
  },
  {
    id: 'pron-word-stress',
    level: 'B1',
    topic: 'stress',
    title: 'Word stress',
    titleVi: 'Trọng âm từ',
    summary: 'Nhấn đúng âm tiết giúp người nghe hiểu bạn.',
    tipsVi:
      'Nhiều danh từ hai âm tiết nhấn âm đầu (PREsent, REcord), động từ nhấn âm sau (preSENT, reCORD). Từ có đuôi -tion nhấn âm ngay trước nó (eduCAtion, inforMAtion).',
    sentences: [
      { text: 'I want to present my present to the teacher.' },
      { text: 'Education is important for every generation.' },
      { text: 'The photographer took a beautiful photograph.' },
      { text: 'Please record the meeting for our records.' },
    ],
  },
  {
    id: 'pron-linking',
    level: 'B2',
    topic: 'connected_speech',
    title: 'Linking and connected speech',
    titleVi: 'Nối âm',
    summary: 'Nói tự nhiên hơn bằng cách nối âm.',
    tipsVi:
      'Khi một từ kết thúc bằng phụ âm và từ sau bắt đầu bằng nguyên âm, hãy nối lại: “pick it up” → /pɪ-kɪ-tʌp/. Đừng ngắt quãng từng từ.',
    sentences: [
      { text: 'Pick it up and put it on the table.' },
      { text: 'Can I have an apple, please?' },
      { text: 'Turn off the lights when you leave.' },
      { text: 'What are you up to this evening?' },
    ],
  },
];

// Placement test: original questions spanning A1–C2. The result is an estimate,
// not an official CEFR certificate.
export const placementQuestions = [
  { level: 'A1', prompt: 'Hello, my name ___ Linh.', options: ['am', 'is', 'are', 'be'], answer: 1 },
  { level: 'A1', prompt: 'They ___ from Vietnam.', options: ['is', 'am', 'are', 'be'], answer: 2 },
  { level: 'A1', prompt: 'I ___ coffee every morning.', options: ['drinks', 'drink', 'drinking', 'am drink'], answer: 1 },
  { level: 'A1', prompt: 'There ___ two books on the table.', options: ['is', 'are', 'be', 'has'], answer: 1 },
  { level: 'A2', prompt: 'Yesterday we ___ to the cinema.', options: ['go', 'goes', 'went', 'gone'], answer: 2 },
  { level: 'A2', prompt: 'This bag is ___ than that one.', options: ['heavy', 'heavier', 'heaviest', 'more heavy'], answer: 1 },
  { level: 'A2', prompt: 'Look! The children ___ in the garden.', options: ['play', 'plays', 'are playing', 'played'], answer: 2 },
  { level: 'A2', prompt: 'You ___ wear a seatbelt in a car. It’s the law.', options: ['must', 'may', 'can', 'would'], answer: 0 },
  { level: 'B1', prompt: 'I have lived here ___ 2019.', options: ['for', 'since', 'from', 'during'], answer: 1 },
  { level: 'B1', prompt: 'If it ___ tomorrow, we will stay at home.', options: ['rains', 'will rain', 'rained', 'raining'], answer: 0 },
  { level: 'B1', prompt: 'The letter ___ yesterday.', options: ['sent', 'was sent', 'has sent', 'is sending'], answer: 1 },
  { level: 'B1', prompt: 'She asked me where ___.', options: ['did I live', 'I lived', 'do I live', 'I live in'], answer: 1 },
  { level: 'B2', prompt: 'If I had known about the traffic, I ___ earlier.', options: ['would leave', 'left', 'would have left', 'had left'], answer: 2 },
  { level: 'B2', prompt: 'He denied ___ the window.', options: ['to break', 'breaking', 'break', 'broke'], answer: 1 },
  { level: 'B2', prompt: 'The project, ___ was finished last week, cost a lot.', options: ['that', 'which', 'what', 'who'], answer: 1 },
  { level: 'B2', prompt: 'By the time we arrived, the film ___.', options: ['already started', 'has already started', 'had already started', 'was already start'], answer: 2 },
  { level: 'C1', prompt: 'Not until the results were published ___ how serious the problem was.', options: ['we realised', 'did we realise', 'we did realise', 'realised we'], answer: 1 },
  { level: 'C1', prompt: 'The proposal was rejected on the ___ that it was too expensive.', options: ['grounds', 'reasons', 'causes', 'bases'], answer: 0 },
  { level: 'C2', prompt: 'Her explanation was so ___ that nobody could follow it.', options: ['lucid', 'convoluted', 'concise', 'candid'], answer: 1 },
  { level: 'C2', prompt: 'Had it not been for his intervention, the talks ___.', options: ['would collapse', 'would have collapsed', 'had collapsed', 'collapsed'], answer: 1 },
];
