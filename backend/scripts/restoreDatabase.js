#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Setup readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const backupDir = path.join(__dirname, '../../backups');
const dbPath = path.join(__dirname, '../database/fitbois.db');

// Check if backups directory exists
if (!fs.existsSync(backupDir)) {
  console.error('❌ No backups directory found.');
  console.error('Run "npm run backup-db" first to create a backup.');
  process.exit(1);
}

// List available backups
const backups = fs.readdirSync(backupDir)
  .filter(file => file.endsWith('.db'))
  .sort()
  .reverse();

if (backups.length === 0) {
  console.error('❌ No backup files found in:', backupDir);
  console.error('Run "npm run backup-db" first to create a backup.');
  process.exit(1);
}

console.log('📚 Available backups:\n');
backups.forEach((backup, index) => {
  const backupPath = path.join(backupDir, backup);
  const stats = fs.statSync(backupPath);
  const fileSizeKB = (stats.size / 1024).toFixed(2);
  const modifiedDate = stats.mtime.toISOString().split('T')[0];
  console.log(`  ${index + 1}. ${backup}`);
  console.log(`     Size: ${fileSizeKB} KB | Modified: ${modifiedDate}\n`);
});

// Get backup selection from user
rl.question('Enter backup number to restore (or "q" to quit): ', (answer) => {
  if (answer.toLowerCase() === 'q') {
    console.log('Cancelled.');
    rl.close();
    process.exit(0);
  }
  
  const backupIndex = parseInt(answer) - 1;
  
  if (isNaN(backupIndex) || backupIndex < 0 || backupIndex >= backups.length) {
    console.error('❌ Invalid backup number.');
    rl.close();
    process.exit(1);
  }
  
  const selectedBackup = backups[backupIndex];
  const backupPath = path.join(backupDir, selectedBackup);
  
  // Confirm restoration
  console.log(`\n⚠️  WARNING: This will replace your current database with ${selectedBackup}`);
  
  rl.question('Are you sure? Type "yes" to confirm: ', (confirmation) => {
    if (confirmation.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      rl.close();
      process.exit(0);
    }
    
    try {
      // Create a backup of current database before restoring
      if (fs.existsSync(dbPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const currentBackupPath = path.join(backupDir, `fitbois-before-restore-${timestamp}.db`);
        fs.copyFileSync(dbPath, currentBackupPath);
        console.log('✅ Created safety backup of current database');
      }
      
      // Restore the selected backup
      fs.copyFileSync(backupPath, dbPath);
      
      console.log('\n✅ Database restored successfully!');
      console.log(`📁 Restored from: ${selectedBackup}`);
      console.log(`📍 Database location: ${dbPath}`);
      console.log('\nRestart your server to use the restored database.');
      
    } catch (error) {
      console.error('❌ Error restoring database:', error.message);
      rl.close();
      process.exit(1);
    }
    
    rl.close();
  });
});
