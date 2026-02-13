# Staged Exam System Migration

## Overview
This migration adds support for multi-stage exams that combine instructional content (videos and text slides) with traditional assessment questions.

## Migration Files
- `staged_exam_system.sql` - Creates the core tables and indexes
- Applied via Supabase MCP on: 2026-02-09

## Tables Created

### 1. exam_stages
Stores stage definitions for each exam (Video, Content, Questions).

**Columns:**
- `id` (uuid, PK) - Unique stage identifier
- `exam_id` (uuid, FK) - References exams.id with ON DELETE CASCADE
- `stage_type` (text) - Type of stage: 'video', 'content', or 'questions'
- `stage_order` (integer) - Order of stage in exam sequence
- `configuration` (jsonb) - Stage-specific configuration
- `created_at` (timestamptz) - Creation timestamp
- `updated_at` (timestamptz) - Last update timestamp

**Constraints:**
- CHECK: stage_type IN ('video', 'content', 'questions')
- UNIQUE: (exam_id, stage_order)

**Indexes:**
- `idx_exam_stages_exam_order` on (exam_id, stage_order)

**RLS Policies:**
- `exam_stages_admin_all` - Admins (authenticated) have full access
- `exam_stages_public_select` - Public (anon) can view stages for published exams

### 2. attempt_stage_progress
Tracks student progress through each stage.

**Columns:**
- `id` (uuid, PK) - Unique progress record identifier
- `attempt_id` (uuid, FK) - References exam_attempts.id with ON DELETE CASCADE
- `stage_id` (uuid, FK) - References exam_stages.id with ON DELETE CASCADE
- `started_at` (timestamptz, nullable) - When student started this stage
- `completed_at` (timestamptz, nullable) - When student completed this stage
- `progress_data` (jsonb) - Stage-specific progress data
- `created_at` (timestamptz) - Creation timestamp
- `updated_at` (timestamptz) - Last update timestamp

**Constraints:**
- UNIQUE: (attempt_id, stage_id)

**Indexes:**
- `idx_attempt_stage_progress_attempt` on (attempt_id)
- `idx_attempt_stage_progress_stage` on (stage_id)

**RLS Policies:**
- `attempt_stage_progress_admin_all` - Admins (authenticated) have full access
- `attempt_stage_progress_public_select` - Students (anon) can view progress
- `attempt_stage_progress_public_update` - Students (anon) can update progress
- `attempt_stage_progress_public_insert` - Students (anon) can insert progress

## Backward Compatibility
✅ **Verified**: Existing exams without stages continue to work unchanged
- All existing exams have `stage_count = 0`
- No modifications to existing tables
- No data migration required

## Configuration Examples

### Video Stage Configuration
```json
{
  "youtube_url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "enforcement_threshold": 80,
  "description": "Watch this introduction video"
}
```

### Content Stage Configuration
```json
{
  "slides": [
    {
      "id": "slide-1",
      "content": "<h2>Introduction</h2><p>Welcome to...</p>",
      "order": 0
    }
  ],
  "minimum_read_time_per_slide": 30
}
```

### Questions Stage Configuration
```json
{
  "question_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "randomize_within_stage": false
}
```

## Progress Data Examples

### Video Stage Progress
```json
{
  "watch_percentage": 85.5,
  "total_watch_time": 342,
  "last_position": 380,
  "watched_segments": [[0, 120], [150, 400]]
}
```

### Content Stage Progress
```json
{
  "current_slide_index": 2,
  "slide_times": {
    "slide-1": 45,
    "slide-2": 62,
    "slide-3": 38
  }
}
```

### Questions Stage Progress
```json
{
  "answered_count": 8,
  "total_count": 10
}
```

## Verification
Migration was tested and verified:
- ✅ Tables created successfully
- ✅ Indexes created
- ✅ Foreign keys with CASCADE working
- ✅ RLS policies enabled
- ✅ Triggers for updated_at working
- ✅ Backward compatibility confirmed
- ✅ No impact on existing exams

## Next Steps
1. Extend RPC functions (get_attempt_state, update_stage_progress)
2. Create TypeScript type definitions
3. Build stage components (VideoStage, ContentStage, QuestionsStage)
4. Integrate with existing attempt flow
