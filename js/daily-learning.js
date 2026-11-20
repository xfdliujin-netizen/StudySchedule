// Each band is ordered from foundational to more demanding material.
const dailyBands = [
  {
    chinese: [
      ['春眠不觉晓，处处闻啼鸟。', '孟浩然《春晓》'],
      ['举头望明月，低头思故乡。', '李白《静夜思》'],
      ['欲穷千里目，更上一层楼。', '王之涣《登鹳雀楼》'],
      ['小荷才露尖尖角，早有蜻蜓立上头。', '杨万里《小池》']
    ],
    math: [
      ['和 = 加数 + 加数', '3 + 5 = 8。'],
      ['差 = 被减数 − 减数', '12 − 5 = 7。'],
      ['相同加数的和可以用乘法表示', '4 + 4 + 4 = 3 × 4 = 12。'],
      ['平均分每份的数量 = 总量 ÷ 份数', '12 个分成 3 份，每份 4 个。']
    ],
    english: [
      ['book', 'bʊk', '书', 'This is my book.', '这是我的书。'],
      ['sun', 'sʌn', '太阳', 'I see the sun.', '我看见了太阳。'],
      ['help', 'hɛlp', '帮助', 'Can you help me?', '你能帮助我吗？'],
      ['smile', 'smaɪl', '微笑', 'Your smile makes me happy.', '你的微笑让我开心。']
    ]
  },
  {
    chinese: [
      ['停车坐爱枫林晚，霜叶红于二月花。', '杜牧《山行》'],
      ['遥望洞庭山水翠，白银盘里一青螺。', '刘禹锡《望洞庭》'],
      ['迟日江山丽，春风花草香。', '杜甫《绝句二首·其一》'],
      ['不识庐山真面目，只缘身在此山中。', '苏轼《题西林壁》']
    ],
    math: [
      ['长方形周长 = (长 + 宽) × 2', '长 6 厘米、宽 4 厘米，周长是 20 厘米。'],
      ['长方形面积 = 长 × 宽', '长 6 厘米、宽 4 厘米，面积是 24 平方厘米。'],
      ['平均数 = 总和 ÷ 个数', '3、5、7 的平均数是 5。'],
      ['a × (b + c) = a × b + a × c', '4 × (10 + 2) = 40 + 8。']
    ],
    english: [
      ['garden', 'ˈɡɑrdən', '花园', 'There are flowers in the garden.', '花园里有花。'],
      ['share', 'ʃɛr', '分享', 'I share my books with my friends.', '我和朋友们分享我的书。'],
      ['practice', 'ˈpræktɪs', '练习', 'I practice English every day.', '我每天练习英语。'],
      ['curious', 'ˈkjʊriəs', '好奇的', 'I am curious about the stars.', '我对星星很好奇。']
    ]
  },
  {
    chinese: [
      ['明月松间照，清泉石上流。', '王维《山居秋暝》'],
      ['等闲识得东风面，万紫千红总是春。', '朱熹《春日》'],
      ['千磨万击还坚劲，任尔东西南北风。', '郑燮《竹石》'],
      ['谁道人生无再少？门前流水尚能西！', '苏轼《浣溪沙·游蕲水清泉寺》']
    ],
    math: [
      ['三角形面积 = 底 × 对应的高 ÷ 2', '底 6 厘米、高 4 厘米，面积是 12 平方厘米。'],
      ['梯形面积 = (上底 + 下底) × 高 ÷ 2', '上底 3、下底 5、高 4，面积是 16 平方单位。'],
      ['圆的周长 = 2πr', '半径为 3 厘米时，周长是 6π 厘米。'],
      ['圆柱体积 = 底面积 × 高', '底面积为 10 平方厘米、高 3 厘米，体积是 30 立方厘米。']
    ],
    english: [
      ['journey', 'ˈdʒɝni', '旅程', 'We began our journey early in the morning.', '我们清早开始了旅程。'],
      ['protect', 'prəˈtɛkt', '保护', 'We can protect the river by keeping it clean.', '保持河流清洁可以保护它。'],
      ['improve', 'ɪmˈpruv', '改进', 'Reading aloud helps me improve my English.', '大声朗读有助于我提高英语水平。'],
      ['describe', 'dɪˈskraɪb', '描述', 'Can you describe what you saw?', '你能描述一下你看到了什么吗？']
    ]
  },
  {
    chinese: [
      ['学而不思则罔，思而不学则殆。', '《论语·为政》'],
      ['会当凌绝顶，一览众山小。', '杜甫《望岳》'],
      ['沉舟侧畔千帆过，病树前头万木春。', '刘禹锡《酬乐天扬州初逢席上见赠》'],
      ['但愿人长久，千里共婵娟。', '苏轼《水调歌头》']
    ],
    math: [
      ['去括号：a − (b + c) = a − b − c', '10 − (3 + 2) = 10 − 3 − 2 = 5。'],
      ['完全平方公式：(a + b)² = a² + 2ab + b²', '(x + 3)² = x² + 6x + 9。'],
      ['勾股定理：a² + b² = c²', '直角三角形的两条直角边为 3、4 时，斜边为 5。'],
      ['二次函数 y = ax² + bx + c 的对称轴：x = −b/(2a)', 'a ≠ 0。例如 y = x² − 4x 的对称轴是 x = 2。']
    ],
    english: [
      ['compare', 'kəmˈpɛr', '比较', 'Compare the two answers before you decide.', '决定之前，先比较这两个答案。'],
      ['evidence', 'ˈɛvɪdəns', '证据', 'What evidence supports your idea?', '什么证据支持你的想法？'],
      ['challenge', 'ˈtʃælɪndʒ', '挑战', 'Learning a new skill can be a challenge.', '学习一项新技能可能是个挑战。'],
      ['environment', 'ɪnˈvaɪrənmənt', '环境', 'Small actions can help protect the environment.', '小小的行动也有助于保护环境。']
    ]
  },
  {
    chinese: [
      ['锲而不舍，金石可镂。', '《荀子·劝学》'],
      ['师者，所以传道受业解惑也。', '韩愈《师说》'],
      ['寄蜉蝣于天地，渺沧海之一粟。', '苏轼《赤壁赋》'],
      ['问君能有几多愁？恰似一江春水向东流。', '李煜《虞美人》']
    ],
    math: [
      ['等差数列通项：aₙ = a₁ + (n − 1)d', '首项 3、公差 2，第 5 项是 11。'],
      ['同角三角函数基本关系：sin²x + cos²x = 1', '若 sin x = 3/5，则 cos²x = 16/25。'],
      ['等比数列前 n 项和：Sₙ = a₁(1 − qⁿ)/(1 − q)', 'q ≠ 1。数列 1、2、4、8 的和是 15。'],
      ['幂函数求导：(xⁿ)′ = nxⁿ⁻¹（n 为正整数）', '例如 (x³)′ = 3x²。']
    ],
    english: [
      ['analyze', 'ˈænəlaɪz', '分析', 'We need to analyze the results carefully.', '我们需要仔细分析结果。'],
      ['perspective', 'pərˈspɛktɪv', '视角', 'Try to see the problem from another perspective.', '试着从另一个角度看这个问题。'],
      ['sustainable', 'səˈsteɪnəbəl', '可持续的', 'The city is looking for sustainable ways to travel.', '这座城市正在寻找可持续的出行方式。'],
      ['evaluate', 'ɪˈvæljueɪt', '评估', 'Evaluate the evidence before drawing a conclusion.', '得出结论前，先评估证据。']
    ]
  }
];

const localPoems = [
  ['江苏', 3, 6, '姑苏城外寒山寺，夜半钟声到客船。', '张继《枫桥夜泊》'],
  ['浙江', 3, 6, '欲把西湖比西子，淡妆浓抹总相宜。', '苏轼《饮湖上初晴后雨二首·其二》'],
  ['山东', 7, 12, '造化钟神秀，阴阳割昏晓。', '杜甫《望岳》'],
  ['湖北', 7, 12, '晴川历历汉阳树，芳草萋萋鹦鹉洲。', '崔颢《黄鹤楼》'],
  ['江西', 3, 6, '飞流直下三千尺，疑是银河落九天。', '李白《望庐山瀑布》']
];

const regionEnglish = {
  coastal: ['coast', 'koʊst', '海岸', 'We walked along the coast.', '我们沿着海岸散步。'],
  river: ['river', 'ˈrɪvər', '河流', 'The river flows past our town.', '这条河流经我们的小镇。'],
  mountain: ['mountain', 'ˈmaʊntən', '山', 'We can see the mountain in the distance.', '我们能看到远处的山。'],
  city: ['museum', 'mjuˈziəm', '博物馆', 'Let’s visit the museum this weekend.', '我们这周末去博物馆吧。']
};

const advancedRegionEnglish = {
  coastal: ['coastline', 'ˈkoʊstlaɪn', '海岸线', 'The coastline changes slowly over time.', '海岸线会随着时间慢慢变化。'],
  river: ['waterway', 'ˈwɔtərweɪ', '水道', 'This waterway connects several towns.', '这条水道连接着几个城镇。'],
  mountain: ['altitude', 'ˈæltəˌtud', '海拔', 'The air is cooler at a higher altitude.', '海拔越高，空气越凉。'],
  city: ['heritage', 'ˈhɛrɪtɪdʒ', '文化遗产', 'The museum helps preserve our cultural heritage.', '博物馆有助于保护我们的文化遗产。']
};

export function dailySubjectContent(subjectId, day, profile = {}) {
  const grade = Number(profile?.grade) || 0;
  const region = String(profile?.region || '');
  const bandIndex = grade <= 2 ? 0 : grade <= 4 ? 1 : grade <= 6 ? 2 : grade <= 9 ? 3 : 4;
  const entries = dailyBands[grade ? bandIndex : 1][subjectId];
  const dayIndex = Date.parse(day + 'T00:00:00Z') / 86400000;
  if (!Array.isArray(entries) || !Number.isFinite(dayIndex)) return null;
  const month = Number(day.slice(5, 7));
  // September–October and February–March favor foundational items.
  const earlyTerm = [2, 3, 9, 10].includes(month);
  const bandStart = [1, 3, 5, 7, 10][bandIndex];
  const span = grade ? Math.min(entries.length, 2 + (grade - bandStart) + (earlyTerm ? 0 : 1)) : 3;
  const pool = entries.slice(0, span);
  const offset = grade + [...region].reduce((sum, char) => sum + char.codePointAt(0), 0);
  const localDay = region && (dayIndex + offset) % 7 === 0;
  let entry = pool[((dayIndex + offset) % pool.length + pool.length) % pool.length];
  if (subjectId === 'chinese') {
    const poem = localDay && localPoems.find(([place, min, max]) => region.includes(place) && (!grade || (grade >= min && grade <= max)));
    if (poem) entry = poem.slice(3);
    return {title:'每日诗文', text:entry[0], notes:[entry[1]]};
  }
  if (subjectId === 'math') {
    const notes = [entry[1]];
    if (localDay) notes.push(grade >= 7
      ? `应用：试着用今天的公式，给「${region}」的地图或身边事物设计一道题。`
      : `试一试：用今天的算式数一数或量一量「${region}」身边的事物。`);
    return {title:'每日公式', text:entry[0], notes};
  }
  if (localDay) {
    const topic = /沿海|江苏|浙江|福建|广东|海南|山东|辽宁|上海|天津|广西|香港|澳门|台湾/.test(region) ? 'coastal'
      : /四川|贵州|云南|重庆|西藏|青海|山西/.test(region) ? 'mountain'
      : /湖北|湖南|江西|安徽|河南|黑龙江|吉林/.test(region) ? 'river' : 'city';
    if (!grade || grade >= 3) entry = (grade >= 7 ? advancedRegionEnglish : regionEnglish)[topic];
  }
  const [word, ipa, meaning, example, translation] = entry;
  return {title:'每日英语', text:word, ipa, meaning, example, notes:[translation]};
}
