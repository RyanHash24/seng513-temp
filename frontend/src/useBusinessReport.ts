import { useCallback, useEffect, useState } from 'react';
import { validateBusinessReport, type BusinessReport, type ReportSource } from './reportData';

type Result = { source: ReportSource | null; month: string; kind: 'loading' | 'ready' | 'empty' | 'error'; report: BusinessReport | null; error: string };
export function useBusinessReport(source: ReportSource | null, month: string) {
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  const [result, setResult] = useState<Result>({ source: null, month: '', kind: 'loading', report: null, error: '' });
  useEffect(() => {
    if (!source) return;
    const controller = new AbortController();
    async function load() {
      setResult({ source, month, kind: 'loading', report: null, error: '' });
      try {
        const report = validateBusinessReport(await source!.load({ month, signal: controller.signal }), month);
        if (!controller.signal.aborted) setResult({ source, month, kind: report ? 'ready' : 'empty', report, error: '' });
      } catch (cause) {
        if (!controller.signal.aborted) setResult({ source, month, kind: 'error', report: null,
          error: cause instanceof Error ? cause.message : 'Unable to load this month’s report. Please try again.' });
      }
    }
    void load();
    return () => controller.abort();
  }, [source, month, revision]);
  if (!source) return { kind: 'unavailable' as const, report: null, error: '', reload };
  return result.source === source && result.month === month ? { ...result, reload }
    : { kind: 'loading' as const, report: null, error: '', reload };
}
