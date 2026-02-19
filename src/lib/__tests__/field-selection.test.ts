/**
 * Unit tests for field selection utility module
 */

import {
  parseFieldSelection,
  validateFields,
  applyFieldSelection,
  applyFieldSelectionToArray,
  generateSQLFieldList,
  fieldSelectionToJSONB,
  type FieldSelection,
} from '../field-selection';

describe('Field Selection Utility', () => {
  describe('parseFieldSelection', () => {
    it('should return empty object for null/undefined input', () => {
      expect(parseFieldSelection(null)).toEqual({});
      expect(parseFieldSelection(undefined)).toEqual({});
    });

    it('should parse array as include list', () => {
      const result = parseFieldSelection(['field1', 'field2']);
      expect(result).toEqual({
        include: ['field1', 'field2'],
      });
    });

    it('should filter out empty strings from array', () => {
      const result = parseFieldSelection(['field1', '', 'field2']);
      expect(result).toEqual({
        include: ['field1', 'field2'],
      });
    });

    it('should return FieldSelection object as-is', () => {
      const input: FieldSelection = {
        include: ['field1'],
        exclude: ['field2'],
      };
      const result = parseFieldSelection(input);
      expect(result).toEqual(input);
    });
  });

  describe('validateFields', () => {
    const allowedFields = ['id', 'name', 'email', 'created_at'];

    it('should return true for empty field list', () => {
      expect(validateFields([], allowedFields)).toBe(true);
    });

    it('should return true for valid fields', () => {
      expect(validateFields(['id', 'name'], allowedFields)).toBe(true);
    });

    it('should return false for invalid fields', () => {
      expect(validateFields(['id', 'invalid_field'], allowedFields)).toBe(false);
    });

    it('should return false if any field is invalid', () => {
      expect(validateFields(['name', 'email', 'password'], allowedFields)).toBe(false);
    });
  });

  describe('applyFieldSelection', () => {
    const testData = {
      id: '123',
      name: 'Test',
      email: 'test@example.com',
      password: 'secret',
      created_at: '2024-01-01',
    };

    it('should return all fields when no selection specified', () => {
      const result = applyFieldSelection(testData, {});
      expect(result).toEqual(testData);
    });

    it('should include only specified fields', () => {
      const result = applyFieldSelection(testData, {
        include: ['id', 'name'],
      });
      expect(result).toEqual({
        id: '123',
        name: 'Test',
      });
    });

    it('should exclude specified fields', () => {
      const result = applyFieldSelection(testData, {
        exclude: ['password', 'email'],
      });
      expect(result).toEqual({
        id: '123',
        name: 'Test',
        created_at: '2024-01-01',
      });
    });

    it('should prioritize include over exclude', () => {
      const result = applyFieldSelection(testData, {
        include: ['id', 'name'],
        exclude: ['name'],
      });
      // Include takes precedence
      expect(result).toEqual({
        id: '123',
        name: 'Test',
      });
    });

    it('should handle non-existent fields in include list', () => {
      const result = applyFieldSelection(testData, {
        include: ['id', 'non_existent'],
      });
      expect(result).toEqual({
        id: '123',
      });
    });

    it('should return data as-is for non-object input', () => {
      expect(applyFieldSelection(null as any, {})).toBeNull();
      expect(applyFieldSelection('string' as any, {})).toBe('string');
    });
  });

  describe('applyFieldSelectionToArray', () => {
    const testArray = [
      { id: '1', name: 'Alice', email: 'alice@example.com' },
      { id: '2', name: 'Bob', email: 'bob@example.com' },
    ];

    it('should apply selection to all items in array', () => {
      const result = applyFieldSelectionToArray(testArray, {
        include: ['id', 'name'],
      });
      expect(result).toEqual([
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ]);
    });

    it('should return empty array for non-array input', () => {
      expect(applyFieldSelectionToArray(null as any, {})).toEqual([]);
      expect(applyFieldSelectionToArray({} as any, {})).toEqual([]);
    });
  });

  describe('generateSQLFieldList', () => {
    const allFields = ['id', 'name', 'email', 'created_at'];

    it('should return all fields when no selection specified', () => {
      const result = generateSQLFieldList('t', {}, allFields);
      expect(result).toBe('t.id, t.name, t.email, t.created_at');
    });

    it('should return only included fields', () => {
      const result = generateSQLFieldList('t', { include: ['id', 'name'] }, allFields);
      expect(result).toBe('t.id, t.name');
    });

    it('should exclude specified fields', () => {
      const result = generateSQLFieldList('t', { exclude: ['email'] }, allFields);
      expect(result).toBe('t.id, t.name, t.created_at');
    });

    it('should filter out non-existent fields from include list', () => {
      const result = generateSQLFieldList('t', { include: ['id', 'non_existent'] }, allFields);
      expect(result).toBe('t.id');
    });
  });

  describe('fieldSelectionToJSONB', () => {
    it('should return null for empty selection', () => {
      expect(fieldSelectionToJSONB({})).toBeNull();
      expect(fieldSelectionToJSONB(null)).toBeNull();
      expect(fieldSelectionToJSONB(undefined)).toBeNull();
    });

    it('should convert include list to JSONB format', () => {
      const result = fieldSelectionToJSONB({ include: ['id', 'name'] });
      expect(result).toEqual({
        include: ['id', 'name'],
        exclude: null,
      });
    });

    it('should convert exclude list to JSONB format', () => {
      const result = fieldSelectionToJSONB({ exclude: ['password'] });
      expect(result).toEqual({
        include: null,
        exclude: ['password'],
      });
    });

    it('should convert both include and exclude to JSONB format', () => {
      const result = fieldSelectionToJSONB({
        include: ['id'],
        exclude: ['password'],
      });
      expect(result).toEqual({
        include: ['id'],
        exclude: ['password'],
      });
    });
  });
});
