// Original reading passages written for EnglishAI.
export const readingLessons = [
  {
    id: 'reading-my-neighborhood',
    level: 'A1',
    topic: 'daily_life',
    title: 'My neighborhood',
    titleVi: 'Khu phố của tôi',
    summary: 'Một người kể về khu phố nơi mình sống.',
    passage: `My name is Lan and I live in a small street in Da Nang. My street is quiet in the morning and busy in the evening.

Next to my house, there is a bakery. The bread is fresh and cheap, so I buy it every morning. Across the street, there is a small park with tall trees. Old people do exercise there at six o’clock, and children play football after school.

My favorite place is the café at the end of the street. The owner, Mr. Minh, is very friendly. I often sit there on Sunday and read a book. I love my neighborhood because the people are kind and everything is near.`,
    summaryVi: 'Lan sống ở một con phố nhỏ tại Đà Nẵng, có tiệm bánh mì, công viên và quán cà phê cô yêu thích. Cô yêu khu phố vì mọi người tốt bụng và mọi thứ đều gần.',
    questions: [
      { prompt: 'Where does Lan live?', options: ['In Hanoi', 'In Da Nang', 'In Hue', 'In Can Tho'], answer: 1 },
      { prompt: 'Why does Lan buy bread at the bakery every morning?', options: ['It is far away', 'It is fresh and cheap', 'Her friend works there', 'It opens late'], answer: 1 },
      { prompt: 'What do old people do in the park?', options: ['Play football', 'Read books', 'Do exercise', 'Sell food'], answer: 2 },
      { prompt: 'What does Lan often do on Sunday?', options: ['She reads at the café', 'She works at the bakery', 'She plays football', 'She visits Mr. Minh’s house'], answer: 0 },
    ],
  },
  {
    id: 'reading-weekend-trip',
    level: 'A2',
    topic: 'travel',
    title: 'A weekend in Hoi An',
    titleVi: 'Cuối tuần ở Hội An',
    summary: 'Chuyến đi cuối tuần của hai người bạn.',
    passage: `Last weekend, my friend Huy and I took the bus to Hoi An. The trip took only one hour, and the tickets were cheap.

We stayed in a small homestay near the river. On Saturday morning, we rented bicycles and rode to An Bang Beach. The water was warm and clean, but the sun was very strong, so we didn’t stay long.

In the evening, the old town was beautiful. Hundreds of lanterns were glowing, and many tourists were taking photos. We tried cao lầu, a famous local noodle dish, and bought some handmade souvenirs for our families.

On Sunday, it rained all morning. We spent the time in a café and talked about our next trip. Huy wants to visit Ha Giang, but I prefer the beach. Maybe we will go to both!`,
    summaryVi: 'Hai người bạn đi Hội An bằng xe buýt, đạp xe ra biển An Bàng, ngắm phố cổ đèn lồng, ăn cao lầu và mua quà. Chủ nhật trời mưa nên họ ngồi cà phê bàn chuyến đi tiếp theo.',
    questions: [
      { prompt: 'How did they travel to Hoi An?', options: ['By train', 'By bus', 'By motorbike', 'By plane'], answer: 1 },
      { prompt: 'Why didn’t they stay at the beach for long?', options: ['The water was cold', 'It was raining', 'The sun was very strong', 'The beach was dirty'], answer: 2 },
      { prompt: 'What is cao lầu?', options: ['A lantern', 'A noodle dish', 'A souvenir shop', 'A bicycle'], answer: 1 },
      { prompt: 'Which statement is true?', options: ['Huy prefers the beach', 'It rained on Saturday evening', 'They stayed in a homestay', 'The trip took three hours'], answer: 2 },
    ],
  },
  {
    id: 'reading-remote-work',
    level: 'B1',
    topic: 'work',
    title: 'Working from home: pros and cons',
    titleVi: 'Làm việc tại nhà: ưu và nhược điểm',
    summary: 'Lợi ích và thách thức của làm việc từ xa.',
    passage: `Since 2020, many companies have allowed their employees to work from home for at least part of the week. For a lot of people, this change has been positive. They no longer spend an hour or more commuting, so they have more time for family, exercise or sleep. Some workers also say they can concentrate better at home because the office is noisy.

However, working from home is not perfect. Many people find it hard to separate work from personal life. When your laptop is always on the kitchen table, it is tempting to answer emails late at night. Others feel lonely because they miss chatting with colleagues over lunch. New employees may also learn more slowly, since they cannot easily watch and ask experienced coworkers.

As a result, a growing number of companies are choosing a hybrid model. Employees work in the office two or three days a week for meetings and teamwork, and stay at home on the other days for focused tasks. The key, according to most experts, is clear communication: teams need to agree on when people are available and how quickly they should reply.`,
    summaryVi: 'Làm việc tại nhà giúp tiết kiệm thời gian đi lại và tập trung hơn, nhưng dễ lẫn lộn công việc với đời sống, gây cô đơn và khiến nhân viên mới học chậm. Nhiều công ty chọn mô hình kết hợp; điều quan trọng là giao tiếp rõ ràng.',
    questions: [
      { prompt: 'According to the text, what is one benefit of working from home?', options: ['Higher salaries', 'Less time spent commuting', 'More meetings', 'Bigger offices'], answer: 1 },
      { prompt: 'Why might new employees learn more slowly at home?', options: ['They have no laptop', 'They cannot easily watch and ask experienced coworkers', 'They work longer hours', 'They don’t receive emails'], answer: 1 },
      { prompt: 'What is a “hybrid model” in this text?', options: ['Working only at night', 'Working in the office some days and at home on others', 'Working for two companies', 'Working without a manager'], answer: 1 },
      { prompt: 'What do experts say is the key to success?', options: ['A quiet kitchen', 'Clear communication', 'More technology', 'Longer lunch breaks'], answer: 1 },
    ],
  },
  {
    id: 'reading-plastic-ocean',
    level: 'B2',
    topic: 'environment',
    title: 'Can we stop plastic from reaching the ocean?',
    titleVi: 'Có thể ngăn nhựa ra biển không?',
    summary: 'Nguyên nhân và giải pháp cho rác nhựa đại dương.',
    passage: `Every year, millions of tonnes of plastic waste end up in the world’s oceans. Much of it does not come from ships or beaches, but from rivers that carry rubbish from cities far inland. Once in the sea, plastic breaks down into tiny pieces known as microplastics, which are eaten by fish and eventually find their way into the food we eat.

Governments have tried a range of measures. Some have banned single-use plastic bags or introduced a small charge for them, which in several countries has reduced their use dramatically. Others are investing in better waste collection, since a large proportion of ocean plastic comes from places where rubbish is simply not collected at all.

Technology also plays a role. Floating barriers placed at river mouths can catch waste before it reaches the sea, and researchers are developing materials that break down more safely. Nevertheless, most scientists agree that clean-up alone cannot solve the problem. As one researcher put it, “If your bathtub is overflowing, you don’t start by mopping the floor — you turn off the tap.” In other words, the most effective solution is to produce and throw away less plastic in the first place.`,
    summaryVi: 'Rác nhựa ra biển chủ yếu qua các con sông, phân rã thành vi nhựa đi vào chuỗi thức ăn. Lệnh cấm túi nilon, thu gom rác tốt hơn và công nghệ đều giúp ích, nhưng giải pháp hiệu quả nhất là giảm sản xuất và thải bỏ nhựa ngay từ đầu.',
    questions: [
      { prompt: 'Where does much ocean plastic come from, according to the text?', options: ['Ships at sea', 'Rivers carrying waste from cities', 'Fishermen', 'Factories on islands'], answer: 1 },
      { prompt: 'What happened in several countries after plastic bag charges were introduced?', options: ['Use dropped dramatically', 'Prices of food increased', 'More bags were produced', 'Nothing changed'], answer: 0 },
      { prompt: 'What does the bathtub comparison mean?', options: ['Clean-up is the most important step', 'We should stop the source of the problem first', 'Bathrooms use too much plastic', 'Water is more important than plastic'], answer: 1 },
      { prompt: 'The word “eventually” in paragraph 1 is closest in meaning to…', options: ['quickly', 'in the end', 'rarely', 'immediately'], answer: 1 },
    ],
  },
  {
    id: 'reading-attention-economy',
    level: 'C1',
    topic: 'technology',
    title: 'The attention economy',
    titleVi: 'Nền kinh tế chú ý',
    summary: 'Ứng dụng được thiết kế để giữ chân người dùng như thế nào.',
    passage: `Many of the apps on our phones are free, yet the companies behind them are among the most valuable in the world. The apparent paradox disappears once we recognise what is actually being sold: our attention. The longer we scroll, watch and tap, the more advertising can be shown to us, and the more data is gathered about our habits.

To maximise this engagement, designers draw on insights from behavioural psychology. Infinite feeds remove natural stopping points; unpredictable rewards, such as the occasional notification of a “like”, keep us checking our screens in much the same way that slot machines keep gamblers pulling the lever. None of these features is inherently sinister, but taken together they create an environment in which putting the phone down requires a conscious effort.

Critics argue that this business model has hidden costs, from shorter attention spans to the spread of sensational content, which tends to attract more clicks than careful reporting. Defenders reply that users are free to leave and that personalised feeds genuinely help people discover things they enjoy. What is beyond dispute is that our attention is finite. Deciding deliberately where to spend it — rather than letting an algorithm decide for us — may be one of the more important skills of the digital age.`,
    summaryVi: 'Ứng dụng miễn phí kiếm tiền từ sự chú ý của người dùng. Các kỹ thuật như bảng tin vô tận và phần thưởng bất ngờ khiến ta khó rời điện thoại. Có tranh luận về tác hại và lợi ích, nhưng chắc chắn rằng sự chú ý là hữu hạn và cần được sử dụng có chủ đích.',
    questions: [
      { prompt: 'What is the “apparent paradox” mentioned in paragraph 1?', options: ['Free apps belong to very valuable companies', 'Phones are becoming cheaper', 'Advertising no longer works', 'People dislike free apps'], answer: 0 },
      { prompt: 'Why does the writer compare notifications to slot machines?', options: ['Both cost money', 'Both use unpredictable rewards to keep people engaged', 'Both are illegal', 'Both are designed by psychologists only'], answer: 1 },
      { prompt: 'Which view is presented as “beyond dispute”?', options: ['Apps should be banned', 'Attention is limited', 'Personalised feeds are harmful', 'Sensational content is rare'], answer: 1 },
      { prompt: 'The word “sinister” in paragraph 2 most nearly means…', options: ['harmful or evil', 'expensive', 'complicated', 'old-fashioned'], answer: 0 },
    ],
  },
];
