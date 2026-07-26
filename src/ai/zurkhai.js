const kimi = require('./kimi');
const prompts = require('../config/prompts');
const config = require('../config/global');

const extractCarMeta = (answers) => {
  const allText = Object.values(answers || {})
    .map(v => (typeof v === 'string' ? v : v?.text || v?.caption || ''))
    .join(' ');
  const yearMatch = allText.match(/(19|20)\d{2}/);
  const colors = ['улаан','цагаан','хар','ногоон','цэнхэр','шар','саарал','улбар шар','хүрэн','ягаан'];
  const color = colors.find(c => allText.includes(c)) || '';
  const plateMatch = allText.match(/\d{3,}/);
  return { year: yearMatch ? yearMatch[0] : '', color, plate: plateMatch ? plateMatch[0] : '' };
};

exports.generate = async (birthDate, gender, session) => {
  const tierKey = session.tier === 4 ? '4' : '2';
  const car = extractCarMeta(session.answers);
  const prompt = await prompts.get('zurkhai', tierKey, {
    BIRTH_DATE: birthDate || '',
    GENDER: gender || 'хэрэглэгч',
    CAR_YEAR: car.year,
    CAR_COLOR: car.color || 'мэдээлэлгүй',
    CAR_PLATE: car.plate || 'мэдээлэлгүй'
  });
  return kimi.call(prompt, 'zurkhai', session.id, {
    temperature: 0.1,
    maxTokens: session.tier === 4 ? 6000 : 3000,
    enableSearch: true
  });
};
