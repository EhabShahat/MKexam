# ID Card Button Implementation

## Overview
Added ID Card button to the home page code entry section with admin toggle control in the System Status panel.

## Changes Made

### 1. Frontend Components

#### MultiExamEntry Component (`src/components/public/MultiExamEntry.tsx`)
- Added `showIdCard` prop to interface
- Added ID Card button (emerald color) to the button grid
- Button appears below code entry when Exams is ON
- Button appears standalone when Exams is OFF
- Responsive grid layout adjusts for 1-3 buttons (sm:grid-cols-1/2/3)
- Links to `/id` route

#### CodeFirstRouter Component (`src/components/CodeFirstRouter.tsx`)
- Added `showIdCard` prop to interface
- Passes `showIdCard` prop to MultiExamEntry component

#### Main Page (`src/app/page.tsx`)
- Added `home_button_id` to database query keys
- Added `idToggle` variable to read from config
- Added `showIdCard` state calculation (defaults to false)
- Passes `showIdCard` prop to CodeFirstRouter

### 2. Backend API

#### System API (`src/server/admin/system.ts`)
- Added `"home_button_id"` to `HOME_BUTTON_KEYS` array
- Updated `getHomeButtons()` to return `id` field
- Updated `updateHomeButtons()` to handle `id` boolean and null values
- Supports upsert (true/false) and delete (null) operations

### 3. Admin Dashboard

#### Admin Page (`src/app/admin/page.tsx`)
- Updated `homeButtons` query type to include `id: boolean | null`
- Added `idVisible` state calculation
- Updated System Status message to show ID Card visibility
- Added ID Card toggle button (emerald color when ON, gray when OFF)
- Toggle positioned after Register button
- Fully responsive with proper mobile layout

## Database Structure

The system uses the existing `app_config` table with key-value pairs:

```sql
-- Key: home_button_id
-- Value: "true" or "false"
-- When key doesn't exist: defaults to false (hidden)
```

No database migration needed - the key-value structure supports dynamic keys.

## Button Details

### ID Card Button (Emerald)
- **Route**: `/id`
- **Purpose**: View student ID card by national number
- **Icon**: ID card icon (user badge with details)
- **Color**: Emerald gradient (bg-emerald-50, border-emerald-200, text-emerald-900)
- **Position**: 
  - Below code entry (when Exams is ON)
  - Standalone grid (when Exams is OFF)
  - Adjusts with Results and Register buttons

### Admin Toggle
- **Label**: "ID Card"
- **Color**: Emerald (bg-emerald-500 when ON)
- **Position**: After Register toggle in System Status panel
- **Behavior**: 
  - Click to toggle ON/OFF
  - Updates database immediately
  - Changes reflect on home page instantly

## Layout Scenarios

### Scenario 1: All Buttons Enabled
```
┌─────────────────────────────────────┐
│   Logo                              │
│                                     │
│   Code Entry Form                   │
│   [Enter Code]                      │
│   [Submit Button]                   │
│                                     │
│   ┌─────────┬─────────┐             │
│   │ Results │ Register│             │
│   └─────────┴─────────┘             │
│                                     │
│   ┌─────────────────────────────┐  │
│   │        ID Card              │  │
│   └─────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Scenario 2: Exams OFF, All Others ON
```
┌─────────────────────────────────────┐
│   Logo                              │
│                                     │
│   Select Action                     │
│                                     │
│   ┌─────────┬─────────┐             │
│   │ Results │ Register│             │
│   └─────────┴─────────┘             │
│                                     │
│   ┌─────────────────────────────┐  │
│   │        ID Card              │  │
│   └─────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Scenario 3: Only ID Card Enabled
```
┌─────────────────────────────────────┐
│   Logo                              │
│                                     │
│   Code Entry Form                   │
│   [Enter Code]                      │
│   [Submit Button]                   │
│                                     │
│   ┌─────────────────────────────┐  │
│   │        ID Card              │  │
│   └─────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Responsive Behavior

### Desktop
- Results and Register: 2 columns side-by-side (when both visible)
- Results or Register alone: 1 column full width
- ID Card: Always full width in separate row below

### Mobile
- Always single column
- All buttons stack vertically
- Full width for better touch targets
- ID Card appears last in its own row

## API Endpoints

### Get Button Visibility
```http
GET /api/admin/system?action=home-buttons

Response:
{
  "exams": true | false | null,
  "results": true | false | null,
  "register": true | false | null,
  "id": true | false | null
}
```

### Update Button Visibility
```http
PATCH /api/admin/system?action=home-buttons
Content-Type: application/json

{
  "id": true | false | null
}

Response:
{
  "success": true
}
```

## Testing Checklist

- [x] ID Card button appears when toggle is ON
- [x] ID Card button hides when toggle is OFF
- [x] Button appears below code entry (Exams ON)
- [x] Button appears standalone (Exams OFF)
- [x] Grid layout adjusts correctly (1-3 columns)
- [x] Mobile layout works (single column)
- [x] Admin toggle updates database
- [x] Changes reflect immediately on home page
- [x] No TypeScript errors
- [x] Proper color scheme (emerald)
- [x] Links to correct route (/id)

## Usage Examples

### Example 1: Enable ID Card Only
Admin wants students to only view their ID cards:
- Exams: OFF
- Results: OFF
- Register: OFF
- ID Card: ON

**Result**: Students see only ID Card button

### Example 2: Full Access
Admin wants all features available:
- Exams: ON
- Results: ON
- Register: ON
- ID Card: ON

**Result**: Students see code entry with all 3 buttons below

### Example 3: Results + ID Card
Admin wants students to view results and ID cards:
- Exams: OFF
- Results: ON
- Register: OFF
- ID Card: ON

**Result**: Students see Results and ID Card buttons (no code entry)

## Internationalization

Button labels are fully localized:
- English: "Public ID" / "View your ID card"
- Arabic: "الكارت" / "عرض الid"

Translation keys in `src/i18n/student.ts`:
- `public_id` - Button title
- `view_id_card` - Button description

## Files Modified

1. `src/components/public/MultiExamEntry.tsx` - Added ID Card button
2. `src/components/CodeFirstRouter.tsx` - Added showIdCard prop
3. `src/app/page.tsx` - Added ID Card config reading
4. `src/server/admin/system.ts` - Added ID Card API support
5. `src/app/admin/page.tsx` - Added ID Card toggle

## Notes

- Default state: Hidden (false)
- No database migration required
- Works with existing app_config table
- Fully responsive and accessible
- Consistent with other button implementations
- Emerald color distinguishes it from other buttons
