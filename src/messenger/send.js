const axios = require('axios');
const config = require('../config/global');

const post = async (body) => {
  const cfg = await config.loadDbConfig();
  try {
    await axios.post(`https://graph.facebook.com/v20.0/me/messages?access_token=${cfg.fbPageToken}`, body, { timeout: 30000 });
  } catch (err) {
    console.error('FB send error:', err.response?.data?.error?.message || err.message);
  }
};

exports.text = async (userId, text, quickReplies = null) => {
  const body = { recipient: { id: userId }, message: { text: String(text).substring(0, 2000) } };
  if (Array.isArray(quickReplies) && quickReplies.length) {
    body.message.quick_replies = quickReplies.slice(0, 13).map(q => ({
      content_type: 'text',
      title: String(q.title).substring(0, 20),
      payload: String(q.payload).substring(0, 1000)
    }));
  }
  return post(body);
};

exports.image = async (userId, imageUrl) => {
  return post({
    recipient: { id: userId },
    message: { attachment: { type: 'image', payload: { is_reusable: true, url: imageUrl } } }
  });
};

exports.markSeen = async (userId) => post({ recipient: { id: userId }, sender_action: 'mark_seen' });
exports.typingOn = async (userId) => post({ recipient: { id: userId }, sender_action: 'typing_on' });
exports.typingOff = async (userId) => post({ recipient: { id: userId }, sender_action: 'typing_off' });
