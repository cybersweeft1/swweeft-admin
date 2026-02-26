/**
 * Cyber Sweeft Config - Hidden Configuration
 * DO NOT COMMIT THIS FILE TO PUBLIC REPOS
 */

const CONFIG = {
  // Google Sheets - using opensheet public API (no auth needed for read)
  SHEET_ID: '1CdOJ_j-yT7MudoCRd4GFL7bBsKs_wK96ipIStAKO7XY',
  SHEET_NAME: 'sweeft projects',
  
  // Paystack Public Key
  PAYSTACK_KEY: 'pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  
  // Fixed price for all projects
  PRICE: 2500,
  
  // LocalStorage key for purchases
  STORAGE_KEY: 'cybersweeft_purchases_v1'
};

// Make available globally
window.CONFIG = CONFIG;
