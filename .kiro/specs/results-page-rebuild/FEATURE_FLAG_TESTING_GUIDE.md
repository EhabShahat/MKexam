# Feature Flag Testing Guide

## Overview

This guide explains how to enable and test the new Results Page implementation using the feature flag system. The feature flag allows you to safely switch between the old and new implementations without code changes.

## Feature Flag System

The feature flag system uses **localStorage** to persist the user's choice across sessions. This means:
- Each user can independently enable/disable the new implementation
- The choice persists across browser sessions
- No server-side configuration needed
- Easy rollback by toggling off

## How to Enable the Feature Flag

### Method 1: Using the Admin UI Toggle (Recommended)

1. **Navigate to the Results Page**
   - Go to `/admin/results` in your browser
   - You should see the current (old) Results page implementation

2. **Locate the Feature Toggle**
   - At the top of the page, you'll see a toggle component labeled "New Results Page (Beta)"
   - The toggle shows the current state (enabled/disabled)

3. **Enable the New Implementation**
   - Click the toggle switch to turn it ON (green)
   - You'll see an alert: "New Results Page enabled. Refresh the page to see changes."
   - Click OK on the alert

4. **Refresh the Page**
   - Press F5 or Ctrl+R (Cmd+R on Mac) to refresh
   - The new Results Page implementation will now load

5. **Verify the Change**
   - Check that the page layout and components match the new design
   - Look for improved performance and modular components

### Method 2: Using Browser Console (For Developers)

If you prefer to use the browser console:

```javascript
// Enable the new Results Page
localStorage.setItem('feature_flag_new_results_page', 'true');
location.reload();

// Disable the new Results Page (revert to old)
localStorage.setItem('feature_flag_new_results_page', 'false');
location.reload();

// Check current status
console.log('New Results Page enabled:', localStorage.getItem('feature_flag_new_results_page') === 'true');

// Reset to default (disabled)
localStorage.removeItem('feature_flag_new_results_page');
location.reload();
```

## Testing Workflow

### Phase 1: Internal Dev Team Testing (Week 1)

**Objective**: Validate core functionality and identify critical issues

**Steps**:

1. **Enable the feature flag** using Method 1 or 2 above

2. **Test Core Functionality**:
   - [ ] Exam selection and filtering
   - [ ] Individual exam view with attempts table
   - [ ] All exams aggregated view
   - [ ] Student search and filtering
   - [ ] Date range filtering
   - [ ] Score sorting (ascending/descending)
   - [ ] Device info display
   - [ ] Manual grading indicators
   - [ ] Score breakdown overlay

3. **Test Actions**:
   - [ ] Export to CSV (individual and all exams)
   - [ ] Export to XLSX (individual and all exams)
   - [ ] Regrade all attempts
   - [ ] Delete attempt with confirmation
   - [ ] Refresh data

4. **Test Performance**:
   - [ ] Initial page load time (should be < 2 seconds)
   - [ ] Virtual scrolling with 50+ rows
   - [ ] Search input responsiveness (debounced)
   - [ ] Memory usage with large datasets

5. **Test Edge Cases**:
   - [ ] Empty states (no exams, no attempts)
   - [ ] Null scores and missing data
   - [ ] Arabic text in names and titles
   - [ ] Long exam titles and student names
   - [ ] Multiple attempts per student

6. **Document Issues**:
   - Create a list of bugs, UI issues, or performance problems
   - Note any differences from the old implementation
   - Capture screenshots or screen recordings if needed

### Phase 2: Limited Rollout (Week 2) - 10% of Users

**Objective**: Monitor real-world usage and collect feedback

**Steps**:

1. **Select Test Users**:
   - Choose 10% of admin users (preferably power users)
   - Provide them with instructions to enable the feature flag

2. **Provide Instructions**:
   - Send email or message with Method 1 instructions above
   - Include link to this guide
   - Set up feedback channel (email, form, or chat)

3. **Monitor Metrics**:
   - Track error rates in browser console
   - Monitor page load times
   - Watch for user complaints or confusion

4. **Collect Feedback**:
   - Ask users to report any issues immediately
   - Request feedback on usability and performance
   - Note any feature requests or improvements

5. **Address Critical Issues**:
   - Fix any blocking bugs immediately
   - Deploy fixes and ask users to test again
   - Document all changes

### Phase 3: Expanded Rollout (Week 3) - 50% of Users

**Objective**: Validate stability at scale

**Steps**:

1. **Expand User Base**:
   - Enable for 50% of admin users
   - Include a mix of power users and casual users

2. **Continue Monitoring**:
   - Track the same metrics as Phase 2
   - Compare performance between old and new implementations
   - Watch for any degradation in user experience

3. **Gather Comprehensive Feedback**:
   - Survey users on satisfaction (target: > 4.5/5)
   - Ask about specific features and improvements
   - Identify any remaining issues

4. **Final Adjustments**:
   - Address any remaining non-critical issues
   - Optimize based on user feedback
   - Prepare for full rollout

## Switching Back to Old Implementation

If you encounter issues or want to compare implementations:

### Using the Toggle
1. Go to `/admin/results`
2. Click the toggle to turn it OFF (gray)
3. Refresh the page
4. The old implementation will load

### Using Console
```javascript
localStorage.setItem('feature_flag_new_results_page', 'false');
location.reload();
```

## Comparison Testing

To compare old vs new implementations side-by-side:

1. **Open Two Browser Windows**:
   - Window 1: Enable feature flag (new implementation)
   - Window 2: Disable feature flag (old implementation)

2. **Test Same Scenarios**:
   - Select the same exam in both windows
   - Apply the same filters
   - Export the same data
   - Compare results

3. **Use Comparison Tools**:
   - See `COMPARISON_TESTING_README.md` for detailed comparison checklist
   - Use `comparison-test-runner.html` for automated comparison tests
   - Run `comparison-test-utils.ts` for data validation

## Troubleshooting

### Feature Flag Not Working

**Problem**: Toggle doesn't change the implementation

**Solutions**:
1. Check browser console for errors
2. Verify localStorage is enabled in your browser
3. Try clearing browser cache and cookies
4. Use incognito/private mode to test fresh

### Page Not Loading

**Problem**: Blank page or errors after enabling

**Solutions**:
1. Check browser console for error messages
2. Disable the feature flag and refresh
3. Clear browser cache
4. Report the error to the development team

### Performance Issues

**Problem**: Page is slow or unresponsive

**Solutions**:
1. Check if you have a large dataset (1000+ attempts)
2. Verify virtual scrolling is enabled (should activate at 50+ rows)
3. Check browser memory usage
4. Try disabling browser extensions
5. Report performance metrics to the team

## Monitoring and Metrics

### Key Metrics to Track

1. **Performance**:
   - Initial page load time (target: < 2 seconds)
   - Time to interactive (target: < 3 seconds)
   - Memory usage (target: < 100MB for 1000 rows)
   - Scroll performance (target: 60fps)

2. **Reliability**:
   - Error rate (target: < 1%)
   - API failure rate
   - Cache hit rate (target: > 70%)

3. **User Satisfaction**:
   - User feedback score (target: > 4.5/5)
   - Feature adoption rate
   - Issue reports

### How to Measure

**Browser DevTools**:
1. Open DevTools (F12)
2. Go to Performance tab
3. Record page load
4. Check metrics in the report

**Console Logging**:
```javascript
// Check React Query cache status
console.log('Cache status:', window.__REACT_QUERY_DEVTOOLS_CACHE__);

// Check feature flag status
console.log('Feature flags:', {
  enabled: localStorage.getItem('feature_flag_new_results_page') === 'true',
  timestamp: new Date().toISOString()
});
```

## Rollback Plan

If critical issues are discovered:

1. **Immediate Rollback**:
   - Instruct all users to disable the feature flag
   - Send communication with instructions
   - Monitor that users have switched back

2. **Fix Issues**:
   - Identify and fix the critical bugs
   - Test thoroughly in development
   - Prepare for re-rollout

3. **Re-enable**:
   - Start again from Phase 1 (internal testing)
   - Proceed more cautiously through phases

## Support and Feedback

### Reporting Issues

When reporting issues, include:
- Browser and version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots or screen recordings
- Browser console errors
- Network tab errors (if API-related)

### Feedback Channels

- **Email**: [your-team-email]
- **Issue Tracker**: [your-issue-tracker-url]
- **Chat**: [your-chat-channel]

## Next Steps

After successful testing in all phases:

1. **Task 9.6**: Full rollout to 100% of users
2. **Task 9.7**: Remove old implementation and feature flag code
3. **Documentation**: Update user guides and training materials

## Additional Resources

- `COMPARISON_TESTING_README.md` - Detailed comparison testing guide
- `COMPARISON_TESTING_CHECKLIST.md` - Comprehensive testing checklist
- `PERFORMANCE_BENCHMARKING.md` - Performance measurement guide
- `DEPLOYMENT_CHECKLIST.md` - Deployment procedures
- `MIGRATION_GUIDE.md` - Technical migration details
