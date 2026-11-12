'use client';
import { use, useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { call, useApi } from '@/lib/client';
import { Button, Card, Empty, Field, Loading, Msg, PageHeader, useFlash, dt } from '@/components/ui';

export default function Announcements({ params }) {
  const { tid } = use(params);
  const { data, error, reload } = useApi(`/api/t/${tid}/announcements`);
  const [f, setF] = useState({ title: '', text: '' });
  const [msg, flash] = useFlash();
  const send = async (e) => {
    e.preventDefault();
    const r = await flash(() => call(`/api/t/${tid}/announcements`, f), 'Announcement sent');
    if (r) { setF({ title: '', text: '' }); reload(); }
  };
  const list = data?.announcements || [];
  return (
    <>
      <PageHeader title="Announcements" subtitle="Sent to every participant and shown on the home page" />
      <Card title="New announcement">
        <form onSubmit={send} className="grid gap-3">
          <Field label="Title"><input required maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Message" hint={`${f.text.length}/2000`}><textarea rows={4} maxLength={2000} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></Field>
          <Button icon={Send} className="w-full sm:w-auto sm:justify-self-start">Send to everyone</Button>
          <Msg {...msg} />
        </form>
      </Card>
      <Card title={`Sent announcements (${list.length})`}>
        {error && <div role="alert" className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger"><span className="min-w-0 break-words">{error}</span><Button variant="secondary" onClick={reload}>Retry</Button></div>}
        {!data ? error ? <Empty>Could not load announcements.</Empty> : <Loading /> : !list.length ? <Empty>No announcements yet.</Empty> : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {list.map((a) => (
              <li key={a._id} className="flex gap-3 rounded-xl border border-line bg-surface2/40 p-3">
                <Megaphone size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <div className="min-w-0"><div className="break-words font-semibold">{a.title}</div>
                  <p className="m-0 whitespace-pre-wrap break-words text-sm">{a.text}</p>
                  <div className="mt-1 text-xs text-muted">{dt(a.at)}</div></div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
