'use client';
// "Summary and completion": one line of totals, what is still missing, and a guarded Complete button.
// Per-team budget/squad detail lives in the Teams strip above, so it is not repeated here.
import { useState } from 'react';
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button, Card, Field, money } from '@/components/ui';

export default function Summary({ data, error, retry, d, lotOpen, onComplete }) {
  const [exception, setException] = useState('');
  if (!data) {
    return (
      <Card title="Summary and completion">
        {error ? <div role="alert" className="text-sm text-danger"><p className="mb-2">{error}</p><Button variant="secondary" onClick={retry}>Retry summary</Button></div> : <p className="m-0 text-muted">Loading...</p>}
      </Card>
    );
  }
  const incomplete = data.teams.filter((t) => t.problems.length);
  const allDone = !incomplete.length;
  const completed = d.status === 'completed';
  const needsReason = !allDone && exception.trim().length < 3;

  return (
    <Card title="Summary and completion" right={completed ? <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">Completed</span> : null}>
      <p className="m-0 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <span>Sold <b className="tabular-nums text-fg">{d.progress.sold}/{d.progress.total}</b></span>
        <span>Total spend <b className="tabular-nums text-fg">{money(data.totalSpend)}</b></span>
        <span>Unassigned <b className={data.unassigned.length ? 'tabular-nums text-warning' : 'tabular-nums text-fg'}>{data.unassigned.length}</b></span>
      </p>

      {completed ? (
        <p className="m-0 mt-3 flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm text-success"><ShieldCheck size={18} aria-hidden />Auction completed{d.completion?.exception ? ` with exception: ${d.completion.exception}` : ''}.</p>
      ) : allDone ? (
        <p className="m-0 mt-3 flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm text-success"><CheckCircle2 size={18} aria-hidden />Every squad is complete.</p>
      ) : (
        <ul className="m-0 mt-3 grid list-none gap-1 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
          {incomplete.map((t) => (
            <li key={t._id} className="flex flex-wrap gap-x-2 text-warning"><AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden /><b>{t.name}</b><span className="opacity-90">{t.problems.join(' · ')}</span></li>
          ))}
        </ul>
      )}

      {!completed && (
        <div className="mt-3 grid gap-3">
          {!allDone && <Field label="Reason for completing with incomplete squads" hint="Required. Saved in the audit log."><input value={exception} onChange={(e) => setException(e.target.value)} placeholder="e.g. Not enough players registered" /></Field>}
          {lotOpen && <p className="m-0 text-sm text-muted">Close or cancel the open lot first.</p>}
          <Button size="lg" variant={allDone ? 'success' : 'danger'} icon={allDone ? CheckCircle2 : AlertTriangle} disabled={lotOpen || needsReason} onClick={() => onComplete(allDone ? '' : exception)}>
            {allDone ? 'Complete auction' : 'Complete with exception'}
          </Button>
        </div>
      )}
    </Card>
  );
}
