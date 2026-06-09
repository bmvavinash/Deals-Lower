import React, { useState } from 'react';
import axios from 'axios';
import './ProductMatchingPage.css';

const ProductMatchingPage: React.FC = () => {
  const [sourceCode, setSourceCode] = useState('');
  const [targetCode, setTargetCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const extractCode = (input: string) => {
    // If it's a URL, try to extract product code.
    // Extremely basic fallback extraction, normally the backend resolves this via platformUtils
    if (input.includes('amazon.in')) {
      const match = input.match(/\/dp\/([A-Z0-9]+)/);
      return match ? match[1] : input;
    }
    if (input.includes('flipkart.com')) {
      const match = input.match(/pid=([A-Z0-9]+)/) || input.match(/\/p\/([a-zA-Z0-9]+)/);
      return match ? match[1] : input;
    }
    return input.trim();
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceCode || !targetCode) {
      setError('Please provide both product codes or URLs');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Extract codes if user pasted URLs
      const sCode = extractCode(sourceCode);
      const tCode = extractCode(targetCode);

      const response = await axios.post('/api/deals/link', {
        sourceProductCode: sCode,
        targetProductCode: tCode
      });

      setSuccess(`Success! ${response.data.message}. These products will now display together on the website.`);
      setSourceCode('');
      setTargetCode('');
    } catch (err: any) {
      console.error('Link error', err);
      setError(err.response?.data?.error || 'An error occurred while linking products.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="matching-page">
      <div className="matching-header">
        <h1>Manual Product Linker</h1>
        <p>Force two separate listings (e.g. Amazon & Flipkart) to share the same unique Match ID so they display as a single product.</p>
      </div>

      <div className="matching-card">
        <form onSubmit={handleLink}>
          <div className="form-group">
            <label>Product 1 (Code or URL)</label>
            <input 
              type="text" 
              placeholder="e.g. B0CHX4W743 or https://amazon.in/..." 
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
            />
          </div>

          <div className="link-icon">🔗</div>

          <div className="form-group">
            <label>Product 2 (Code or URL)</label>
            <input 
              type="text" 
              placeholder="e.g. MOBGTEYGXXXX or https://flipkart.com/..." 
              value={targetCode}
              onChange={(e) => setTargetCode(e.target.value)}
            />
          </div>

          <button type="submit" className="link-btn" disabled={loading}>
            {loading ? 'Linking...' : 'Merge Products'}
          </button>
        </form>

        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}
      </div>

      <div className="info-card">
        <h3>How it works</h3>
        <p>The scraper tries to automatically group products using Model Numbers or by extracting Key Specifications (RAM, Tons, Brand). If a product fails to group automatically, you can paste both URLs here. They will instantly merge on the live portal.</p>
      </div>
    </div>
  );
};

export default ProductMatchingPage;
