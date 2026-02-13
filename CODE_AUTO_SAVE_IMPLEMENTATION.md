# Code Auto-Save and Auto-Submit Implementation

## Overview
Implemented automatic code persistence and auto-submission. When you enter a code and submit it, the code is saved to localStorage. When you refresh the page or reopen the app, the code is automatically restored AND submitted - you'll see your exam list immediately without having to click anything.

## Changes Made

### 1. Modified `src/components/public/MultiExamEntry.tsx`

#### Added Auto-Restore and Auto-Submit
- **State Management**: Added `hasAutoSubmitted` flag to prevent duplicate submissions
- **Code Storage**: Stores valid codes after successful verification
- **Auto-Submit**: Automatically submits stored code on page load

#### Key Features

##### 1. Restore and Auto-Submit on Mount
```typescript
// Restore code from localStorage on mount and auto-submit
useEffect(() => {
  if (storedCode && !code && !propCode && !codeParam && !hasAutoSubmitted && codeSettings) {
    setCode(storedCode);
    // Auto-submit the stored code
    setHasAutoSubmitted(true);
    void verifyCode(storedCode);
  }
}, [storedCode, code, propCode, codeParam, hasAutoSubmitted, codeSettings, verifyCode]);
```

##### 2. Save Valid Codes After Verification
```typescript
// In verifyCode function
const data = await res.json();
const items: ByCodeExamItem[] = data?.exams || [];
setStudentName(data?.student_name || null);

// Store the valid code
await storeCode(c, data?.student_id);
```

##### 3. Clear Invalid Codes
```typescript
if (!res.ok) {
  setError(t(locale, "code_not_found"));
  // Clear stored code if it's invalid
  clearStoredCode('code not found');
  return;
}
```

## How It Works

### User Experience Flow

1. **First Visit - Enter Code**
   - User enters code in the input field
   - User clicks submit button
   - Code is verified against the API
   - If valid, code is saved to localStorage (encrypted)
   - Exam list is displayed

2. **Page Refresh / App Reopen**
   - Component initializes and checks localStorage
   - If valid saved code exists, it's automatically restored
   - Code is automatically submitted (verifyCode is called)
   - Exam list appears immediately - no button click needed
   - User sees their exams without any action

3. **Invalid Code Handling**
   - If stored code becomes invalid, it's automatically cleared
   - User sees empty form and can enter a new code

### Security Features

The auto-save leverages the existing `useStudentCode` hook which provides:

- **Encryption**: Code is encrypted before storage using `encryptData()`
- **Validation**: Stored codes are validated on retrieval
- **Expiration**: Codes expire after 7 days
- **Attempt Tracking**: Failed validation attempts are tracked
- **Rate Limiting**: Protection against excessive validation attempts
- **Audit Logging**: Security events are logged

### Technical Details

#### Initialization Flow
1. Component mounts and checks for `storedCode` from `useStudentCode` hook
2. Waits for `codeSettings` to be loaded from API
3. If all conditions are met (has storedCode, no other code sources, not already submitted):
   - Sets the code in state
   - Marks as auto-submitted
   - Calls `verifyCode()` to fetch and display exams

#### Conditions for Auto-Submit
Auto-submit only happens when ALL of these are true:
- `storedCode` exists in localStorage
- No `code` in component state
- No `propCode` passed as prop
- No `codeParam` in URL query string
- `hasAutoSubmitted` is false (prevents duplicate submissions)
- `codeSettings` are loaded

#### Storage Timing
Code is saved to localStorage:
- After successful API verification in `verifyCode()`
- After successful exam access in `startOrContinueExam()`
- Only valid codes are stored

#### Cleanup
Code is cleared from localStorage when:
- API returns "code not found" error
- User clicks "Change Code" button
- User clicks "Clear Code" button
- Code validation fails multiple times (security feature)

## Benefits

1. **Zero Friction**: User doesn't need to re-enter or re-submit code
2. **Instant Access**: Exam list appears immediately on page load
3. **Seamless Experience**: Completely automatic - user doesn't notice anything
4. **Data Persistence**: Code survives browser crashes, tab closes, refreshes
5. **Security**: Encrypted storage with validation and expiration
6. **Reliability**: Graceful error handling and automatic cleanup

## Testing Recommendations

1. **Basic Flow**
   - Enter code → Submit → Refresh page → Should see exam list immediately

2. **Invalid Code**
   - Enter invalid code → Refresh → Should see empty form (code cleared)

3. **Multiple Refreshes**
   - Submit code → Refresh multiple times → Should work every time

4. **Change Code**
   - Submit code → Click "Change Code" → Enter new code → Refresh → Should use new code

5. **URL Parameters**
   - If URL has `?code=1234`, should use URL code instead of stored code

## Related Files

- `src/components/public/MultiExamEntry.tsx` - Main implementation
- `src/hooks/useStudentCode.ts` - Storage and validation logic
- `src/lib/security.ts` - Encryption utilities
- `src/components/CodeInputForm.tsx` - Code input component (simplified)

## Notes

- Auto-submit only works in "full" mode (not "exams-only" mode)
- URL parameters take precedence over stored codes
- Invalid codes are automatically cleared to prevent confusion
- The `hasAutoSubmitted` flag prevents infinite loops
- Code is only saved after successful API verification
