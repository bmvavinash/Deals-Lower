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

function App() {
  return (
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
          <Route path="/others/dad-expenses" element={<DadExpensesPage />} />
        </Routes>
      </MainLayout>
    </Router>
  );
}

export default App;

