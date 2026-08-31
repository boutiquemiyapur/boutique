import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { StorefrontHomePage } from './components/home/StorefrontHomePage';
import { ProductListingPage } from './components/shop/ProductListingPage';
import { ProductDetailPage } from './components/product/ProductDetailPage';
import { CheckoutPage } from './components/checkout/CheckoutPage';
import { OrderConfirmationPage } from './components/checkout/OrderConfirmationPage';
import { OrderTrackingPage } from './components/tracking/OrderTrackingPage';
import { CustomerAccountPage } from './components/account/CustomerAccountPage';
import { TailoringGuidePage } from './components/pages/TailoringGuidePage';
import { AboutArtisansPage } from './components/pages/AboutArtisansPage';
import { ContactConciergePage } from './components/pages/ContactConciergePage';
import { AdminPortalPage } from './components/admin/AdminPortalPage';
import { CartDrawer } from './components/cart/CartDrawer';
import { WishlistDrawer } from './components/common/WishlistDrawer';
import { QuickViewModal } from './components/common/QuickViewModal';
import { SizeGuideModal } from './components/common/SizeGuideModal';
import { ToastContainer } from './components/common/ToastContainer';
import { FloatingWhatsAppButton } from './components/common/FloatingWhatsAppButton';
import { WishlistPage } from './components/common/WishlistPage';
import { CartPage } from './components/cart/CartPage';
import { NotFoundPage, StaticPage } from './components/pages/StaticPage';
import { AuthPage } from './components/auth/AuthPage';
import { LoaderCircle, ShieldAlert } from 'lucide-react';

const RouteLoading = () => <div className="grid min-h-[65vh] place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-[#685c53]" /></div>;

const ProtectedAccount = () => {
  const { authStatus, requireAuth } = useStore();
  if (authStatus === 'loading') return <RouteLoading />;
  if (authStatus !== 'authenticated') return <AccessNotice title="Sign in to view your account" action="Sign in" onAction={() => requireAuth('account')} />;
  return <CustomerAccountPage />;
};

const ProtectedAdmin = () => {
  const { authStatus, authSession, requireAuth } = useStore();
  if (authStatus === 'loading') return <RouteLoading />;
  if (authStatus !== 'authenticated') return <AccessNotice title="Admin sign-in required" action="Sign in" onAction={() => requireAuth('admin')} />;
  if (!authSession?.isAdmin) return <UnauthorizedAdminRedirect />;
  return <AdminPortalPage />;
};

const UnauthorizedAdminRedirect = () => {
  const { navigate } = useStore();
  useEffect(() => { navigate('home'); }, [navigate]);
  return <RouteLoading />;
};

const AccessNotice = ({ title, action, onAction }: { title: string; action: string; onAction: () => void }) => <section className="grid min-h-[60vh] place-items-center px-5"><div className="max-w-md border border-[#ddd7cf] bg-white p-8 text-center shadow-sm"><ShieldAlert className="mx-auto h-7 w-7 text-[#685c53]" /><h1 className="mt-4 font-serif text-3xl text-[#252220]">{title}</h1><p className="mt-3 text-sm text-stone-600">Your account and boutique operations are protected by Firebase Authentication.</p><button onClick={onAction} className="mt-6 bg-[#685c53] px-6 py-3 text-xs font-semibold uppercase tracking-[.12em] text-white">{action}</button></div></section>;

function AppContent() {
  const { activeView, navigateFromUrl } = useStore();
  const isAuthView = activeView === 'login' || activeView === 'register' || activeView === 'forgot-password';
  const isStandaloneView = isAuthView || activeView === 'admin';

  // Scroll to top on page transition
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeView]);

  useEffect(() => {
    navigateFromUrl();
    window.addEventListener('popstate', navigateFromUrl);
    return () => window.removeEventListener('popstate', navigateFromUrl);
    // Route parser only uses stable React state setters; registering it once
    // avoids rebinding the listener on each StoreContext provider render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#1A1715] selection:bg-[#8B1E3F] selection:text-white font-sans antialiased">
      {!isStandaloneView && <Header />}

      {/* Main View Router */}
      <main className="flex-1">
        {activeView === 'home' && <StorefrontHomePage />}

        {activeView === 'shop' && <ProductListingPage />}

        {activeView === 'product-detail' && <ProductDetailPage />}

        {activeView === 'cart' && <CartPage />}

        {activeView === 'wishlist' && <WishlistPage />}

        {activeView === 'checkout' && <CheckoutPage />}

        {activeView === 'order-confirmation' && <OrderConfirmationPage />}

        {activeView === 'order-tracking' && <OrderTrackingPage />}

        {activeView === 'account' && <ProtectedAccount />}

        {activeView === 'tailoring-guide' && <TailoringGuidePage />}

        {activeView === 'about' && <AboutArtisansPage />}

        {activeView === 'contact' && <ContactConciergePage />}

        {['shipping-policy', 'returns-policy', 'cancellation-policy', 'privacy-policy', 'terms-policy', 'cookie-policy'].includes(activeView) && <StaticPage view={activeView} />}

        {activeView === 'not-found' && <NotFoundPage />}

        {activeView === 'admin' && <ProtectedAdmin />}

        {activeView === 'login' && <AuthPage key="login" mode="login" />}

        {activeView === 'register' && <AuthPage key="register" mode="register" />}

        {activeView === 'forgot-password' && <AuthPage key="forgot" mode="forgot" />}
      </main>

      {/* Global Footer */}
      {!isStandaloneView && <Footer />}

      {/* Modals and Slide-out Drawers */}
      {!isStandaloneView && <><CartDrawer /><WishlistDrawer /><QuickViewModal /><SizeGuideModal /></>}
      {!isStandaloneView && <FloatingWhatsAppButton />}
      <ToastContainer />
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}

export default App;
