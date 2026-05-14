import { useState } from 'react';
import { BarChart3, Download, FileText, Calendar, Clock, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

interface ReportItem {
  id: string;
  name: string;
  type: 'financial' | 'clinical' | 'operational';
  generatedAt: string;
  generatedBy: string;
  size: string;
  status: 'ready' | 'generating' | 'failed';
}

const mockReports: ReportItem[] = [
  { id: '1', name: 'Monthly Revenue Report - April 2026', type: 'financial', generatedAt: '2026-05-01T09:00:00Z', generatedBy: 'System', size: '2.4 MB', status: 'ready' },
  { id: '2', name: 'Patient Outcomes Q1 2026', type: 'clinical', generatedAt: '2026-04-15T14:30:00Z', generatedBy: 'Dr. Karimov', size: '5.1 MB', status: 'ready' },
  { id: '3', name: 'Bed Utilization Report - April', type: 'operational', generatedAt: '2026-05-02T08:00:00Z', generatedBy: 'System', size: '1.8 MB', status: 'ready' },
  { id: '4', name: 'Staff Performance Review Q1', type: 'operational', generatedAt: '2026-04-20T10:00:00Z', generatedBy: 'HR Admin', size: '3.2 MB', status: 'ready' },
  { id: '5', name: 'Expense Analysis - May 2026', type: 'financial', generatedAt: '2026-05-14T06:00:00Z', generatedBy: 'System', size: '-', status: 'generating' },
  { id: '6', name: 'Infection Control Report', type: 'clinical', generatedAt: '2026-05-10T11:00:00Z', generatedBy: 'Dr. Yusupova', size: '1.5 MB', status: 'ready' },
];

const reportTypeConfig: Record<ReportItem['type'], { color: string; label: string }> = {
  financial: { color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300', label: 'Financial' },
  clinical: { color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300', label: 'Clinical' },
  operational: { color: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300', label: 'Operational' },
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function ReportsPage() {
  const [reportType, setReportType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading] = useState(false);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('all');

  const filteredReports = activeTypeFilter === 'all'
    ? mockReports
    : mockReports.filter((r) => r.type === activeTypeFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Reports
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Generate, view, and export hospital reports
        </p>
      </div>

      {/* Generate New Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary-500" />
            Generate New Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Report Type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              options={[
                { value: 'financial', label: 'Financial Report' },
                { value: 'clinical', label: 'Clinical Outcomes' },
                { value: 'operational', label: 'Operational Metrics' },
                { value: 'staffing', label: 'Staffing Report' },
                { value: 'utilization', label: 'Resource Utilization' },
              ]}
            />
            <Input
              label="From Date"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              label="To Date"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <div className="flex items-end gap-2">
              <Button variant="primary" className="flex-1" disabled={!reportType}>
                <BarChart3 className="h-4 w-4" />
                Generate
              </Button>
              <Button variant="outline" disabled={!reportType}>
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" />
        {['all', 'financial', 'clinical', 'operational'].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveTypeFilter(type)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
              activeTypeFilter === type
                ? 'bg-primary-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700',
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" />
            Recent Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredReports.map((report) => {
              const typeConf = reportTypeConfig[report.type];
              return (
                <div
                  key={report.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-4 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                      <FileText className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {report.name}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className={cn('rounded-md px-1.5 py-0.5 text-2xs font-medium', typeConf.color)}>
                          {typeConf.label}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(report.generatedAt).toLocaleDateString()}
                        </span>
                        <span>By: {report.generatedBy}</span>
                        {report.size !== '-' && <span>{report.size}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.status === 'generating' ? (
                      <Badge variant="warning" dot size="sm">Generating...</Badge>
                    ) : report.status === 'failed' ? (
                      <Badge variant="error" dot size="sm">Failed</Badge>
                    ) : (
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
