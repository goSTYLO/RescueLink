import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { FileText, Search } from 'lucide-react';
import { auditLogs } from '../data/mockData';
import { useState } from 'react';

export function AuditLogPage() {
  const [search, setSearch] = useState('');

  const filteredLogs = auditLogs.filter(log =>
    log.incidentHash.toLowerCase().includes(search.toLowerCase()) ||
    log.department.toLowerCase().includes(search.toLowerCase()) ||
    log.barangay.toLowerCase().includes(search.toLowerCase())
  );

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'Warning': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Resolved': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">Audit Log / Blockchain Records</h1>
          <p className="text-gray-600 mt-1">Immutable incident verification records</p>
        </div>

        {/* Info Card */}
        <Card className="mb-6 bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900">Blockchain-Backed Audit Trail</p>
                <p className="text-sm text-blue-700 mt-1">
                  All incident verifications are recorded in an immutable blockchain ledger for non-repudiation and transparency.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by hash, department, or barangay..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Audit Log Table */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Records ({filteredLogs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Incident Hash</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Timestamp</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Verification</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Department</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Barangay</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4 text-sm font-mono text-gray-900">{log.incidentHash}</td>
                      <td className="py-4 px-4 text-sm text-gray-600">{log.timestamp}</td>
                      <td className="py-4 px-4">
                        <Badge variant="outline" className={log.verificationStatus === 'Verified' ? 'border-green-300 text-green-700' : 'border-amber-300 text-amber-700'}>
                          {log.verificationStatus}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">{log.department}</td>
                      <td className="py-4 px-4 text-sm text-gray-600">{log.barangay}</td>
                      <td className="py-4 px-4">
                        <Badge className={getSeverityColor(log.severity)}>
                          {log.severity}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
