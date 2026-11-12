import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hash(pw) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`;
}
export function verify(pw, stored = '') {
  const [salt, h] = stored.split(':');
  if (!salt || !h) return false;
  const a = Buffer.from(h, 'hex'), b = scryptSync(pw, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const randomPassword = () => randomBytes(5).toString('hex');
