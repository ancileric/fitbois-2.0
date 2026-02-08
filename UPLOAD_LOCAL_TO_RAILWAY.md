# 📤 Upload Local Database to Railway

## 🎯 **Your Situation**

- ✅ You have data stored **locally** on your computer (76KB, 11 users, 46 workouts, 38 goals)
- ❌ Railway has **no database** or only sample data
- 🎯 **Goal:** Upload your local database to Railway with persistent storage

---

## 📋 **Step-by-Step Guide**

### **Step 1: Backup Your Local Database** ⏰ 30 seconds

Safety first!

```bash
# Create a backup of your local database
cp backend/database/fitbois.db fitbois-local-backup-$(date +%Y-%m-%d).db

# Verify backup
ls -lh fitbois-local-backup-*.db
```

✅ Your data is now backed up safely!

---

### **Step 2: Commit Code Changes** ⏰ 1 minute

```bash
git add .
git commit -m "Add persistent database support with safe initialization"
```

**DO NOT PUSH YET!**

---

### **Step 3: Add Railway Volume** ⏰ 2 minutes

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Open your **FitBois 2.0** project
3. Click on your **web** service
4. Go to **Settings** → Scroll to **Volumes**
5. Click **"+ New Volume"**
6. Configure:
   - **Mount Path:** `/app/backend/database`
7. Click **"Add"**

✅ Volume created!

---

### **Step 4: Deploy Code** ⏰ 3 minutes

```bash
# Now push your changes
git push

# Wait for Railway to build and deploy
# It will create a NEW empty database in the volume
```

Check Railway dashboard - wait for deployment to succeed.

---

### **Step 5: Upload Your Local Database to Railway** ⏰ 3 minutes

Now we need to upload your local database (with all your data) to Railway's volume.

#### **Method A: Using Railway CLI** (Recommended)

```bash
# Upload your local database to Railway
railway run "cat > /app/backend/database/fitbois.db" < backend/database/fitbois.db

# Verify it was uploaded successfully
railway run "ls -lh /app/backend/database/fitbois.db"

# Check the data made it
railway run "sqlite3 /app/backend/database/fitbois.db 'SELECT COUNT(*) FROM users;'"
```

If you see "11" (your user count), success! ✅

```bash
# Restart the Railway service to load the new database
railway restart
```

---

#### **Method B: Using Environment Variable (Alternative)**

If the CLI method doesn't work, you can create a temporary upload endpoint.

**1. Create temporary upload script:**

Create `backend/scripts/uploadDatabase.js`:

```javascript
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: '/tmp/' });

// TEMPORARY UPLOAD ENDPOINT - REMOVE AFTER USE!
app.post('/admin/upload-db', upload.single('database'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const tempPath = req.file.path;
  const targetPath = path.join(__dirname, '../database/fitbois.db');
  
  fs.copyFile(tempPath, targetPath, (err) => {
    if (err) {
      console.error('Error uploading database:', err);
      return res.status(500).json({ error: err.message });
    }
    
    fs.unlink(tempPath, () => {});
    res.json({ 
      message: 'Database uploaded! Restart server to apply.',
      path: targetPath 
    });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Upload server running on ${PORT}`);
});
```

**2. Install multer:**
```bash
cd backend
npm install multer
```

**3. Add temporary route to `backend/server.js`:**

```javascript
// TEMPORARY - Add after other requires
const multer = require('multer');
const upload = multer({ dest: '/tmp/' });

// TEMPORARY - Add before the catch-all route
app.post('/api/admin/upload-db', upload.single('database'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const tempPath = req.file.path;
  const targetPath = path.join(__dirname, 'database', 'fitbois.db');
  
  fs.copyFile(tempPath, targetPath, (err) => {
    if (err) {
      console.error('Error uploading database:', err);
      return res.status(500).json({ error: err.message });
    }
    
    fs.unlink(tempPath, () => {});
    res.json({ message: 'Database uploaded! Please restart the service.' });
  });
});
```

**4. Deploy the changes:**
```bash
git add .
git commit -m "Add temporary database upload endpoint"
git push
```

**5. Upload your database:**
```bash
# Get your Railway URL from the dashboard
# Replace YOUR-RAILWAY-URL with your actual URL

curl -F "database=@backend/database/fitbois.db" \
  https://YOUR-RAILWAY-URL.railway.app/api/admin/upload-db
```

**6. Remove the temporary endpoint:**
- Delete the upload code from `server.js`
- Commit and push again
- Railway will restart automatically

---

### **Step 6: Verify Everything Works** ⏰ 2 minutes

1. **Open your Railway app URL** in a browser
2. **Check your data:**
   - Do you see your 11 users?
   - Are your 46 workouts there?
   - Are your 38 goals visible?

✅ If yes, success! Your local data is now on Railway with persistent storage!

---

### **Step 7: Test Persistence** ⏰ 2 minutes

Let's make sure data persists across deployments:

```bash
# Make a small change (add a comment somewhere)
echo "// test" >> backend/server.js

# Commit and deploy
git add .
git commit -m "Test persistence"
git push

# Wait for deployment
# Check your app - all data should still be there!
```

✅ If data persists, you're all set! 🎉

---

## 🔧 **Troubleshooting**

### **Railway CLI upload fails?**

Try:
```bash
# Check if you're still linked
railway status

# Re-link if needed
railway link

# Try upload again
railway run "cat > /app/backend/database/fitbois.db" < backend/database/fitbois.db
```

### **Can't install multer?**

```bash
cd backend
npm install multer --save
cd ..
git add backend/package*.json
git commit -m "Add multer for upload"
git push
```

### **Upload endpoint returns 404?**

- Make sure you deployed after adding the endpoint
- Check Railway logs: `railway logs`
- Verify the route was added correctly

### **Data still showing as empty?**

```bash
# Restart Railway service
railway restart

# Or force redeploy
railway up --detach
```

---

## 📊 **What Happens Next**

After this setup:
- ✅ Your local data is now on Railway
- ✅ Data persists across all future deployments
- ✅ You can continue working locally and deploying changes
- ✅ Railway volume keeps your database safe

---

## 🎯 **Future Workflow**

### **Working Locally:**
```bash
# Make changes to your code
npm run dev  # (in separate terminals for frontend/backend)

# Test locally
# Data saves to: backend/database/fitbois.db
```

### **Deploying to Railway:**
```bash
git add .
git commit -m "Your changes"
git push

# Railway deploys automatically
# Data in volume persists ✅
```

### **Regular Backups:**
```bash
# Backup local database
cd backend && npm run backup-db

# Download Railway database (periodic backup)
railway run "cat /app/backend/database/fitbois.db" > railway-backup-$(date +%Y-%m-%d).db
```

---

## ✅ **Success Checklist**

- [ ] Local database backed up
- [ ] Code changes committed
- [ ] Railway volume created at `/app/backend/database`
- [ ] Code deployed to Railway
- [ ] Local database uploaded to Railway volume
- [ ] Railway service restarted
- [ ] All data visible in Railway app (11 users, 46 workouts, 38 goals)
- [ ] Data persists after redeployment
- [ ] Can backup both local and Railway databases

---

Your local data is now safely deployed to Railway with persistent storage! 🚀
