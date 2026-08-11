import { InventoryItem } from '../types';
import { getAccessToken } from './auth';

const SPREADSHEET_ID_KEY = 'inventory_spreadsheet_id';
const SHEET_NAME = 'Inventory';

export const getOrCreateSpreadsheet = async (): Promise<string> => {
  let spreadsheetId = localStorage.getItem(SPREADSHEET_ID_KEY);
  
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  if (spreadsheetId) {
    // Verify if it still exists and we have access
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        return spreadsheetId;
      }
    } catch (e) {
      console.warn("Spreadsheet not found or no access, creating a new one.");
    }
  }

  // Try to find it in Google Drive
  try {
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='Inventory Management Data' and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id)`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        spreadsheetId = searchData.files[0].id;
        localStorage.setItem(SPREADSHEET_ID_KEY, spreadsheetId);
        return spreadsheetId;
      }
    }
  } catch (e) {
    console.warn("Failed to search Drive", e);
  }

  // Create a new spreadsheet
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: 'Inventory Management Data'
      },
      sheets: [
        {
          properties: {
            title: SHEET_NAME
          }
        }
      ]
    })
  });
  
  if (!res.ok) {
    throw new Error('Failed to create spreadsheet');
  }

  const data = await res.json();
  spreadsheetId = data.spreadsheetId;
  
  if (spreadsheetId) {
    localStorage.setItem(SPREADSHEET_ID_KEY, spreadsheetId);
    
    // Set up headers
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAME}!A1:F1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [['ID', 'SKU', 'Name', 'Category', 'Location', 'LastUpdated']]
      })
    });
    
    return spreadsheetId;
  }
  
  throw new Error('Could not create spreadsheet');
}

export const loadInventoryFromSheets = async (): Promise<InventoryItem[]> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  
  const spreadsheetId = await getOrCreateSpreadsheet();
  
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAME}!A2:H`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!res.ok) throw new Error('Failed to load data');
  
  const data = await res.json();
  const rows = data.values || [];
  
  return rows.map((row: any[]) => {
    // Check if row has the old 8 column format (with quantity/price at 4,5)
    // or the new 6 column format.
    const isOldFormat = row.length > 6 && (row[6] || row[7]); // Usually location and lastUpdated are at 6,7 in old format
    
    return {
      id: row[0] || crypto.randomUUID(),
      sku: row[1] || '',
      name: row[2] || '',
      category: row[3] || '',
      location: isOldFormat ? (row[6] || '') : (row[4] || ''),
      lastUpdated: isOldFormat ? (row[7] || new Date().toISOString()) : (row[5] || new Date().toISOString())
    };
  });
};

export const saveInventoryToSheets = async (items: InventoryItem[]): Promise<void> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  
  const spreadsheetId = await getOrCreateSpreadsheet();
  
  // First clear the sheet below headers to avoid leftover rows
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAME}!A2:H:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const values = items.map(item => [
    item.id,
    item.sku,
    item.name,
    item.category,
    item.location,
    item.lastUpdated
  ]);
  
  if (values.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAME}!A2:F?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    });
  }
};
