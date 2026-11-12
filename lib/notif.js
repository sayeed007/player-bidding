import { ObjectId } from 'mongodb';
import { oid } from './server.js';

const both = (v) => (v && ObjectId.isValid(String(v)) ? [new ObjectId(String(v)), String(v)] : []);
/** Mongo filter for notifications user `u` may see in tournament `tid`. */
export function visible(tid, u) {
  const or = [{ 'to.all': true }, { 'to.userId': { $in: both(u._id) } }];
  if (u.teamId) or.push({ 'to.teamId': { $in: both(u.teamId) } });
  return { tournamentId: oid(tid), $or: or };
}
