import assert from 'node:assert';
import { homeFor, isStaff } from './roles.js';

assert.equal(homeFor(null), '/');
assert.equal(homeFor({ role: 'super' }), '/admin');
assert.equal(homeFor({ role: 'organizer', tournamentId: 'abc' }), '/admin');
assert.equal(homeFor({ role: 'auctioneer', tournamentId: 'abc' }), '/admin');
assert.equal(homeFor({ role: 'owner', tournamentId: 'abc' }), '/team/abc');
assert.equal(homeFor({ role: 'captain', tournamentId: 'abc' }), '/team/abc');
assert.equal(homeFor({ role: 'owner' }), '/'); // owner without a tournament: stay public
assert.equal(homeFor({ role: 'player' }), '/me');
assert.ok(isStaff({ role: 'organizer' }) && !isStaff({ role: 'owner' }) && !isStaff(null));
console.log('roles ok');
