import { useEffect, useRef, useState } from 'react';
import { prepareReportFile, reportMoney, reportMonth, type BusinessReport, type ReportFormat, type ReportSource } from './reportData';

type Prepared = Awaited<ReturnType<typeof prepareReportFile>> & { url: string };
export default function ReportExportPreview({ report, format, source, onClose }: {
  report: BusinessReport; format: ReportFormat; source: ReportSource; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ kind: 'loading' | 'ready' | 'error'; file: Prepared | null; error: string }>({ kind: 'loading', file: null, error: '' });
  const [downloadRequested, setDownloadRequested] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    node?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => node?.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let url = '';
    async function prepare() {
      setState({ kind: 'loading', file: null, error: '' });
      try {
        const file = await prepareReportFile(await source.export({ reportId: report.id, month: report.month, format, signal: controller.signal }), format);
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(file.blob);
        setState({ kind: 'ready', file: { ...file, url }, error: '' });
      } catch (cause) {
        if (!controller.signal.aborted) setState({ kind: 'error', file: null,
          error: cause instanceof Error ? cause.message : 'Could not prepare this report. Please try again.' });
      }
    }
    void prepare();
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [source, report.id, report.month, format, attempt]);
  function close() { dialog.current?.close(); onClose(); }
  return <dialog ref={dialog} className="fcr-export-dialog" aria-labelledby="fcr-export-title" onCancel={event => { event.preventDefault(); close(); }}>
    <header className="fcr-dialog-heading"><div><h2 id="fcr-export-title">Report export preview</h2><p>{reportMonth(report.month)} · Business · {report.currency} · {format.toUpperCase()}</p></div><button type="button" className="fcr-close" aria-label="Close report preview" onClick={close}>×</button></header>
    {state.kind === 'loading' && <div className="fcr-file-state" role="status"><h3>Preparing your report…</h3><p>Fetching the original {format.toUpperCase()} file.</p></div>}
    {state.kind === 'error' && <div className="fcr-file-state" role="alert"><h3>Couldn’t prepare the report</h3><p>{state.error}</p><button type="button" className="fcr-primary" onClick={() => setAttempt(value => value + 1)}>Retry export</button></div>}
    {state.file && <><p className="fcr-file-name">{state.file.filename} · {new Intl.NumberFormat('en-CA', { maximumFractionDigits: 1 }).format(state.file.blob.size / 1024)} KB</p>
      <p>Review the report before downloading. The download contains the original file.</p>
      <div className="fcr-report-preview">
        <dl className="fcr-export-totals"><div><dt>Money in</dt><dd>{reportMoney(report.moneyInCents, report.currency)}</dd></div><div><dt>Money out</dt><dd>{reportMoney(report.moneyOutCents, report.currency)}</dd></div><div><dt>Net cash flow</dt><dd>{reportMoney(report.netCashFlowCents, report.currency)}</dd></div></dl>
        {report.categories.length > 0 && <ul className="fcr-export-categories">{report.categories.map((category, index) => <li key={`${category.name}-${index}`}><strong>{category.name}</strong><span>{reportMoney(category.amountCents, report.currency)}</span></li>)}</ul>}
        {format === 'csv' ? <><details><summary>View CSV contents</summary><pre tabIndex={0} aria-label="CSV report preview">{state.file.previewText}</pre></details>{state.file.previewTruncated && <p>Showing the first 200 KB of the CSV contents. Download the original for the complete report.</p>}</>
          : <p className="fcr-pdf-preview">This is the report summary. <a href={state.file.url} target="_blank" rel="noopener noreferrer">Open original PDF</a> to review the document’s full layout before sharing.</p>}
      </div>
      <div className="fcr-dialog-actions"><button type="button" onClick={close}>Close preview</button><a className="fcr-primary" href={state.file.url} download={state.file.filename} onClick={() => setDownloadRequested(true)}>Download {format.toUpperCase()}</a></div>
      {downloadRequested && <p className="fcr-download-status" role="status">Download requested. You can use the download link again if needed.</p>}
    </>}
    {state.kind !== 'ready' && <button type="button" onClick={close}>Cancel</button>}
  </dialog>;
}
