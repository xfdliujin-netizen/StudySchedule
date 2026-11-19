export function parseTaskSpeech(text, baseDate, fallbackSubject='chinese') {
 const raw=String(text).trim();
 if(!raw)throw Error('请先说出或输入任务。');
 const num=s=>{if(/^\d+$/.test(s))return Number(s);const d='零一二三四五六七八九';s=s.replace(/两/g,'二');if(s.includes('十')){const [a,b]=s.split('十');return (a?d.indexOf(a):1)*10+(b?d.indexOf(b):0);}return d.indexOf(s);};
 const matches=[['chinese',/语文|古诗|汉字|作文/],['math',/数学|口算|计算题/],['english',/英语|英文|单词/]].filter(([,re])=>re.test(raw));
 if(matches.length>1)throw Error('一次请安排一个科目的任务，多个任务请分开说。');
 let startDate=baseDate, repeatRule={type:'once'},durationMinutes=20;
 const warnings=[];
 const offset=raw.includes('后天')?2:raw.includes('明天')?1:0;
 if(offset){const d=new Date(baseDate+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+offset);startDate=d.toISOString().slice(0,10);}
 const explicit=raw.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?/);
 if(explicit){const value=(explicit[1]||baseDate.slice(0,4))+'-'+explicit[2].padStart(2,'0')+'-'+explicit[3].padStart(2,'0');const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==value)throw Error('日期不正确，请检查月份和日期。');startDate=value;}
 const weekly=raw.match(/每(?:周|星期)([日天一二三四五六、，,和及\s]+)/);
 if(/每天|每日/.test(raw))repeatRule={type:'daily'};
 if(/每周末/.test(raw))repeatRule={type:'weekly',days:[0,6]};
 if(weekly)repeatRule={type:'weekly',days:[...new Set([...weekly[1]].filter(c=>'日天一二三四五六'.includes(c)).map(c=>c==='天'?0:'日一二三四五六'.indexOf(c)))]};
 if(/(?:周|星期)[一二三四五六日天]到|至/.test(raw))throw Error('星期范围请改说具体日期，例如“每周一二三四五”。');
 const interval=raw.match(/每隔([\d零一二两三四五六七八九十]+)天/);
 if(interval){const n=num(interval[1]);if(n<1)throw Error('间隔天数需要大于零。');repeatRule={type:'interval',interval:n};}
 const duration=raw.match(/([\d零一二两三四五六七八九十]+)分钟/);
 if(duration){durationMinutes=num(duration[1]);if(durationMinutes<1||durationMinutes>240)throw Error('时长请填写 1 到 240 分钟。');}
 if(!matches.length)warnings.push('科目未明确，暂用当前科目');
 if(!duration)warnings.push('未说时长，暂用20分钟');
 if(/下周|下星期|晚上|下午|上午|点|小时/.test(raw))warnings.push('具体星期、时刻或小时表达未自动解析，请手动核对');
 let title=raw.replace(/^(请|帮我|给我|安排|添加|一个任务|任务是)[，,\s]*/g,'').replace(/今天|明天|后天|开始/g,'').replace(/每天|每日|每周末/g,'');
 for(const m of [explicit,weekly,interval,duration])if(m)title=title.replace(m[0],'');
 title=title.replace(/^[，,、\s]+|[，,。\s]+$/g,'').trim();
 if(!title)throw Error('请补充学习内容，例如“背诵古诗”。');
 return {title,subjectId:matches[0]?.[0]||fallbackSubject,startDate,durationMinutes,repeatRule,warnings,description:raw};
}
