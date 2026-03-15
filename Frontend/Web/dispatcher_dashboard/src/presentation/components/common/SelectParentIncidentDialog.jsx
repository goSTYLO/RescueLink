/**
 * Reusable dialog to browse and select an incident as parent (e.g. when linking as duplicate).
 * Includes search, filters, and pagination - a mini version of the dashboard.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/presentation/components/ui/Dialog';
import { Button } from '@/presentation/components/ui/Button';
import { Badge } from '@/presentation/components/ui/Badge';
import { Input } from '@/presentation/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Search, ChevronLeft, ChevronRight, Merge, Loader2, LayoutList } from 'lucide-react';
import { getIncidents } from '@/data/api/incidents.api';
import { mapApiIncidentToDisplay } from '@/core/utils/incidentDisplay';
import { mapIncidentTypeFilterToApi } from '@/core/utils/incidentClassification';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { barangays } from '@/data/mock/mockData';

function mapStatusFilterToApi(value) {
  if (value === 'Pending') return 'pending';
  if (value === 'Verified') return 'verified';
  if (value === 'In Progress') return 'in_progress';
  if (value === 'Resolved') return 'resolved';
  if (value === 'Closed') return 'closed';
  return undefined;
}

function mapSeverityFilterToApi(value) {
  if (value === 'Critical') return 'high';
  if (value === 'Warning') return 'medium';
  if (value === 'Low') return 'low';
  return undefined;
}

const TYPE_OPTIONS = [
  { value: 'All', label: 'All Types' },
  { value: 'Fire', label: 'Fire' },
  { value: 'Medical', label: 'Medical' },
  { value: 'Police', label: 'Police' },
  { value: 'Disaster', label: 'Disaster' },
  { value: 'Other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'All', label: 'All Status' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Verified', label: 'Verified' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Closed', label: 'Closed' },
];

const SEVERITY_OPTIONS = [
  { value: 'All', label: 'All Severity' },
  { value: 'Critical', label: 'Critical' },
  { value: 'Warning', label: 'Warning' },
  { value: 'Low', label: 'Low' },
];

export function SelectParentIncidentDialog({
  open,
  onOpenChange,
  currentIncidentId,
  onSelect,
  loading: linkLoading = false,
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [incidents, setIncidents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterBarangay, setFilterBarangay] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);
  const [selectOpen, setSelectOpen] = useState({ type: false, status: false, severity: false, barangay: false });

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const apiType = mapIncidentTypeFilterToApi(filterType);
      const apiStatus = mapStatusFilterToApi(filterStatus);
      const apiSeverity = mapSeverityFilterToApi(filterSeverity);
      const apiBarangay = filterBarangay !== 'All' ? filterBarangay : undefined;
      const offset = (page - 1) * pageSize;
      const result = await getIncidents({
        limit: pageSize,
        offset,
        status: apiStatus,
        severity_level: apiSeverity,
        incident_type: apiType,
        barangay: apiBarangay,
        search: searchDebounced || undefined,
        exclude_duplicates: false,
        exclude_report_id: currentIncidentId ?? undefined,
        withMeta: true,
      });
      const items = Array.isArray(result?.items) ? result.items : [];
      setIncidents(items.map(mapApiIncidentToDisplay));
      setTotalCount(Number(result?.totalCount ?? 0));
    } catch {
      setIncidents([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterType, filterStatus, filterSeverity, filterBarangay, searchDebounced, currentIncidentId]);

  useEffect(() => {
    if (open) {
      setPage(1);
      fetchIncidents();
    }
  }, [open, fetchIncidents]);

  const filteredIncidents = incidents;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const panelClass = isLight ? 'bg-gray-50/80 border-gray-200/80' : 'bg-white/5 border-white/10';
  const borderClass = isLight ? 'border-gray-200/80' : 'border-white/10';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutList className="w-5 h-5" />
            Select parent incident
          </DialogTitle>
          <DialogDescription>
            Browse incidents to link this report as a duplicate. Use search and filters to find the related incident.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <Input
              placeholder="Search by report ID, description, or barangay..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl border ${borderClass} ${panelClass}`}>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Type</label>
              <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }} open={selectOpen.type} onOpenChange={(o) => setSelectOpen((s) => ({ ...s, type: o }))}>
                {({ value, dropdownRect }) => (
                  <>
                    <SelectTrigger isOpen={selectOpen.type} onClick={() => setSelectOpen((s) => ({ ...s, type: !s.type }))} className="h-8 text-sm">
                      <SelectValue value={value} options={TYPE_OPTIONS} placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent isOpen={selectOpen.type} dropdownRect={dropdownRect}>
                      {TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} onSelect={(v) => { setFilterType(v); setPage(1); setSelectOpen((s) => ({ ...s, type: false })); }}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </>
                )}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Status</label>
              <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }} open={selectOpen.status} onOpenChange={(o) => setSelectOpen((s) => ({ ...s, status: o }))}>
                {({ value, dropdownRect }) => (
                  <>
                    <SelectTrigger isOpen={selectOpen.status} onClick={() => setSelectOpen((s) => ({ ...s, status: !s.status }))} className="h-8 text-sm">
                      <SelectValue value={value} options={STATUS_OPTIONS} placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent isOpen={selectOpen.status} dropdownRect={dropdownRect}>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} onSelect={(v) => { setFilterStatus(v); setPage(1); setSelectOpen((s) => ({ ...s, status: false })); }}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </>
                )}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Severity</label>
              <Select value={filterSeverity} onValueChange={(v) => { setFilterSeverity(v); setPage(1); }} open={selectOpen.severity} onOpenChange={(o) => setSelectOpen((s) => ({ ...s, severity: o }))}>
                {({ value, dropdownRect }) => (
                  <>
                    <SelectTrigger isOpen={selectOpen.severity} onClick={() => setSelectOpen((s) => ({ ...s, severity: !s.severity }))} className="h-8 text-sm">
                      <SelectValue value={value} options={SEVERITY_OPTIONS} placeholder="All Severity" />
                    </SelectTrigger>
                    <SelectContent isOpen={selectOpen.severity} dropdownRect={dropdownRect}>
                      {SEVERITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} onSelect={(v) => { setFilterSeverity(v); setPage(1); setSelectOpen((s) => ({ ...s, severity: false })); }}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </>
                )}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Barangay</label>
              <Select value={filterBarangay} onValueChange={(v) => { setFilterBarangay(v); setPage(1); }} open={selectOpen.barangay} onOpenChange={(o) => setSelectOpen((s) => ({ ...s, barangay: o }))}>
                {({ value, dropdownRect }) => (
                  <>
                    <SelectTrigger isOpen={selectOpen.barangay} onClick={() => setSelectOpen((s) => ({ ...s, barangay: !s.barangay }))} className="h-8 text-sm">
                      <SelectValue value={value} options={[{ value: 'All', label: 'All Barangays' }, ...barangays.map((b) => ({ value: b, label: b }))]} placeholder="All Barangays" />
                    </SelectTrigger>
                    <SelectContent isOpen={selectOpen.barangay} dropdownRect={dropdownRect}>
                      <SelectItem value="All" onSelect={(v) => { setFilterBarangay(v); setPage(1); setSelectOpen((s) => ({ ...s, barangay: false })); }}>All Barangays</SelectItem>
                      {barangays.map((b) => (
                        <SelectItem key={b} value={b} onSelect={(v) => { setFilterBarangay(v); setPage(1); setSelectOpen((s) => ({ ...s, barangay: false })); }}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </>
                )}
              </Select>
            </div>
          </div>

          {/* Results */}
          <div className={`flex-1 min-h-0 overflow-y-auto rounded-xl border ${borderClass} ${panelClass}`}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted" />
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="py-12 text-center text-muted">
                <p>No incidents found. Try adjusting filters or search.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className={`flex items-center justify-between gap-4 p-3 hover:bg-white/5 transition-colors ${borderClass}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/incidents/${inc.id}`}
                          className="font-medium text-primary hover:underline"
                          onClick={() => onOpenChange?.(false)}
                        >
                          Report #{inc.id}
                        </Link>
                        <Badge variant="outline" className="text-xs">{inc.emergencyType}</Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            inc.severity === 'Critical' ? 'border-red-500/50 text-red-600' :
                            inc.severity === 'Warning' ? 'border-amber-500/50 text-amber-600' :
                            'border-green-500/50 text-green-600'
                          }`}
                        >
                          {inc.severity}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{inc.status}</Badge>
                      </div>
                      <p className="text-sm text-muted mt-0.5">{inc.barangay} · {inc.reporterName}</p>
                      <p className="text-xs text-muted mt-0.5">{inc.timeReported}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 shrink-0"
                      disabled={linkLoading}
                      onClick={() => onSelect(inc.id)}
                    >
                      {linkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Merge className="w-3 h-3" />}
                      Link as duplicate
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
              <p className="text-sm text-muted">
                Page {page} of {totalPages} · {totalCount} total
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
