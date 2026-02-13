# Home Page Buttons System

## Overview
The home page buttons (Exams, Results, Register, Public ID) are dynamically controlled by the admin through the System Status panel on the admin dashboard.

## How It Works

### Admin Control Panel
Located at: `/admin` (Admin Dashboard)

The **System Status** section displays toggles for:
- **Exams** - Show/hide the code entry form and "Exams" functionality
- **Results** - Show/hide the "Results" button on the home page
- **Register** - Show/hide the "Register" button on the home page
- **Public ID** - Always visible when system is not disabled

### Toggle States
Each toggle can be:
- **ON (Green)** - Feature is visible/enabled on the home page
- **OFF (Gray)** - Feature is hidden/disabled from the home page

### Code Entry Behavior
- **When Exams is ON**: Code entry form is shown with Results and Register buttons below it
- **When Exams is OFF**: Code entry form is hidden, only Results and Register buttons are shown (if enabled)

## System Flow

1. **Admin Dashboard** (`/admin`)
   - Admin sees System Status panel with toggles
   - Clicking a toggle updates the database via API
   - Changes are immediate (no page refresh needed)

2. **Database Storage** (`app_config` table)
   - `home_button_exams` - Controls code entry form and Exams functionality
   - `home_button_results` - Controls Results button visibility
   - `home_button_register` - Controls Register button visibility

3. **Home Page** (`/`)
   - Server-side reads config from database
   - Passes visibility flags to components
   - Code entry form shows/hides based on Exams toggle
   - Results and Register buttons appear below code entry or standalone

4. **MultiExamEntry Component** (`MultiExamEntry.tsx`)
   - Receives `showExams`, `showResults`, `showRegister` props
   - Shows code entry form only when `showExams` is true
   - Shows Results and Register buttons below code entry (when Exams is ON)
   - Shows only Results and Register buttons (when Exams is OFF)
   - Adjusts layout based on visible button count

## Button Details

### Code Entry Form (Blue)
- **Controlled by**: Exams toggle
- **Purpose**: Enter student code to access exams
- **Behavior**: 
  - Shows when Exams toggle is ON
  - Hides when Exams toggle is OFF
  - Results and Register buttons appear below it

### Results Button (Indigo)
- **Route**: `/results`
- **Purpose**: Search and view exam results
- **Icon**: Bar chart icon
- **Color**: Indigo gradient
- **Position**: Below code entry (if Exams ON) or standalone (if Exams OFF)

### Register Button (Purple)
- **Route**: `/register`
- **Purpose**: Student registration form
- **Icon**: User add icon
- **Color**: Purple gradient
- **Position**: Below code entry (if Exams ON) or standalone (if Exams OFF)

### Public ID Button (Emerald)
- **Route**: `/id`
- **Purpose**: View student ID card
- **Icon**: ID card icon
- **Color**: Emerald gradient
- **Note**: Only visible after code validation (on PublicHome component)

## Layout Scenarios

### Scenario 1: Exams ON, Results ON, Register ON
```
┌─────────────────────────┐
│   Logo                  │
│                         │
│   Code Entry Form       │
│   [Enter Code]          │
│   [Submit Button]       │
│                         │
│   ┌─────────┬─────────┐ │
│   │ Results │ Register│ │
│   └─────────┴─────────┘ │
└─────────────────────────┘
```

### Scenario 2: Exams OFF, Results ON, Register ON
```
┌─────────────────────────┐
│   Logo                  │
│                         │
│   Select Action         │
│                         │
│   ┌─────────┬─────────┐ │
│   │ Results │ Register│ │
│   └─────────┴─────────┘ │
└─────────────────────────┘
```

### Scenario 3: Exams ON, Results ON, Register OFF
```
┌─────────────────────────┐
│   Logo                  │
│                         │
│   Code Entry Form       │
│   [Enter Code]          │
│   [Submit Button]       │
│                         │
│   ┌─────────────────┐   │
│   │    Results      │   │
│   └─────────────────┘   │
└─────────────────────────┘
```

### Scenario 4: Exams ON, Results OFF, Register OFF
```
┌─────────────────────────┐
│   Logo                  │
│                         │
│   Code Entry Form       │
│   [Enter Code]          │
│   [Submit Button]       │
│                         │
└─────────────────────────┘
```

## Responsive Layout

The buttons automatically adjust their grid layout:

- **Desktop**: 2 columns when both Results and Register are visible
- **Desktop**: 1 column when only one button is visible
- **Mobile**: Always single column layout

## API Endpoints

### Get Button Visibility
```
GET /api/admin/system?action=home-buttons
```

Response:
```json
{
  "exams": true | false | null,
  "results": true | false | null,
  "register": true | false | null
}
```

### Update Button Visibility
```
PATCH /api/admin/system?action=home-buttons
Content-Type: application/json

{
  "exams": true | false | null,
  "results": true | false | null,
  "register": true | false | null
}
```

## Default Behavior

When no explicit toggle value is set (null):
- **Exams**: Visible when system mode is "exam"
- **Results**: Visible when system mode is "results"
- **Register**: Hidden by default

## System Modes

The system has three modes that affect button visibility:

1. **Exam Mode** (default)
   - Code entry visible (unless explicitly hidden)
   - Results button hidden (unless explicitly shown)
   - Register button hidden (unless explicitly shown)

2. **Results Mode**
   - Code entry hidden (unless explicitly shown)
   - Results button visible (unless explicitly hidden)
   - Register button hidden (unless explicitly shown)

3. **Disabled Mode**
   - All features hidden
   - Shows custom disabled message
   - Only admin can access the system

## Code Locations

### Frontend Components
- `src/app/page.tsx` - Server-side config loading
- `src/components/CodeFirstRouter.tsx` - Router with props
- `src/components/public/MultiExamEntry.tsx` - Code entry and button rendering
- `src/components/public/PublicHome.tsx` - Button rendering after code validation
- `src/app/admin/page.tsx` - Admin dashboard with toggles

### Backend API
- `src/server/admin/system.ts` - Home buttons API logic
- `src/app/api/admin/system/route.ts` - API route handler

### Database
- `app_config` table - Stores button visibility settings
- Keys: `home_button_exams`, `home_button_results`, `home_button_register`

## Usage Examples

### Example 1: Exam Period Only
Admin wants students to only take exams:
- Exams: ON
- Results: OFF
- Register: OFF

**Result**: Students see code entry form only

### Example 2: Results Release Only
Admin wants students to only view results:
- Exams: OFF
- Results: ON
- Register: OFF

**Result**: Students see only Results button (no code entry)

### Example 3: Registration Period
Admin wants students to register:
- Exams: OFF
- Results: OFF
- Register: ON

**Result**: Students see only Register button (no code entry)

### Example 4: Exam + Results Access
Admin wants students to take exams and view results:
- Exams: ON
- Results: ON
- Register: OFF

**Result**: Students see code entry form with Results button below

### Example 5: Full Access
Admin wants all features available:
- Exams: ON
- Results: ON
- Register: ON

**Result**: Students see code entry form with Results and Register buttons below

## Internationalization

All button labels and descriptions are fully localized:
- English (en)
- Arabic (ar) with RTL support

Translation keys in `src/i18n/student.ts`:
- `select_exam` - "Exam Access" / "دخول الاختبار"
- `results` - "Results" / "النتائج"
- `register` - "Register" / "تسجيل"
- `search_your_results` - "Search your exam results" / "نتائج اختبارك"
- `apply_to_join` - "Apply to join as a student" / "استمارة التقديم"
- `choose_action_below` - "Choose an action below" / "اختر إجراءً أدناه"

## Testing

To test the system:

1. Login to admin dashboard (`/admin/login`)
2. Navigate to dashboard (`/admin`)
3. Find "System Status" panel
4. Toggle buttons on/off
5. Open home page in new tab (`/`)
6. Verify code entry and buttons appear/disappear based on toggles

## Notes

- Changes are immediate (no cache clearing needed)
- Toggles work independently of each other
- Code entry form visibility is controlled by Exams toggle
- Results and Register buttons can appear below code entry or standalone
- System must not be in "Disabled" mode for features to show
- Mobile layout is always single column regardless of button count
- When Exams is OFF, code entry is completely hidden
