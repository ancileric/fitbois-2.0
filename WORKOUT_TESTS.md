# 🏋️ Workout Tab Test Cases

## 🧪 **Comprehensive Test Suite for Workout Tab**

### **Test Environment:**
- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:5000
- **Database:** `backend/database/fitbois.db`

---

## 📊 **1. Summary Tiles Tests**

### **Test 1.1: Total Participants Tile**
**Expected:** Shows count of active participants
```bash
# API Test
curl http://localhost:5000/api/users | jq '[.[] | select(.isActive == true)] | length'
```
**Manual Test:**
1. Go to Workout tab
2. Check "Total Participants" tile
3. ✅ Should match number of active users in database

### **Test 1.2: Current Week Tile**
**Expected:** Shows "1" (since challenge started Jan 19, 2026)
```bash
# Date calculation test
node -e "
const start = new Date('2026-01-19');
const now = new Date();
const daysDiff = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
console.log('Current week should be:', daysDiff < 0 ? 0 : Math.floor(daysDiff / 7) + 1);
"
```
**Manual Test:**
1. Check "Current Week" tile
2. ✅ Should show "1" (not "Not Started")

### **Test 1.3: Week Completion Tile**
**Expected:** Percentage based on individual consistency levels
```bash
# Calculate expected completion
curl http://localhost:5000/api/users | jq -r '.[] | select(.isActive == true) | .currentConsistencyLevel' | awk '{sum+=$1} END {print "Required workouts:", sum}'
curl http://localhost:5000/api/workouts | jq '[.[] | select(.week == 1 and .isCompleted == true)] | length'
```
**Manual Test:**
1. Check "Week Completion" tile
2. ✅ Should show percentage with progress bar
3. ✅ Should show "X/Y workouts completed" below

### **Test 1.4: Challenge Status Tile**
**Expected:** Shows "ACTIVE"
**Manual Test:**
1. Check "Challenge Status" tile
2. ✅ Should show "ACTIVE" in purple

---

## 📅 **2. Week Selector Tests**

### **Test 2.1: Week Button Functionality**
**Manual Test:**
1. Click different week buttons (1, 2, 3...)
2. ✅ Selected week should highlight in blue
3. ✅ Current week should have "(Current)" label
4. ✅ Workout grid should update to show selected week

### **Test 2.2: Week Statistics Display**
**Manual Test:**
1. Look at numbers under each week button
2. ✅ Should show "X/Y" (completed users / total users)
3. ✅ Numbers should be accurate for each week

---

## ✅ **3. Workout Tracking Grid Tests**

### **Test 3.1: Table Structure**
**Manual Test:**
1. Check table headers alignment
2. ✅ Headers should align perfectly with columns
3. ✅ Days: Mon, Tue, Wed, Thu, Fri, Sat, Sun
4. ✅ All active participants should be listed

### **Test 3.2: Workout Toggle Functionality**
**API Test:**
```bash
# Test workout toggle
USER_ID="user-1"
WEEK=1
DAY=1
DATE="2026-01-19"

# Mark workout complete
curl -X POST http://localhost:5000/api/workouts \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"week\":$WEEK,\"dayOfWeek\":$DAY,\"date\":\"$DATE\",\"isCompleted\":true,\"markedBy\":\"admin\"}"

# Verify it was saved
curl http://localhost:5000/api/workouts/$USER_ID/$WEEK | jq '.[] | select(.dayOfWeek == 1) | .isCompleted'
```

**Manual Test:**
1. Click a gray (incomplete) workout button
2. ✅ Should turn green immediately
3. ✅ Should save to database (refresh page to verify persistence)
4. Click a green (complete) workout button
5. ✅ Should turn gray immediately
6. ✅ Should update database (refresh to verify)

### **Test 3.3: Progress Calculation**
**Manual Test:**
1. Mark workouts for a user (e.g., 3 out of 5 required)
2. ✅ Progress column should show "3/5"
3. ✅ Should NOT show green checkmark (incomplete)
4. Mark enough workouts to meet requirement (e.g., 5/5)
5. ✅ Progress should show "5/5" with green checkmark

### **Test 3.4: Consistency Level Handling**
**Manual Test:**
1. Find Subhash (4-day level) vs others (5-day level)
2. ✅ Subhash should show "4" in Level column
3. ✅ Subhash needs 4/4 for completion, others need 5/5
4. ✅ Progress calculation should respect individual levels

---

## 📈 **4. Weekly Progress Summary Tests**

### **Test 4.1: Progress Cards Display**
**Manual Test:**
1. Check weekly progress cards (Week 1, 2, 3...)
2. ✅ Current week should have blue background
3. ✅ Each card shows "X/Y users met goals"
4. ✅ Progress bars should reflect completion percentages

### **Test 4.2: Smart Calculation Note**
**Manual Test:**
1. Look for blue info box at bottom
2. ✅ Should explain individual consistency levels
3. ✅ Should mention 5 days/week = 5 required, etc.

---

## 🔄 **5. Real-time Updates Tests**

### **Test 5.1: Live Database Updates**
**Manual Test:**
1. Mark a workout complete
2. ✅ UI should update immediately
3. Refresh the page
4. ✅ Change should persist (from database)

### **Test 5.2: Week Completion Recalculation**
**Manual Test:**
1. Note current "Week Completion" percentage
2. Mark several workouts complete
3. ✅ Percentage should increase in real-time
4. Unmark some workouts
5. ✅ Percentage should decrease

### **Test 5.3: Progress Summary Updates**
**Manual Test:**
1. Mark workouts to complete a user's week
2. ✅ Weekly progress card should update
3. ✅ "Users met goals" count should increase

---

## 🗄️ **6. Database Integration Tests**

### **Test 6.1: Data Persistence**
**API Tests:**
```bash
# Check workout data structure
curl http://localhost:5000/api/workouts | jq '.[0]'

# Verify foreign key relationships
curl http://localhost:5000/api/workouts | jq '[.[] | {userId, userName, week, dayOfWeek, isCompleted}]'
```

**Manual Test:**
1. Make several workout changes
2. Close browser completely
3. Reopen http://localhost:3000
4. ✅ All changes should be preserved

### **Test 6.2: User Consistency Levels**
**Manual Test:**
1. Check users with different consistency levels
2. ✅ 5-day users need 5 workouts for green checkmark
3. ✅ 4-day users (like Subhash) need 4 workouts
4. ✅ Progress calculations respect individual requirements

---

## 🚨 **7. Error Handling Tests**

### **Test 7.1: Database Connection**
**Manual Test:**
1. Look for "Database Connected" indicator
2. ✅ Should show blue pulsing dot
3. ✅ Should say "Database Connected"

### **Test 7.2: Backend Failure Handling**
**Test Scenario:**
1. Stop backend server: `pkill -f "node server.js"`
2. Try to mark a workout
3. ✅ Should show error message
4. Restart backend: `cd backend && npm start`
5. ✅ Should reconnect automatically

---

## 📱 **8. UI/UX Tests**

### **Test 8.1: Responsive Design**
**Manual Test:**
1. Resize browser window
2. ✅ Table should scroll horizontally on small screens
3. ✅ Summary tiles should stack on mobile
4. ✅ Week selector should wrap properly

### **Test 8.2: Visual Feedback**
**Manual Test:**
1. Hover over workout buttons
2. ✅ Should show hover effects
3. ✅ Buttons should have smooth transitions
4. ✅ Colors should be clear (green = complete, gray = incomplete)

---

## 🎯 **9. Business Logic Tests**

### **Test 9.1: Weekly Goal Logic**
**Test Scenario:**
1. User needs 5 workouts (5-day level)
2. Mark 4 workouts ✅ → Progress shows "4/5" (no green check)
3. Mark 5th workout ✅ → Progress shows "5/5" with green check
4. Unmark 1 workout ❌ → Progress shows "4/5" (green check disappears)

### **Test 9.2: Different Consistency Levels**
**Test Scenario:**
1. Subhash (4-day): Mark 4 workouts → Should show complete
2. Others (5-day): Mark 4 workouts → Should NOT show complete
3. ✅ Progress calculations should differ based on level

---

## 🔍 **10. Performance Tests**

### **Test 10.1: Large Dataset Handling**
**Test with multiple weeks:**
1. Select different weeks (1, 2, 3, 4...)
2. ✅ Should load quickly
3. ✅ Should not lag when toggling workouts

### **Test 10.2: Memory Usage**
**Manual Test:**
1. Toggle many workouts rapidly
2. ✅ Should not slow down
3. ✅ Should not cause memory leaks

---

## 🎉 **Expected Test Results:**

### **✅ All Tests Should Pass:**
- Summary tiles show accurate real-time data
- Week selector works with proper highlighting
- Workout grid toggles save to database immediately
- Progress calculations respect individual consistency levels
- Weekly progress updates in real-time
- Database persistence works across sessions
- UI is responsive and provides good feedback

### **🚨 If Tests Fail:**
- Check backend server is running on port 5000
- Check database file exists: `backend/database/fitbois.db`
- Check browser console for JavaScript errors
- Verify API connectivity: `curl http://localhost:5000/api/health`

---

## 🚀 **Quick Test Script:**

```bash
# Run this to verify everything is working
echo "=== FitBois 2.0 Workout Tab Test ==="
echo "1. Backend Health:"
curl -s http://localhost:5000/api/health | jq -r '.status'

echo "2. Total Users:"
curl -s http://localhost:5000/api/users | jq '[.[] | select(.isActive == true)] | length'

echo "3. Week 1 Workouts:"
curl -s http://localhost:5000/api/workouts | jq '[.[] | select(.week == 1 and .isCompleted == true)] | length'

echo "4. Frontend Status:"
curl -s http://localhost:3000 > /dev/null && echo "✅ Frontend accessible" || echo "❌ Frontend not accessible"

echo "=== Test Complete ==="
```

**Run this test script to verify all core functionality is working!** 💪🧪