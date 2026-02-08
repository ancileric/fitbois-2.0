# 🚀 START HERE - Database Persistence Setup

## 🚨 **URGENT: Data at Risk?**

**If you have valuable data on Railway right now and NO volume configured:**

👉 **Follow this FIRST:** `EMERGENCY_BACKUP_GUIDE.md`

Your data is in temporary storage and will be wiped on next deployment!

---

## 🎯 Problem You're Solving

Your database keeps resetting every time you deploy to Railway. Let's fix that!

---

## ❓ **Quick Question: Where Is Your Data?**

### **I HAVE LOCAL DATA I WANT TO UPLOAD TO RAILWAY** 💾

Your data is on your computer, not on Railway yet.

👉 **Follow this guide:** `UPLOAD_LOCAL_TO_RAILWAY.md`

This will:
1. Backup your local database
2. Set up Railway with persistent storage
3. Upload your local data to Railway
4. Ensure data persists across deployments

**Time:** ~10 minutes

---

### **I HAVE EXISTING DATA ON RAILWAY** ✋

Your data is already on Railway and you want to keep it.

👉 **Follow this guide:** `RAILWAY_DATA_MIGRATION.md`

This will:
1. Backup your current Railway database
2. Add a persistent volume
3. Restore your data to the volume
4. Ensure no data is lost

**Time:** ~10 minutes

---

### **I DON'T HAVE DATA (or don't care about losing it)** 🆕

Starting fresh with a new database.

👉 **Follow this guide:** `RAILWAY_SETUP_STEPS.md`

This will:
1. Add a persistent volume to Railway
2. Deploy your updated code
3. Start fresh with a persistent database

**Time:** ~5 minutes

---

### **NOT SURE? Run This Command:**

```bash
# Check if you have local data
sqlite3 backend/database/fitbois.db "SELECT COUNT(*) FROM users;" 2>/dev/null && echo "You have local data!"

# Check if you have Railway data
railway run "ls -la /app/backend/database/fitbois.db" 2>/dev/null && echo "You have Railway data!"
```

---

## 📚 **Other Helpful Documents**

- **`DATABASE_SOLUTION_SUMMARY.md`** - Overview of all changes made
- **`DEPLOYMENT_DATABASE_GUIDE.md`** - Comprehensive guide with alternatives
- **This README** - You are here!

---

## 🔧 **New Commands Available**

After setup, you can use these locally:

```bash
cd backend

# Create a backup
npm run backup-db

# Restore from a backup
npm run restore-db

# Safe initialize (won't overwrite existing data)
npm run safe-init-db
```

---

## ✅ **After You're Done**

Test that everything works:

1. Add some test data (create a user, mark workouts)
2. Make a small code change
3. Deploy again: `git add . && git commit -m "test" && git push`
4. Check that your test data is still there ✅

If data persists, you're all set! 🎉

---

## 🆘 **Need Help?**

- Check the troubleshooting section in `RAILWAY_SETUP_STEPS.md`
- Review `DEPLOYMENT_DATABASE_GUIDE.md` for alternative solutions
- Railway Docs: https://docs.railway.app/reference/volumes
