import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { dealsAPI } from '../services/api';
import DealList from '../components/Deals/DealList';
import DealFilters from '../components/Deals/DealFilters';
import './DealsPage.css';

const DealsPage: React.FC = () => {
  const [filters, setFilters] = useState({ dealType: '', platform: '', limit: 100, offset: 0 });
  
  const { data, isLoading, error, refetch } = useQuery(
    ['deals', filters],
    () => dealsAPI.getAll(filters),
    { keepPreviousData: true }
  );

  const handleFilterChange = (newFilters: any) => {
    setFilters({ ...filters, ...newFilters, offset: 0 });
  };

  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isTelegramRunning, setIsTelegramRunning] = useState(false);

  const handleTriggerBulkUpdate = async () => {
    try {
      setIsBulkUpdating(true);
      await dealsAPI.triggerBulkUpdate('website', 'productdeals');
      alert('Bulk update triggered successfully! It will run in the background.');
      refetch();
    } catch (error) {
      alert('Failed to trigger bulk update');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleTriggerTelegramBot = async () => {
    try {
      setIsTelegramRunning(true);
      await dealsAPI.triggerTelegramBot();
      alert('Telegram bot triggered successfully! It will process messages continuously in the background.');
    } catch (error) {
      alert('Failed to trigger Telegram bot');
    } finally {
      setIsTelegramRunning(false);
    }
  };

  return (
    <div className="deals-page">
      <div className="page-header">
        <h1>Deals Management</h1>
        <div className="trigger-buttons">
          <button 
            onClick={handleTriggerBulkUpdate} 
            className="trigger-button"
            disabled={isBulkUpdating}
          >
            {isBulkUpdating ? '⏳ Triggering...' : '🔄 Trigger Bulk Update'}
          </button>
          <button 
            onClick={handleTriggerTelegramBot} 
            className="trigger-button telegram-button"
            disabled={isTelegramRunning}
          >
            {isTelegramRunning ? '⏳ Starting...' : '📱 Trigger Telegram Bot'}
          </button>
        </div>
        <div className="trigger-info">
          <p className="info-text">
            <strong>Note:</strong> Bulk updates and Telegram bot can run in parallel. 
            They use separate processes and won't interfere with each other.
          </p>
        </div>
      </div>

      <DealFilters filters={filters} onFilterChange={handleFilterChange} />

      {isLoading && <div className="loading">Loading deals...</div>}
      {error && <div className="error">Error loading deals: {String(error)}</div>}
      
      {data && (
        <DealList 
          deals={(data.data as any).data || []} 
          pagination={(data.data as any).pagination}
          onPageChange={(offset) => setFilters({ ...filters, offset })}
        />
      )}
    </div>
  );
};

export default DealsPage;

