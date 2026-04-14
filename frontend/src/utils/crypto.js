import CryptoJS from 'crypto-js';

const SECRET_KEY = 'TianshangChatCrypto2024';

export function encryptPassword(password) {
  return CryptoJS.SHA256(password + SECRET_KEY).toString();
}

export function validatePassword(password) {
  if (!password || password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }
  return { valid: true };
}

export function validateUsername(username) {
  if (!username || username.length < 3 || username.length > 20) {
    return { valid: false, error: 'Username must be 3-20 characters' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }
  return { valid: true };
}
