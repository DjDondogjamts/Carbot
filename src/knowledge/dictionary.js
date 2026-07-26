const XLSX = require('xlsx');
const db = require('../config/db');
const drive = require('./drive');
const DICT_FILENAME = 'Final_CarMarket_Service_Dictionary.xlsx';
let cache = [];

exports.load = async () => {
  try {
    const buf = await drive.getFileByName(DICT_FILENAME);
    if (buf?.length) {
      const wb = XLSX.read(buf, { type: 'buffer' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const clean = rows
        .map(r => ({
          en: String(r.English || r.en || '').trim(),
          mn: String(r.Mongolian || r.mn || '').trim(),
          category: String(r.Category || 'general').trim()
        }))
        .filter(r => r.en && r.mn);
      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        await client.query('TRUNCATE TABLE dictionary');
        for (const r of clean) {
          await client.query(`INSERT INTO dictionary (en, mn, category) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [r.en, r.mn, r.category]);
        }
        await client.query('COMMIT');
        cache = clean;
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
      console.log(`📖 Dictionary loaded: ${clean.length} terms`);
      return clean.length;
    }
  } catch (e) {
    console.warn('⚠️ Dictionary load warning:', e.message);
  }
  // Fallback to DB
  cache = (await db.query(`SELECT en, mn, category FROM dictionary`)).rows;
  return cache.length;
};

exports.getAll = () => cache.slice();
