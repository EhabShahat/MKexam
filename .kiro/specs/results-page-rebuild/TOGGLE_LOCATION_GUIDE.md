# Feature Toggle Location Guide

## Where to Find the Toggle

The "New Results Page (Beta)" toggle is now integrated into the Results page. Here's exactly where to find it:

### Visual Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Exam Results                        [Manage Extra Scores]  │ ← Header
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  New Results Page (Beta)                          [Toggle]  │ ← FEATURE TOGGLE (Look here!)
│  Enable the rebuilt Results page with improved performance  │
│  and modular architecture.                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  📋 Select Exam                            0 available       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [All] [Published] [Completed]                      │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔍 Search exams by title...                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  [All Exams]  [Matrix View]  [Exam 1]  [Exam 2]  ...       │
└─────────────────────────────────────────────────────────────┘
```

## What It Looks Like

### When Disabled (Default)
```
┌──────────────────────────────────────────────────────────┐
│ New Results Page (Beta)                      ⚪ OFF      │
│ Enable the rebuilt Results page with improved            │
│ performance and modular architecture.                    │
└──────────────────────────────────────────────────────────┘
```
- Gray/white background
- Toggle switch is OFF (gray circle on left)
- No additional messages

### When Enabled
```
┌──────────────────────────────────────────────────────────┐
│ New Results Page (Beta)                      🟢 ON       │
│ Enable the rebuilt Results page with improved            │
│ performance and modular architecture. Refresh the page   │
│ to see the new implementation.                           │
│                                                           │
│ ⓘ Note: The new implementation is currently in beta.    │
│   You can switch back to the old version at any time    │
│   by toggling this off.                                  │
└──────────────────────────────────────────────────────────┘
```
- Light blue background (info box)
- Toggle switch is ON (green circle on right)
- Additional note about beta status appears

## Step-by-Step Instructions

### 1. Navigate to Results Page
- Open your browser
- Go to: `http://your-domain/admin/results`
- Or click "Results" in the admin navigation menu

### 2. Locate the Toggle
- Look at the top of the page, just below the header
- You'll see a gray/white box with "New Results Page (Beta)"
- This appears BEFORE the "Select Exam" section

### 3. Click the Toggle
- Click on the toggle switch on the right side
- It will turn green and move to the right
- An alert will appear: "New Results Page enabled. Refresh the page to see changes."
- Click OK

### 4. Refresh the Page
- Press F5 (or Cmd+R on Mac)
- Or click the browser refresh button
- The page will reload with the new implementation

### 5. Verify It's Working
- The toggle should still be ON (green) after refresh
- The page layout may look slightly different
- Performance should be noticeably faster

## Troubleshooting

### "I don't see the toggle"

**Possible causes:**
1. **Page hasn't loaded yet**: Wait a few seconds for the page to fully load
2. **JavaScript error**: Check browser console (F12) for errors
3. **Cache issue**: Hard refresh with Ctrl+F5 (Cmd+Shift+R on Mac)
4. **Old code**: Make sure you've pulled the latest code changes

**Solutions:**
- Clear browser cache and reload
- Try in incognito/private mode
- Check that `ResultsPageFeatureToggle.tsx` exists in `src/components/results/`
- Verify the import is in `src/app/admin/results/page.tsx`

### "Toggle doesn't stay enabled after refresh"

**Possible causes:**
1. **localStorage disabled**: Browser privacy settings blocking localStorage
2. **Incognito mode**: localStorage doesn't persist in private browsing
3. **Browser extension**: Ad blocker or privacy extension interfering

**Solutions:**
- Check browser console for localStorage errors
- Try in a different browser
- Disable browser extensions temporarily
- Use the console method instead (see below)

### "Alert appears but nothing changes"

**Possible causes:**
1. **Forgot to refresh**: The toggle requires a page refresh to take effect
2. **New implementation not built**: Code changes not deployed

**Solutions:**
- Make sure to press F5 to refresh after toggling
- Check that the new Results page components exist
- Verify the feature flag logic in `src/lib/featureFlags.ts`

## Alternative: Console Method

If the toggle doesn't work, use the browser console:

1. Press F12 to open DevTools
2. Go to the Console tab
3. Type this command:
```javascript
localStorage.setItem('feature_flag_new_results_page', 'true');
location.reload();
```
4. Press Enter

The page will refresh with the new implementation enabled.

## Checking Current Status

To check if the feature flag is currently enabled:

1. Open browser console (F12)
2. Type:
```javascript
localStorage.getItem('feature_flag_new_results_page')
```
3. Press Enter

**Result:**
- `"true"` = New implementation is enabled
- `"false"` = Old implementation is active
- `null` = Default (old implementation)

## Need Help?

If you're still having trouble:
1. Take a screenshot of the Results page
2. Check browser console for errors (F12 → Console tab)
3. Note your browser and version
4. Contact the development team with this information

---

**Last Updated**: Phase 6 - Task 9.3 (User Acceptance Testing)
