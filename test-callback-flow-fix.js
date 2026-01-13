/**
 * Test Callback Flow Fix
 * Verifies that callbacks are not consumed before verification is complete
 */

// Mock PaystackStorage for testing
const mockStorage = {
  data: {},
  
  getCallback() {
    return this.data.callback || null
  },
  
  storeCallback(callback) {
    this.data.callback = callback
    console.log('📝 Callback stored:', callback.reference)
  },
  
  clearCallback() {
    delete this.data.callback
    console.log('🧹 Callback cleared')
  },
  
  get