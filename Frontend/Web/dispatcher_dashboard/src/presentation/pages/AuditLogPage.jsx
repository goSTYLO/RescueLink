import { Layout } from '@/presentation/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/Card';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Blocks, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { auditLogs } from '@/data/mock/mockData';
import { useState, useEffect } from 'react';

const ROWS_PER_PAGE = 5;

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts.replace(' ', 'T'));
  return d.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function truncateHash(hash) {
  if (!hash || hash.length <= 14) return hash;
  return `${hash.slice(0, 10)}...`;
}

export function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [filterVerification, setFilterVerification] = useState('Verified');
  const [filterBarangay, setFilterBarangay] = useState('All Barangays');
  const [filterSeverity, setFilterSeverity] = useState('All Severity');
  const [selectStates, setSelectStates] = useState({ verification: false, barangay: false, severity: false });
  const [currentPage, setCurrentPage] = useState(1);

  const filteredLogs = auditLogs.filter((log) => {
    const matchSearch =
      !search ||
      (log.incidentId && log.incidentId.toLowerCase().includes(search.toLowerCase())) ||
      log.incidentHash?.toLowerCase().includes(search.toLowerCase()) ||
      log.department?.toLowerCase().includes(search.toLowerCase()) ||
      log.barangay?.toLowerCase().includes(search.toLowerCase());
    const matchVerification =
      filterVerification === 'All' || log.verificationStatus === filterVerification;
    const matchBarangay = filterBarangay === 'All Barangays' || log.barangay === filterBarangay;
    const matchSeverity = filterSeverity === 'All Severity' || log.severity === filterSeverity;
    return matchSearch && matchVerification && matchBarangay && matchSeverity;
  });

  const totalPages = Math.ceil(filteredLogs.length / ROWS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + ROWS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterVerification, filterBarangay, filterSeverity]);

  const verifiedCount = filteredLogs.filter((l) => l.verificationStatus === 'Verified').length;
  const criticalCount = filteredLogs.filter((l) => l.severity === 'Critical').length;
  const resolvedCount = filteredLogs.filter((l) => l.severity === 'Resolved').length;

  const verificationOptions = [
    { value: 'All', label: 'All' },
    { value: 'Verified', label: 'Verified' },
    { value: 'Pending', label: 'Pending' },
  ];
  const barangayOptions = [
    { value: 'All Barangays', label: 'All Barangays' },
    ...[...new Set(auditLogs.map((l) => l.barangay))].filter(Boolean).map((b) => ({ value: b, label: b })),
  ];
  const severityOptions = [
    { value: 'All Severity', label: 'All Severity' },
    { value: 'Critical', label: 'Critical' },
    { value: 'Warning', label: 'Warning' },
    { value: 'Resolved', label: 'Resolved' },
  ];

  // Severity: Critical #FF4F52, Warning amber, Resolved muted green (dark theme)
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return 'bg-primary/20 text-primary border-primary/50';
      case 'Warning': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Resolved': return 'bg-severity-resolved/20 text-severity-resolved border-emerald-500/40';
      default: return 'bg-card text-muted border-[rgba(19,65,120,0.35)]';
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-foreground">Audit Log / Blockchain Records</h1>
          <p className="text-muted mt-1">Immutable incident verification records</p>
        </div>

        {/* Blockchain-Backed Audit Trail — static info card */}
        <Card hover={false} className="mb-6 bg-secondary/20 border-[rgba(19,65,120,0.35)]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary/30 flex items-center justify-center">
                <Blocks className="w-6 h-6 text-secondary-light" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Blockchain-Backed Audit Trail</p>
                <p className="text-sm text-muted mt-1">
                  All incident verifications are recorded in an immutable blockchain ledger for
                  non-repudiation and transparency.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card hover={false} className="border border-[rgba(19,65,120,0.35)]">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted">Total Records</p>
              <p className="text-2xl font-bold text-foreground mt-1">{filteredLogs.length}</p>
            </CardContent>
          </Card>
          <Card hover={false} className="border border-[rgba(19,65,120,0.35)]">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted">Verified</p>
              <p className="text-2xl font-bold text-severity-resolved mt-1">{verifiedCount}</p>
            </CardContent>
          </Card>
          <Card hover={false} className="border border-[rgba(19,65,120,0.35)]">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted">Critical Incidents</p>
              <p className="text-2xl font-bold text-primary mt-1">{criticalCount}</p>
            </CardContent>
          </Card>
          <Card hover={false} className="border border-[rgba(19,65,120,0.35)]">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted">Resolved</p>
              <p className="text-2xl font-bold text-foreground mt-1">{resolvedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
              <Input
                placeholder="Search by Incident ID, department, or barangay."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2 text-muted">
              <Filter className="w-5 h-5" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <Select value={filterVerification} onValueChange={setFilterVerification}>
              {({ value }) => (
                <>
                  <SelectTrigger
                    isOpen={selectStates.verification}
                    onClick={() =>
                      setSelectStates((s) => ({ ...s, verification: !s.verification }))
                    }
                    className="min-w-[140px]"
                  >
                    <SelectValue
                      placeholder="Verification Status"
                      value={value}
                      options={verificationOptions}
                    />
                  </SelectTrigger>
                  <SelectContent isOpen={selectStates.verification}>
                    {verificationOptions.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        onSelect={(v) => {
                          setFilterVerification(v);
                          setSelectStates((s) => ({ ...s, verification: false }));
                        }}
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </>
              )}
            </Select>
            <Select value={filterBarangay} onValueChange={setFilterBarangay}>
              {({ value }) => (
                <>
                  <SelectTrigger
                    isOpen={selectStates.barangay}
                    onClick={() =>
                      setSelectStates((s) => ({ ...s, barangay: !s.barangay }))
                    }
                    className="min-w-[140px]"
                  >
                    <SelectValue placeholder="Barangay" value={value} options={barangayOptions} />
                  </SelectTrigger>
                  <SelectContent isOpen={selectStates.barangay} className="max-h-[240px]">
                    {barangayOptions.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        onSelect={(v) => {
                          setFilterBarangay(v);
                          setSelectStates((s) => ({ ...s, barangay: false }));
                        }}
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </>
              )}
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              {({ value }) => (
                <>
                  <SelectTrigger
                    isOpen={selectStates.severity}
                    onClick={() =>
                      setSelectStates((s) => ({ ...s, severity: !s.severity }))
                    }
                    className="min-w-[120px]"
                  >
                    <SelectValue placeholder="Severity" value={value} options={severityOptions} />
                  </SelectTrigger>
                  <SelectContent isOpen={selectStates.severity}>
                    {severityOptions.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        onSelect={(v) => {
                          setFilterSeverity(v);
                          setSelectStates((s) => ({ ...s, severity: false }));
                        }}
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </>
              )}
            </Select>
          </div>
        </div>

        {/* Audit Log Table */}
        <Card hover={false}>
          <CardHeader>
            <CardTitle>Audit Records ({filteredLogs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(19,65,120,0.35)]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted">
                      Incident ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted">
                      Incident Hash
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted">
                      Timestamp
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted">
                      Verification
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted">
                      Department
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted">
                      Barangay
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted">
                      Severity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log, index) => (
                    <tr
                      key={log.incidentId || log.incidentHash || index}
                      className="border-b border-[rgba(19,65,120,0.2)] hover:bg-card transition-colors"
                    >
                      <td className="py-4 px-4 text-sm font-mono text-foreground">
                        {log.incidentId || '—'}
                      </td>
                      <td className="py-4 px-4 text-sm font-mono text-foreground">
                        {truncateHash(log.incidentHash)}
                      </td>
                      <td className="py-4 px-4 text-sm text-muted">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="py-4 px-4">
                        <Badge
                          className={
                            log.verificationStatus === 'Verified'
                              ? 'bg-severity-resolved/20 text-severity-resolved border-emerald-500/40'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          }
                        >
                          {log.verificationStatus?.toUpperCase() || '—'}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-sm text-muted">{log.department}</td>
                      <td className="py-4 px-4 text-sm text-muted">{log.barangay}</td>
                      <td className="py-4 px-4">
                        <Badge className={`${getSeverityColor(log.severity)} border rounded px-2 py-0.5 text-xs font-medium`}>
                          {log.severity?.toUpperCase() || '—'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredLogs.length > 0 && (
              <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-[rgba(19,65,120,0.35)]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`h-8 w-8 p-0 ${currentPage === pageNum ? 'bg-secondary text-foreground hover:bg-secondary-hover' : ''}`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted ml-2">
                  Page {currentPage} of {totalPages}
                  {filteredLogs.length > ROWS_PER_PAGE &&
                    ` (${startIndex + 1}-${Math.min(startIndex + ROWS_PER_PAGE, filteredLogs.length)} of ${filteredLogs.length})`}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
