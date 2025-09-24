import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/index.css';
import './i18n';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { setFavicon } from './utils/favicon';

const queryClient = new QueryClient();

// Ensure favicon set to company logo (overrides placeholder SVG in index.html if present)
setFavicon();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
