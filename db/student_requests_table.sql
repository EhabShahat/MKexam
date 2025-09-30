-- Create student_requests table for the public registration system
-- This table stores student registration requests that need admin approval

CREATE TABLE IF NOT EXISTS student_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_name VARCHAR(255) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    mobile_number2 VARCHAR(20),
    address TEXT,
    national_id VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_student_requests_status ON student_requests(status);
CREATE INDEX IF NOT EXISTS idx_student_requests_mobile ON student_requests(mobile_number);
CREATE INDEX IF NOT EXISTS idx_student_requests_national_id ON student_requests(national_id) WHERE national_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_requests_created_at ON student_requests(created_at DESC);

-- Add Row Level Security (RLS) policies
ALTER TABLE student_requests ENABLE ROW LEVEL SECURITY;

-- Allow public inserts for new registration requests
CREATE POLICY "Allow public insert for registration requests" ON student_requests
    FOR INSERT 
    WITH CHECK (true);

-- Allow admins to read all requests
CREATE POLICY "Allow admins to read requests" ON student_requests
    FOR SELECT 
    TO authenticated
    USING (true);

-- Allow admins to update request status
CREATE POLICY "Allow admins to update requests" ON student_requests
    FOR UPDATE 
    TO authenticated
    USING (true);

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_student_requests_updated_at 
    BEFORE UPDATE ON student_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data (optional - for testing)
INSERT INTO student_requests (student_name, mobile_number, address, national_id, status) VALUES
('أحمد محمد علي', '01012345678', 'القاهرة، مصر الجديدة', '12345678901234', 'pending'),
('فاطمة حسن محمود', '01098765432', 'الإسكندرية، سيدي جابر', '98765432109876', 'pending'),
('محمد عبد الله أحمد', '01156789012', 'الجيزة، الدقي', '11223344556677', 'approved')
ON CONFLICT DO NOTHING;
