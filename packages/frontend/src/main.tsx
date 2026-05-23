import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Shell } from './app/Shell.js';
import { LocationProvider } from './context/LocationContext.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('root element missing');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LocationProvider>
          <Shell />
        </LocationProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
