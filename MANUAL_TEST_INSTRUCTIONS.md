# Add Asset Feature - Manual Test Instructions

## How to Test the Add Asset Feature

### Prerequisites
1. Open `index.html` in a web browser
2. Open browser developer console (F12) for additional test information

### Test 1: Modal Opening and Closing
1. Click the "Add Asset" button in the Assets tab
2. **Expected**: Modal should open with title "Add Asset"
3. **Expected**: Modal should contain all required form fields
4. Click the "×" button or "Cancel" to close
5. **Expected**: Modal should close and return focus to the tab

### Test 2: Dropdown Functionality
1. Open the Add Asset modal
2. Test the **Type dropdown**:
   - Click the dropdown
   - **Expected**: Should show options: Stock, ETF, Crypto, Bond, Other
   - Select "Stock"
   - **Expected**: Selection should be visible and saved
3. Test the **Currency dropdown**:
   - Click the currency dropdown
   - **Expected**: Should show options: USD, EUR, DKK, GBP, SEK, NOK
   - Select "EUR"
   - **Expected**: Selection should be visible and saved

### Test 3: Currency Picker Impact
1. In the Add Asset modal, select different currencies
2. Enter a symbol like "AAPL" and select "Stock" as type
3. **Expected**: When currency changes, validation message should update with correct currency
4. Change the main **Display Currency** in the header
5. **Expected**: All portfolio values should update to reflect the new currency

### Test 4: Real-time Calculations
1. Open Add Asset modal
2. Enter in the **Current Price** field: `100`
3. Enter in the **Shares/Quantity** field: `10`
4. **Expected**: A "Current Value: $1,000.00" message should appear below the shares field
5. Change the price to `200`
6. **Expected**: The calculated value should update to "$2,000.00"
7. Change the currency to EUR
8. **Expected**: The calculated value should update to show EUR formatting

### Test 5: Symbol Validation and Auto-population
1. Open Add Asset modal
2. Select "Stock" as type
3. Enter symbol "AAPL" in the Symbol field
4. Click outside the symbol field (blur event)
5. **Expected**: Name field should auto-populate with "Apple Inc." or similar
6. **Expected**: Current Price should auto-populate with current price
7. **Expected**: Validation message should appear showing the found asset
8. Try with crypto: Select "Crypto" type and enter "bitcoin"
9. **Expected**: Should auto-populate with Bitcoin information

### Test 6: Form Submission
1. Fill out a complete form:
   - Symbol: "TESTASSET"
   - Type: "Stock"
   - Name: "Test Asset Corp"
   - Current Price: "75.50"
   - Shares: "15"
   - Total Cost Basis: "1000"
   - Growth Rate: "8.0"
2. Click "Save Asset"
3. **Expected**: Success notification should appear
4. **Expected**: Modal should close
5. **Expected**: New asset should appear in the assets table
6. **Expected**: Portfolio summary should update with new totals

### Test 7: Validation Errors
1. Try submitting with missing fields
2. **Expected**: Error notification for missing required fields
3. Try entering negative values for shares or total contributed
4. **Expected**: Appropriate error messages
5. Try entering invalid numbers
6. **Expected**: Form should prevent submission and show errors

### Test 8: Currency Conversion
1. Add an asset with EUR currency
2. Set display currency to USD
3. **Expected**: Asset values should be converted and displayed in USD
4. Change display currency back to EUR
5. **Expected**: Values should convert back to EUR display

## Additional Tests via Console
Open browser console and run:
```javascript
// Run comprehensive test suite
window.assetTestSuite.runTests();

// Manual test specific features
window.app.openAssetModal(); // Should open modal
```

## Expected Results Summary
- ✅ Modal opens/closes properly
- ✅ All dropdowns function correctly
- ✅ Currency picker affects calculations and validation
- ✅ Real-time calculation of current value works
- ✅ Symbol validation auto-populates fields
- ✅ Form validation prevents invalid submissions
- ✅ Assets are successfully created and added to portfolio
- ✅ Currency conversion works throughout the application

## Troubleshooting
If any test fails:
1. Check browser console for error messages
2. Ensure JavaScript is enabled
3. Verify all files are loaded correctly
4. Check network requests in developer tools (for price fetching)

## Demo Mode
The application has demo data for testing. If external APIs fail, it will use predefined prices for common symbols like AAPL, MSFT, bitcoin, etc.