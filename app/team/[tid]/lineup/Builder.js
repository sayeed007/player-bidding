'use client';
// Squad builder: pick a formation, then drag players onto the pitch (or tap a player, then tap a spot).
// Spots can be dragged anywhere, so any shape works. All state rules live in lib/formation.js (tested).
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Eraser, Shuffle } from 'lucide-react';
import { Button, Segmented } from '@/components/ui';
import { Avatar } from '@/components/ui';
import { CatChip, catOf } from '@/components/cards';
import { FORMATIONS, SIZES, autoFill, buildState, carry, clearSlot, defaultFormation, moveSlot, placedIds, putPlayer, roleAt, swapSlots } from '@/lib/formation';

const TOKEN = 52; // px, token diameter on the pitch
const short = (name = '') => {
  const w = name.split(/\s+/).filter((x) => x.replace('.', '').length > 2 && !/^(md|mohammad|mohammed|muhammad)\.?$/i.test(x));
  return w[0] || name.split(/\s+/)[0] || '?';
};

function PitchLines() {
  const l = { stroke: 'rgba(255,255,255,.38)', strokeWidth: 2, fill: 'none' };
  return (
    <svg aria-hidden viewBox="0 0 300 400" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      <rect x="12" y="12" width="276" height="376" rx="4" {...l} />
      <line x1="12" y1="200" x2="288" y2="200" {...l} />
      <circle cx="150" cy="200" r="40" {...l} />
      <circle cx="150" cy="200" r="3" fill="rgba(255,255,255,.5)" />
      <rect x="78" y="12" width="144" height="58" {...l} /><rect x="116" y="12" width="68" height="22" {...l} />
      <rect x="78" y="330" width="144" height="58" {...l} /><rect x="116" y="366" width="68" height="22" {...l} />
    </svg>
  );
}

export default function Builder({ squad, initial, onSave, saving }) {
  const [st, setSt] = useState(() => buildState(squad, initial));
  const [sel, setSel] = useState(null); // {kind:'bench', pid} | {kind:'slot', id}
  const [ghost, setGhost] = useState(null);
  const [note, setNote] = useState('');
  const pitch = useRef(null), drag = useRef(null), stRef = useRef(st), selRef = useRef(sel);
  stRef.current = st; selRef.current = sel;
  const { size, formation, slots } = st;
  const byPid = Object.fromEntries(squad.map((p) => [String(p._id), p]));
  const onPitch = new Set(placedIds(slots));
  const bench = squad.filter((p) => !onPitch.has(String(p._id)));
  const upd = (fn) => setSt((s) => ({ ...s, slots: fn(s.slots) }));

  // ----- geometry -----
  const where = (cx, cy) => {
    const r = pitch.current.getBoundingClientRect();
    const inside = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
    const px = ((cx - r.left) / r.width) * 100, py = ((cy - r.top) / r.height) * 100;
    const near = stRef.current.slots
      .map((s) => ({ s, d: Math.hypot(r.left + (s.x / 100) * r.width - cx, r.top + (s.y / 100) * r.height - cy) }))
      .filter((o) => o.d <= TOKEN * 0.8).sort((a, b) => a.d - b.d)[0]?.s;
    return { inside, px, py, near };
  };
  const nearestEmpty = (px, py) => stRef.current.slots.filter((s) => !s.pid).sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))[0];
  const full = () => setNote(`The pitch is full (${size}/${size}). Drop onto a player to replace them, or take one off first.`);

  // place a bench player at a free point: the nearest empty spot moves to exactly where it was dropped
  const placeAt = (pid, px, py) => {
    const e = nearestEmpty(px, py);
    if (!e) return full();
    setNote('');
    upd((sl) => moveSlot(putPlayer(sl, e.id, pid), e.id, px, py));
  };

  // ----- tap (no drag) -----
  const tap = (d) => {
    const cur = selRef.current, sl = stRef.current.slots;
    setNote('');
    if (d.from === 'bench') return setSel(cur?.kind === 'bench' && cur.pid === d.pid ? null : { kind: 'bench', pid: d.pid });
    const s = sl.find((x) => x.id === d.slotId);
    if (!cur) { if (s.pid) setSel({ kind: 'slot', id: s.id }); else setNote('Pick a player from the bench first, then tap a spot.'); return; }
    if (cur.kind === 'bench') { upd((x) => putPlayer(x, s.id, cur.pid)); return setSel(null); }
    if (cur.id === s.id) return setSel(null);
    upd((x) => (s.pid ? swapSlots(x, cur.id, s.id) : putPlayer(x, s.id, sl.find((y) => y.id === cur.id).pid)));
    setSel(null);
  };
  const tapPitch = (e) => {
    if (e.target.closest('[data-slot]')) return;
    const cur = selRef.current; if (!cur) return;
    const { px, py } = where(e.clientX, e.clientY);
    if (cur.kind === 'bench') placeAt(cur.pid, px, py); else upd((x) => moveSlot(x, cur.id, px, py));
    setSel(null);
  };

  // ----- drag (pointer events: mouse, pen and touch) -----
  const endDrag = (d, cx, cy) => {
    if (!d.moved) return tap(d);
    const h = where(cx, cy);
    setSel(null); setNote('');
    if (!h.inside) { if (d.from === 'slot') upd((sl) => clearSlot(sl, d.slotId)); return; } // dropped off the pitch = back to the bench
    const target = h.near && h.near.id !== d.slotId ? h.near : null;
    if (d.from === 'bench') return target ? upd((sl) => putPlayer(sl, target.id, d.pid)) : placeAt(d.pid, h.px, h.py);
    return target ? upd((sl) => swapSlots(sl, d.slotId, target.id)) : upd((sl) => moveSlot(sl, d.slotId, h.px, h.py));
  };
  const begin = (e, d) => {
    if (e.button > 0) return;
    e.preventDefault();
    drag.current = { ...d, sx: e.clientX, sy: e.clientY, moved: false };
    const off = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
    const move = (ev) => {
      const g = drag.current; if (!g) return;
      if (!g.moved && Math.hypot(ev.clientX - g.sx, ev.clientY - g.sy) < 6) return;
      g.moved = true; setGhost({ pid: g.pid, x: ev.clientX, y: ev.clientY });
    };
    const up = (ev) => { off(); const g = drag.current; drag.current = null; setGhost(null); if (g) endDrag(g, ev.clientX, ev.clientY); };
    const cancel = () => { off(); drag.current = null; setGhost(null); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
  };
  useEffect(() => () => { drag.current = null; }, []);
  const key = (d) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(d); } };

  // ----- controls -----
  const setFormation = (f) => { setSt((s) => ({ ...s, formation: f, slots: carry(s.slots, f) })); setSel(null); };
  const setSize = (n) => { const f = defaultFormation(n); setSt({ size: n, formation: f, slots: carry(stRef.current.slots, f) }); setSel(null); setNote(''); };
  const fill = () => { const picks = autoFill(slots, squad); upd((sl) => sl.map((s, i) => ({ ...s, pid: picks[i] ? String(picks[i]) : null }))); setSel(null); setNote(''); };
  const clear = () => { upd((sl) => sl.map((s) => ({ ...s, pid: null }))); setSel(null); setNote(''); };
  const save = () => onSave({
    formation, size,
    positions: slots.filter((s) => s.pid).map((s) => ({ playerId: s.pid, x: s.x, y: s.y, gk: s.gk })),
  });

  const count = onPitch.size;
  const ghostPlayer = ghost && byPid[ghost.pid];
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(320px,440px)_1fr] md:grid-rows-[auto_auto_1fr] md:gap-x-8">
      {/* controls */}
      <section className="grad-card rounded-2xl p-3 shadow-card md:col-start-2 md:row-start-1" aria-label="Formation">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-muted">On pitch</span>
            <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="!min-h-10 !w-auto !rounded-lg !py-1 font-semibold" aria-label="Players on the pitch">
              {SIZES.map((n) => <option key={n} value={n}>{n}-a-side</option>)}
            </select>
          </label>
          <span className={clsx('ml-auto rounded-full px-3 py-1 font-display text-sm font-bold tabular-nums', count === size ? 'bg-primary text-primary-fg' : 'bg-surface2')}>{count}/{size}</span>
        </div>
        <div className="-mx-1 overflow-x-auto px-1"><Segmented value={formation} onChange={setFormation} options={(FORMATIONS[size] || []).map((f) => ({ value: f, label: f }))} /></div>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" icon={Shuffle} onClick={fill}>Auto-pick</Button>
          <Button variant="secondary" size="sm" icon={Eraser} onClick={clear} disabled={!count}>Clear</Button>
        </div>
      </section>

      {/* pitch */}
      <div className="md:col-start-1 md:row-span-3 md:row-start-1">
        <div ref={pitch} onClick={tapPitch} aria-label="Pitch"
          className="relative mx-auto aspect-[3/4] w-full max-w-[440px] select-none overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_40px_-12px_rgb(var(--primary)/.6)]"
          style={{ background: 'repeating-linear-gradient(0deg, #0e4a35 0 12.5%, #0b3f2e 12.5% 25%)' }}>
          <PitchLines />
          {slots.map((s) => {
            const p = s.pid && byPid[s.pid];
            const isSel = sel?.kind === 'slot' && sel.id === s.id;
            const role = roleAt(s.y, s.gk);
            const d = { from: 'slot', slotId: s.id, pid: s.pid };
            return (
              <div key={s.id} data-slot role="button" tabIndex={0} aria-label={p ? `${p.name}, ${role}. Drag to move.` : `Empty ${role} spot`}
                onPointerDown={(e) => (p ? begin(e, d) : tap(d))} onKeyDown={key(d)}
                style={{ left: `${s.x}%`, top: `${s.y}%`, touchAction: 'none' }}
                className={clsx('absolute z-10 flex w-[72px] -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center outline-none focus-visible:ring-2 focus-visible:ring-primary', ghost?.pid === s.pid && s.pid && 'opacity-30')}>
                {p ? (
                  <>
                    <Avatar src={p.photo} name={p.name} size={TOKEN}
                      className={clsx('!border-2 transition', isSel && 'pulse-live')}
                      style={{ boxShadow: `0 0 0 3px ${catOf(p.category).from}, 0 4px 14px rgb(0 0 0 / .5)` }} />
                    <span className="mt-1 max-w-full truncate rounded bg-black/65 px-1.5 text-[11px] font-bold leading-4 text-white">{short(p.name)}</span>
                    <span className="mt-0.5 rounded bg-black/45 px-1 text-[9px] font-semibold uppercase tracking-wider text-white/80">{role}</span>
                  </>
                ) : (
                  <span style={{ width: TOKEN, height: TOKEN }} className={clsx('grid place-items-center rounded-full border-2 border-dashed text-[10px] font-bold uppercase tracking-wider text-white/80', isSel ? 'border-primary bg-primary/20' : 'border-white/55 bg-black/20', sel?.kind === 'bench' && 'pulse-live')}>{role}</span>
                )}
              </div>
            );
          })}
        </div>
        <p className={clsx('mx-auto mt-2 max-w-[440px] text-center text-xs', note ? 'text-warning' : 'text-muted')} role="status">
          {note || 'Drag players onto the pitch, or tap a player then a spot. Drag a spot to reshape the formation; drag a player off the pitch to bench them.'}
        </p>
      </div>

      {/* bench */}
      <section aria-label="Bench" className="md:col-start-2">
        <h2 className="mb-2 mt-0 flex items-center justify-between text-base">Squad<span className="text-sm font-medium normal-case tracking-normal text-muted">{bench.length} on the bench</span></h2>
        {!bench.length ? <p className="grad-card m-0 rounded-xl p-3 text-sm text-muted">Everyone is on the pitch.</p> : (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
            {bench.map((p) => {
              const on = sel?.kind === 'bench' && sel.pid === String(p._id);
              const d = { from: 'bench', pid: String(p._id) };
              return (
                <div key={p._id} role="button" tabIndex={0} aria-pressed={on} aria-label={`${p.name}${p.position ? `, ${p.position}` : ''}. Tap to select, or drag onto the pitch.`}
                  onPointerDown={(e) => begin(e, d)} onKeyDown={key(d)}
                  className={clsx('grad-card flex w-32 shrink-0 cursor-grab select-none flex-col items-center gap-1 rounded-xl p-2 text-center outline-none [touch-action:pan-x] focus-visible:ring-2 focus-visible:ring-primary md:w-auto md:flex-row md:gap-3 md:text-left md:[touch-action:none]',
                    on && '!border-primary glow-primary', ghost?.pid === String(p._id) && 'opacity-30')}>
                  <Avatar src={p.photo} name={p.name} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold leading-tight">{p.name}</span>
                    <span className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-muted md:justify-start"><CatChip code={p.category} />{p.position || '—'}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* save */}
      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-primary/40 bg-bg/90 p-3 shadow-[0_-8px_32px_-8px_rgb(var(--primary)/.45)] backdrop-blur md:static md:col-start-2 md:mx-0 md:rounded-2xl md:border md:shadow-none">
        <Button className="w-full" size="lg" disabled={saving || !count} onClick={save}>{saving ? 'Saving…' : `Save lineup (${count}/${size})`}</Button>
      </div>

      {ghostPlayer && (
        <div aria-hidden className="pointer-events-none fixed z-[70] -translate-x-1/2 -translate-y-1/2 opacity-90" style={{ left: ghost.x, top: ghost.y }}>
          <Avatar src={ghostPlayer.photo} name={ghostPlayer.name} size={TOKEN + 8} style={{ boxShadow: `0 0 0 3px ${catOf(ghostPlayer.category).from}, 0 10px 24px rgb(0 0 0 / .6)` }} />
        </div>
      )}
    </div>
  );
}
