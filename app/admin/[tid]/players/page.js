'use client';
import { use, useEffect, useRef, useState } from 'react';
import { Plus, Upload, Download, Images, Camera, ImagePlus, Search, ChevronRight, Check, X, Pause, Play, UserMinus, Pencil, Loader2 } from 'lucide-react';
import { call, useApi, parseCsv, downloadCsv, uploadImage } from '@/lib/client';
import { Card, Button, Field, Msg, PageHeader, Table, Segmented, Sheet, Avatar, Badge, StatusBadge, Empty, Skeleton, useFlash, money } from '@/components/ui';
import { CatChip } from '@/components/cards';
import { POSITIONS, statusIndex, statusLabel, effectivePrice, matchPhotos } from '@/lib/setup';

const FILTERS = [['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['hold', 'Hold'], ['in_auction', 'In auction'], ['sold', 'Sold'], ['unsold', 'Unsold'], ['withdrawn', 'Withdrawn']];
const EMPTY = { name: '', photo: '', phone: '', email: '', employeeId: '', department: '', position: 'Midfielder', position2: '', category: '', basePrice: '', reason: '' };
const PHOTO_REASON = 'photo update';

export default function Players({ params }) {
  const { tid } = use(params);
  const [flt, setFlt] = useState({ q: '', category: '', status: '', position: '' });
  const qs = new URLSearchParams({ all: '1', ...Object.fromEntries(Object.entries(flt).filter(([, v]) => v)) });
  const { data, error, reload } = useApi(`/api/t/${tid}/players?${qs}`);
  const { data: t } = useApi(`/api/t/${tid}`);
  const [form, setForm] = useState(null); // null = closed; {_id?, ...fields}
  const [selId, setSelId] = useState(null);
  const [apprCat, setApprCat] = useState('');
  const [confirmW, setConfirmW] = useState(false);
  const [imp, setImp] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [busy, setBusy] = useState(null);
  const [msg, flash] = useFlash();
  const gallery = useRef(null), camera = useRef(null), target = useRef(null);
  useEffect(() => { const s = new URLSearchParams(location.search).get('status'); if (s) setFlt((x) => ({ ...x, status: s })); }, []);

  const players = data?.players || [];
  const sel = players.find((p) => p._id === selId);
  const cats = (t?.categories || []).filter((c) => c.active !== false);
  const after = t && statusIndex(t.status) >= statusIndex('auction_in_progress');
  const patch = (id, b) => call(`/api/t/${tid}/players/${id}`, b, 'PATCH');

  const act = (p, a, extra = {}) => flash(async () => { await call(`/api/t/${tid}/players/${p._id}/${a}`, extra); setSelId(null); setConfirmW(false); reload(); }, `${p.name}: ${a} done`);
  const openSel = (p) => { setSelId(p._id); setApprCat(p.category || ''); setConfirmW(false); };
  const edit = (p) => { setSelId(null); setForm({ ...EMPTY, ...p, phone: p.contact?.phone || '', email: p.contact?.email || '', category: p.category || '', basePrice: p.basePrice ?? '', position2: p.position2 || '', reason: '' }); };
  const save = (e) => {
    e.preventDefault();
    flash(async () => {
      const { _id, ...b } = form;
      _id ? await patch(_id, b) : await call(`/api/t/${tid}/players`, b);
      setForm(null); reload();
    }, 'Saved');
  };
  const fset = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const pick = (p, cam) => { target.current = p; (cam ? camera : gallery).current?.click(); };
  const onFile = (e) => {
    const file = e.target.files[0], p = target.current;
    e.target.value = '';
    if (!file || !p) return;
    setBusy(p._id);
    flash(async () => { const url = await uploadImage(file); await patch(p._id, { photo: url, reason: PHOTO_REASON }); reload(); }, `${p.name}: photo saved`).finally(() => setBusy(null));
  };
  const formPhoto = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    file && flash(async () => { const photo = await uploadImage(file); setForm((f) => ({ ...f, photo })); }, 'Photo uploaded');
  };

  const importFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    flash(async () => {
      const rows = parseCsv(await file.text());
      const r = await call(`/api/t/${tid}/players/import`, { rows });
      setImp(r); reload();
      e.target.value = '';
      return r;
    }, (r) => `Imported ${r.created}, skipped ${r.skipped.length}`);
  };
  const exportCsv = () => downloadCsv('players.csv', players.map((p) => ({
    name: p.name, position: p.position, position2: p.position2, category: p.category, basePrice: p.basePrice ?? '', effectivePrice: effectivePrice(p, t) ?? '',
    status: p.status, soldPrice: p.price ?? '', phone: p.contact?.phone, email: p.contact?.email, employeeId: p.employeeId, department: p.department,
  })));
  const noPhoto = players.filter((p) => !p.photo).length;

  const photoBtn = (p, size = 48) => (
    <button type="button" aria-label={`Change photo for ${p.name}`} onClick={() => pick(p, false)}
      className="relative !min-h-0 shrink-0 !rounded-full !bg-transparent !p-0">
      <Avatar src={p.photo} name={p.name} size={size} />
      <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border border-surface bg-primary text-primary-fg">
        {busy === p._id ? <Loader2 size={11} className="animate-spin" aria-hidden /> : <Camera size={11} aria-hidden />}
      </span>
    </button>
  );

  return (
    <>
      <PageHeader title="Players" subtitle={data ? `${players.length} shown${noPhoto ? ` · ${noPhoto} without photo` : ''}` : ' '}
        right={<Button icon={Plus} onClick={() => setForm({ ...EMPTY })}>Add player</Button>} />
      <Msg {...msg} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={onFile} />
      <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={onFile} />

      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="md" icon={Images} onClick={() => setBulk((v) => !v)}>Bulk photos</Button>
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-semibold hover:bg-surface2">
          <Upload size={15} aria-hidden />Import CSV<input type="file" accept=".csv,text/csv" hidden onChange={importFile} /></label>
        <Button variant="secondary" size="md" icon={Download} onClick={exportCsv}>Export CSV</Button>
      </div>
      {imp?.skipped.length > 0 && (
        <details className="mb-3 rounded-xl border border-line bg-surface p-3 text-sm"><summary className="cursor-pointer text-danger">{imp.skipped.length} rows skipped</summary>
          {imp.skipped.map((s) => <div key={s.row} className="mt-1">row {s.row} {s.name}: {s.reason}</div>)}
          <p className="mt-2 text-xs text-muted">CSV columns: name, position, category, basePrice, phone, email, employeeId, department, position2.</p></details>
      )}

      {bulk && <BulkPhotos tid={tid} onClose={() => setBulk(false)} onDone={reload} patch={patch} />}

      <Card title="Find players" className="!my-3 !p-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input aria-label="Search players" className="!pl-10" type="search" placeholder="Search name / employee id" value={flt.q} onChange={(e) => setFlt({ ...flt, q: e.target.value })} />
        </div>
        <div className="-mx-1 mt-2 overflow-x-auto px-1 pb-1">
          <Segmented value={flt.status} onChange={(v) => setFlt({ ...flt, status: v })} options={FILTERS.map(([value, label]) => ({ value, label }))} />
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select aria-label="Category" value={flt.category} onChange={(e) => setFlt({ ...flt, category: e.target.value })}><option value="">All categories</option>{(t?.categories || []).map((c) => <option key={c.code}>{c.code}</option>)}</select>
          <select aria-label="Position" value={flt.position} onChange={(e) => setFlt({ ...flt, position: e.target.value })}><option value="">All positions</option>{POSITIONS.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
      </Card>

      {error && <div role="alert" className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger"><span className="min-w-0 break-words">{error}</span><Button variant="secondary" onClick={reload}>Retry</Button></div>}
      {!data ? error ? <Empty>Could not load players.</Empty> : <div className="grid gap-2"><Skeleton className="h-[72px]" /><Skeleton className="h-[72px]" /><Skeleton className="h-[72px]" /></div>
        : !players.length ? <Empty>No players match these filters.</Empty> : (
          <>
            <ul className="grid gap-2 md:hidden">
              {players.map((p) => (
                <li key={p._id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
                  {photoBtn(p)}
                  <button type="button" onClick={() => openSel(p)} className="!flex !min-h-[48px] min-w-0 flex-1 !items-center !justify-start !gap-2 !bg-transparent !p-0 text-left !font-normal text-fg">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <CatChip code={p.category || '?'} />{p.position || '—'}{p.teamId && <> · {money(p.price)}</>}
                      </span>
                    </span>
                    <StatusBadge status={p.status} /><ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <Card flush className="hidden md:block">
              <Table mobile="scroll" rows={players} cols={[
                { key: 'photo', label: '', render: (p) => photoBtn(p, 40) },
                { key: 'name', label: 'Name', render: (p) => <span className="font-medium">{p.name}</span> },
                { key: 'position', label: 'Position' },
                { key: 'category', label: 'Cat', render: (p) => <CatChip code={p.category || '?'} /> },
                { key: 'bp', label: 'Base', render: (p) => <span className="tabular-nums">{money(effectivePrice(p, t || {}))}</span> },
                { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.rejected ? 'rejected' : p.status} /> },
                { key: 'sold', label: 'Sold', render: (p) => <span className="tabular-nums">{p.teamId ? money(p.price) : ''}</span> },
                { key: 'contact', label: 'Contact', render: (p) => p.contact?.phone || p.contact?.email },
                { key: 'a', label: '', render: (p) => <Button size="md" variant="secondary" onClick={() => openSel(p)}>Manage</Button> },
              ]} />
            </Card>
          </>
        )}

      {/* action sheet */}
      <Sheet open={!!sel} onClose={() => { setSelId(null); setConfirmW(false); }} title={sel?.name || 'Player'}>
        {sel && (
          <div className="grid gap-3">
            <Msg {...msg} />
            <div className="flex items-center gap-3">
              <Avatar src={sel.photo} name={sel.name} size={72} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><StatusBadge status={sel.rejected ? 'rejected' : sel.status} />{sel.category && <CatChip code={sel.category} />}</div>
                <p className="mt-1 text-sm text-muted">{sel.position}{sel.position2 ? ` / ${sel.position2}` : ''} · base {money(effectivePrice(sel, t || {}))}</p>
                <p className="truncate text-sm text-muted">{sel.contact?.phone || sel.contact?.email || 'no contact'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" icon={Camera} onClick={() => pick(sel, true)}>Take photo</Button>
              <Button variant="secondary" icon={ImagePlus} onClick={() => pick(sel, false)}>Gallery</Button>
            </div>
            {['pending', 'draft', 'hold', 'withdrawn'].includes(sel.status) && !sel.teamId && (
              <div className="grid gap-2 rounded-xl bg-surface2/60 p-3">
                {!sel.category && <Field label="Category (required to approve)"><select value={apprCat} onChange={(e) => setApprCat(e.target.value)}><option value="">Choose…</option>{cats.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.price})</option>)}</select></Field>}
                <Button variant="success" icon={Check} disabled={!sel.category && !apprCat} onClick={() => act(sel, 'approve', { category: sel.category || apprCat })}>Approve</Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {sel.status === 'pending' && <Button variant="danger" icon={X} onClick={() => act(sel, 'reject')}>Reject</Button>}
              {['approved', 'unsold'].includes(sel.status) && <Button variant="secondary" icon={Pause} onClick={() => act(sel, 'hold')}>Hold</Button>}
              {sel.status === 'hold' && <Button variant="secondary" icon={Play} onClick={() => act(sel, 'release')}>Release</Button>}
              <Button variant="secondary" icon={Pencil} onClick={() => edit(sel)}>Edit</Button>
            </div>
            {!sel.teamId && ['pending', 'draft', 'approved', 'hold', 'unsold'].includes(sel.status) && (
              confirmW
                ? <div className="grid gap-2 rounded-xl border border-danger/40 p-3"><p className="text-sm">Withdraw {sel.name} from the tournament?</p>
                  <div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setConfirmW(false)}>Cancel</Button><Button variant="danger" onClick={() => act(sel, 'withdraw')}>Withdraw</Button></div></div>
                : <Button variant="ghost" className="!text-danger" icon={UserMinus} onClick={() => setConfirmW(true)}>Withdraw player</Button>
            )}
          </div>
        )}
      </Sheet>

      {/* add / edit sheet */}
      <Sheet open={!!form} onClose={() => setForm(null)} title={form?._id ? `Edit ${form.name}` : 'Add player'}>
        {form && (
          <form onSubmit={save} className="grid gap-3">
            <Msg {...msg} />
            <div className="flex items-center gap-3 rounded-xl bg-surface2/60 p-3">
              <Avatar src={form.photo} name={form.name} size={64} />
              <div className="grid flex-1 grid-cols-2 gap-2">
                <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold"><Camera size={16} aria-hidden />Camera
                  <input type="file" accept="image/*" capture="user" hidden onChange={formPhoto} /></label>
                <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold"><ImagePlus size={16} aria-hidden />Gallery
                  <input type="file" accept="image/*" hidden onChange={formPhoto} /></label>
              </div>
            </div>
            <Field label="Name"><input required value={form.name} onChange={fset('name')} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Position"><select value={form.position} onChange={fset('position')}>{POSITIONS.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Secondary"><select value={form.position2} onChange={fset('position2')}><option value="">—</option>{POSITIONS.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Category"><select required value={form.category} onChange={fset('category')}><option value="">—</option>{cats.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.price})</option>)}</select></Field>
              <Field label="Base price" hint="Blank = category price"><input type="number" inputMode="numeric" min="0" value={form.basePrice} onChange={fset('basePrice')} /></Field>
            </div>
            <Field label="Phone"><input type="tel" value={form.phone} onChange={fset('phone')} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={fset('email')} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Employee ID"><input value={form.employeeId} onChange={fset('employeeId')} /></Field>
              <Field label="Department"><input value={form.department} onChange={fset('department')} /></Field>
            </div>
            {after && form._id && <Field label="Reason for change (required, audited)"><input required value={form.reason} onChange={fset('reason')} /></Field>}
            <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-line bg-surface px-4 pb-1 pt-3">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button>Save</Button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}

/** Bulk photo tool: pick many image files named like the players, review matches, upload + PATCH each. */
function BulkPhotos({ tid, onClose, onDone, patch }) {
  const { data } = useApi(`/api/t/${tid}/players?all=1`);
  const all = data?.players || [];
  const [rows, setRows] = useState([]); // {id, file, url, playerId, score, state: ''|'up'|'ok'|'err', err}
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);

  const choose = (e) => {
    const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    const m = matchPhotos(files.map((f) => f.name), all);
    setRows(files.map((file, i) => ({ id: `${i}-${file.name}`, file, url: URL.createObjectURL(file), playerId: m[i].playerId, score: m[i].score, state: '' })));
    setDone(0);
  };
  const setRow = (id, o) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...o } : r)));
  const matched = rows.filter((r) => r.playerId);
  const upload = async () => {
    setRunning(true); setDone(0);
    let n = 0;
    for (const r of matched) {
      if (r.state === 'ok') { n++; continue; }
      setRow(r.id, { state: 'up', err: '' });
      try {
        const photo = await uploadImage(r.file);
        await patch(r.playerId, { photo, reason: PHOTO_REASON });
        setRow(r.id, { state: 'ok' });
      } catch (e) { setRow(r.id, { state: 'err', err: e.message }); }
      setDone(++n);
    }
    setRunning(false); onDone();
  };
  const nameOf = (id) => all.find((p) => p._id === id)?.name;
  const used = new Set(rows.map((r) => r.playerId).filter(Boolean));
  const okCount = rows.filter((r) => r.state === 'ok').length;

  return (
    <Card title="Bulk photos" right={<Button variant="ghost" size="md" icon={X} onClick={onClose} aria-label="Close bulk photos">Close</Button>}>
      <p className="mb-3 text-sm text-muted">Select many images named after the player (e.g. <b>Rupok Das.jpg</b>). Names are matched automatically; fix any mismatch before uploading.</p>
      <label className="flex min-h-[56px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface2/40 text-sm font-semibold">
        <ImagePlus size={18} aria-hidden />{rows.length ? 'Choose different files' : 'Choose photos'}
        <input type="file" accept="image/*" multiple hidden onChange={choose} disabled={running || !data} />
      </label>
      {rows.length > 0 && (
        <>
          <p className="mt-3 text-sm"><Badge color="green">{matched.length} matched</Badge> <Badge color={rows.length - matched.length ? 'amber' : 'neutral'}>{rows.length - matched.length} unmatched</Badge> <span className="text-muted">Unmatched files are skipped.</span></p>
          <ul className="mt-2 grid gap-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border border-line p-2">
                <img src={r.url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover object-top" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted">{r.file.name}</p>
                  <select aria-label={`Player for ${r.file.name}`} disabled={running || r.state === 'ok'} value={r.playerId || ''} className="!min-h-[40px] !py-1 text-sm"
                    onChange={(e) => setRow(r.id, { playerId: e.target.value || null, state: '' })}>
                    <option value="">— skip (unmatched) —</option>
                    {all.map((p) => <option key={p._id} value={p._id} disabled={used.has(p._id) && r.playerId !== p._id}>{p.name}</option>)}
                  </select>
                  {r.state === 'err' && <p role="alert" className="mt-0.5 text-xs text-danger">{r.err}</p>}
                </div>
                <span className="w-6 shrink-0 text-center" aria-label={r.state || (r.playerId ? 'matched' : 'unmatched')}>
                  {r.state === 'up' ? <Loader2 size={18} className="animate-spin text-primary" aria-hidden />
                    : r.state === 'ok' ? <Check size={18} className="text-success" aria-hidden />
                      : r.state === 'err' || !r.playerId ? <X size={18} className={r.state === 'err' ? 'text-danger' : 'text-warning'} aria-hidden />
                        : <Check size={18} className="text-muted" aria-hidden />}
                </span>
              </li>
            ))}
          </ul>
          {(running || okCount > 0) && (
            <div className="mt-3" role="status">
              <div className="h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full bg-primary transition-all" style={{ width: `${matched.length ? (done / matched.length) * 100 : 0}%` }} /></div>
              <p className="mt-1 text-xs text-muted tabular-nums">{done} / {matched.length} processed · {okCount} saved</p>
            </div>
          )}
          <Button className="mt-3 w-full" icon={Upload} disabled={running || !matched.length || okCount === matched.length} onClick={upload}>
            {running ? 'Uploading…' : `Upload ${matched.length - okCount} photo${matched.length - okCount === 1 ? '' : 's'}`}
          </Button>
          {matched.length > 0 && <p className="mt-2 text-xs text-muted">Matched players: {matched.slice(0, 3).map((r) => nameOf(r.playerId)).join(', ')}{matched.length > 3 ? '…' : ''}</p>}
        </>
      )}
    </Card>
  );
}
