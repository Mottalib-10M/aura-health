import { useState, useMemo } from 'react';
import { Filter, Calendar, Table2, Map } from 'lucide-react';
import { SurveillanceMap, type MapFeature } from '@/components/maps/SurveillanceMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const diseases = ['Cholera', 'Tuberculosis', 'Measles', 'COVID-19', 'Typhoid', 'Malaria'];

const mockFeatures: MapFeature[] = [
  { coordinates: { latitude: 41.2995, longitude: 69.2401 }, caseCount: 145, diseaseName: 'COVID-19', alertLevel: 'warning', region: 'Tashkent', city: 'Tashkent' },
  { coordinates: { latitude: 39.6547, longitude: 66.9597 }, caseCount: 78, diseaseName: 'Tuberculosis', alertLevel: 'alert', region: 'Samarkand', city: 'Samarkand' },
  { coordinates: { latitude: 40.7821, longitude: 72.3442 }, caseCount: 32, diseaseName: 'Cholera', alertLevel: 'emergency', region: 'Fergana', city: 'Andijan' },
  { coordinates: { latitude: 41.5533, longitude: 60.6321 }, caseCount: 21, diseaseName: 'Measles', alertLevel: 'watch', region: 'Karakalpakstan', city: 'Nukus' },
  { coordinates: { latitude: 38.8601, longitude: 65.7847 }, caseCount: 54, diseaseName: 'Typhoid', alertLevel: 'warning', region: 'Kashkadarya', city: 'Karshi' },
  { coordinates: { latitude: 40.1156, longitude: 67.8422 }, caseCount: 12, diseaseName: 'COVID-19', alertLevel: 'watch', region: 'Jizzakh', city: 'Jizzakh' },
  { coordinates: { latitude: 40.5267, longitude: 68.7845 }, caseCount: 89, diseaseName: 'Tuberculosis', alertLevel: 'alert', region: 'Namangan', city: 'Namangan' },
];

interface CaseData {
  region: string;
  disease: string;
  cases: number;
  deaths: number;
  recoveries: number;
  alertLevel: string;
}

const mockTableData: CaseData[] = [
  { region: 'Tashkent', disease: 'COVID-19', cases: 145, deaths: 3, recoveries: 120, alertLevel: 'warning' },
  { region: 'Samarkand', disease: 'Tuberculosis', cases: 78, deaths: 5, recoveries: 45, alertLevel: 'alert' },
  { region: 'Fergana', disease: 'Cholera', cases: 32, deaths: 2, recoveries: 18, alertLevel: 'emergency' },
  { region: 'Namangan', disease: 'Tuberculosis', cases: 89, deaths: 7, recoveries: 52, alertLevel: 'alert' },
  { region: 'Kashkadarya', disease: 'Typhoid', cases: 54, deaths: 1, recoveries: 40, alertLevel: 'warning' },
  { region: 'Karakalpakstan', disease: 'Measles', cases: 21, deaths: 0, recoveries: 19, alertLevel: 'watch' },
  { region: 'Jizzakh', disease: 'COVID-19', cases: 12, deaths: 0, recoveries: 10, alertLevel: 'watch' },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function SurveillancePage() {
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('2026-05-14');
  const [isLoading] = useState(false);

  const filteredFeatures = useMemo(() => {
    if (selectedDiseases.length === 0) return mockFeatures;
    return mockFeatures.filter((f) => selectedDiseases.includes(f.diseaseName));
  }, [selectedDiseases]);

  const filteredTableData = useMemo(() => {
    if (selectedDiseases.length === 0) return mockTableData;
    return mockTableData.filter((d) => selectedDiseases.includes(d.disease));
  }, [selectedDiseases]);

  const toggleDisease = (disease: string) => {
    setSelectedDiseases((prev) =>
      prev.includes(disease) ? prev.filter((d) => d !== disease) : [...prev, disease],
    );
  };

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
          Disease Surveillance
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Real-time disease monitoring and outbreak detection across Central Asia
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Sidebar Filters */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Filter className="h-4 w-4 text-primary-500" />
                Disease Filter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {diseases.map((disease) => (
                  <label
                    key={disease}
                    className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDiseases.length === 0 || selectedDiseases.includes(disease)}
                      onChange={() => toggleDisease(disease)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300">{disease}</span>
                  </label>
                ))}
              </div>
              {selectedDiseases.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setSelectedDiseases([])}
                >
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Time Range */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-primary-500" />
                Time Range
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {['7d', '30d', '90d', '1y'].map((range) => (
                <button
                  key={range}
                  type="button"
                  className={cn(
                    'w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors',
                    range === '30d'
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800',
                  )}
                >
                  {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : range === '90d' ? 'Last 90 Days' : 'Last Year'}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Map */}
          <SurveillanceMap
            features={filteredFeatures}
            height="450px"
            dateRange={{ min: '2025-01-01', max: '2026-05-14' }}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />

          {/* Data Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Table2 className="h-5 w-5 text-slate-500" />
                Case Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700">
                      <th className="pb-2 text-left text-xs font-semibold text-slate-500">Region</th>
                      <th className="pb-2 text-left text-xs font-semibold text-slate-500">Disease</th>
                      <th className="pb-2 text-right text-xs font-semibold text-slate-500">Cases</th>
                      <th className="pb-2 text-right text-xs font-semibold text-slate-500">Deaths</th>
                      <th className="pb-2 text-right text-xs font-semibold text-slate-500">Recoveries</th>
                      <th className="pb-2 text-left text-xs font-semibold text-slate-500">Alert Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                    {filteredTableData.map((row, i) => (
                      <tr key={i}>
                        <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">{row.region}</td>
                        <td className="py-2.5 text-slate-600 dark:text-slate-400">{row.disease}</td>
                        <td className="py-2.5 text-right font-semibold text-slate-900 dark:text-slate-100">{row.cases.toLocaleString()}</td>
                        <td className="py-2.5 text-right text-red-600 dark:text-red-400">{row.deaths}</td>
                        <td className="py-2.5 text-right text-green-600 dark:text-green-400">{row.recoveries}</td>
                        <td className="py-2.5">
                          <Badge
                            variant={
                              row.alertLevel === 'emergency' ? 'critical' :
                              row.alertLevel === 'alert' ? 'high' :
                              row.alertLevel === 'warning' ? 'warning' : 'low'
                            }
                            dot
                            size="sm"
                          >
                            {row.alertLevel}
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
      </div>
    </div>
  );
}
