# 📍 Where to Set Scheduling Mode (Auto/Manual) in UI

## ✅ Location: Exam Edit Page

### **Path:**
```
/admin/exams/[examId]/edit
```

### **How to Access:**
1. Go to `/admin/exams`
2. Click **"Edit"** on any exam
3. Scroll to **"Schedule & Duration"** section
4. You'll see the **Scheduling Mode** selector at the top

---

## 🎨 **UI Control - What You'll See:**

```
┌────────────────────────────────────────────────┐
│         📅 Schedule & Duration                 │
├────────────────────────────────────────────────┤
│                                                │
│  ⚙️ Scheduling Mode                           │
│  ┌──────────────┬──────────────┐              │
│  │   ⚙️ Auto    │   🔧 Manual  │              │
│  │  Time-based  │  You control │              │
│  └──────────────┴──────────────┘              │
│                                                │
│  ⚙️ Auto Mode: Exam automatically becomes     │
│  available at start time and ends at end      │
│  time. You can still publish early using      │
│  the "🚀 Publish" button.                     │
│                                                │
│  Start Time: [datetime picker]                │
│  End Time: [datetime picker]                  │
│  Duration (minutes): [number input]           │
│                                                │
└────────────────────────────────────────────────┘
```

---

## 🔄 **How It Works:**

### **⚙️ Auto Mode (Default):**
- Exam status changes automatically based on time
- **Before start_time:** 📝 Draft → **Scheduled**
- **Between start/end:** 🟢 Live → **Published**
- **After end_time:** ⚫ Ended → **Done**
- You can still click **🚀 Publish** to publish early

### **🔧 Manual Mode:**
- YOU control when the exam is published
- Start/end times become **optional**
- Status won't change automatically
- Perfect for homework or open-ended assignments

---

## 📝 **When to Use Each Mode:**

### **Use Auto Mode (⚙️) When:**
- ✅ You have a specific exam date/time
- ✅ You want automatic start and end
- ✅ It's a timed assessment
- ✅ Example: "Final Exam - Oct 20, 10:00 AM to 12:00 PM"

### **Use Manual Mode (🔧) When:**
- ✅ No specific schedule
- ✅ Open-ended homework
- ✅ You want full control
- ✅ Example: "Practice Quiz - available whenever you decide"

---

## 🎯 **Quick Actions:**

### **To Switch Modes:**
1. Edit an exam
2. Go to "Schedule & Duration" section
3. Click **⚙️ Auto** or **🔧 Manual** button
4. Click **Save** at the top

### **To Publish Early (Auto Mode):**
1. Exam must be in Auto mode with future start time
2. Go to exam list (`/admin/exams`)
3. Click **🚀 Publish** button
4. Exam becomes accessible immediately
5. Still ends automatically at scheduled time

---

## 💡 **Tips:**

- **Auto Mode** is automatically selected when you set both start and end times
- **Manual Mode** is automatically selected when you create an exam without times
- You can switch between modes anytime
- Changes take effect immediately after saving
- The status badge shows **🔧** icon for Manual mode

---

## 📂 **Files Modified:**

✅ `src/app/admin/exams/[examId]/edit/page.tsx`
- Added Scheduling Mode selector
- Updated status badge to show live info
- Made times optional in Manual mode

---

## 🧪 **Test It:**

1. Create a new exam
2. Go to edit page
3. See the Scheduling Mode selector
4. Switch between Auto and Manual
5. Notice how the description changes
6. Save and check the exam list page
7. Status should reflect your choice

---

## 🎉 **That's It!**

Now you can easily control whether your exams follow automatic scheduling or manual control!
