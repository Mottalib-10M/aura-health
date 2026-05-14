import { useState } from 'react';
import { FileText, Download, Clock, Calendar, BarChart3, Filter, Plus } from 'lucide-react';
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

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  lastGenerated?: string;
}

const templates: ReportTemplate[] = [
  { id: '1', name: 'Weekly Disease Surveillance Summary', description: 'Aggregated disease surveillance data by region and pathogen', category: 'Surveillance', lastGenerated: '2026-05-12' },
  { id: '2', name: 'Monthly Outbreak Response Report', description: 'Detailed outbreak status, response measures, and outcomes', category: 'Outbreak', lastGenerated: '2026-05-01' },
  { id: '3', name: 'Vaccination Coverage Analysis', description: 'Regional vaccination rates and coverage gaps', category: 'Vaccination' },
  { id: '4', name: 'Antimicrobial Resistance Trends', description: 'AMR patterns and drug resistance surveillance', category: 'AMR', lastGenerated: '2026-04-28' },
  { id: '5', name: 'Epidemiological Forecast', description: 'Predictive modeling of disease spread and resource needs', category: 'Forecast' },
  { id: '6', name: 'Supply Chain Status Report', description: 'Medical supply inventory and distribution status', category: 'Supply Chain', lastGenerated: '2026-05-10' },
];

interface ScheduledReport {
  id: string;
  templateName: string;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  nextRun: string;
  recipients: number;
  status: 'active' | 'paused';
}

const scheduledReports: ScheduledReport[] = [
  { id: '1', templateName: 'Weekly Disease Surveillance Summary', frequency: 'weekly', nextRun: '2026-05-19', recipients: 12, status: 'active' },
  { id: '2', templateName: 'Monthly Outbreak Response Report', frequency: 'monthly', nextRun: '2026-06-01', recipients: 8, status: 'active' },
  { id: '3', templateName: 'Supply Chain Status Report', frequency: 'weekly', nextRun: '2026-05-17', recipients: 5, status: 'paused' },
];

interface GeneratedReport {
  id: string;
  name: string;
  generatedAt: string;
  format: 'PDF' | 'CSV' | 'XLSX';
  size: string;
}

const recentReports: GeneratedReport[] = [
  { id: '1', name: 'Disease Surveillance - Week 19', generatedAt: '2026-05-12T09:00:00Z', format: 'PDF', size: '4.2 MB' },
  { id: '2', name: 'Outbreak Response - April 2026', generatedAt: '2026-05-01T10:30:00Z', format: 'PDF', size: '8.7 MB' },
  { id: '3', name: 'Disease Surveillance - Week 18', generatedAt: '2026-05-05T09:00:00Z', format: 'PDF', size: '3.9 MB' },
  { id: '4', name: 'AMR Trends Q1 2026', generatedAt: '2026-04-28T14:00:00Z', format: 'XLSX', size: '2.1 MB' },
  { id: '5', name: 'Supply Chain Status', generatedAt: '2026-05-10T08:00:00Z', format: 'CSV', size: '1.5 MB' },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function AnalystReportsPage() {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exportFormat, setExportFormat] = useState('pdf');
  const [isLoading] = useState(false);

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
          Generate, schedule, and export Ministry of Health reports
        </p>
      </div>

      {/* Report Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary-500" />
            Generate Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Select
                label="Report Template"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                options={templates.map((t) => ({ value: t.id, label: t.name }))}
                placeholder="Select a report template..."
              />
            </div>
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
            <div>
              <Select
                label="Format"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                options={[
                  { value: 'pdf', label: 'PDF' },
                  { value: 'csv', label: 'CSV' },
                  { value: 'xlsx', label: 'Excel' },
                ]}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" disabled={!selectedTemplate}>
              <BarChart3 className="h-4 w-4" />
              Generate Report
            </Button>
            <Button variant="outline" disabled={!selectedTemplate}>
              <Download className="h-4 w-4" />
              Export as {exportFormat.toUpperCase()}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" />
            Report Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="rounded-xl border border-slate-200 p-4 transition-colors hover:border-primary-300 hover:bg-primary-50/50 dark:border-slate-700 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
              >
                <div className="flex items-start justify-between">
                  <Badge variant="default" size="sm">{template.category}</Badge>
                  {template.lastGenerated && (
                    <span className="text-2xs text-slate-400">
                      Last: {new Date(template.lastGenerated).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <h4 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {template.name}
                </h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {template.description}
                </p>
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSelectedTemplate(template.id)}>
                  Generate
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Reports */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Scheduled Reports
            </CardTitle>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" />
              Schedule New
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {scheduledReports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-700"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{report.templateName}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <span className="capitalize">{report.frequency}</span>
                    <span>Next: {new Date(report.nextRun).toLocaleDateString()}</span>
                    <span>{report.recipients} recipients</span>
                  </div>
                </div>
                <Badge variant={report.status === 'active' ? 'success' : 'default'} dot size="sm">
                  {report.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-500" />
            Recently Generated
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentReports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between rounded-lg border border-slate-50 p-3 transition-colors hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    <FileText className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{report.name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{new Date(report.generatedAt).toLocaleDateString()}</span>
                      <Badge variant="default" size="sm">{report.format}</Badge>
                      <span>{report.size}</span>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
