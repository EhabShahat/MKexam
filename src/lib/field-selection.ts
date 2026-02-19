/**
 * Field Selection Utility Module
 * 
 * Provides utilities for parsing, validating, and applying field selection
 * to reduce data transfer and improve performance.
 * 
 * Requirements: 1.2, 5.4, 10.4
 */

/**
 * Field selection configuration
 */
export interface FieldSelection {
  include?: string[];
  exclude?: string[];
}

/**
 * Parse field selection from various input formats
 * 
 * @param fields - Field selection input (array of field names, or FieldSelection object)
 * @returns Normalized FieldSelection object
 */
export function parseFieldSelection(
  fields?: string[] | FieldSelection | null
): FieldSelection {
  if (!fields) {
    return {};
  }

  // If already a FieldSelection object, return as-is
  if (typeof fields === 'object' && !Array.isArray(fields)) {
    return {
      include: fields.include,
      exclude: fields.exclude,
    };
  }

  // If array, treat as include list
  if (Array.isArray(fields)) {
    return {
      include: fields.filter(f => typeof f === 'string' && f.length > 0),
    };
  }

  return {};
}

/**
 * Validate that requested fields are allowed
 * 
 * @param fields - Requested field names
 * @param allowedFields - List of allowed field names
 * @returns true if all fields are valid, false otherwise
 */
export function validateFields(
  fields: string[],
  allowedFields: string[]
): boolean {
  if (!fields || fields.length === 0) {
    return true;
  }

  const allowedSet = new Set(allowedFields);
  return fields.every(field => allowedSet.has(field));
}

/**
 * Apply field selection to data object
 * 
 * @param data - Source data object
 * @param selection - Field selection configuration
 * @returns Filtered data object with only selected fields
 */
export function applyFieldSelection<T extends Record<string, any>>(
  data: T,
  selection: FieldSelection
): Partial<T> {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // If no selection specified, return all fields
  if (!selection.include && !selection.exclude) {
    return data;
  }

  const result: Partial<T> = {};

  // If include list is specified, only include those fields
  if (selection.include && selection.include.length > 0) {
    for (const field of selection.include) {
      if (field in data) {
        result[field as keyof T] = data[field];
      }
    }
    return result;
  }

  // If exclude list is specified, include all except those
  if (selection.exclude && selection.exclude.length > 0) {
    const excludeSet = new Set(selection.exclude);
    for (const key in data) {
      if (!excludeSet.has(key)) {
        result[key as keyof T] = data[key];
      }
    }
    return result;
  }

  return data;
}

/**
 * Apply field selection to array of data objects
 * 
 * @param dataArray - Array of data objects
 * @param selection - Field selection configuration
 * @returns Array of filtered data objects
 */
export function applyFieldSelectionToArray<T extends Record<string, any>>(
  dataArray: T[],
  selection: FieldSelection
): Partial<T>[] {
  if (!Array.isArray(dataArray)) {
    return [];
  }

  return dataArray.map(item => applyFieldSelection(item, selection));
}

/**
 * Generate SQL field list for SELECT queries
 * 
 * @param tableName - Table name or alias
 * @param selection - Field selection configuration
 * @param allFields - All available fields for the table
 * @returns SQL field list string (e.g., "t.field1, t.field2")
 */
export function generateSQLFieldList(
  tableName: string,
  selection: FieldSelection,
  allFields: string[]
): string {
  // If no selection, return all fields
  if (!selection.include && !selection.exclude) {
    return allFields.map(f => `${tableName}.${f}`).join(', ');
  }

  let selectedFields: string[];

  // If include list specified, use only those fields
  if (selection.include && selection.include.length > 0) {
    selectedFields = selection.include.filter(f => allFields.includes(f));
  } else if (selection.exclude && selection.exclude.length > 0) {
    // If exclude list specified, use all except those
    const excludeSet = new Set(selection.exclude);
    selectedFields = allFields.filter(f => !excludeSet.has(f));
  } else {
    selectedFields = allFields;
  }

  // Return qualified field names
  return selectedFields.map(f => `${tableName}.${f}`).join(', ');
}

/**
 * Convert field selection to JSONB for PostgreSQL RPC calls
 * 
 * @param selection - Field selection configuration
 * @returns JSONB-compatible object or null
 */
export function fieldSelectionToJSONB(
  selection: FieldSelection | null | undefined
): Record<string, any> | null {
  if (!selection || (!selection.include && !selection.exclude)) {
    return null;
  }

  return {
    include: selection.include || null,
    exclude: selection.exclude || null,
  };
}
