# 🎯 Goals Page Test Cases

## 🧪 **Comprehensive Test Suite for Goals Page**

### **Test Environment:**
- **Frontend:** http://localhost:3000 → Goals tab
- **Backend:** http://localhost:5000
- **Database:** `backend/database/fitbois.db`

---

## 📊 **1. Page Structure Tests**

### **Test 1.1: Navigation & Access**
**Manual Test:**
1. Visit http://localhost:3000
2. Click "Goals" tab (2nd tab)
3. ✅ Should load Goals Management page
4. ✅ Should show "Goals Management" header
5. ✅ Should show description about 5 goals per user

### **Test 1.2: User Sections Display**
**Manual Test:**
1. Check that all users are displayed
2. ✅ Users should be in alphabetical order
3. ✅ Each user should have their own section with avatar and name
4. ✅ Should show "X/5 active goals • Y completed"

---

## 🎯 **2. Compact 5-Row Format Tests**

### **Test 2.1: Category Row Structure**
**Manual Test:**
1. Check each user's 5 category rows
2. ✅ Should show all 5 categories: 🏃‍♂️ 💪 📅 ⚽ 🎯
3. ✅ Categories should be in consistent order for all users
4. ✅ Each row should show category icon, name, and goal description

### **Test 2.2: Goal Status Display**
**Manual Test:**
1. Look for different goal states:
   - **No goal:** "No goal set for this category" + [Add Goal] button
   - **Active goal:** Description + [Complete] [Delete] buttons
   - **Completed goal:** Description + completion date + [Delete] button
2. ✅ Status should be visually clear
3. ✅ Completed goals should have green background

### **Test 2.3: Difficult Goal Indicators**
**Manual Test:**
1. Look for "Difficult" badges on goals
2. ✅ Should appear as orange badges
3. ✅ Should only show on goals marked as difficult

---

## 🔧 **3. Goal Management Tests**

### **Test 3.1: Add Goal Functionality**
**API Test:**
```bash
# Check current goals count
curl http://localhost:5000/api/goals | jq 'length'

# Check users available
curl http://localhost:5000/api/users | jq '.[] | {id, name}'
```

**Manual Test:**
1. Find a category with "No goal set"
2. Click "Add Goal" button
3. ✅ Modal should open with user and category pre-selected
4. ✅ User dropdown should be alphabetically sorted
5. Fill description: "Test goal for verification"
6. Check "This is a difficult goal"
7. Click "Add Goal"
8. ✅ Modal should close
9. ✅ Goal should appear in the row immediately
10. ✅ Should show "Difficult" badge

### **Test 3.2: Complete Goal Functionality**
**Manual Test:**
1. Find an active (incomplete) goal
2. Click "Complete" button
3. ✅ Goal row should turn green background
4. ✅ Should show "✅ Complete" badge
5. ✅ Should show completion date
6. ✅ "Complete" button should disappear
7. Refresh page
8. ✅ Goal should remain completed (database persistence)

### **Test 3.3: Delete Goal Functionality**
**Manual Test:**
1. Find any goal (active or completed)
2. Click "Delete" button
3. ✅ Should show confirmation dialog
4. Click "OK" to confirm
5. ✅ Goal should disappear immediately
6. ✅ Row should show "No goal set for this category"
7. ✅ "Add Goal" button should appear
8. Refresh page
9. ✅ Goal should remain deleted (database persistence)

### **Test 3.4: Clear All Goals**
**Manual Test:**
1. Find a user with multiple goals
2. Click "Clear All" button
3. ✅ Should show confirmation with user name
4. Click "OK" to confirm
5. ✅ All goals for that user should disappear
6. ✅ All rows should show "No goal set"
7. ✅ All rows should show "Add Goal" buttons

---

## 📋 **4. Validation & Rules Tests**

### **Test 4.1: Category Uniqueness**
**Manual Test:**
1. Try to add a goal in a category that already has a goal
2. ✅ Should show error message about duplicate category
3. ✅ Goal should not be created

### **Test 4.2: Difficult Goal Requirement**
**Manual Test:**
1. Find a user with goals but no difficult goals
2. ✅ Should show "⚠️ Need Difficult Goal" warning
3. ✅ Should show orange alert explaining requirement
4. Mark a goal as difficult
5. ✅ Warning should disappear

### **Test 4.3: Missing Categories Alert**
**Manual Test:**
1. Find a user missing 2+ categories
2. ✅ Should show "X Missing" badge
3. ✅ Should show blue alert listing missing categories
4. Add goals to fill categories
5. ✅ Should change to "✅ All Categories" when complete

---

## 🗄️ **5. Database Integration Tests**

### **Test 5.1: Data Persistence**
**API Tests:**
```bash
# Create a test goal
curl -X POST http://localhost:5000/api/goals \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","category":"consistency","description":"Test persistence goal","isDifficult":false}'

# Verify it was created
curl http://localhost:5000/api/goals | jq '.[] | select(.description == "Test persistence goal")'

# Complete the goal
GOAL_ID=$(curl -s http://localhost:5000/api/goals | jq -r '.[] | select(.description == "Test persistence goal") | .id')
curl -X PUT http://localhost:5000/api/goals/$GOAL_ID \
  -H "Content-Type: application/json" \
  -d '{"description":"Test persistence goal","isDifficult":false,"isCompleted":true}'

# Verify completion
curl http://localhost:5000/api/goals | jq '.[] | select(.id == "'$GOAL_ID'") | .isCompleted'
```

### **Test 5.2: Real-time Updates**
**Manual Test:**
1. Open Goals page in two browser tabs
2. Add/complete/delete a goal in one tab
3. Refresh the other tab
4. ✅ Changes should be reflected (database persistence)

---

## 🎨 **6. UI/UX Tests**

### **Test 6.1: Responsive Design**
**Manual Test:**
1. Resize browser window to different sizes
2. ✅ Goal rows should stack properly on mobile
3. ✅ Buttons should remain accessible
4. ✅ Text should not overflow

### **Test 6.2: Visual Feedback**
**Manual Test:**
1. Hover over buttons
2. ✅ Should show hover effects
3. ✅ Colors should be intuitive (green=complete, red=delete, blue=add)
4. ✅ Transitions should be smooth

### **Test 6.3: Alphabetical User Sorting**
**Manual Test:**
1. Check user order in Goals page
2. ✅ Should match alphabetical order: Afreed, Ajay, Akhil, Ancil, etc.
3. ✅ Should be consistent with other pages

---

## 🔄 **7. Workflow Tests**

### **Test 7.1: Complete User Goal Setup**
**Test Scenario:** Set up a new user with all 5 goals
1. Find a user with no goals
2. Add goal in each category (5 total)
3. Mark one as difficult
4. ✅ Should show "✅ All Categories"
5. ✅ Should NOT show "Need Difficult Goal" warning
6. ✅ All 5 rows should have goals

### **Test 7.2: Goal Completion Workflow**
**Test Scenario:** Complete goals and earn points
1. Complete a goal
2. ✅ Goal should turn green with completion date
3. Go to Workout tab → Click "Recalculate" in Admin
4. ✅ User's points should increase
5. Go to Dashboard → Check leaderboard
6. ✅ Points should be reflected in rankings

---

## 🚨 **8. Error Handling Tests**

### **Test 8.1: Invalid User Selection**
**Manual Test:**
1. Try to add goal without selecting user
2. ✅ "Add Goal" button should be disabled
3. ✅ Should not allow submission

### **Test 8.2: Empty Description**
**Manual Test:**
1. Try to add goal with empty description
2. ✅ "Add Goal" button should be disabled
3. ✅ Should not allow submission

### **Test 8.3: Database Connection Issues**
**Test Scenario:**
1. Stop backend server: `pkill -f "node server.js"`
2. Try to add/complete/delete a goal
3. ✅ Should show error message
4. Restart backend: `cd backend && npm start`
5. ✅ Should work normally again

---

## 📊 **9. Data Consistency Tests**

### **Test 9.1: Category Constraint**
**API Test:**
```bash
# Try to create duplicate category goal
USER_ID="user-1"
curl -X POST http://localhost:5000/api/goals \
  -H "Content-Type: application/json" \
  -d '{"userId":"'$USER_ID'","category":"cardio","description":"First cardio goal","isDifficult":false}'

curl -X POST http://localhost:5000/api/goals \
  -H "Content-Type: application/json" \
  -d '{"userId":"'$USER_ID'","category":"cardio","description":"Second cardio goal","isDifficult":false}'

# Second should fail with constraint error
```

### **Test 9.2: Points Calculation**
**Manual Test:**
1. Note user's current points in Dashboard
2. Complete a goal
3. Go to Admin → Click "Recalculate"
4. ✅ Points should increase by 1
5. Delete the completed goal
6. Click "Recalculate" again
7. ✅ Points should decrease by 1

---

## 🎉 **Expected Results**

### **✅ All Tests Should Pass:**
- Compact 5-row format displays correctly
- Add Goal buttons work contextually
- Goal completion updates immediately
- Database persistence works across sessions
- Visual indicators (difficult, completed) show properly
- Alphabetical sorting maintained
- Error handling works gracefully
- Points system integrates correctly

---

## 🚀 **Quick Verification Script**

```bash
#!/bin/bash
echo "🧪 Goals Page Quick Test"
echo "======================"

# Test 1: Backend connectivity
echo "1. Backend Health:"
curl -s http://localhost:5000/api/health | jq -r '.status'

# Test 2: Goals data
echo "2. Total Goals:"
curl -s http://localhost:5000/api/goals | jq 'length'

# Test 3: Users with goals
echo "3. Users with Goals:"
curl -s http://localhost:5000/api/goals | jq -r 'group_by(.userId) | .[] | "\(.[0].userName): \(length) goals"'

# Test 4: Difficult goals
echo "4. Difficult Goals:"
curl -s http://localhost:5000/api/goals | jq '[.[] | select(.isDifficult == true)] | length'

# Test 5: Completed goals
echo "5. Completed Goals:"
curl -s http://localhost:5000/api/goals | jq '[.[] | select(.isCompleted == true)] | length'

echo "=== Manual Tests ==="
echo "1. Visit Goals tab - check 5-row format"
echo "2. Click Add Goal in empty category"
echo "3. Complete a goal and verify green background"
echo "4. Delete a goal and verify it disappears"
echo "5. Check alphabetical user ordering"
```

Let me run this verification script to test the current state: