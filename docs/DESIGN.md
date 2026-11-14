# BidArena – Design contract (read before touching code)

Stack: Next.js 15 App Router (JS, no TS), MongoDB Atlas (driver `mongodb`), Cloudinary (client-side unsigned upload, `uploadImage()` in `lib/client.js`), deploys on Vercel free tier.
**No WebSockets / no background workers / no cron.** Live data = client polling (1.5s) of stateless GET endpoints. Timers are `endsAt` timestamps compared with the server clock (`now` returned by the API). Anything "scheduled" is evaluated lazily on read.
No new npm dependencies unless unavoidable (CSV, scheduling, standings etc. are hand-written).

## Foundation (already written – import, don't rewrite; extra helpers go in YOUR OWN lib file)
- `lib/server.js` – `col(name)`, `db()`, `client()`, `oid()`, `tour(tid)`, `api(handler)`, `body(req)`, `fail(status,msg)`, `need(roles,tid)`, `needTeam(tid,teamId)`, `me()`, `audit(tid,user,action,detail)`, `notify(tid,to,type,title,text)`, `rateLimit(key,max,ms)`, `publicPlayer(p)`.
  Route pattern:
  ```js
  export const POST = api(async (req, { params }) => { const { tid } = params; const u = await need(['organizer'], tid); const b = await body(req); ...; return {ok:true}; });
  ```
  `api()` already awaits `params`; thrown `fail()` becomes JSON `{error}`. Add `export const dynamic = 'force-dynamic'` to GET routes that must not cache.
- `lib/rules.js` – pure bid rules `maxBid`, `checkBid`, `squadProblems`, `categoryProblems` (tested: `npm test`).
- `lib/lifecycle.js` – `STATUSES`, `auctionReadiness(t)`, `checkTransition(t,to)`, `setStatus`.
- `lib/client.js` (client only) – `call(url, data?, method?)`, `useApi(url,{poll})`, `useMe()`, `downloadCsv`, `parseCsv`, `uploadImage`.
- `components/ui.js` – `Card, Badge, Stat, Table, Field, Msg, useFlash, money, dt`. `app/globals.css` has light/dark theme, `.card .row .grid .mut .err .okc .badge .scroll`.
- Roles: `super | organizer | auctioneer | owner | captain | player`. `super` passes every `need()`. Other roles are bound to ONE tournament via `user.tournamentId`. `owner`/`captain` also have `teamId`; `player` has `playerId`.
- Dynamic route params in pages (client components): `import { use } from 'react'; const { tid } = use(params);`
- Money/points are integers. IDs are ObjectId in DB, strings in JSON/URLs.
- Everything is scoped by `tournamentId` (ObjectId). Never query a tournament collection without it.

## Collections
- `users` {username(unique, lowercase), hash, role, name, tournamentId?, teamId?, playerId?, active, createdAt}
- `tournaments` {name, code, season, description, logo, banner, visibility:'public'|'private', status, teamsCount, squadSize, budget, format:'single'|'double'|'knockout'|'group_knockout'|'league_playoff', venues:[str], matchDuration, breakDuration, pointsRule:{win,draw,loss}, tiebreak:['points','gd','gf','h2h','fairplay'], rules(text), rulesDocUrl, dates:{regStart,regEnd,auctionAt,start,end}, categories:[{code,name,description,price,min,max,active,order}], auction:{increment,timerSec,extendWithinSec,extendToSec,autoClose,unsoldPolicy:'manual'|'return_to_pool'|'reduce_base',unsoldReducePct,selection:'random'|'category',publicPrices}, createdAt}
- `players` {tournamentId, name, photo, contact:{phone,email}, employeeId, department, position, position2, category, basePrice(null→category price), status:'draft'|'pending'|'approved'|'hold'|'in_auction'|'sold'|'unsold'|'withdrawn'|'disqualified', teamId, price, saleId, captain:bool, regAt, userId?}
  "Available for auction" = `teamId==null && status in (approved, unsold)`.
- `teams` {tournamentId, name(unique per tournament), logo, color, ownerName, captainName, captainPlayerId?, contact:{phone,email}, status:'pending'|'approved'|'rejected', budget, spent, counts:{A:n,...}, regAt}
  Remaining = budget - spent. Player count = sum(counts).
- `auctions` {tournamentId(unique), status:'idle'|'live'|'paused'|'suspended'|'completed', lotCounter, lot:null|{no, playerId, bid, leaderTeamId, startedAt, endsAt, pausedLeftMs, held:bool}, completion:{exception:str?}}
- `auction_events` {tournamentId, at, type, userId, data}  – IMMUTABLE append-only (random_pick, lot_open, bid, sold, unsold, pause, resume, skip, cancel, hold, correction, …)
- `bids` {tournamentId, lotNo, playerId, teamId, amount, key(idempotency), at}
- `sales` {tournamentId, lotNo, playerId, teamId, price, at, status:'confirmed'|'voided', voidReason, voidedBy, supersededBy}
- `ledger` {tournamentId, teamId, delta(negative = spend), reason, saleId, at}  – never edited
- `matches` {tournamentId, stage:'league'|'group'|'knockout'|'playoff', round, group?, label?, homeTeamId, awayTeamId, venue, start(ISO string), end, status:'scheduled'|'upcoming'|'live'|'half_time'|'completed'|'postponed'|'cancelled'|'forfeited', published:bool, score:{home,away}, resultState:'open'|'submitted'|'final', events:[{id,type:'goal'|'own_goal'|'penalty_goal'|'assist'|'yellow'|'red'|'sub',minute,period,teamId,playerId,assistPlayerId?,inPlayerId?}], lineups:{home:[playerId],away:[playerId]}, referee, potmPlayerId, finalizedAt, history:[{at,by,reason,before}]}
- `awards` {tournamentId, type('golden_boot'|'best_goalkeeper'|'mvp'|'potm'|…), playerId?, teamId?, note}
- `notifications` {tournamentId, to:{all:true}|{teamId}|{userId}, type, title, text, at, readBy:[userId]}  (announcements are `type:'announcement'`, `to:{all:true}`)
- `audit` {tournamentId, at, userId, userName, action, detail}

## Pages (URL ownership)
Public/read-only (no login): `/` · `/t/[tid]` · `/t/[tid]/teams` · `/t/[tid]/teams/[teamId]` · `/t/[tid]/players` · `/t/[tid]/players/[pid]` · `/t/[tid]/fixtures` · `/t/[tid]/standings` · `/t/[tid]/stats` · `/t/[tid]/auction` (spectator) · `/t/[tid]/auction/live` (projector, full screen, no nav) · `/t/[tid]/register` (player self-registration)
Staff: `/admin` (tournament list/create/clone, users) · `/admin/[tid]` (dashboard) · `/admin/[tid]/settings` · `/players` · `/teams` · `/auction` · `/fixtures` · `/results` · `/reports` · `/announcements` · `/audit` (each is `/admin/[tid]/<name>`) – `app/admin/layout.js` renders the sidebar linking all of them.
Team: `/team/[tid]` (owner/captain dashboard: budget, squad, quotas, fixtures, notifications) · `/team/[tid]/auction` (bidding room) · `/team/[tid]/lineup` (captain). Player: `/me`.

## API surface (all under `/api`, JSON). Roles in [].
**Setup (module SETUP)**
- `GET /tournaments` public list (visibility public) · `POST /tournaments` [super] · `POST /tournaments/[tid]/clone` [super] → new tournament (config+categories, status draft, optional `copyPlayers`)
- `GET /t/[tid]` public info (incl. categories, status, auction.publicPrices) · `PATCH /t/[tid]` [organizer] settings (category validation via `categoryProblems`) · `POST /t/[tid]/status {to}` [organizer] uses `checkTransition` (+audit+notify) · `GET /t/[tid]/readiness` [organizer] → `auctionReadiness`
- `GET /t/[tid]/dashboard` [organizer,auctioneer] widget counts
- Players: `GET /t/[tid]/players?q=&category=&status=&position=` (public: only approved/in_auction/sold/unsold, via `publicPlayer`; staff with `?all=1` see all + private fields) · `GET /t/[tid]/players/[pid]` · `POST /t/[tid]/players` [organizer] create · `POST /t/[tid]/players/register` public self-registration → status `pending` (rate limited) · `PATCH /t/[tid]/players/[pid]` [organizer] (post-auction-start edits are audited, require `reason`) · `POST /t/[tid]/players/[pid]/{approve,reject,hold,release,withdraw}` · `POST /t/[tid]/players/import` [organizer] `{rows:[...]}` · `GET /t/[tid]/players/export` [organizer] CSV
- Teams: `GET /t/[tid]/teams` public (approved only; staff `?all=1`) · `GET /t/[tid]/teams/[teamId]` team + squad (+prices if publicPrices or staff/own team) · `POST /t/[tid]/teams` [organizer or public submit→pending] · `PATCH …/[teamId]` · `POST …/[teamId]/{approve,reject}` (approve creates owner user, returns one-time password) · `GET …/[teamId]/budget` [own team|staff] budget+ledger+quota
- Users: `GET/POST /users` [super] ; `POST /t/[tid]/users` [organizer] create captain/auctioneer/owner/player login
**Auction (module AUCTION)** – everything under `/t/[tid]/auction/…`
- `GET state` (public, polled) → `{now, tournamentStatus, status, lot:{no,player,bid,leaderTeamId,endsAt,pausedLeftMs}|null, config:{increment,timerSec,categories,squad}, teams:[{_id,name,logo,color,budget,spent,remaining,counts,count,slots,maxBidForLot?}], recentBids, recentSales, progress:{sold,total,unsold,available}}` (`maxBidForLot` only for the caller's team)
- [auctioneer|organizer]: `start`, `random-pick` {category?}, `open`, `close` (sold/unsold), `pause`, `resume`, `suspend`, `skip`, `cancel-lot`, `hold-lot`, `reopen/[pid]`, `correct-sale` {saleId, newTeamId?, newPrice?, reason}, `complete` {exception?}, `summary` GET
- [owner,captain? owners only] `bid` {amount, key}
**Matches (module MATCH)**
- `POST /t/[tid]/fixtures/generate` [organizer] params → preview (not saved) or `{save:true}` · `GET /t/[tid]/matches` (public: published only; staff `?all=1`) → `{matches:[{...match, homeName, awayName, homeColor, awayColor}]}` · `POST /t/[tid]/fixtures/publish` · `PATCH /t/[tid]/matches/[mid]` (reschedule/venue/status; conflict-validated; logged + notify) · `DELETE` (cancel) · `POST …/[mid]/events` · `DELETE …/[mid]/events/[eid]` · `POST …/[mid]/submit` · `POST …/[mid]/finalize` · `POST …/[mid]/correct` {reason,…} · `PUT …/[mid]/lineup` [captain of that team]
- `GET /t/[tid]/standings` → `{rows:[{teamId,name,logo,color,P,W,D,L,GF,GA,GD,Pts,rank}]}` (derived from final matches only)
- `GET /t/[tid]/stats` → `{players:[{playerId,name,photo,teamId,teamName,position,category,price?,P,starts,goals,assists,yellow,red,og,penGoals,cleanSheets}], teams:[{teamId,name,P,W,D,L,GF,GA,GD,Pts,rank,cleanSheets,yellow,red}]}`
- `GET /t/[tid]/leaderboards` → `{scorers:[{playerId,name,teamId,teamName,value}], assists:[…], cleanSheets:[…], potm:[…], awards:[{type,playerId?,teamId?,name,note}]}` · `PUT /t/[tid]/awards` [organizer]
**Ops (module OPS)**
- `GET /t/[tid]/notifications` [logged in; filtered to user/team/all] · `POST …/notifications/read` · `GET/POST /t/[tid]/announcements` (GET public, POST [organizer])
- `GET /t/[tid]/reports/[name]` [organizer] → `{title, rows}` for: registration, categories, teams, sales, unsold, budgets, squads, fixtures, results, standings, performance, team-performance, summary, audit · pages render rows as a table with CSV export and print (`window.print()`).
- `GET /t/[tid]/audit` [organizer]

## Module split / file ownership (do NOT edit files owned by another module)
- **SETUP**: `app/api/tournaments/**`, `app/api/users/**`, `app/api/t/[tid]/route.js`, `status`, `readiness`, `dashboard`, `players/**`, `teams/**`, `users`; pages `app/admin/layout.js`, `app/admin/page.js`, `app/admin/[tid]/{page,settings,players,teams}/…`, `app/team/[tid]/page.js`, `app/me/**`, `app/t/[tid]/register/**`; `lib/setup.js`.
- **AUCTION**: `app/api/t/[tid]/auction/**`, `lib/auction.js`, pages `app/admin/[tid]/auction/**`, `app/team/[tid]/auction/**`, `app/t/[tid]/auction/**` (spectator + `live` projector).
- **MATCH**: `app/api/t/[tid]/{fixtures,matches,standings,stats,leaderboards,awards}/**`, `lib/fixtures.js`, `lib/standings.js`, `lib/stats.js`, pages `app/admin/[tid]/{fixtures,results}/**`, `app/team/[tid]/lineup/**`.
- **OPS**: public pages `app/page.js`, `app/t/[tid]/{page,teams,players,fixtures,standings,stats}/**`, `app/api/t/[tid]/{notifications,announcements,reports,audit}/**`, `lib/reports.js`, pages `app/admin/[tid]/{reports,announcements,audit}/**`, notification bell component `components/Bell.js` (OPS may add it to `components/Nav.js`).
Shared files (`lib/server.js`, `lib/rules.js`, `lib/lifecycle.js`, `lib/client.js`, `components/ui.js`, `app/globals.css`, `components/Nav.js`) – small additive changes only, no renames.

## Rules every module must respect
Server decides everything (never trust client for validity). Privileged mutations call `audit()`. Public endpoints never return `contact`, `employeeId`, `department`, `hash`, or passwords. Validate input at API boundaries. Keep code small and boring; mark deliberate shortcuts with a `ponytail:` comment. Verify with `npx next build` (set `MONGODB_URI=mongodb://x SECRET=x`) and `npm test`; add small `*.test.mjs` for pure logic (fixtures, standings, bid logic) wired into the `test` script chain.
