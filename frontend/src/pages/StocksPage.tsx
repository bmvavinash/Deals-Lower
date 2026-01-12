import React from 'react';
import { useQuery } from 'react-query';
import { stocksAPI } from '../services/api';
import './StocksPage.css';

const StocksPage: React.FC = () => {
  const { data: zerodhaData } = useQuery('zerodha', stocksAPI.getZerodha);
  const { data: xalphaData } = useQuery('xalpha', stocksAPI.getXAlpha);
  const { data: recommendationsData } = useQuery('recommendations', stocksAPI.getRecommendations);

  return (
    <div className="stocks-page">
      <h1>Stocks & Trading</h1>

      <div className="stocks-section">
        <h2>Zerodha Holdings</h2>
        {zerodhaData?.data?.success ? (
          <div className="table-container">
            <table className="stocks-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Qty</th>
                  <th>Avg Cost</th>
                  <th>LTP</th>
                  <th>Cur Val</th>
                  <th>PnL</th>
                  <th>Day Chg</th>
                </tr>
              </thead>
              <tbody>
                {(zerodhaData.data.data || []).map((stock: any, idx: number) => (
                  <tr key={idx}>
                    <td>{stock.Instrument}</td>
                    <td>{stock.Qty}</td>
                    <td>{stock.AvgCost}</td>
                    <td>{stock.LTP}</td>
                    <td>{stock.CurVal}</td>
                    <td className={stock.PnL >= 0 ? 'positive' : 'negative'}>{stock.PnL}</td>
                    <td className={stock.DayChg >= 0 ? 'positive' : 'negative'}>{stock.DayChg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-data">No Zerodha data available. Ensure the main application is running.</div>
        )}
      </div>

      <div className="stocks-section">
        <h2>X Alpha Crypto Data</h2>
        {xalphaData?.data?.success ? (
          <div className="table-container">
            <pre>{JSON.stringify(xalphaData.data.data, null, 2)}</pre>
          </div>
        ) : (
          <div className="no-data">No X Alpha data available. Ensure the main application is running.</div>
        )}
      </div>

      <div className="stocks-section">
        <h2>Stock Recommendations</h2>
        {recommendationsData?.data?.success ? (
          <div className="table-container">
            <table className="stocks-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Score</th>
                  <th>Stock Match</th>
                  <th>Duration Match</th>
                  <th>Low Price Match</th>
                  <th>Target Match</th>
                  <th>Stop Loss Match</th>
                </tr>
              </thead>
              <tbody>
                {(recommendationsData.data.data || []).map((rec: any, idx: number) => (
                  <tr key={idx}>
                    <td>{rec.Instrument}</td>
                    <td>{rec.RecommendationScore}</td>
                    <td>{rec.stockMatch ? '✓' : '✗'}</td>
                    <td>{rec.durationMatch ? '✓' : '✗'}</td>
                    <td>{rec.lowPriceMatch ? '✓' : '✗'}</td>
                    <td>{rec.targetMatch ? '✓' : '✗'}</td>
                    <td>{rec.stoplossMatch ? '✓' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-data">No recommendations available.</div>
        )}
      </div>
    </div>
  );
};

export default StocksPage;


















