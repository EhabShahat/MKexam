# Test API Response

## Manual Test

Open your browser and paste this URL (replace with your actual exam ID):

```
http://localhost:3000/api/admin/exams/63ce5ba4-dddb-42b1-b6cf-9664ac099077/attempts
```

You should see JSON response like:

```json
{
  "items": [
    {
      "id": "...",
      "student_name": "...",
      "device_info": { ... },  ← THIS SHOULD BE PRESENT
      "ip_address": "...",
      ...
    }
  ]
}
```

## If device_info is missing:

Check server terminal for:
- "RPC SUCCESS - Sample device_info: HAS DATA" or "NULL"
- "FALLBACK SUCCESS - Sample device_info: HAS DATA" or "NULL"
- Any error messages

## If device_info is present but table still shows "Unknown Device":

The issue is in the frontend rendering, not the API.
