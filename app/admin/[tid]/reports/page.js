'use client';
import { use, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useApi, downloadCsv } from '@/lib/client';
import { Button, Card, Field, Loading, PageHeader, Table } from '@/components/ui';

const NAMES = ['registration', 'categories', 'teams', 'sales', 'unsold', 'budgets', 'squads', 'fixtures', 'results', 'standings', 'performance', 'team-performance', 'summary', 'audit'];

export default function Reports({ params }) {
  const { tid } = use(params);
  const [name, setName] = useState('registration');
  const { data, error, reload } = useApi(`/api/t/${tid}/reports/${name}`);
  const rows = data?.rows || [];
  const keys = [...new Set(rows.flatMap((x) => Object.keys(x)))];
  return (
    <>
      <PageHeader title="Reports" subtitle="Choose a report, review the data, then export or print" />
      <div className="noprint grid grid-cols-2 items-end gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex sm:flex-wrap">
        <Field label="Report" className="col-span-2 min-w-0 flex-1 sm:min-w-[200px] sm:max-w-xs">
          <select value={name} onChange={(e) => setName(e.target.value)}>{NAMES.map((n) => <option key={n} value={n}>{n.replace('-', ' ')}</option>)}</select>
        </Field>
        <Button icon={Download} disabled={!rows.length} onClick={() => downloadCsv(`${name}.csv`, rows)}>CSV</Button>
        <Button variant="secondary" icon={Printer} disabled={!data || !!error} onClick={() => window.print()}>Print</Button>
      </div>
      {error && <div role="alert" className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger"><span className="min-w-0 break-words">{error}</span><Button variant="secondary" onClick={reload}>Retry</Button></div>}
      {!error && !data && <div className="mt-3"><Loading /></div>}
      {data && (
        <Card title={data.title} className="card" right={<span className="text-sm text-muted">{rows.length} rows</span>}>
          <p className="noprint mb-3 text-xs text-muted md:hidden">Swipe horizontally to see all report columns.</p>
          <Table mobile="scroll" rows={rows} cols={keys.map((k) => ({ key: k, label: k }))} empty="No data for this report." />
        </Card>
      )}
    </>
  );
}
