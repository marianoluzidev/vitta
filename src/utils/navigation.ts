/**
 * Safe navigation utility for Ionic Vue
 * Handles navigation from non-tab pages to tab pages to avoid Ionic navigation stack issues
 */

/**
 * Navigate to a tab page safely
 * Uses window.location.href to force full page reload when navigating from non-tab to tab pages
 * This prevents the "Cannot read properties of undefined (reading 'classList')" error
 * 
 * @param path - The path to navigate to (e.g., '/tabs/agenda')
 * @param delay - Optional delay in milliseconds before navigation (default: 100)
 */
export function navigateToTab(path: string, delay: number = 100): void {
  // Always use window.location.href for tab pages to avoid Ionic navigation issues
  // This ensures a clean navigation without stack conflicts
  setTimeout(() => {
    window.location.href = path;
  }, delay);
}

/**
 * Navigate to a non-tab page using router
 * Use this for navigation between non-tab pages or from tab to non-tab
 * 
 * @param router - Vue Router instance
 * @param path - The path to navigate to
 */
export function navigateToNonTab(router: any, path: string): void {
  router.push(path);
}



