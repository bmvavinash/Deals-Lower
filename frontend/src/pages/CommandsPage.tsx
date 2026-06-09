import React, { useState, useEffect } from 'react';
import './CommandsPage.css';
import { API_BASE_URL } from '../config';

interface Command {
  id: string;
  name: string;
  command: string;
  purpose: string;
}

const CommandsPage: React.FC = () => {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchCommands();
  }, []);

  const fetchCommands = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/commands`);
      const data = await response.json();
      if (data.success) {
        setCommands(data.commands);
      } else {
        setMessage({ text: data.message || 'Failed to load commands', type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching commands:', error);
      setMessage({ text: 'Error connecting to server', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const executeCommand = async (id: string) => {
    setExecuting(id);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/commands/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ text: data.message, type: 'success' });
      } else {
        setMessage({ text: data.message || 'Failed to execute command', type: 'error' });
      }
    } catch (error) {
      console.error('Error executing command:', error);
      setMessage({ text: 'Error connecting to server', type: 'error' });
    } finally {
      setExecuting(null);
    }
  };

  if (loading) {
    return <div className="commands-loading">Loading commands...</div>;
  }

  return (
    <div className="commands-page">
      <header className="commands-header">
        <h1>System Commands & Operations</h1>
        <p>Review and execute backend scripts, scrapers, and automated tools.</p>
      </header>

      {message && (
        <div className={`commands-alert ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="commands-grid">
        {commands.map(cmd => (
          <div key={cmd.id} className="command-card">
            <div className="command-header">
              <h2>{cmd.name}</h2>
              <button 
                className="btn-execute" 
                onClick={() => executeCommand(cmd.id)}
                disabled={executing === cmd.id}
              >
                {executing === cmd.id ? 'Starting...' : 'Execute'}
              </button>
            </div>
            
            <div className="command-body">
              <div className="command-section">
                <strong>Command:</strong>
                <pre><code>{cmd.command}</code></pre>
              </div>
              <div className="command-section">
                <strong>Purpose:</strong>
                <p>{cmd.purpose}</p>
              </div>
            </div>
          </div>
        ))}
        {commands.length === 0 && !loading && (
          <div className="no-commands">No commands configured in commandsList.json.</div>
        )}
      </div>
    </div>
  );
};

export default CommandsPage;
