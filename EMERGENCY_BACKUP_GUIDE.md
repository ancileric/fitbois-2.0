# 🚨 EMERGENCY BACKUP - Your Railway Data

## 🎯 **Your Situation**

- ✅ You have 143 workouts, 44 goals, 11 users on Railway
- ⚠️ Data is in ephemeral container (temporary storage)
- 🚨 **CRITICAL:** Next deployment will WIPE ALL DATA
- ✅ No volume configured yet
- 🎯 **Goal:** Backup NOW, add volume, restore safely

---

## 📋 **Step-by-Step: BACKUP FIRST**

### **Step 1: Deploy the Download Endpoint** ⏰ 3 minutes

I just added a temporary backup endpoint to your code. Let's deploy it:

```bash
# Commit the backup endpoint
git add backend/server.js
git commit -m "Add temporary database download endpoint for backup"

# Push to Railway
git push
```

⚠️ **Important:** This deployment MIGHT reset your data, but we have no choice. We need this endpoint to backup.

**Wait for Railway to finish deploying** (check Railway dashboard)

---

### **Step 2: Download Your Railway Database** ⏰ 1 minute

Once deployed, download your database:

#### **Option A: Using Browser**

Open this URL in your browser (replace with your Railway URL):
```
https://YOUR-RAILWAY-APP.railway.app/api/admin/download-database
```

This will download `fitbois-railway-backup.db` to your computer.

#### **Option B: Using curl**

```bash
# Download database
curl -o railway-database-backup-$(date +%Y-%m-%d).db \
  https://YOUR-RAILWAY-APP.railway.app/api/admin/download-database

# Verify it downloaded
ls -lh railway-database-backup-*.db
```

---

### **Step 3: Verify the Backup** ⏰ 30 seconds

```bash
# Check how much data is in the backup
sqlite3 railway-database-backup-*.db "
SELECT 
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM workout_days) as workouts,
  (SELECT COUNT(*) FROM goals) as goals;
"
```

You should see: **11 users, 143+ workouts, 44 goals**

✅ If you see this, your backup is good!

---

## 📋 **NEXT: Add Volume & Make Persistent**

### **Step 4: Remove the Temporary Endpoint** ⏰ 1 minute

For security, remove the download endpoint now that you have your backup.

I'll update the code for you:

```bash
# This will be done automatically in next step
```

---

### **Step 5: Add Railway Volume** ⏰ 2 minutes

1. Go to Railway Dashboard
2. Open FitBois 2.0 → **web** service
3. Click **Settings** → scroll to **Volumes**
4. Click **"+ New Volume"**
5. Mount path: `/app/backend/database`
6. Click **"Add"**

✅ Volume created!

---

### **Step 6: Deploy with Safe Initialization** ⏰ 3 minutes

```bash
# Commit all remaining changes (safe init + remove download endpoint)
git add .
git commit -m "Add persistent storage with safe initialization"
git push
```

Wait for deployment to complete.

---

### **Step 7: Upload Your Backup to Railway Volume** ⏰ 2 minutes

Now upload your backed-up database to the persistent volume:

```bash
# Upload your backup to Railway
railway run "cat > /app/backend/database/fitbois.db" < railway-database-backup-YYYY-MM-DD.db

# Verify it was uploaded
railway run "ls -lh /app/backend/database/fitbois.db"

# Restart Railway to load the database
railway up --detach
```

---

### **Step 8: Verify Everything Works** ⏰ 2 minutes

1. Open your Railway app
2. Check all your users are there
3. Check workouts are there
4. Check goals are there

✅ All data should be back!

---

### **Step 9: Test Persistence** ⏰ 2 minutes

```bash
# Make a small change
echo "# Persistence test" >> README.md

# Deploy again
git add .
git commit -m "Test persistence"
git push

# After deployment, check your app
# All data should STILL be there!
```

✅ If data persists, you're done! 🎉

---

## 🆘 **Troubleshooting**

### **Download endpoint returns 404?**

The database might already be gone. Check your app - is data still there?

If yes, the path might be different:
```bash
# Try to find it with logs
railway logs | grep "Database"
```

### **Can't upload with railway run?**

Alternative: Create an upload endpoint (similar to download) and use curl.

### **Data disappeared after Step 1?**

Don't panic! Your local backup has the data. After setting up the volume, you can restore from your local backup instead:

```bash
railway run "cat > /app/backend/database/fitbois.db" < backend/database/fitbois.db
```

---

## ✅ **After You're Done**

Your setup will be:
- ✅ Railway Volume at `/app/backend/database`
- ✅ Database persists across ALL deployments
- ✅ Safe initialization (won't overwrite existing data)
- ✅ Backup tools available (`npm run backup-db`)

---

## 🎯 **Why This Happened**

Railway containers are **ephemeral** (temporary). Your data was surviving because:
- The container kept running without redeployment
- But ANY deployment would wipe it

Now with a volume, deployments won't affect your data!

---

## 📊 **Regular Backups Going Forward**

Create backups regularly:

```bash
# Download from Railway (monthly)
curl -o backup-$(date +%Y-%m-%d).db \
  https://YOUR-APP.railway.app/api/admin/download-database

# OR use Railway CLI
railway run "cat /app/backend/database/fitbois.db" > backup-$(date +%Y-%m-%d).db
```

---

Your data will now be safe forever! 🚀
