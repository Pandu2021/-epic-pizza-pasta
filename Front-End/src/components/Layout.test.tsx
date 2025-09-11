import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Layout from './Layout';

it('renders navbar brand', () => {
  render(
    <BrowserRouter>
      <Layout>content</Layout>
    </BrowserRouter>
  );
  expect(screen.getByRole('link', { name: /Epic Pizza & Pasta/i })).toBeInTheDocument();
});
