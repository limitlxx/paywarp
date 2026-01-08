#!/usr/bin/env node

/**
 * Clear read-only mode from localStorage
 * Run this script if users are stuck in read-only mode
 */

console.log('Clearing read-only mode...')

// This would be run in the browser console or as part of app initialization
const clearScript = `
if (typeof window !== 'undefined' && window.localStorage) {
  const stored = localStorage.getItem('paywarp_readonly_mode');
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed.reason && parsed.reason.toLowerCase().includes('price')) {
      localStorage.removeItem('paywarp_readonly_mode');
      console.log('Cleared price-feed related read-only mode');
    }
  }
}
`

console.log('Add this to your browser console to clear read-only mode:')
console.log(clearScript)