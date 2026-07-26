const { google } = require('googleapis');
const config = require('../config/global');
let authClient = null;

const getAuth = async () => {
  if (authClient) return authClient;
  const cfg = await config.loadDbConfig();
  if (!cfg.googleSaBase64) throw new Error('Google SA not configured');
  const sa = JSON.parse(Buffer.from(cfg.googleSaBase64, 'base64').toString('utf8'));
  authClient = new google.auth.GoogleAuth({
    credentials: sa,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
  return authClient;
};

exports.listFolder = async () => {
  const cfg = await config.loadDbConfig();
  const drive = google.drive({ version: 'v3', auth: await getAuth() });
  const res = await drive.files.list({
    q: `'${cfg.googleDriveFolderId}' in parents AND trashed=false`,
    fields: 'files(id,name,mimeType,size)',
    pageSize: 100
  });
  return res.data.files;
};

exports.downloadFileBuffer = async (fileId) => {
  const drive = google.drive({ version: 'v3', auth: await getAuth() });
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
};

exports.getFileByName = async (name) => {
  const files = await exports.listFolder();
  const hit = files.find(f => String(f.name).toLowerCase() === String(name).toLowerCase());
  if (!hit) return null;
  return exports.downloadFileBuffer(hit.id);
};
