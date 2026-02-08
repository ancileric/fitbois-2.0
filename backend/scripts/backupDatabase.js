#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Source and destination paths
const dbPath = path.join(__dirname, '../database/fitbois.db');
const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
const backupDir = path.join(__dirname, '../../backups');
const backupPath = path.join(backupDir, `fitbois-backup-${timestamp}.db`);

// Create backups directory if it doesn't exist
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
  console.log('📁 Created backups directory');
}

// Check if source database exists
if (!fs.existsSync(dbPath)) {
  console.error('❌ Database file not found at:', dbPath);
  console.error('Make sure the database exists before backing up.');
  process.exit(1);
}

// Copy database file
try {
  fs.copyFileSync(dbPath, backupPath);
  
  // Get file size for confirmation
  const stats = fs.statSync(backupPath);
  const fileSizeKB = (stats.size / 1024).toFixed(2);
  
  console.log('✅ Database backup created successfully!');
  console.log(`📁 Backup location: ${backupPath}`);
  console.log(`📊 Backup size: ${fileSizeKB} KB`);
  console.log(`📅 Backup date: ${timestamp}`);
  
  // List all backups
  const backups = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.db'))
    .sort()
    .reverse();
  
  if (backups.length > 1) {
    console.log(`\n📚 You have ${backups.length} backups:`);
    backups.forEach((backup, index) => {
      const backupFullPath = path.join(backupDir, backup);
      const backupStats = fs.statSync(backupFullPath);
      const backupSizeKB = (backupStats.size / 1024).toFixed(2);
      console.log(`  ${index + 1}. ${backup} (${backupSizeKB} KB)`);
    });
  }
  
  // Cleanup old backups (keep last 10)
  if (backups.length > 10) {
    console.log('\n🧹 Cleaning up old backups (keeping 10 most recent)...');
    const oldBackups = backups.slice(10);
    oldBackups.forEach(backup => {
      const oldBackupPath = path.join(backupDir, backup);
      fs.unlinkSync(oldBackupPath);
      console.log(`  Deleted: ${backup}`);
    });
  }
  
} catch (error) {
  console.error('❌ Error creating backup:', error.message);
  process.exit(1);
}
