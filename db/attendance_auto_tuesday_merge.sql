-- Auto-merge attendance records to last Tuesday
-- This ensures all attendance from Tue-Mon gets recorded as that week's Tuesday

-- Function to calculate the last Tuesday from a given date
CREATE OR REPLACE FUNCTION get_last_tuesday(input_date DATE)
RETURNS DATE AS $$
DECLARE
  day_of_week INTEGER;
  days_back INTEGER;
BEGIN
  -- Get day of week (0=Sunday, 1=Monday, 2=Tuesday, etc.)
  day_of_week := EXTRACT(DOW FROM input_date);
  
  -- Calculate how many days back to the last Tuesday
  -- Tuesday is 2
  IF day_of_week >= 2 THEN
    -- If today is Tuesday or later in the week, go back to this week's Tuesday
    days_back := day_of_week - 2;
  ELSE
    -- If today is Sunday (0) or Monday (1), go back to last week's Tuesday
    days_back := day_of_week + 5;
  END IF;
  
  RETURN input_date - days_back;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function to auto-adjust session_date to last Tuesday (timezone-safe)
CREATE OR REPLACE FUNCTION auto_set_session_date_to_last_tuesday()
RETURNS TRIGGER AS $$
DECLARE
  input_date DATE;
  day_of_week INTEGER;
  days_back INTEGER;
BEGIN
  -- Ensure we're working with a proper DATE (strip any timezone info)
  -- If session_date is null, use current UTC date
  input_date := COALESCE(NEW.session_date, CURRENT_DATE);
  
  -- Get day of week (0=Sunday, 1=Monday, 2=Tuesday, etc.)
  -- EXTRACT(DOW FROM DATE) is timezone-independent
  day_of_week := EXTRACT(DOW FROM input_date);
  
  -- Calculate how many days back to the last Tuesday
  -- Tuesday is 2
  IF day_of_week >= 2 THEN
    -- If today is Tuesday or later in the week, go back to this week's Tuesday
    days_back := day_of_week - 2;
  ELSE
    -- If today is Sunday (0) or Monday (1), go back to last week's Tuesday
    days_back := day_of_week + 5;
  END IF;
  
  -- Set session_date to the last Tuesday
  NEW.session_date := input_date - days_back;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to ensure attended_at is stored in UTC
CREATE OR REPLACE FUNCTION set_attended_at_utc()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure attended_at is set to current UTC time if not provided
  IF NEW.attended_at IS NULL THEN
    NEW.attended_at := NOW() AT TIME ZONE 'UTC';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on attendance_records to auto-adjust to Tuesday
DROP TRIGGER IF EXISTS set_session_date_to_tuesday ON attendance_records;
CREATE TRIGGER set_session_date_to_tuesday
  BEFORE INSERT OR UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_session_date_to_last_tuesday();

-- Create trigger to ensure UTC timestamps
DROP TRIGGER IF EXISTS ensure_attended_at_utc ON attendance_records;
CREATE TRIGGER ensure_attended_at_utc
  BEFORE INSERT ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION set_attended_at_utc();

-- Comment explaining the purpose
COMMENT ON FUNCTION get_last_tuesday(DATE) IS 'Returns the most recent Tuesday from a given date. Used for weekly attendance aggregation.';
COMMENT ON FUNCTION auto_set_session_date_to_last_tuesday() IS 'Trigger function that automatically merges attendance records to the last Tuesday of the week.';
COMMENT ON FUNCTION set_attended_at_utc() IS 'Trigger function that ensures attended_at timestamps are stored in UTC to prevent timezone issues.';
