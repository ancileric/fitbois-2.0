# 🚨 Railway Data Migration - PRESERVE EXISTING DATA

## ⚠️ **IMPORTANT: READ THIS FIRST**

If you already have data on Railway that you want to keep, follow these steps carefully!

## 🔍 **Quick Check: Do You Actually Have Data on Railway?**

Before following the migration steps, let's verify you have data worth backing up:

```bash
# Find any database files on Railway
railway run "find /app -name '*.db' 2>/dev/null"
```

**Results:**

- **✅ Found `fitbois.db`?** → Continue with migration below
- **❌ No files found?** → You probably don't have data yet!
  - Your app might be using sample/mock data
  - Or the database hasn't been created on Railway yet
  - **Solution:** Skip migration, just follow `RAILWAY_SETUP_STEPS.md` for fresh setup

---

## 📋 **Step-by-Step Migration** (Preserves Existing Data)

### **Step 1: Check if You Have Data to Backup** ⏰ 2 minutes

First, let's see if there's actually a database on Railway to backup:

```bash
# Make sure you're logged in
railway login

# Link to your project (if not already)
railway link

# Check where the database actually is
railway run "find /app -name 'fitbois.db' -o -name '*.db' 2>/dev/null"

# Or explore the backend directory
railway run "ls -la /app/backend/" 2>/dev/null

# Check if database directory exists
railway run "ls -la /app/backend/database/" 2>/dev/null
```

#### **Scenario A: Database Found** ✅

If you see the database file, download it:

```bash
# Use the actual path from the find command above
railway run cat /app/backend/database/fitbois.db > railway-backup-$(date +%Y-%m-%d).db

# Verify the backup file exists and has data
ls -lh railway-backup-*.db
```

#### **Scenario B: Database NOT Found** 🤷

If the database doesn't exist, you have two options:

**Option 1: You don't have data to backup (easiest)**
- Skip to Step 2 and do a fresh deployment
- Your current Railway app might be using mock data or hasn't been initialized yet

**Option 2: Check if data exists elsewhere**

```bash
# Get a shell in Railway to explore
railway run bash

# Inside the shell, explore:
pwd
ls -la
find . -name "*.db"
ls -la backend/
ls -la backend/database/
exit
```

#### Option B: Using Railway Shell (Alternative)

```bash
# Open Railway shell
railway run bash

# Inside the shell:
cat /app/backend/database/fitbois.db

# Copy the output and save to a local file
# (This is less reliable - use Option A if possible)
```

#### Option C: Manual Export via API Script

Create a quick export script:

```bash
# Create a temporary export script
cat > export-railway-db.sh << 'EOF'
#!/bin/bash
echo "Fetching database from Railway..."
railway run "cat /app/backend/database/fitbois.db" > railway-backup-$(date +%Y-%m-%d).db
echo "✅ Backup saved: railway-backup-$(date +%Y-%m-%d).db"
ls -lh railway-backup-*.db
EOF

chmod +x export-railway-db.sh
./export-railway-db.sh
```

---

### **Step 2: Commit Code Changes** ⏰ 1 minute

```bash
git add .
git commit -m "Add persistent database support (not deployed yet)"
```

**DO NOT PUSH YET!**

---

### **Step 3: Add Railway Volume** ⏰ 2 minutes

1. Go to Railway Dashboard
2. Open your FitBois 2.0 project → **web** service
3. Go to **Settings** → **Volumes**
4. Click **"+ New Volume"**
5. Mount path: `/app/backend/database`
6. Click **"Add"**

✅ Volume is now ready (but empty)

---

### **Step 4: Deploy with Volume** ⏰ 3 minutes

```bash
# Now push your changes
git push

# Wait for deployment to complete
# Railway will create a NEW database (with sample data) in the volume
```

---

### **Step 5: Restore Your Data** ⏰ 3 minutes

Now we need to upload your backup to the volume.

#### Option A: Using Railway CLI

```bash
# Make sure you have your backup file
ls railway-backup-*.db

# Upload the backup to Railway's volume
railway run "cat > /app/backend/database/fitbois.db" < railway-backup-YYYY-MM-DD.db

# Verify it was uploaded
railway run "ls -lh /app/backend/database/"

# Restart the service to load the restored database
railway up --detach
```

#### Option B: Using a Temporary Restore Endpoint

If Railway CLI doesn't work well, you can create a temporary admin endpoint to upload the database:

**Add to `backend/server.js` temporarily:**

```javascript
// TEMPORARY RESTORE ENDPOINT - REMOVE AFTER USE!
const multer = require('multer');
const upload = multer({ dest: '/tmp/' });

app.post('/api/admin/restore-db', upload.single('database'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const tempPath = req.file.path;
  const targetPath = path.join(__dirname, 'database', 'fitbois.db');
  
  fs.copyFile(tempPath, targetPath, (err) => {
    if (err) {
      console.error('Error restoring database:', err);
      return res.status(500).json({ error: err.message });
    }
    
    fs.unlink(tempPath, () => {});
    res.json({ message: 'Database restored! Restart server to apply.' });
  });
});
```

Then use this curl command:

```bash
curl -F "database=@railway-backup-YYYY-MM-DD.db" \
  https://your-railway-url.railway.app/api/admin/restore-db
```

**IMPORTANT:** Remove this endpoint after restoring!

---

### **Step 6: Verify Data** ⏰ 1 minute

1. Open your Railway app
2. Check that all your users are there
3. Check that workout data is preserved
4. Check that goals are intact

✅ **Success!** Your data is now in the persistent volume.

---

## 🔄 **Quick Summary**

```bash
# 1. Backup from Railway
railway run cat /app/backend/database/fitbois.db > railway-backup-$(date +%Y-%m-%d).db

# 2. Commit changes (don't push yet)
git add .
git commit -m "Add persistent database support"

# 3. Add volume in Railway Dashboard
# Settings → Volumes → Mount: /app/backend/database

# 4. Deploy
git push

# 5. Restore backup
railway run "cat > /app/backend/database/fitbois.db" < railway-backup-$(date +%Y-%m-%d).db

# 6. Restart
railway up --detach

# 7. Verify your app has all the data!
```

---

## 🆘 **Troubleshooting**

### **Railway CLI not working?**

Install it:
```bash
npm install -g @railway/cli
railway login
railway link
```

### **Can't download the database?**

Try this alternative:
```bash
# Get a shell in Railway
railway run bash

# Check if database exists
ls -lh /app/backend/database/

# Try to read it
sqlite3 /app/backend/database/fitbois.db ".dump" > dump.sql
cat dump.sql
```

Then copy the SQL output and recreate locally.

### **Upload not working?**

You can also:
1. Use the temporary restore endpoint method above
2. Or manually recreate important data after migration
3. Or use Railway's PostgreSQL instead (automatic backups)

---

## 🎯 **Alternative: Skip Migration (Fresh Start)**

If your current Railway data isn't critical:

1. Add the volume
2. Push the code
3. Let it create a fresh database
4. Manually re-enter important data

This is simpler but loses existing data.

---

## 📝 **After Migration**

Once your data is safely in the volume:

- ✅ Future deployments will preserve data
- ✅ Run backups regularly: `railway run "cat /app/backend/database/fitbois.db" > backup.db`
- ✅ Consider setting up automated backup schedule
- ✅ Test by redeploying - data should persist!

---

## ✅ **Success Checklist**

- [ ] Backed up current Railway database
- [ ] Committed code changes
- [ ] Created Railway volume at `/app/backend/database`
- [ ] Deployed updated code
- [ ] Restored backup to volume
- [ ] Restarted Railway service
- [ ] Verified all data is present
- [ ] Tested that new data persists across deployments

---

Your data is now safe and will survive all future deployments! 🎉
