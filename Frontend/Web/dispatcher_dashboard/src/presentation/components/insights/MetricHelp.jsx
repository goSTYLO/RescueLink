import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/presentation/components/ui/Dialog';
import { Button } from '@/presentation/components/ui/Button';

export const METRIC_HELP = {
  incidents: 'Unique incidents (report IDs) created in this date range. Percent change compares the previous period of the same length. Sparkline is daily or weekly volume from this snapshot. City-wide hint shows volunteer-accepted share (primary acceptor on the report).',
  critical: 'Incidents whose severity is high or critical. Percent change is versus the previous period.',
  first_action: 'Created time to the earliest of first dispatch, volunteer accepted_at, first escalation, or first coordination note. The card shows the median (p50). Hint shows p90 and p95. n is how many incidents have a first-action timestamp. Null clocks are excluded.',
  dispatch: 'Created time to first dispatch. When a department is selected, only that department’s dispatches count. Card shows p50; hint shows p90/p95 and n. Null clocks excluded.',
  arrival: 'Created time to first On Scene stamp (status history or actual_arrival_at). Same clock as end-to-end arrival — shown once. p50 on the card; p90/p95 and n in the hint.',
  resolve: 'Created time to resolved_at, or closed_at if never marked resolved. p50 on the card; p90/p95 and n in the hint. Null clocks excluded.',
  dispatch_sla: 'Share of dispatched incidents whose dispatch clock is 8 minutes or less. Internal RescueLink target, not NFPA. Denominator is incidents with a dispatch clock (n).',
  arrival_sla: 'Share of on-scene incidents whose arrival clock (created → On Scene) is 10 minutes or less. Internal RescueLink target, not NFPA. Denominator is incidents with an arrival clock (n).',
  unserved: 'Share of incidents with no dispatch, no escalation, and no volunteer accepted_at. Stricter than unassigned (which ignores volunteer accept).',
  overdue: 'Share of incidents still open at the end of the range whose created time is more than 30 minutes before that end. Open means no resolved_at or closed_at at or before range end.',
  duplicate_rate: 'Share of unique incidents in the range flagged is_duplicate.',
  response_matrix: 'Medians (p50), p90, and p95 for first action, dispatch, arrival, and resolution, overall and by severity. n is omitted in cells; null clocks are excluded from percentiles.',
  volume: 'Incident volume by day (ranges up to 90 days) or week. Overlay is the previous period of the same length.',
  peak_demand: 'Busiest weekday and peak hour band come from the weekday×hour heatmap (Asia/Manila). Peak volume is the hottest heatmap cell. Max concurrent is the highest number of still-open incidents in any hour (or day if the range is over 90 days).',
  demand_types: 'Unique incidents grouped by incident type. Click a bar to filter this page.',
  barangay_map: 'Choropleth of Dagupan barangays (NAME_3) colored by incident count. Tooltip and table show top incident types per barangay (not count alone). Click a polygon to set the barangay filter.',
  type_barangay: 'Top 10 type × barangay combinations in this range — what came in, and from where.',
  channels: 'Reporting channel: SOS type, voice (audio path, not SOS), and remaining text. Approximate, from stored fields.',
  exceptions: 'Incidents with a recorded dispatch exception: team reassignment (audit or extra team), auto-assign mismatch, backup requested, or declined escalation. Only those events exist. Categories are shown without overlap (first match wins).',
  escalation_funnel: 'Unique incidents that had an escalation, then accepted, then a dispatch to the target department after the escalation, then arrival. Rates are percent of escalated incidents. Processing time is p50 of escalation created_at to responded_at for accepted or declined.',
  utilization: 'Units recorded on incidents in this range (incident_unit_usage rows) and dispatch row count. Available/total units is a live snapshot when a department is selected — not historical. Deployment duration is not available (no release time).',
  outcomes: 'Resolved / Closed / Cancelled / Duplicate / Unable to respond / Other, from status, closure_method, and is_duplicate. Unknown methods go to Other.',
  department_clocks: 'City-wide only. Per department: p50 dispatch, p50 arrival, and n. Primary is the first dispatch’s department; supporting is a later dispatch or escalation-only. Volunteers row uses accept time as the dispatch analog and on-scene for arrival; it is not an NFPA department. The department chart may double-count multi-department incidents; unique KPI totals do not.',
  heatmap: 'Incident created_at by weekday and hour in Asia/Manila.',
  incidents_table: 'Filtered incident list for this snapshot. Click a row to open the incident. Print includes this page only; CSV is the full filtered set (PII-safe).',
};

export function MetricHelp({ metricId }) {
  const [open, setOpen] = useState(false);
  const body = METRIC_HELP[metricId] || 'No definition for this metric.';

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="metric-help print:hidden inline-flex items-center justify-center min-h-11 min-w-11 rounded-md text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label="What this metric means"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <HelpCircle className="w-4 h-4" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen} className="metric-help-dialog max-w-lg">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What this metric means</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-foreground leading-relaxed whitespace-normal break-words">{body}</p>
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
