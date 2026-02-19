# Results View Optimization - Implementation Plan

## Executive Summary

The All Exams and Matrix View pages currently make **130+ individual API calls** per page load, causing:
- 10-30 second load times
- High Netlify function costs ($50-100/month for 1000 views)
- Poor user experience
- Excessive Supabase bandwidth usage

**Solution:** Consolidate into 1-2 API calls with database-level aggregation.

**Expected Results:**
- ⚡ 90% faster (1-3 seconds vs 10-30 seconds)
- 💰 95% cost reduction ($1-5/month vs $50-100/month)
- 🚀 Better UX with instant caching

---

## Phase 1: Backend Optimization (Priority: CRITICAL)

### 1.1 Create Bulk Attempts API ✅ DONE

**File:** `src/app/api/admin/attempts/bulk/route.ts`

**What it does:**
- Returns ALL attempts for ALL exams in a single query
- Uses Supabase JOIN to fetch related exam data
- Groups results by exam_id for easy consumption

**Usage:**
```typescript
const res = await authFetch('/api/admin/attempts/bulk');
const { attemptsByExam, allAttempts } = await res.json();
```

**Impact:** Reduces 130 API calls to 1

### 1.2 Create Materialized View ✅ DONE

**File:** `db/results_summary_view.sql`

**What it does:**
- Pre-aggregates student scores across all exams
- Stores best score, attempt count, last attempt date
- Refreshes on-demand or via scheduled job

**Benefits:**
- Instant aggregated data retrieval
- No client-side computation
- Consistent performance

### 1.3 Create Summary API ✅ DONE

**File:** `src/app/api/admin/results/summary/route.ts`

**What it does:**
- Queries the materialized view
- Returns pre-computed student scores
- Supports refresh trigger via POST

---

## Phase 2: Frontend Updates (Priority: HIGH)

### 2.1 Update All Exams View

**File:** `src/app/admin/results/page.tsx`

**Changes needed:**

```typescript
// BEFORE (lines ~370-470)
const allAttemptsQuery = useQuery({
  enabled: examId === ALL,
  queryKey: ["admin", "attempts", "ALL"],
  queryFn: async () => {
    const exams = visibleActualExams ?? [];
    const resultsByExam: Record<string, any[]> = {};
    
    // ❌ BAD: 130+ separate API calls
    await Promise.all(
      exams.map(async (ex) => {
        const res = await authFetch(`/api/admin/exams/${ex.id}/attempts`);
        const j = await res.json();
        if (res.ok) resultsByExam[ex.id] = (j.items as any[]) || [];
        else resultsByExam[ex.id] = [];
      })
    );
    // ... aggregation logic
  },
});

// AFTER (OPTIMIZED)
const allAttemptsQuery = useQuery({
  enabled: examId === ALL,
  queryKey: ["admin", "attempts", "bulk"],
  staleTime: 2 * 60 * 1000,  // Cache for 2 minutes
  gcTime: 5 * 60 * 1000,      // Keep in memory for 5 minutes
  queryFn: async () => {
    const exams = visibleActualExams ?? [];
    
    // ✅ GOOD: Single API call for all attempts
    const res = await authFetch('/api/admin/attempts/bulk');
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Load failed");
    
    const { attemptsByExam } = json;
    
    // Fetch students list once
    let nameToCode: Map<string, string> = new Map();
    let codeToId: Map<string, string> = new Map();
    let nameToId: Map<string, string> = new Map();
    
    try {
      const sRes = await authFetch(`/api/admin/students`);
      const sJson = await sRes.json();
      if (sRes.ok && Array.isArray(sJson?.students)) {
        for (const s of sJson.students) {
          const nm = (String(s?.student_name ?? "").trim()) || "";
          const cd = s?.code ? String(s.code) : "";
          const sid = s?.student_id ? String(s.student_id) : "";
          if (nm && cd && !nameToCode.has(nm)) nameToCode.set(nm, cd);
          if (cd && sid) codeToId.set(cd, sid);
          if (nm && sid && !nameToId.has(nm)) nameToId.set(nm, sid);
        }
      }
    } catch {}
    
    // Build per-student aggregation (same logic as before)
    const byStudent: Map<string, { 
      name: string; 
      code: string | null; 
      student_id: string | null; 
      scores: Record<string, number | null> 
    }> = new Map();
    
    for (const ex of exams) {
      const items = attemptsByExam[ex.id] || [];
      const bestByName: Map<string, number> = new Map();
      const codeByName: Map<string, string | null> = new Map();
      const idByName: Map<string, string | null> = new Map();
      
      for (const at of items) {
        const name = (at.student_name ?? "").trim() || "(Anonymous)";
        const val = at.final_score_percentage ?? at.score_percentage;
        const n = val == null ? null : Number(val);
        if (n == null || Number.isNaN(n)) continue;
        
        const prev = bestByName.get(name);
        if (prev == null || n > prev) bestByName.set(name, n);
        
        if (!codeByName.has(name)) {
          codeByName.set(name, at.code ?? (nameToCode.get(name) ?? null));
        }
        
        if (!idByName.has(name)) {
          const code = at.code ?? (nameToCode.get(name) ?? null);
          const sid = code ? (codeToId.get(code) ?? null) : (nameToId.get(name) ?? null);
          idByName.set(name, sid ?? null);
        }
      }
      
      // Merge into rows
      for (const [name, val] of bestByName.entries()) {
        const row = byStudent.get(name) || { 
          name, 
          code: codeByName.get(name) ?? null, 
          student_id: idByName.get(name) ?? null, 
          scores: {} 
        };
        row.scores[ex.id] = val;
        byStudent.set(name, row);
      }
      
      // Ensure students with attempts but null score appear
      for (const at of items) {
        const name = (at.student_name ?? "").trim() || "(Anonymous)";
        if (!byStudent.has(name)) {
          byStudent.set(name, { 
            name, 
            code: at.code ?? (nameToCode.get(name) ?? null), 
            student_id: idByName.get(name) ?? null, 
            scores: { [ex.id]: null } 
          });
        }
      }
    }
    
    const rows = Array.from(byStudent.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
    
    return { exams, rows };
  },
});
```

### 2.2 Update Matrix View

**File:** `src/app/admin/results/matrix/page.tsx`

**Changes needed:**

```typescript
// BEFORE (lines ~72-92)
const attemptsQuery = useQuery({
  queryKey: ["admin", "attempts", "all-matrix"],
  queryFn: async () => {
    const exams = examsQuery.data ?? [];
    const allAttempts: Attempt[] = [];
    
    // ❌ BAD: 130+ separate API calls
    await Promise.all(
      exams.map(async (exam) => {
        const res = await authFetch(`/api/admin/exams/${exam.id}/attempts`);
        const j = await res.json();
        if (res.ok) {
          const attempts = (j.items as Attempt[]) || [];
          allAttempts.push(...attempts.map(a => ({ ...a, exam_id: exam.id })));
        }
      })
    );
    
    return allAttempts;
  },
  enabled: !!examsQuery.data && examsQuery.data.length > 0,
});

// AFTER (OPTIMIZED)
const attemptsQuery = useQuery({
  queryKey: ["admin", "attempts", "bulk-matrix"],
  staleTime: 2 * 60 * 1000,  // Cache for 2 minutes
  gcTime: 5 * 60 * 1000,      // Keep in memory for 5 minutes
  queryFn: async () => {
    // ✅ GOOD: Single API call for all attempts
    const res = await authFetch('/api/admin/attempts/bulk');
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Load failed");
    
    // allAttempts already includes exam_id from the bulk API
    return json.allAttempts as Attempt[];
  },
  enabled: !!examsQuery.data && examsQuery.data.length > 0,
});
```

### 2.3 Add Caching to Individual Exam View

**File:** `src/app/admin/results/page.tsx`

**Changes needed:**

```typescript
// BEFORE (lines ~560-570)
const attemptsQuery = useQuery({
  enabled: !!examId && examId !== ALL,
  queryKey: ["admin", "attempts", examId],
  staleTime: 0,  // ❌ Always fetch fresh
  gcTime: 0,     // ❌ Don't cache
  queryFn: async () => {
    const res = await authFetch(`/api/admin/exams/${examId}/attempts`);
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Load attempts failed");
    return j.items as Attempt[];
  },
});

// AFTER (OPTIMIZED)
const attemptsQuery = useQuery({
  enabled: !!examId && examId !== ALL,
  queryKey: ["admin", "attempts", examId],
  staleTime: 2 * 60 * 1000,  // ✅ Fresh for 2 minutes
  gcTime: 5 * 60 * 1000,      // ✅ Cache for 5 minutes
  queryFn: async () => {
    const res = await authFetch(`/api/admin/exams/${examId}/attempts`);
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Load attempts failed");
    return j.items as Attempt[];
  },
});
```

---

## Phase 3: Database Setup (Priority: HIGH)

### 3.1 Apply Materialized View Migration

```bash
# Connect to your Supabase database
psql $DATABASE_URL -f db/results_summary_view.sql

# Verify creation
psql $DATABASE_URL -c "\d results_summary_mv"

# Initial refresh
psql $DATABASE_URL -c "SELECT refresh_results_summary();"
```

### 3.2 Set Up Scheduled Refresh (Optional but Recommended)

**Option A: Netlify Scheduled Function**

Create `netlify/functions/refresh-results.ts`:

```typescript
import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

export const handler = schedule("*/15 * * * *", async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { error } = await supabase.rpc('refresh_results_summary');
  
  if (error) {
    console.error('Refresh failed:', error);
    return { statusCode: 500 };
  }
  
  console.log('Results summary refreshed successfully');
  return { statusCode: 200 };
});
```

**Option B: Supabase pg_cron Extension**

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule refresh every 15 minutes
SELECT cron.schedule(
  'refresh-results-summary',
  '*/15 * * * *',
  'SELECT refresh_results_summary();'
);
```

---

## Phase 4: Testing & Validation (Priority: MEDIUM)

### 4.1 Performance Testing

```typescript
// Test bulk API performance
console.time('Bulk API');
const res = await fetch('/api/admin/attempts/bulk');
const data = await res.json();
console.timeEnd('Bulk API');
// Expected: < 2 seconds

// Test materialized view
console.time('Summary API');
const res2 = await fetch('/api/admin/results/summary');
const data2 = await res2.json();
console.timeEnd('Summary API');
// Expected: < 500ms
```

### 4.2 Data Validation

Ensure aggregated data matches individual queries:

```typescript
// Compare old vs new approach
const oldData = await fetchIndividualExams(); // Old method
const newData = await fetchBulkExams();       // New method

// Validate scores match
validateScoresMatch(oldData, newData);
```

### 4.3 Load Testing

Use tools like Apache Bench or k6:

```bash
# Test concurrent requests
ab -n 100 -c 10 https://your-app.netlify.app/api/admin/attempts/bulk
```

---

## Phase 5: Monitoring & Rollback (Priority: HIGH)

### 5.1 Add Performance Monitoring

```typescript
// Add to results page
useEffect(() => {
  if (allAttemptsQuery.isSuccess) {
    const loadTime = allAttemptsQuery.dataUpdatedAt - allAttemptsQuery.fetchedAt;
    console.log(`All Exams loaded in ${loadTime}ms`);
    
    // Send to analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'timing_complete', {
        name: 'all_exams_load',
        value: loadTime,
      });
    }
  }
}, [allAttemptsQuery.isSuccess]);
```

### 5.2 Rollback Plan

If issues occur:

1. **Immediate:** Comment out new code, uncomment old code
2. **Database:** Materialized view is optional, can be dropped
3. **API:** Old endpoints remain functional

---

## Implementation Checklist

- [ ] **Phase 1: Backend** (1-2 hours)
  - [x] Create bulk attempts API
  - [x] Create materialized view SQL
  - [x] Create summary API
  - [ ] Test APIs in Postman/Thunder Client

- [ ] **Phase 2: Frontend** (2-3 hours)
  - [ ] Update All Exams view query
  - [ ] Update Matrix view query
  - [ ] Add caching to individual exam view
  - [ ] Test in development

- [ ] **Phase 3: Database** (30 minutes)
  - [ ] Apply materialized view migration
  - [ ] Set up scheduled refresh
  - [ ] Verify indexes created

- [ ] **Phase 4: Testing** (1-2 hours)
  - [ ] Performance testing
  - [ ] Data validation
  - [ ] Load testing
  - [ ] Cross-browser testing

- [ ] **Phase 5: Deployment** (30 minutes)
  - [ ] Deploy to staging
  - [ ] Smoke test
  - [ ] Deploy to production
  - [ ] Monitor for 24 hours

---

## Expected Timeline

- **Total Time:** 5-8 hours
- **Downtime:** None (backward compatible)
- **Risk Level:** Low (old endpoints remain functional)

## Success Metrics

After implementation, measure:

1. **Page Load Time:** Should be < 3 seconds (vs 10-30 seconds)
2. **API Calls:** Should be 1-2 per page load (vs 130+)
3. **Netlify Function Invocations:** 99% reduction
4. **User Satisfaction:** Faster, smoother experience
5. **Cost Savings:** 95% reduction in function costs

## Questions?

Contact the development team or refer to:
- [Results View Optimization Guide](./RESULTS_VIEW_OPTIMIZATION.md)
- [API Route Caching](./API_ROUTE_CACHING.md)
- [Performance Monitoring](./PERFORMANCE_MONITORING.md)
