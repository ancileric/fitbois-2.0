# Database Persistence on Railway - Complete Guide

## 🚨 **The Problem**

Every time you deploy to Railway, your SQLite database gets reset because:
- Railway uses **ephemeral containers** (temporary filesystems)
- Each deployment rebuilds the container from scratch
- Your `fitbois.db` file is recreated with sample data from `initDatabase.js`

## ✅ **Solutions**

### **Option 1: Railway Volume (Keep SQLite) - EASIEST**

Railway supports persistent volumes that survive deployments.

#### Steps:

1. **In Railway Dashboard:**
   - Go to your `fitbois-2.0` project
   - Click on your `web` service
   - Go to **"Variables"** tab
   - Scroll down to **"Volumes"**
   - Click **"New Volume"**
   - Set mount path: `/app/backend/database`
   - Click **"Add"**

2. **Update Environment Variable (if needed):**
   ```
   DATABASE_PATH=/app/backend/database/fitbois.db
   ```

3. **Redeploy your app**

Your database will now persist across deployments! ✨

**Pros:**
- ✅ No code changes needed
- ✅ Keep using SQLite
- ✅ Simple setup
- ✅ Data persists

**Cons:**
- ⚠️ Volumes are tied to one region
- ⚠️ SQLite doesn't scale well for multiple instances
- ⚠️ No automatic backups

---

### **Option 2: PostgreSQL Database (RECOMMENDED FOR PRODUCTION)**

Railway provides managed PostgreSQL databases that are persistent, scalable, and have automatic backups.

#### Steps:

1. **Add PostgreSQL Service in Railway:**
   - Click **"+ New"** → **"Database"** → **"PostgreSQL"**
   - Railway will automatically create a database and set environment variables

2. **Install PostgreSQL Dependencies:**
   ```bash
   cd backend
   npm install pg
   ```

3. **Update your code to use PostgreSQL**
   - See migration guide below

**Pros:**
- ✅ Persistent by default
- ✅ Automatic backups
- ✅ Better performance for production
- ✅ Supports multiple instances
- ✅ Railway manages it for you

**Cons:**
- ⚠️ Requires code changes
- ⚠️ Different SQL syntax

---

### **Option 3: Conditional Database Initialization**

Update your initialization script to NOT overwrite existing data.

**Update `backend/scripts/initDatabase.js`:**

This has been created for you in a new file: `backend/scripts/safeInitDatabase.js`

Then update your `nixpacks.toml`:
```toml
[phases.build]
cmds = ["npm run build", "cd backend && node scripts/safeInitDatabase.js"]
```

**Pros:**
- ✅ Simple fix
- ✅ Still works with Volume option

**Cons:**
- ⚠️ Still need a volume for persistence
- ⚠️ Database still ephemeral without volume

---

### **Option 4: Database Migrations System**

Use a proper migration system like `node-pg-migrate` or `knex`.

**Benefits:**
- Version-controlled schema changes
- Safe upgrades without data loss
- Professional approach

---

## 🔧 **Quick Fix: Safe Database Initialization**

I've created a new initialization script that won't overwrite existing data.

### **Update your deployment config:**

**In `nixpacks.toml`:**
```toml
[phases.build]
cmds = ["npm run build", "cd backend && node scripts/safeInitDatabase.js"]
```

**Or in `package.json` (backend):**
```json
{
  "scripts": {
    "start": "NODE_ENV=production node scripts/safeInitDatabase.js && node server.js"
  }
}
```

---

## 📊 **Backup Your Current Data**

Before making changes, backup your database:

```bash
# Local backup
cp backend/database/fitbois.db fitbois-backup-$(date +%Y-%m-%d).db

# Download from Railway (if you have Railway CLI)
railway run cat /app/backend/database/fitbois.db > railway-backup.db
```

---

## 🎯 **Recommended Approach**

For your FitBois 2.0 app, I recommend:

1. **Short term (NOW):**
   - Add Railway Volume to persist SQLite database
   - Use the safe initialization script
   
2. **Long term (LATER):**
   - Migrate to PostgreSQL for better production reliability
   - Implement proper database migrations

---

## 🔍 **Testing Your Setup**

After implementing any solution:

1. Deploy your app
2. Add some test data (create a user, mark some workouts)
3. Deploy again (make a small code change and push)
4. Check if your test data is still there ✅

---

## 📝 **Need Help?**

- Railway Volumes: https://docs.railway.app/reference/volumes
- PostgreSQL on Railway: https://docs.railway.app/databases/postgresql
- Railway CLI: https://docs.railway.app/develop/cli
