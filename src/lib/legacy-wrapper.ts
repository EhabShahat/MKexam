/**
 * Legacy Endpoint Wrapper Utilities
 * 
 * Provides backward compatibility for optimized RPC functions
 * Maintains old function signatures while calling new optimized versions
 * Adds deprecation warnings and tracks usage
 * 
 * Requirements: 10.1, 10.2
 */

import { supabaseServer } from "@/lib/supabase/server";

/**
 * Deprecation timeline configuration
 * Legacy endpoints will be removed after this date
 */
export const DEPRECATION_CONFIG = {
  // 30 days from deployment date
  deprecationDate: new Date('2025-02-15'), // Update this when deploying
  warningMessage: 'This endpoint is deprecated and will be removed on {date}. Please migrate to the v2 endpoint.',
  contactEmail: 'support@example.com', // Update with actual support email
};

/**
 * Log deprecation warning to console and optionally to database
 */
export function logDeprecationWarning(
  endpoint: string,
  clientInfo?: {
    userAgent?: string;
    ip?: string;
    userId?: string;
  }
): void {
  const daysUntilRemoval = Math.ceil(
    (DEPRECATION_CONFIG.deprecationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  
  const warning = `[DEPRECATION WARNING] Endpoint "${endpoint}" is deprecated and will be removed in ${daysUntilRemoval} days (${DEPRECATION_CONFIG.deprecationDate.toISOString().split('T')[0]}). Please migrate to the v2 endpoint.`;
  
  // Log to console for server-side visibility
  // eslint-disable-next-line no-console
  console.warn(warning, clientInfo);
  
  // TODO: Optionally log to database for tracking
  // This can be implemented later to track which clients are still using legacy endpoints
}

/**
 * Add deprecation headers to response
 */
export function addDeprecationHeaders(headers: Headers): Headers {
  const daysUntilRemoval = Math.ceil(
    (DEPRECATION_CONFIG.deprecationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  
  headers.set('X-API-Deprecated', 'true');
  headers.set('X-API-Deprecation-Date', DEPRECATION_CONFIG.deprecationDate.toISOString());
  headers.set('X-API-Deprecation-Days', daysUntilRemoval.toString());
  headers.set('X-API-Deprecation-Info', DEPRECATION_CONFIG.warningMessage.replace('{date}', DEPRECATION_CONFIG.deprecationDate.toISOString().split('T')[0]));
  headers.set('Link', '</api/docs/migration>; rel="deprecation"'); // Standard deprecation header
  
  return headers;
}

/**
 * Wrapper for get_attempt_state that calls get_attempt_state_v2
 * Maintains backward compatibility while using optimized version
 */
export async function legacyGetAttemptState(
  attemptId: string,
  options?: {
    logWarning?: boolean;
    clientInfo?: { userAgent?: string; ip?: string; userId?: string };
  }
): Promise<{ data: any; error: any }> {
  // Log deprecation warning
  if (options?.logWarning !== false) {
    logDeprecationWarning('get_attempt_state', options?.clientInfo);
  }
  
  const supabase = supabaseServer();
  
  // Call v2 with no field selection (returns all fields for backward compatibility)
  const result = await supabase.rpc("get_attempt_state_v2", {
    p_attempt_id: attemptId,
    p_fields: null, // null means return all fields
  });
  
  return result;
}

/**
 * Wrapper for admin_list_attempts that calls admin_list_attempts_v2
 * Maintains backward compatibility while using optimized version
 */
export async function legacyAdminListAttempts(
  examId: string,
  token?: string,
  options?: {
    logWarning?: boolean;
    clientInfo?: { userAgent?: string; ip?: string; userId?: string };
  }
): Promise<{ data: any; error: any }> {
  // Log deprecation warning
  if (options?.logWarning !== false) {
    logDeprecationWarning('admin_list_attempts', options?.clientInfo);
  }
  
  const supabase = supabaseServer(token);
  
  // Call v2 with default pagination (returns all results for backward compatibility)
  // Use a large limit to simulate "return all" behavior
  const result = await supabase.rpc("admin_list_attempts_v2", {
    p_exam_id: examId,
    p_limit: 10000, // Large limit to return all results
    p_offset: 0,
    p_fields: null, // null means return all fields
  });
  
  return result;
}

/**
 * Check if deprecation period has expired
 */
export function isDeprecationExpired(): boolean {
  return Date.now() > DEPRECATION_CONFIG.deprecationDate.getTime();
}

/**
 * Get days remaining until deprecation
 */
export function getDaysUntilDeprecation(): number {
  return Math.ceil(
    (DEPRECATION_CONFIG.deprecationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
}

/**
 * Middleware to check if legacy endpoint should be blocked
 * Returns true if the endpoint should be blocked (deprecation expired)
 */
export function shouldBlockLegacyEndpoint(): boolean {
  return isDeprecationExpired();
}
