import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

type Metrics = {
  retention: { day1: number; day7: number; day30: number };
  dauMau: { dau: number; mau: number; stickiness: number; dailyData: { date: string; dau: number }[] };
  sessionLength: { averageSeconds: number; dailyData: { date: string; avgSeconds: number }[] };
  sessionsPerUser: { daily: number; weekly: number; dailyData: { date: string; sessionsPerUser: number }[] };
  overview: { totalUsers: number; totalBubbles: number; totalEvents: number; totalSessions: number };
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatCard({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <p className="text-gray-500 text-sm font-medium">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-gray-700 font-semibold mb-4">{title}</h3>
      <div className="h-64">
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/analytics/metrics');
      if (!res.ok) throw new Error('Failed to fetch metrics');
      const data = await res.json();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!metrics) return null;

  const dauData = metrics.dauMau.dailyData.map(d => ({ ...d, date: formatDate(d.date) }));
  const sessionLengthData = metrics.sessionLength.dailyData.map(d => ({
    date: formatDate(d.date),
    avgMinutes: Math.round(d.avgSeconds / 60 * 10) / 10,
  }));
  const sessionsData = metrics.sessionsPerUser.dailyData.map(d => ({
    date: formatDate(d.date),
    sessionsPerUser: d.sessionsPerUser,
  }));

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Bubble Analytics</h1>
          <p className="text-gray-500 mt-1">Key user metrics dashboard</p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Users" value={metrics.overview.totalUsers} />
          <StatCard title="Total Bubbles" value={metrics.overview.totalBubbles} />
          <StatCard title="Total Events" value={metrics.overview.totalEvents} />
          <StatCard title="Total Sessions" value={metrics.overview.totalSessions} />
        </div>

        {/* Retention Rate */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Retention Rate</h2>
          <p className="text-gray-500 text-sm mb-4">% of users who return after install</p>
          <div className="grid grid-cols-3 gap-4">
            <StatCard title="Day 1" value={`${metrics.retention.day1}%`} subtitle="Return next day" />
            <StatCard title="Day 7" value={`${metrics.retention.day7}%`} subtitle="Return after 1 week" />
            <StatCard title="Day 30" value={`${metrics.retention.day30}%`} subtitle="Return after 1 month" />
          </div>
        </div>

        {/* DAU/MAU */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Daily & Monthly Active Users</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <StatCard title="DAU" value={metrics.dauMau.dau} subtitle="Active today" />
            <StatCard title="MAU" value={metrics.dauMau.mau} subtitle="Active this month" />
            <StatCard title="Stickiness" value={`${metrics.dauMau.stickiness}%`} subtitle="DAU ÷ MAU ratio" />
          </div>
          <ChartCard title="Daily Active Users (Last 14 days)">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dauData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#999" />
                <YAxis tick={{ fontSize: 12 }} stroke="#999" allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="dau" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Average Session Length */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Average Session Length</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <StatCard 
              title="Overall Average" 
              value={formatDuration(metrics.sessionLength.averageSeconds)} 
              subtitle="Per session" 
            />
          </div>
          <ChartCard title="Average Session Length (Last 14 days)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sessionLengthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#999" />
                <YAxis tick={{ fontSize: 12 }} stroke="#999" unit="m" />
                <Tooltip formatter={(value: number) => [`${value} min`, 'Avg Length']} />
                <Bar dataKey="avgMinutes" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Sessions per User */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Sessions per User</h2>
          <p className="text-gray-500 text-sm mb-4">Frequency of app opens/usage</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <StatCard title="Daily" value={metrics.sessionsPerUser.daily} subtitle="Sessions per user per day" />
            <StatCard title="Weekly" value={metrics.sessionsPerUser.weekly} subtitle="Sessions per user per week" />
          </div>
          <ChartCard title="Sessions per User (Last 14 days)">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sessionsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#999" />
                <YAxis tick={{ fontSize: 12 }} stroke="#999" />
                <Tooltip />
                <Line type="monotone" dataKey="sessionsPerUser" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="text-center text-gray-400 text-sm py-8">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
}
