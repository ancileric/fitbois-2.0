# 🚂 Railway Deployment - Quick Setup Guide

## 🚨 **IMPORTANT: Do You Have Existing Data on Railway?**

**⚠️ If you already have data on Railway that you want to keep:**
- **STOP!** Don't follow this guide yet
- **Read `RAILWAY_DATA_MIGRATION.md` first** - it has steps to backup your existing data
- Following this guide without backing up will **create a fresh database and lose your current data**

**✅ If this is a new deployment or you don't care about existing data:**
- Continue with this guide!

---

## 🎯 **The Goal**

Make your database data persist across deployments so it doesn't reset every time you push code.

---

## 📋 **Step-by-Step Setup**

### **1️⃣ Add Railway Volume** *(5 minutes)*

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Open your **FitBois 2.0** project
3. Click on your **web** service
4. Navigate to **"Settings"** tab (or **"Variables"** → scroll down)
5. Find the **"Volumes"** section
6. Click **"+ New Volume"**
7. Configure:
   - **Mount Path:** `/app/backend/database`
   - **Size:** Default is fine (starts at 1GB)
8. Click **"Add"** or **"Create Volume"**

✅ **Done!** Your volume is now mounted.

---

### **2️⃣ Verify Your Code Changes**

The code updates have been made automatically. Here's what changed:

#### ✅ Updated Files:
- `backend/server.js` - Added directory check for database
- `backend/package.json` - Updated start script to use safe initialization
- New file: `backend/scripts/safeInitDatabase.js` - Won't overwrite existing data

#### 🔍 Verify Start Script:
Open `backend/package.json` and confirm:
```json
"start": "NODE_ENV=production node scripts/safeInitDatabase.js && node server.js"
```

---

### **3️⃣ Deploy & Test**

1. **Commit and push your changes:**
   ```bash
   git add .
   git commit -m "Add persistent database with Railway volume"
   git push
   ```

2. **Railway will automatically deploy**
   - Watch the build logs in Railway dashboard
   - Look for: `✅ Database initialization complete!`
   - Should say: `EXISTING DATABASE - will preserve data` after first deploy

3. **Test data persistence:**
   - Open your deployed app
   - Create a test user or mark some workouts
   - Make a small code change and push again
   - Verify your test data is still there! ✨

---

## 🔧 **Local Database Management**

### **Backup Database:**
```bash
cd backend
npm run backup-db
```
Creates: `backups/fitbois-backup-YYYY-MM-DD.db`

### **Restore Database:**
```bash
cd backend
npm run restore-db
```
Shows list of available backups to restore from.

### **Manual Backup:**
```bash
cp backend/database/fitbois.db fitbois-backup-$(date +%Y-%m-%d).db
```

---

## 🐛 **Troubleshooting**

### **Volume not working?**
1. Check Railway dashboard → Service → Settings → Volumes
2. Verify mount path is: `/app/backend/database`
3. Check deployment logs for errors

### **Database still resetting?**
1. Verify the start script uses `safeInitDatabase.js`
2. Check logs - should say "EXISTING DATABASE - will preserve data"
3. Volume might not be properly mounted - recreate it

### **Need to reset database on Railway?**
1. Railway dashboard → Service → Settings → Volumes
2. Click volume → Delete
3. Create new volume with same mount path
4. Redeploy

### **Check logs:**
```bash
railway logs
```

---

## 📊 **How It Works**

### **Before (with problem):**
```
Deploy → Container created → Database initialized → Sample data inserted
Deploy → Container created → Database initialized → Sample data inserted (RESET!)
```

### **After (with volume):**
```
Deploy → Container created → Check database exists → Keep existing data ✅
Deploy → Container created → Check database exists → Keep existing data ✅
```

The volume is like an external hard drive that stays connected across deployments!

---

## 🎓 **Key Commands**

```bash
# Backup database
cd backend && npm run backup-db

# Restore database
cd backend && npm run restore-db

# Initialize new database (dev only)
cd backend && npm run init-db

# Safe initialize (checks for existing data)
cd backend && npm run safe-init-db

# View Railway logs
railway logs

# Deploy to Railway
git push
```

---

## 📚 **Next Steps (Optional)**

For more robust production setup:
1. **Migrate to PostgreSQL** - Better for production
2. **Set up automated backups** - Schedule regular backups
3. **Add database migrations** - Version control for schema changes

See: `DEPLOYMENT_DATABASE_GUIDE.md` for detailed guides.

---

## ✅ **Success Checklist**

- [ ] Railway Volume created at `/app/backend/database`
- [ ] `backend/package.json` start script updated
- [ ] Code committed and pushed
- [ ] App deployed successfully
- [ ] Test data persists across deployments
- [ ] Can backup/restore locally

---

## 🆘 **Need Help?**

- Railway Docs: https://docs.railway.app/reference/volumes
- Railway Discord: https://discord.gg/railway
- Check `DEPLOYMENT_DATABASE_GUIDE.md` for more solutions
