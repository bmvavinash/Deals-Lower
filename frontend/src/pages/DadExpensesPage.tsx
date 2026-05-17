import React, { useState } from 'react';
import './DadExpensesPage.css';

interface ExpenseRow {
  date: string;
  day: string;
  callCount: number;
  workingType: string;
  subtype: string;
  stationType: string;
  route: string;
  hqType: string;
  km: number;
  dailyAllowance: number;
  outstationAllowance: number;
  travelAllowance: number;
  hotelAllowance: number;
  mobileAllowance: number;
}

const DadExpensesPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [expenseData, setExpenseData] = useState<ExpenseRow[]>([]);

  const handleLogin = async () => {
    if (!username || !password) {
      setStatus('Please enter username and password');
      return;
    }

    setIsProcessing(true);
    setStatus('Logging in...');

    try {
      const response = await fetch('http://localhost:3001/api/dad-expenses/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        setIsLoggedIn(true);
        setStatus('Login successful!');
      } else {
        setStatus(`Login failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Failed to connect'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessExpenses = async () => {
    if (expenseData.length === 0) {
      setStatus('Please parse expense data first');
      return;
    }

    setIsProcessing(true);
    setStatus('Processing expenses...');

    try {
      const response = await fetch('http://localhost:3001/api/dad-expenses/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username,
          password,
          expenses: expenseData 
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus(`Successfully processed ${data.processedCount || 0} expenses`);
      } else {
        setStatus(`Processing failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Failed to process'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const parseExpenseTable = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rows = doc.querySelectorAll('.expense-table tbody tr');
    
    const expenses: ExpenseRow[] = [];
    
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 14) return;

      const callCountText = cells[2].textContent?.trim() || '0';
      const callCount = parseInt(callCountText, 10) || 0;
      
      const date = cells[0].textContent?.trim() || '';
      const day = cells[1].textContent?.trim() || '';
      
      // Determine working type and subtype based on call count
      const workingType = callCount === 0 ? 'Non-Working' : 'Working';
      const subtype = callCount === 0 ? 'Holiday' : 'Field Work';
      const route = callCount > 0 ? 'HYDERABAD - HYDERABAD - HYDERABAD' : '';
      const hqType = callCount > 0 ? 'HQ' : '';

      expenses.push({
        date,
        day,
        callCount,
        workingType,
        subtype,
        stationType: 'Single',
        route,
        hqType,
        km: parseFloat(cells[8].textContent?.trim() || '0'),
        dailyAllowance: parseFloat(cells[9].textContent?.trim() || '0'),
        outstationAllowance: parseFloat(cells[10].textContent?.trim() || '0'),
        travelAllowance: parseFloat(cells[11].querySelector('.travel-amount')?.textContent?.trim() || '0'),
        hotelAllowance: parseFloat((cells[12].querySelector('.hotel-input') as HTMLInputElement)?.value || '0'),
        mobileAllowance: parseFloat(cells[13].textContent?.trim() || '0'),
      });
    });

    setExpenseData(expenses);
    setStatus(`Parsed ${expenses.length} expense rows`);
  };

  const handlePasteTable = () => {
    navigator.clipboard.readText().then(text => {
      parseExpenseTable(text);
    }).catch(err => {
      setStatus('Failed to read clipboard. Please paste the HTML table manually.');
    });
  };

  return (
    <div className="dad-expenses-page">
      <div className="page-header">
        <h1>Dad Expenses Automation</h1>
        <p>Automate expense entry for HCP portal</p>
        <div className="info-box success">
          <strong>✓ Automated:</strong> Chrome will be automatically started with debugging port 9222 if not already running.
        </div>
      </div>

      {!isLoggedIn ? (
        <div className="login-section">
          <div className="login-card">
            <h2>Login Credentials</h2>
            <div className="form-group">
              <label>URL:</label>
              <input
                type="text"
                value="https://hcp.csmart.in/"
                readOnly
                className="readonly-input"
              />
            </div>
            <div className="form-group">
              <label>Username:</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                disabled={isProcessing}
              />
            </div>
            <div className="form-group">
              <label>Password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                disabled={isProcessing}
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={isProcessing || !username || !password}
              className="btn btn-primary"
            >
              {isProcessing ? 'Logging in...' : 'Login'}
            </button>
            {status && <div className="status-message">{status}</div>}
          </div>
        </div>
      ) : (
        <div className="expense-section">
          <div className="action-card">
            <h2>Expense Data</h2>
            <div className="form-group">
              <label>Paste HTML Table:</label>
              <textarea
                id="expense-table-input"
                placeholder="Paste the expense table HTML here..."
                rows={10}
                className="table-input"
                onChange={(e) => parseExpenseTable(e.target.value)}
              />
            </div>
            <div className="button-group">
              <button
                onClick={handlePasteTable}
                className="btn btn-secondary"
              >
                Paste from Clipboard
              </button>
              <button
                onClick={handleProcessExpenses}
                disabled={isProcessing || expenseData.length === 0}
                className="btn btn-primary"
              >
                {isProcessing ? 'Processing...' : 'Process Expenses'}
              </button>
            </div>
            {status && <div className="status-message">{status}</div>}
          </div>

          {expenseData.length > 0 && (
            <div className="data-preview">
              <h3>Parsed Data Preview ({expenseData.length} rows)</h3>
              <div className="table-container">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Day</th>
                      <th>Call Count</th>
                      <th>Working Type</th>
                      <th>Subtype</th>
                      <th>Route</th>
                      <th>HQ Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseData.map((expense, idx) => (
                      <tr key={idx}>
                        <td>{expense.date}</td>
                        <td>{expense.day}</td>
                        <td>{expense.callCount}</td>
                        <td>{expense.workingType}</td>
                        <td>{expense.subtype}</td>
                        <td>{expense.route || '-'}</td>
                        <td>{expense.hqType || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DadExpensesPage;

