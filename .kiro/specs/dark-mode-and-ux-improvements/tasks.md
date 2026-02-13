# Implementation Plan: Dark Mode and UX Improvements

## Overview

This implementation plan breaks down the dark mode and UX improvements feature into discrete, actionable tasks. The plan follows a phased approach: first enhancing the theme system, then implementing comprehensive dark mode styles, adding the results filter, and finally conducting cross-browser testing and accessibility validation.

## Tasks

- [x] 1. Enhance Theme System Foundation
  - Update useTheme hook with system preference detection and dark mode default
  - Add theme initialization script to prevent FOUC
  - Enhance ThemeToggle component with improved accessibility
  - _Requirements: 2.1, 2.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 6.1, 6.2, 6.5_

- [x] 2. Implement Core Theme Functionality
  - [x] 2.1 Update useTheme hook implementation
    - Add getInitialTheme() function with priority: localStorage → system preference → default 'dark'
    - Add detectSystemPreference() function using prefers-color-scheme media query
    - Update applyThemeToDocument() to set both class and color-scheme property
    - Add error handling for localStorage unavailability
    - Add systemPreference and isSystemPreferenceOverridden to return interface
    - _Requirements: 2.1, 2.8, 3.3, 3.4_

  - [x] 2.2 Write property test for theme persistence round trip
    - **Property 8: Theme Persistence Round Trip**
    - **Validates: Requirements 3.4**

  - [x] 2.3 Write property test for theme default
    - **Property 6: Dark Mode Default**
    - **Validates: Requirements 2.1**

  - [x] 2.4 Write property test for system preference detection
    - **Property 7: System Preference Detection**
    - **Validates: Requirements 2.8**

  - [x] 2.5 Add theme initialization script to layout.tsx
    - Create inline script in <head> that executes before React hydration
    - Implement synchronous theme detection: localStorage → system preference → 'dark'
    - Apply theme class and color-scheme to document.documentElement
    - Wrap in try-catch with fallback to 'dark' theme
    - _Requirements: 3.5, 6.2, 6.5_

  - [x] 2.6 Write property test for FOUC prevention
    - **Property 11: FOUC Prevention**
    - **Validates: Requirements 3.5, 6.2**

  - [x] 2.7 Write property test for synchronous theme loading
    - **Property 16: Synchronous Theme Loading**
    - **Validates: Requirements 6.5**

  - [x] 2.8 Enhance ThemeToggle component
    - Add handleKeyDown function for Enter and Space key support
    - Update ARIA attributes: aria-label, aria-pressed, role="switch"
    - Optimize icon rendering with proper aria-hidden attributes
    - Add size prop for different toggle sizes
    - _Requirements: 3.6, 3.7, 3.8_

  - [x] 2.9 Write property test for keyboard accessibility
    - **Property 13: Keyboard Accessibility**
    - **Validates: Requirements 3.7**

  - [x] 2.10 Write property test for theme icon consistency
    - **Property 12: Theme Icon Consistency**
    - **Validates: Requirements 3.6**

- [x] 3. Checkpoint - Verify theme system works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Comprehensive Dark Mode Styles
  - Audit existing CSS and add missing dark mode variables
  - Implement dark mode for all admin pages
  - Implement dark mode for all public pages
  - Implement dark mode for all shared components
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 4.1, 4.2, 4.3, 4.6, 4.7, 4.8_

- [x] 5. Enhance CSS Color System
  - [x] 5.1 Audit and enhance CSS custom properties in globals.css
    - Review existing :root and :root.dark color variables
    - Add any missing dark mode color variables for components
    - Ensure semantic naming for all color variables
    - Verify dark background is near-black (#0f172a), not pure black
    - Ensure elevated surfaces (cards, modals) are lighter than background
    - Add separate variables for borders, dividers, and subtle UI elements
    - _Requirements: 2.6, 4.1, 4.2, 4.3, 4.6, 4.8_

  - [x] 5.2 Write property test for WCAG contrast compliance
    - **Property 14: WCAG Contrast Compliance**
    - **Validates: Requirements 2.5**

  - [x] 5.3 Write property test for interactive element contrast
    - **Property 15: Interactive Element Contrast**
    - **Validates: Requirements 4.3, 4.7**

  - [x] 5.4 Add CSS transition effects for theme switching
    - Add transition properties for background-color, color, border-color
    - Create .theme-transitioning class to disable transitions during switch
    - Update applyThemeToDocument in useTheme to use theme-transitioning class
    - _Requirements: 6.3_

  - [x] 5.5 Write property test for theme switching performance
    - **Property 9: Theme Switching Performance**
    - **Validates: Requirements 3.2, 6.1**

- [ ] 6. Implement Dark Mode for Admin Pages
  - [x] 6.1 Add dark mode styles for admin dashboard
    - Update stats cards with dark mode colors
    - Update system status indicators for dark mode
    - Update quick action buttons with dark mode styles
    - Verify all text has sufficient contrast
    - _Requirements: 2.2_

  - [x] 6.2 Add dark mode styles for exam management pages
    - Update exam cards with dark mode colors
    - Update question editor with dark mode styles
    - Update modal dialogs for dark mode
    - Update drag-and-drop areas with dark mode styles
    - _Requirements: 2.2_

  - [x] 6.3 Add dark mode styles for results page
    - Update results table with dark mode colors
    - Update filter controls for dark mode
    - Update export buttons with dark mode styles
    - Update score indicators with appropriate colors
    - _Requirements: 2.2_

  - [x] 6.4 Add dark mode styles for monitoring, audit, settings, and students pages
    - Update live activity cards for dark mode
    - Update real-time indicators with dark mode colors
    - Update form inputs and controls for dark mode
    - Update toggle switches and color pickers for dark mode
    - _Requirements: 2.2_

- [ ] 7. Implement Dark Mode for Public Pages
  - [x] 7.1 Add dark mode styles for exam entry page
    - Update welcome screen with dark mode colors
    - Update code entry form for dark mode
    - Update instructions display with dark mode styles
    - _Requirements: 2.3_

  - [x] 7.2 Add dark mode styles for exam taking interface
    - Update question display with dark mode colors
    - Update answer options for dark mode
    - Update navigation sidebar with dark mode styles
    - Update timer component for dark mode
    - Update progress bar with dark mode colors
    - _Requirements: 2.3_

  - [x] 7.3 Add dark mode styles for results portal
    - Update results display with dark mode colors
    - Update score cards for dark mode
    - Update charts and graphs with dark mode colors
    - _Requirements: 2.3_

- [x] 8. Implement Dark Mode for Shared Components
  - [x] 8.1 Add dark mode styles for modals, tables, and forms
    - Update modal backdrop and content for dark mode
    - Update table headers and rows with dark mode colors
    - Update form inputs, selects, and textareas for dark mode
    - Update form labels and validation messages for dark mode
    - _Requirements: 2.4_

  - [x] 8.2 Add dark mode styles for buttons, navigation, and toast notifications
    - Update all button variants (primary, secondary, ghost, destructive) for dark mode
    - Update navigation links and menus with dark mode colors
    - Update toast notifications for dark mode
    - Update dropdown menus for dark mode
    - _Requirements: 2.4_

  - [x] 8.3 Write property test for RTL dark mode compatibility
    - **Property 18: RTL Dark Mode Compatibility**
    - **Validates: Requirements 2.7**

- [x] 9. Checkpoint - Verify dark mode styles are complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Results Filter Feature
  - Create StatusFilter component
  - Integrate filter with results page exam grid
  - Implement filter persistence with sessionStorage
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 11. Create StatusFilter Component
  - [x] 11.1 Create StatusFilter component file
    - Create src/components/admin/StatusFilter.tsx
    - Define StatusFilterProps interface with value ('all' | 'published' | 'completed') and onChange
    - Implement toggle button UI with "All", "Published", and "Completed" options
    - Add proper ARIA attributes for accessibility
    - Style component using existing CSS primitives
    - _Requirements: 1.1, 1.8_

  - [x] 11.2 Write unit tests for StatusFilter component
    - Test component renders correctly
    - Test onChange callback is called when buttons are clicked
    - Test active button styling based on value prop
    - Test ARIA attributes are present
    - _Requirements: 1.1, 1.8_

  - [x] 11.3 Write property test for filter label consistency
    - **Property 5: Filter Label Consistency**
    - **Validates: Requirements 1.8**

- [-] 12. Integrate Filter with Results Page
  - [x] 12.1 Add filter state and persistence to results page
    - Add statusFilter state with default 'all'
    - Add useEffect to load filter from sessionStorage on mount
    - Add useEffect to save filter to sessionStorage on change
    - Import and add StatusFilter component to page UI above exam grid
    - _Requirements: 1.2, 1.7_

  - [x] 12.2 Write property test for filter default state
    - **Property 1: Filter Default State**
    - **Validates: Requirements 1.2**

  - [x] 12.3 Write property test for filter persistence round trip
    - **Property 4: Filter Persistence Round Trip**
    - **Validates: Requirements 1.7**

  - [x] 12.4 Implement exam grid filtering logic
    - Create filteredVisibleExams useMemo that filters based on statusFilter
    - For 'published' mode, filter exams with status === 'published'
    - For 'completed' mode, filter exams with status === 'done'
    - For 'all' mode, return all visible exams (both published and done)
    - Update exam grid rendering to use filteredVisibleExams instead of visibleExams
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [x] 12.5 Write property test for filter correctness
    - **Property 2: Filter Correctness**
    - **Validates: Requirements 1.3, 1.4, 1.5**

  - [x] 12.6 Write property test for filter reactivity
    - **Property 3: Filter Reactivity**
    - **Validates: Requirements 1.6**

- [x] 13. Checkpoint - Verify results filter works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement Performance Optimizations
  - Optimize theme switching to minimize re-renders
  - Verify theme switching completes within 100ms
  - Add performance monitoring
  - _Requirements: 6.4, 6.6_

- [ ] 15. Optimize Theme Switching Performance
  - [x] 15.1 Minimize React re-renders during theme changes
    - Review components that re-render on theme change
    - Add React.memo to components that don't need theme updates
    - Use CSS variables instead of React state where possible
    - Verify theme changes don't trigger unnecessary re-renders
    - _Requirements: 6.6_

  - [x] 15.2 Write property test for minimal re-renders
    - **Property 17: Minimal Re-renders**
    - **Validates: Requirements 6.6**

  - [x] 15.3 Add performance monitoring for theme switching
    - Use Performance API to measure theme switch duration
    - Log warnings if theme switch exceeds 100ms
    - Add performance metrics to development console
    - _Requirements: 3.2, 6.1_

- [x] 16. Implement Accessibility Enhancements
  - Ensure focus indicators are visible in both themes
  - Verify focus preservation during theme changes
  - Ensure interactive elements are distinguishable
  - _Requirements: 7.2, 7.5, 7.6_

- [ ] 17. Enhance Accessibility Features
  - [x] 17.1 Implement visible focus indicators for both themes
    - Audit all focusable elements for focus indicator visibility
    - Update focus styles to ensure sufficient contrast in both themes
    - Add focus-visible styles for keyboard navigation
    - Test focus indicators with keyboard navigation
    - _Requirements: 7.2_

  - [x] 17.2 Write property test for focus indicator visibility
    - **Property 19: Focus Indicator Visibility**
    - **Validates: Requirements 7.2**

  - [x] 17.3 Implement focus preservation during theme changes
    - Update applyThemeToDocument to preserve document.activeElement
    - Test that focused element remains focused after theme switch
    - Verify focus is not lost during theme transitions
    - _Requirements: 7.5_

  - [x] 17.4 Write property test for focus preservation
    - **Property 20: Focus Preservation**
    - **Validates: Requirements 7.5**

  - [x] 17.5 Ensure interactive elements are distinguishable in dark mode
    - Audit all interactive elements (buttons, links, inputs) in dark mode
    - Verify interactive elements have distinct visual styles
    - Add hover and active states with sufficient contrast
    - Test that users can identify interactive elements easily
    - _Requirements: 7.6_

  - [x] 17.6 Write property test for interactive element distinction
    - **Property 21: Interactive Element Distinction**
    - **Validates: Requirements 7.6**

- [x] 18. Checkpoint - Verify accessibility features work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Implement Cross-Browser Compatibility
  - Add browser-specific handling and feature detection
  - Test in Chrome, Firefox, and Safari
  - Verify all functionality works consistently
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 20. Add Browser Compatibility Utilities
  - [x] 20.1 Create browser feature detection utilities
    - Create src/lib/browserCompat.ts file
    - Add isLocalStorageAvailable() function with try-catch
    - Add isMatchMediaAvailable() function with feature detection
    - Add getBrowserInfo() function to detect browser type
    - Export utilities for use across application
    - _Requirements: 5.6_

  - [x] 20.2 Write unit tests for browser compatibility utilities
    - Test localStorage detection with mocked scenarios
    - Test matchMedia detection with mocked scenarios
    - Test browser detection returns correct values
    - Test graceful fallbacks when features unavailable
    - _Requirements: 5.6_

  - [x] 20.3 Update theme system to use feature detection
    - Import and use isLocalStorageAvailable in useTheme
    - Import and use isMatchMediaAvailable in detectSystemPreference
    - Add fallbacks for when features are unavailable
    - Test theme system works without localStorage/matchMedia
    - _Requirements: 5.6_

- [x] 21. Conduct Cross-Browser Testing
  - [x] 21.1 Write cross-browser integration tests
    - Setup Playwright tests for Chrome, Firefox, Safari
    - Test theme toggle works in all browsers
    - Test theme persistence works in all browsers
    - Test results filter works in all browsers
    - Test localStorage/sessionStorage work in all browsers
    - Test form validation consistency across browsers
    - _Requirements: 5.1, 5.3, 5.7, 5.8_

  - [x] 21.2 Write visual regression tests for cross-browser consistency
    - Capture screenshots of key pages in light mode (all browsers)
    - Capture screenshots of key pages in dark mode (all browsers)
    - Compare screenshots for visual consistency
    - Document any browser-specific rendering differences
    - _Requirements: 5.2, 5.5_

  - [x] 21.3 Manual cross-browser testing
    - Test application manually in Chrome latest stable
    - Test application manually in Firefox latest stable
    - Test application manually in Safari latest stable
    - Document any issues or inconsistencies found
    - Verify vendor prefixes are applied correctly
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [x] 22. Implement Error Handling and Edge Cases
  - Add comprehensive error handling for storage APIs
  - Handle theme script execution errors
  - Handle invalid filter states
  - _Requirements: All requirements (error handling)_

- [ ] 23. Add Robust Error Handling
  - [x] 23.1 Add error handling for storage operations
    - Wrap all localStorage operations in try-catch blocks
    - Wrap all sessionStorage operations in try-catch blocks
    - Add console warnings for storage failures
    - Implement fallbacks for when storage is unavailable
    - Test error handling with storage disabled
    - _Requirements: All requirements_

  - [x] 23.2 Write unit tests for error handling
    - Test localStorage errors are handled gracefully
    - Test sessionStorage errors are handled gracefully
    - Test theme system works without storage
    - Test filter system works without storage
    - Test appropriate fallbacks are used
    - _Requirements: All requirements_

  - [x] 23.3 Add validation for storage values
    - Validate theme value from localStorage before using
    - Validate filter value from sessionStorage before using
    - Clear invalid values from storage
    - Use defaults for invalid values
    - _Requirements: All requirements_

- [x] 24. Final Testing and Quality Assurance
  - Run complete test suite
  - Verify all property tests pass
  - Conduct accessibility audit
  - Performance profiling
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [ ] 25. Run Comprehensive Test Suite
  - [x] 25.1 Run all unit tests
    - Execute unit tests for theme hook
    - Execute unit tests for CompletionFilter component
    - Execute unit tests for browser compatibility utilities
    - Execute unit tests for error handling
    - Verify 100% coverage of critical paths
    - _Requirements: 8.1_

  - [x] 25.2 Run all property-based tests
    - Execute all 21 property tests with minimum 100 iterations
    - Verify all properties pass consistently
    - Document any edge cases discovered
    - Fix any failing properties
    - _Requirements: 8.3_

  - [x] 25.3 Run integration tests
    - Test theme persistence across page navigation
    - Test filter persistence across page reloads
    - Test theme switching doesn't break other functionality
    - Test filter doesn't break results page functionality
    - _Requirements: 8.2_

  - [x] 25.4 Run cross-browser tests
    - Execute Playwright tests in Chrome, Firefox, Safari
    - Verify all tests pass in all browsers
    - Document any browser-specific issues
    - _Requirements: 8.5_

- [ ] 26. Conduct Accessibility Audit
  - [x] 26.1 Run automated accessibility tests
    - Run axe-core tests on all pages in light mode
    - Run axe-core tests on all pages in dark mode
    - Run Lighthouse accessibility audits
    - Fix any accessibility violations found
    - Verify WCAG AA compliance
    - _Requirements: 8.6_

  - [x] 26.2 Manual accessibility testing
    - Test keyboard navigation in both themes
    - Test with screen reader (manual verification)
    - Verify focus indicators are visible
    - Verify ARIA labels are correct
    - Test with high contrast mode
    - _Requirements: 7.7, 8.6_

- [ ] 27. Performance Profiling and Optimization
  - [x] 27.1 Profile theme switching performance
    - Measure theme switch duration with Performance API
    - Verify theme switching completes within 100ms
    - Profile React re-renders during theme change
    - Optimize any performance bottlenecks found
    - _Requirements: 3.2, 6.1, 6.6_

  - [x] 27.2 Profile initial page load performance
    - Measure time to first contentful paint
    - Verify theme is applied before FCP
    - Measure theme script execution time
    - Optimize initial load if needed
    - _Requirements: 6.2, 6.5_

  - [x] 27.3 Run visual regression tests
    - Capture screenshots of all pages in both themes
    - Compare with baseline screenshots
    - Verify no visual regressions
    - Update baselines if intentional changes made
    - _Requirements: 8.4_

- [x] 28. Final Checkpoint - Verify all requirements are met
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests validate end-to-end flows and cross-component interactions
- Cross-browser tests validate functionality in Chrome, Firefox, and Safari
- Accessibility tests validate WCAG AA compliance and screen reader compatibility
- Visual regression tests validate consistent rendering across themes and browsers
- Performance tests validate theme switching speed and minimal re-renders
