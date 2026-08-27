import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import './AffiliatesPage.css';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface Affiliate {
  id: string;
  name: string;
  amazonTagId: string;
  createdAt: string;
  updatedAt: string;
}

const AffiliatesPage: React.FC = () => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    amazonTagId: ''
  });

  const { addNotification } = useNotification();

  const fetchAffiliates = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/affiliates`);
      const data = await res.json();
      if (data.success) {
        setAffiliates(data.data);
      }
    } catch (error) {
      addNotification({ type: 'error', message: 'Failed to fetch affiliates', source: 'Affiliates' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAffiliates();
  }, []);

  const openModal = (affiliate?: Affiliate) => {
    if (affiliate) {
      setFormData({
        id: affiliate.id,
        name: affiliate.name,
        amazonTagId: affiliate.amazonTagId
      });
      setEditingId(affiliate.id);
    } else {
      setFormData({ id: '', name: '', amazonTagId: '' });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = async () => {
    if (!formData.id || !formData.name || !formData.amazonTagId) {
      addNotification({ type: 'error', message: 'All fields are required', source: 'Affiliates' });
      return;
    }

    // Replace spaces and special chars for ID if creating new
    const idToUse = editingId ? editingId : formData.id.toLowerCase().replace(/[^a-z0-9]/g, '');

    try {
      const res = await fetch(`/api/affiliates/${idToUse}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          amazonTagId: formData.amazonTagId
        })
      });
      
      const data = await res.json();
      if (data.success) {
        addNotification({ type: 'success', message: 'Affiliate saved successfully', source: 'Affiliates' });
        closeModal();
        fetchAffiliates();
      } else {
        addNotification({ type: 'error', message: data.error || 'Failed to save', source: 'Affiliates' });
      }
    } catch (error) {
      addNotification({ type: 'error', message: 'Error saving affiliate', source: 'Affiliates' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Are you sure you want to delete affiliate ${id}?`)) return;
    
    try {
      const res = await fetch(`/api/affiliates/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        addNotification({ type: 'success', message: 'Affiliate deleted successfully', source: 'Affiliates' });
        fetchAffiliates();
      }
    } catch (error) {
      addNotification({ type: 'error', message: 'Error deleting affiliate', source: 'Affiliates' });
    }
  };

  return (
    <div className="affiliates-page">
      <div className="affiliates-header">
        <div>
          <h1 style={{ margin: '0 0 8px 0' }}>Affiliates Management</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Manage tracking tags for different persons/affiliates.</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>
          + Add Affiliate
        </button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="affiliates-table-container">
          <table className="affiliates-table">
            <thead>
              <tr>
                <th>ID (URL Ref)</th>
                <th>Name</th>
                <th>Amazon Tag ID</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {affiliates.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>
                    No affiliates found. Add one to get started.
                  </td>
                </tr>
              ) : (
                affiliates.map(aff => (
                  <tr key={aff.id}>
                    <td><code>{aff.id}</code></td>
                    <td>{aff.name}</td>
                    <td>{aff.amazonTagId}</td>
                    <td>{new Date(aff.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button className="btn-edit" onClick={() => openModal(aff)}>Edit</button>
                      <button className="btn-danger" onClick={() => handleDelete(aff.id)}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingId ? 'Edit Affiliate' : 'Add New Affiliate'}</h3>
            
            <div className="form-group">
              <label>ID (Used in URL, e.g., ?ref=johndoe)</label>
              <input 
                type="text" 
                value={formData.id} 
                onChange={e => setFormData({...formData, id: e.target.value})}
                disabled={!!editingId}
                placeholder="e.g. johndoe"
              />
            </div>
            
            <div className="form-group">
              <label>Name (Display Name)</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. John Doe"
              />
            </div>
            
            <div className="form-group">
              <label>Amazon Tag ID</label>
              <input 
                type="text" 
                value={formData.amazonTagId} 
                onChange={e => setFormData({...formData, amazonTagId: e.target.value})}
                placeholder="e.g. dealshubglo0c-21"
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn-success" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AffiliatesPage;
