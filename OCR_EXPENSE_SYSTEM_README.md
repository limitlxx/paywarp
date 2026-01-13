# OCR Expense Tracking System

A comprehensive receipt scanning and expense tracking system built with Next.js, featuring dual OCR processing (Gemini AI + Tesseract.js) and integration with the PayWarp bucket system.

## Features

### 🔍 Dual OCR Processing
- **Gemini API**: Server-side processing with high accuracy (94-98%)
- **Tesseract.js**: Client-side processing for offline use (80-90% accuracy)
- **Hybrid Mode**: Intelligent fallback system for optimal results

### 📱 Dynamic Receipt Data Extraction
- **Core Fields**: Vendor, amount, date, currency
- **Extended Fields**: Subtotal, tax, tip, discount, payment method
- **Location Data**: Address, city, state, zip code
- **Contact Info**: Phone, email, website
- **Itemized Lists**: Individual items with prices and quantities
- **Business Classification**: Auto-categorization by business type

### 💰 Bucket Integration
- Automatic expense categorization
- Smart bucket allocation suggestions
- Integration with existing PayWarp bucket system
- Recurring expense tracking

### 📊 Analytics & Reporting
- Monthly expense trends
- Category-based breakdowns
- Confidence scoring
- Export capabilities (CSV/JSON)

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Routes     │    │   OCR Services  │
│                 │    │                  │    │                 │
│ • Upload UI     │◄──►│ /api/ocr/        │◄──►│ • Gemini API    │
│ • Settings      │    │   extract-       │    │ • Tesseract.js  │
│ • History       │    │   receipt-       │    │ • Hybrid Logic  │
│ • Analytics     │    │   enhanced       │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Local Storage │    │   Rate Limiting  │    │   Data Processing│
│                 │    │                  │    │                 │
│ • Expenses      │    │ • IP-based       │    │ • Validation    │
│ • Settings      │    │ • 100 req/15min  │    │ • Normalization │
│ • OCR Cache     │    │ • Error Handling │    │ • Confidence    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Installation & Setup

### 1. Install Dependencies

```bash
npm install @google/genai react-dropzone tesseract.js
```

### 2. Environment Variables

Add to your `.env` file:

```env
# Gemini API Key (get from https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Provider Setup

The OCR context is already integrated into your providers:

```tsx
// components/providers.tsx
import { OCRModeProvider } from '@/contexts/ocr-mode-context'

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <Web3Providers>
        {/* ... other providers */}
        <OCRModeProvider>
          {children}
        </OCRModeProvider>
      </Web3Providers>
    </ThemeProvider>
  )
}
```

## Usage

### Basic Receipt Scanning

```tsx
import { EnhancedExpenseForm } from '@/components/enhanced-expense-form'
import { useExpenseTracking } from '@/hooks/use-expense-tracking'

function ExpensePage() {
  const { addExpense } = useExpenseTracking()

  const handleExpenseSubmitted = (data) => {
    addExpense(data, {
      bucketId: 'billings',
      category: 'office-supplies',
      tags: ['business', 'tax-deductible']
    })
  }

  return (
    <EnhancedExpenseForm
      onExpenseSubmitted={handleExpenseSubmitted}
    />
  )
}
```

### OCR Mode Management

```tsx
import { useOCRMode } from '@/contexts/ocr-mode-context'

function SettingsPage() {
  const { mode, setMode, isOnline } = useOCRMode()

  return (
    <div>
      <select value={mode} onChange={(e) => setMode(e.target.value)}>
        <option value="hybrid">Hybrid (Recommended)</option>
        <option value="gemini" disabled={!isOnline}>Gemini API</option>
        <option value="tesseract">Tesseract.js</option>
      </select>
    </div>
  )
}
```

### Expense Analytics

```tsx
import { useExpenseTracking } from '@/hooks/use-expense-tracking'

function AnalyticsPage() {
  const { stats, expenses, exportExpenses } = useExpenseTracking()

  const downloadCSV = () => {
    const csv = exportExpenses('csv')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'expenses.csv'
    a.click()
  }

  return (
    <div>
      <h2>Total Expenses: ${stats.totalAmount}</h2>
      <h3>This Month: ${stats.thisMonth}</h3>
      <button onClick={downloadCSV}>Export CSV</button>
    </div>
  )
}
```

## API Routes

### POST /api/ocr/extract-receipt-enhanced

Enhanced OCR processing with comprehensive data extraction.

**Request:**
```json
{
  "imageBase64": "base64_encoded_image",
  "mimeType": "image/jpeg",
  "extractionMode": "comprehensive"
}
```

**Response:**
```json
{
  "success": true,
  "structuredData": {
    "merchant": "Starbucks",
    "total": 15.47,
    "currency": "USD",
    "date": "2024-01-15",
    "items": [
      {
        "name": "Grande Latte",
        "price": 5.25,
        "quantity": 1
      }
    ],
    "location": {
      "address": "123 Main St",
      "city": "San Francisco",
      "state": "CA"
    }
  },
  "confidence": 0.94,
  "processedAt": "2024-01-15T10:30:00Z"
}
```

### POST /api/ocr/extract-receipt

Legacy endpoint for backward compatibility (basic extraction mode).

## Configuration Options

### OCR Modes

1. **Gemini API** (Recommended)
   - Highest accuracy (94-98%)
   - Structured data extraction
   - Requires internet connection
   - Small API costs (~$0.001 per image)

2. **Tesseract.js** (Offline)
   - Works offline
   - No API costs
   - Lower accuracy (80-90%)
   - Slower processing

3. **Hybrid Mode** (Best of Both)
   - Tries Gemini first
   - Falls back to Tesseract if needed
   - Optimal balance of accuracy and reliability

### Rate Limiting

- 100 requests per 15 minutes per IP
- Configurable in API routes
- Error handling with fallback suggestions

### Data Validation

- Amount range validation (0-$100,000)
- Date reasonableness checks (within 1 year)
- Vendor name validation
- Confidence scoring based on completeness

## Integration with PayWarp Buckets

### Automatic Bucket Suggestions

```tsx
const suggestBucket = (expense) => {
  // Business expenses → billings bucket
  if (['office-supplies', 'software'].includes(expense.category)) {
    return 'billings'
  }
  
  // Large amounts → growth bucket
  if (expense.amount > 1000) {
    return 'growth'
  }
  
  // Daily expenses → spendable bucket
  if (['meals', 'groceries'].includes(expense.category)) {
    return 'spendable'
  }
  
  return 'instant'
}
```

### Recurring Expense Management

```tsx
const addRecurringExpense = (expense, frequency) => {
  addExpense(expense, {
    recurring: {
      frequency: 'monthly',
      nextDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoProcess: true
    }
  })
}
```

## Performance Optimization

### Client-Side Caching
- OCR results cached by image hash
- Settings persisted in localStorage
- Offline-first architecture

### Image Processing
- Automatic image compression
- Format conversion (JPEG/PNG/WebP)
- Size limits (10MB max)

### Error Handling
- Graceful fallbacks between OCR modes
- Retry logic for network failures
- User-friendly error messages

## Security Considerations

### API Key Protection
- Gemini API key stored server-side only
- Rate limiting to prevent abuse
- Input validation and sanitization

### Data Privacy
- Images processed temporarily
- No permanent storage of receipt images
- Local storage for expense data

## Testing

### Unit Tests
```bash
npm run test
```

### Integration Tests
```bash
# Test OCR processing
curl -X POST http://localhost:3000/api/ocr/extract-receipt-enhanced \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"...","mimeType":"image/jpeg"}'
```

### Manual Testing Checklist
- [ ] Upload various receipt types
- [ ] Test offline mode (Tesseract)
- [ ] Verify data extraction accuracy
- [ ] Check bucket integration
- [ ] Test export functionality

## Troubleshooting

### Common Issues

1. **Gemini API Key Not Working**
   - Verify key is correct in `.env`
   - Check API quota limits
   - Ensure billing is enabled

2. **Tesseract Loading Slowly**
   - Check network connection for worker files
   - Consider hosting Tesseract assets locally
   - Optimize image size before processing

3. **Low OCR Accuracy**
   - Ensure good image quality
   - Check lighting and focus
   - Try different OCR modes
   - Manually correct extracted data

### Debug Mode

Enable debug logging:
```tsx
const ocrProcessor = new EnhancedOCRProcessor('/api/ocr', {
  debug: true,
  logLevel: 'verbose'
})
```

## Future Enhancements

### Planned Features
- [ ] Multi-language OCR support
- [ ] Receipt image storage (IPFS/Arweave)
- [ ] Machine learning for better categorization
- [ ] Bulk receipt processing
- [ ] Mobile app integration
- [ ] Voice-to-expense conversion
- [ ] Integration with accounting software

### Performance Improvements
- [ ] WebAssembly Tesseract optimization
- [ ] Image preprocessing pipeline
- [ ] Caching layer for frequent vendors
- [ ] Background processing queue

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

This OCR expense tracking system is part of the PayWarp project and follows the same licensing terms.

---

For support or questions, please refer to the main PayWarp documentation or create an issue in the repository.