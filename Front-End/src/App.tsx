import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Layout from './components/Layout';

const HomePage = lazy(() => import('./pages/HomePage'));
const MenuPage = lazy(() => import('./pages/MenuPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const OrderHistoryPage = lazy(() => import('./pages/OrderHistoryPage'));
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage'));
const PaymentFailedPage = lazy(() => import('./pages/PaymentFailedPage'));

export default function App() {
  const location = useLocation();
  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Suspense
          fallback={
            <div className="py-10 text-center text-slate-500" role="status" aria-live="polite">
              Loading…
            </div>
          }
        >
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<HomePage />} />
            <Route path="/menu" element={<MenuPage />} />
            {/* Deprecated product: Super Sampler now integrated; redirect to /menu (placed before :id) */}
            <Route path="/menu/pizza-super-sampler" element={<Navigate to="/menu" replace />} />
            <Route path="/menu/:id" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            {/* Admin is deprecated; redirect to Profile */}
            <Route path="/admin" element={<Navigate to="/profile" replace />} />
            <Route path="/admin/*" element={<Navigate to="/profile" replace />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/orders" element={<OrderHistoryPage />} />
            <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
            <Route path="/payment-failed" element={<PaymentFailedPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AnimatePresence>
    </Layout>
  );
}
