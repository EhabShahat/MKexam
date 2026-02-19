# Requirements Document: Unknown Device Display Fix

## Introduction

The admin results page at `/admin/results` displays device information for exam attempts in a table format. Users are reporting that "Unknown Device" is being displayed in the device info column when device information should be available. This spec addresses the investigation and resolution of this issue to ensure proper device information display across all scenarios.

## Glossary

- **Device_Info**: JSONB column in exam_attempts table containing comprehensive device information collected from the client
- **DeviceInfoCell**: React component responsible for parsing and displaying device information in the results table
- **Enhanced_Device_Info**: New format with detailed fields (friendlyName, oem, browserDetails, platformDetails, allIPs, security)
- **Legacy_Device_Info**: Old format with basic fields (type, manufacturer, model, userAgent)
- **Client_Collection**: Process of gathering device information on the client side using collectDetailedDeviceInfo()
- **Server_Merge**: Process of combining client device info with server-detected IP using mergeDeviceInfo()
- **Fallback_Display**: Default "Unknown Device" text shown when device info is missing or invalid

## Requirements

### Requirement 1: Data Collection Verification

**User Story:** As a system administrator, I want to verify that device information is being collected properly on the client side, so that I can identify if the issue is in data collection or data display.

#### Acceptance Criteria

1. WHEN a student accesses an exam, THE Client_Collection SHALL execute collectDetailedDeviceInfo() and gather comprehensive device data
2. WHEN device collection completes, THE Client_Collection SHALL include friendlyName, oem, browserDetails, platformDetails, and allIPs fields
3. WHEN device collection fails, THE Client_Collection SHALL log detailed error information including error message and stack trace
4. IF device collection times out, THEN THE Client_Collection SHALL return partial data with timeout indicators
5. WHEN device info is sent to the server, THE API_Endpoint SHALL log whether clientDeviceInfo is present and non-null

### Requirement 2: Data Storage Verification

**User Story:** As a system administrator, I want to verify that device information is being stored correctly in the database, so that I can identify if the issue is in data persistence.

#### Acceptance Criteria

1. WHEN the access API receives device info, THE Server_Merge SHALL combine client data with server-detected IP
2. WHEN merging device info, THE Server_Merge SHALL create the allIPs structure with local, public, and server IP arrays
3. WHEN updating the database, THE API_Endpoint SHALL store the merged device info in the device_info JSONB column
4. IF the database update fails, THEN THE API_Endpoint SHALL log the error with attempt ID and error details
5. WHEN device info is stored successfully, THE API_Endpoint SHALL log confirmation with attempt ID and data summary

### Requirement 3: Data Retrieval Verification

**User Story:** As a system administrator, I want to verify that device information is being retrieved correctly from the database, so that I can identify if the issue is in data querying.

#### Acceptance Criteria

1. WHEN the results page loads, THE API_Endpoint SHALL query exam_attempts with device_info column included
2. WHEN query results are returned, THE API_Endpoint SHALL log whether device_info is present for sample records
3. WHEN using RPC functions, THE RPC_Function SHALL include device_info in the returned result set
4. IF device_info is null in query results, THEN THE API_Endpoint SHALL log which attempts have missing data
5. WHEN device_info is present, THE API_Endpoint SHALL verify it contains valid JSON structure

### Requirement 4: Display Logic Verification

**User Story:** As a system administrator, I want to verify that the DeviceInfoCell component correctly parses and displays device information, so that I can identify if the issue is in the display logic.

#### Acceptance Criteria

1. WHEN DeviceInfoCell receives device_info, THE DeviceInfoCell SHALL attempt to parse it as JSON
2. IF JSON parsing fails, THEN THE DeviceInfoCell SHALL log the parsing error and display "Unknown Device"
3. WHEN parsed device info is enhanced format, THE DeviceInfoCell SHALL extract friendlyName or construct name from oem fields
4. WHEN parsed device info is legacy format, THE DeviceInfoCell SHALL fall back to parseUserAgent() for display
5. IF all extraction methods fail, THEN THE DeviceInfoCell SHALL display "Unknown Device" with IP address if available

### Requirement 5: Error Handling and Logging

**User Story:** As a developer, I want comprehensive error logging throughout the device info pipeline, so that I can quickly diagnose where failures occur.

#### Acceptance Criteria

1. WHEN any device info operation fails, THE System SHALL log the error with context including attempt ID and operation name
2. WHEN device info is null or missing, THE System SHALL log which stage detected the missing data
3. WHEN JSON parsing fails, THE System SHALL log the raw string that failed to parse
4. WHEN display fallbacks are triggered, THE System SHALL log which fallback path was taken
5. WHEN device info is successfully processed, THE System SHALL log success confirmations at each stage

### Requirement 6: Backward Compatibility

**User Story:** As a system administrator, I want the system to handle both legacy and enhanced device info formats, so that historical data remains accessible.

#### Acceptance Criteria

1. WHEN device_info contains legacy format fields, THE DeviceInfoCell SHALL parse and display them correctly
2. WHEN device_info contains enhanced format fields, THE DeviceInfoCell SHALL prioritize enhanced fields over legacy
3. WHEN device_info contains mixed format fields, THE DeviceInfoCell SHALL merge information from both formats
4. IF device_info is missing required fields, THEN THE DeviceInfoCell SHALL gracefully degrade to available fields
5. WHEN no device info is available, THE DeviceInfoCell SHALL display IP address as fallback if present

### Requirement 7: Data Validation

**User Story:** As a developer, I want to validate device info structure at each stage, so that I can detect data corruption or format issues early.

#### Acceptance Criteria

1. WHEN device info is received from client, THE Server_Merge SHALL validate it has expected structure
2. WHEN storing device info, THE API_Endpoint SHALL validate the merged structure before database update
3. WHEN retrieving device info, THE API_Endpoint SHALL validate the JSONB data is parseable
4. IF validation fails at any stage, THEN THE System SHALL log validation errors with details
5. WHEN validation succeeds, THE System SHALL proceed with normal processing

### Requirement 8: Diagnostic Tools

**User Story:** As a developer, I want diagnostic tools to inspect device info at runtime, so that I can troubleshoot issues in production.

#### Acceptance Criteria

1. WHEN viewing results page, THE System SHALL provide console logs showing device info parsing status
2. WHEN device info is missing, THE System SHALL log which attempts are affected
3. WHEN display fallbacks occur, THE System SHALL log the reason for fallback
4. IF multiple attempts show "Unknown Device", THEN THE System SHALL log common patterns
5. WHEN device info is present, THE System SHALL log a sample of successfully parsed data

### Requirement 9: Fix Implementation

**User Story:** As a system administrator, I want the identified issues to be fixed, so that device information displays correctly for all exam attempts.

#### Acceptance Criteria

1. WHEN device info collection fails, THE System SHALL implement retry logic with exponential backoff
2. WHEN device info is missing required fields, THE System SHALL populate defaults to prevent display failures
3. WHEN JSON parsing fails, THE System SHALL sanitize the input and retry parsing
4. IF device info is null in database, THEN THE System SHALL attempt to reconstruct from available data
5. WHEN all fixes are applied, THE DeviceInfoCell SHALL display meaningful device information for all attempts

### Requirement 10: Testing and Verification

**User Story:** As a developer, I want comprehensive tests to verify the fix works correctly, so that I can prevent regression.

#### Acceptance Criteria

1. WHEN testing with enhanced device info, THE DeviceInfoCell SHALL display friendlyName correctly
2. WHEN testing with legacy device info, THE DeviceInfoCell SHALL display manufacturer and model correctly
3. WHEN testing with null device info, THE DeviceInfoCell SHALL display "Unknown Device" with IP address
4. WHEN testing with malformed JSON, THE DeviceInfoCell SHALL handle errors gracefully
5. WHEN testing with missing fields, THE DeviceInfoCell SHALL use fallback values appropriately
