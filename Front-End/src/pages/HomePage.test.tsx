import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import HomePage from './HomePage';
import { api } from '../services/api';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { BrowserRouter } from 'react-router-dom';

// Mock cart store
vi.mock('../store/cartStore', () => ({ useCart: () => ({ addItem: vi.fn() }) }));

// Mock api.get
const mockGet = vi.fn();
(api as any).get = mockGet;

describe('HomePage', () => {
  it('renders loading skeleton then featured cards', async () => {
    mockGet.mockResolvedValueOnce({ data: [
      { id: '1', category: 'pizza', name: { en: 'Margherita', th: 'มาร์เกอริต้า' }, basePrice: 199 },
      { id: '2', category: 'dessert', name: { en: 'Tiramisu', th: 'ทีรามิสุ' }, basePrice: 149 },
    ] });
    render(
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      </I18nextProvider>
    );
    // Loading skeleton present (pulse divs) - not asserting exact class to keep resilient
    await waitFor(() => {
      expect(screen.getByText(/menu/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Margherita/i)).toBeInTheDocument();
    expect(screen.getByText(/Tiramisu/i)).toBeInTheDocument();
  });

  it('shows error message on failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'));
    render(
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      </I18nextProvider>
    );
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
