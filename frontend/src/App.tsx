import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import DealsPage from './pages/DealsPage';
import StocksPage from './pages/StocksPage';
import LogsPage from './pages/LogsPage';
import SchedulerPage from './pages/SchedulerPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ExecutionMonitor from './pages/ExecutionMonitor';
import DadExpensesPage from './pages/DadExpensesPage';
import CategoryPriorityPage from './pages/CategoryPriorityPage';
import ProductMatchingPage from './pages/ProductMatchingPage';
import CommandsPage from './pages/CommandsPage';
import { NotificationProvider } from './context/NotificationContext';
import Toaster from './components/Notifications/Toaster';
import NotificationQueue from './components/Notifications/NotificationQueue';

function App() {
  return (
    <NotificationProvider>
      <Router>
        <MainLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/deals" element={<DealsPage />} />
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
  );
}

export default App;

