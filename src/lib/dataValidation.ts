/**
 * Data validation utilities for progress data serialization
 * Ensures data integrity through save-retrieve cycles
 */

/**
 * Validates that data is JSON-serializable
 * Handles circular references and non-serializable types
 */
export function validateJSONSerializable(data: unknown): { valid: boolean; error?: string } {
  try {
    // Attempt to serialize
    const serialized = JSON.stringify(data);
    
    // Attempt to deserialize
    JSON.parse(serialized);
    
    return { valid: true };
  } catch (error) {
    if (error instanceof Error) {
      // Check for circular reference
      if (error.message.includes('circular') || error.message.includes('cyclic')) {
        return { valid: false, error: 'Circular reference detected in progress data' };
      }
      return { valid: false, error: `Serialization error: ${error.message}` };
    }
    return { valid: false, error: 'Unknown serialization error' };
  }
}

/**
 * Removes circular references from an object
 * Returns a clean copy that can be JSON serialized
 */
export function removeCircularReferences(obj: unknown): unknown {
  const seen = new WeakSet();
  
  function clean(value: unknown): unknown {
    // Handle primitives
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    // Check for circular reference
    if (seen.has(value as object)) {
      return undefined; // Remove circular reference
    }
    
    seen.add(value as object);
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(item => clean(item));
    }
    
    // Handle objects
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const cleanedVal = clean(val);
      if (cleanedVal !== undefined) {
        cleaned[key] = cleanedVal;
      }
    }
    
    return cleaned;
  }
  
  return clean(obj);
}

/**
 * Validates and sanitizes progress data before save
 * Ensures data is serializable and preserves types
 */
export function sanitizeProgressData(data: unknown): { sanitized: unknown; warnings: string[] } {
  const warnings: string[] = [];
  
  // Check if data is serializable
  const validation = validateJSONSerializable(data);
  
  if (!validation.valid) {
    warnings.push(validation.error || 'Data is not JSON-serializable');
    
    // Attempt to remove circular references
    const cleaned = removeCircularReferences(data);
    
    // Verify cleaned data is serializable
    const cleanedValidation = validateJSONSerializable(cleaned);
    if (cleanedValidation.valid) {
      warnings.push('Circular references were removed from data');
      return { sanitized: cleaned, warnings };
    }
    
    // If still not serializable, return empty object
    warnings.push('Could not sanitize data, using empty object');
    return { sanitized: {}, warnings };
  }
  
  return { sanitized: data, warnings };
}

/**
 * Validates round-trip integrity of progress data
 * Ensures data survives serialization and deserialization
 */
export function validateRoundTrip(data: unknown): { valid: boolean; error?: string; result?: unknown } {
  try {
    // Serialize
    const serialized = JSON.stringify(data);
    
    // Deserialize
    const deserialized = JSON.parse(serialized);
    
    return { valid: true, result: deserialized };
  } catch (error) {
    if (error instanceof Error) {
      return { valid: false, error: error.message };
    }
    return { valid: false, error: 'Unknown error during round-trip' };
  }
}

/**
 * Deep equality check for objects
 * Used to verify round-trip integrity
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  // Handle primitives and null
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  
  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  
  // One is array, other is not
  if (Array.isArray(a) || Array.isArray(b)) return false;
  
  // Handle objects
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  
  if (aKeys.length !== bKeys.length) return false;
  
  return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
}
