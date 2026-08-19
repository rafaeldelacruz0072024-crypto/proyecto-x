import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Deposits from './pages/Deposits';
import Withdrawals from './pages/Withdrawals';
import Users from './pages/Users';
import Investments from './pages/Investments';
import RoiEngine from './pages/RoiEngine';
import Settings from './pages/Settings';
import Gateways from './pages/Gateways';
import Plans from './pages/Plans';
import WeeklyBonuses from './pages/WeeklyBonuses';
import Network from './pages/Network';
import Commissions from './pages/Commissions';
import Promotions from './pages/Promotions';
import Products from './pages/Products';
import Tutorials from './pages/Tutorials';
import Games from './pages/Games';
import PredictionMarkets from './pages/PredictionMarkets';
import RoadMap from './pages/RoadMap';
import Marketing from './pages/Marketing';
import Communications from './pages/Communications';
import Payroll from './pages/Payroll';
import NovaDigitalCards from './pages/NovaDigitalCards';
import BalanceManager from './pages/BalanceManager';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-bold">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user || profile?.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Layout Component
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 md:ml-64 h-full relative">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/deposits"
          element={
            <ProtectedRoute>
              <Layout>
                <Deposits />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/withdrawals"
          element={
            <ProtectedRoute>
              <Layout>
                <Withdrawals />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/nova-digital-cards"
          element={
            <ProtectedRoute>
              <Layout>
                <NovaDigitalCards />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/balance-manager"
          element={
            <ProtectedRoute>
              <Layout>
                <BalanceManager />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <Layout>
                <Users />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/investments"
          element={
            <ProtectedRoute>
              <Layout>
                <Investments />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/roi-engine"
          element={
            <ProtectedRoute>
              <Layout>
                <RoiEngine />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/promotions"
          element={
            <ProtectedRoute>
              <Layout>
                <Promotions />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <Layout>
                <Products />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tutorials"
          element={
            <ProtectedRoute>
              <Layout>
                <Tutorials />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/games"
          element={
            <ProtectedRoute>
              <Layout>
                <Games />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/gateways"
          element={
            <ProtectedRoute>
              <Layout>
                <Gateways />
              </Layout>
            </ProtectedRoute>
          }
        />


        <Route
          path="/plans"
          element={
            <ProtectedRoute>
              <Layout>
                <Plans />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/weekly-bonuses"
          element={
            <ProtectedRoute>
              <Layout>
                <WeeklyBonuses />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/network"
          element={
            <ProtectedRoute>
              <Layout>
                <Network />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/commissions"
          element={
            <ProtectedRoute>
              <Layout>
                <Commissions />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/predictions"
          element={
            <ProtectedRoute>
              <Layout>
                <PredictionMarkets />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/marketing"
          element={
            <ProtectedRoute>
              <Layout>
                <Marketing />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/communications"
          element={
            <ProtectedRoute>
              <Layout>
                <Communications />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/roadmap"
          element={
            <ProtectedRoute>
              <Layout>
                <RoadMap />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll"
          element={
            <ProtectedRoute>
              <Layout>
                <Payroll />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
