
const fs = require("fs");
fs.appendFileSync("frontend/src/components/Deals/ExpandableDealCard.css", `

/* Validation Status Styling */
.deal-card-valid {
  border-left: 5px solid #4CAF50;
}

.deal-card-blocked {
  background-color: #f5f5f5;
  opacity: 0.85;
  border-left: 5px solid #9e9e9e;
}

.deal-validation-badge {
  font-size: 0.85rem;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
  margin-top: 8px;
  display: inline-block;
}

.badge-valid {
  background-color: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

.badge-blocked {
  background-color: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}

.validation-reasons {
  margin-top: 6px;
  font-size: 0.8rem;
  color: #c62828;
}

.validation-reasons ul {
  margin: 4px 0 0 16px;
  padding: 0;
}

/* Inline Edit Styling */
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px dashed #ccc;
}

.edit-form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.edit-form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #555;
}

.edit-form-group input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.edit-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.btn-save {
  background-color: #2196F3;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.btn-save:hover {
  background-color: #1976D2;
}

.btn-cancel {
  background-color: #e0e0e0;
  color: #333;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.btn-cancel:hover {
  background-color: #bdbdbd;
}

.edit-button {
  background-color: #ff9800;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  margin-left: 8px;
  font-size: 0.85rem;
}
.edit-button:hover {
  background-color: #f57c00;
}
`);

