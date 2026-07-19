import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import DealsPage from './pages/DealsPage';
import MatchingConfigPage from './pages/MatchingConfigPage';
import StocksPage from './pages/StocksPage';
import LogsPage from './pages/LogsPage';
import SchedulerPage from './pages/SchedulerPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ExecutionMonitor from './pages/ExecutionMonitor';
import DadExpensesPage from './pages/DadExpensesPage';
import CategoryPriorityPage from './pages/CategoryPriorityPage';
import ProductMatchingPage from './pages/ProductMatchingPage';
import CommandsPage from './pages/CommandsPage';
import UsersPage from './pages/UsersPage';
import Banners from './pages/Banners';
import { NotificationProvider } from './context/NotificationContext';
import Toaster from './components/Notifications/Toaster';
import NotificationQueue from './components/Notifications/NotificationQueue';
import AuthGate from './components/Auth/AuthGate';

function App() {
  return (
    <AuthGate>
      <NotificationProvider>
        <Router>
          <MainLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/banners" element={<Banners />} />
              <Route path="/deals" element={<DealsPage />} />
              <Route path="/matching-config" element={<MatchingConfigPage />} />
              <Route path="/stocks" element={<StocksPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/scheduler" element={<SchedulerPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/execution" element={<ExecutionMonitor />} />
              <Route path="/category-priority" element={<CategoryPriorityPage />} />
              <Route path="/product-matching" element={<ProductMatchingPage />} />
              <Route path="/commands" element={<CommandsPage />} />
              <Route path="/others/dad-expenses" element={<DadExpensesPage />} />
            </Routes>
          </MainLayout>
        </Router>
        <Toaster />
        <NotificationQueue />
      </NotificationProvider>
    </AuthGate>
  );
}

export default App;

