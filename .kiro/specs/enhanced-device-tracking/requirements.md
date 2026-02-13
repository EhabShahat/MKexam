# Requirements Document: Enhanced Device Tracking

## Introduction

The exam application currently captures basic device information, but many fields show "Unknown Device" or empty values. Additionally, the system captures the router/network IP instead of the actual device IP. This specification defines requirements for improved device information capture to help administrators monitor exam security and detect potential issues.

## Glossary

- **Device_Tracker**: The system component that collects device information
- **Local_IP**: The actual IP address of the device (not the router IP)
- **Public_IP**: The external IP address visible to the server
- **User_Agent**: Browser identification string
- **WebRTC**: Technology that can reveal local IP addresses
- **Device_Info**: JSON object storing all collected device data

## Requirements

### Requirement 1: Capture Local Device IP Address

**User Story:** As an administrator, I want to capture the actual device IP address, so that I can accurately track which devices are used for exams.

#### Acceptance Criteria

1. WHEN a student starts an exam, THE Device_Tracker SHALL use WebRTC to discover the device's local IP address
2. WHEN WebRTC succeeds, THE Device_Tracker SHALL capture all local IP addresses (IPv4 and IPv6)
3. WHEN WebRTC fails, THE Device_Tracker SHALL fall back to server-detected IP from headers
4. THE Device_Tracker SHALL store both local and public IP addresses in the database
5. THE Device_Tracker SHALL complete IP discovery within 5 seconds

### Requirement 2: Improve Browser and Platform Detection

**User Story:** As an administrator, I want complete browser and platform information, so that I can identify the software environment for each exam.

#### Acceptance Criteria

1. THE Device_Tracker SHALL extract browser name and version from User_Agent
2. THE Device_Tracker SHALL extract operating system name and version from User_Agent
3. WHEN available, THE Device_Tracker SHALL use User-Agent Client Hints API for detailed platform information
4. THE Device_Tracker SHALL detect device type (mobile, tablet, or desktop)
5. THE Device_Tracker SHALL store all browser and platform data in structured format

### Requirement 3: Capture Complete Hardware Information

**User Story:** As an administrator, I want hardware specifications, so that I can detect device sharing and unusual configurations.

#### Acceptance Criteria

1. THE Device_Tracker SHALL capture CPU core count
2. THE Device_Tracker SHALL capture device memory (RAM) when available
3. THE Device_Tracker SHALL capture screen resolution, color depth, and pixel ratio
4. THE Device_Tracker SHALL capture viewport size
5. THE Device_Tracker SHALL detect touch capability
6. THE Device_Tracker SHALL capture GPU information when available

### Requirement 4: Improve Device Model Detection

**User Story:** As an administrator, I want accurate device manufacturer and model information, so that I can identify specific devices.

#### Acceptance Criteria

1. THE Device_Tracker SHALL extract device model from User-Agent Client Hints when available
2. THE Device_Tracker SHALL extract device model from User_Agent string patterns as fallback
3. THE Device_Tracker SHALL identify manufacturer (Apple, Samsung, Xiaomi, etc.)
4. THE Device_Tracker SHALL generate a friendly device name (e.g., "Samsung Galaxy S21 (Android) Chrome")
5. WHEN model cannot be determined, THE Device_Tracker SHALL store "Unknown Device" with available info

### Requirement 5: Capture Additional Context Information

**User Story:** As an administrator, I want location, network, and battery information, so that I can verify exam conditions.

#### Acceptance Criteria

1. THE Device_Tracker SHALL request geolocation and capture coordinates when granted
2. THE Device_Tracker SHALL capture network type and speed when available
3. THE Device_Tracker SHALL capture battery level and charging status when available
4. THE Device_Tracker SHALL capture timezone and language settings
5. THE Device_Tracker SHALL handle permission denials gracefully without blocking exam access

### Requirement 6: Enhance Security Detection

**User Story:** As an administrator, I want to detect automation tools, so that I can identify potential cheating.

#### Acceptance Criteria

1. THE Device_Tracker SHALL detect if browser is controlled by automation (webdriver property)
2. THE Device_Tracker SHALL capture plugin count and cookie status
3. THE Device_Tracker SHALL detect multiple monitor configurations
4. THE Device_Tracker SHALL calculate automation risk score
5. THE Device_Tracker SHALL flag high-risk attempts (webdriver=true or suspicious patterns)

### Requirement 7: Maintain Device Fingerprint

**User Story:** As an administrator, I want a device fingerprint, so that I can track the same device across attempts.

#### Acceptance Criteria

1. THE Device_Tracker SHALL generate a canvas-based fingerprint
2. THE Device_Tracker SHALL hash the fingerprint to create a unique identifier
3. THE Device_Tracker SHALL store the fingerprint in the database
4. THE Device_Tracker SHALL use fingerprints to link attempts from the same device

### Requirement 8: Store Data Properly

**User Story:** As a system, I want structured data storage, so that information can be queried and analyzed.

#### Acceptance Criteria

1. THE Device_Tracker SHALL store all data in the device_info JSONB column
2. THE Device_Tracker SHALL organize data into categories (hardware, network, security, location)
3. THE Device_Tracker SHALL include a timestamp for when data was collected
4. THE Device_Tracker SHALL use null values for unavailable data
5. THE System SHALL maintain backward compatibility with existing records

### Requirement 9: Integrate with Exam Flow

**User Story:** As a developer, I want seamless integration, so that device collection doesn't disrupt the user experience.

#### Acceptance Criteria

1. THE Device_Tracker SHALL collect information when the exam entry form is submitted
2. THE Device_Tracker SHALL send data to the server with the exam access request
3. THE Device_Tracker SHALL timeout after 10 seconds and proceed with partial data
4. THE Device_Tracker SHALL not block exam access if collection fails
5. THE Device_Tracker SHALL log errors for debugging

### Requirement 10: Display in Admin Interface

**User Story:** As an administrator, I want to view device information clearly, so that I can analyze attempts effectively.

#### Acceptance Criteria

1. THE Admin_Interface SHALL display device information in organized sections
2. THE Admin_Interface SHALL show local and public IPs separately
3. THE Admin_Interface SHALL highlight automation risk warnings
4. THE Admin_Interface SHALL provide a raw JSON view for debugging
5. THE Admin_Interface SHALL handle missing data gracefully
