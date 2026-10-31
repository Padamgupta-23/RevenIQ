import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiClient from './lib/api';
import { Button } from './components/ui/button';

const queryClient = new QueryClient();

function HomePage() {
  const [healthStatus, setHealthStatus] = useState<string>('checking...');
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/health');
      setHealthStatus(`OK: ${JSON.stringify(res.data)}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setHealthStatus(`Error: ${err.message}`);
      } else {
        setHealthStatus('Error connecting to API');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 border border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
          Brightloop Software
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Subscription Management System Monorepo is up and running.
        </p>

        <div className="bg-slate-100 rounded-lg p-4 mb-6">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            API Health Status
          </div>
          <div className="text-sm font-mono text-slate-800 break-words">
            {healthStatus}
          </div>
        </div>

        <Button onClick={checkHealth} disabled={loading} className="w-full">
          {loading ? 'Testing...' : 'Check API Health'}
        </Button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
