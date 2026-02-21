const path = require("path");
const fs = require("fs");
const { dbPath } = require("./database");

function ensureBackupDir() {
  const backupDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

function createBackup() {
  try {
    const backupDir = ensureBackupDir();
    const fileName = `pharmatrackpro_backup_${Date.now()}.db`;
    const backupPath = path.join(backupDir, fileName);
    fs.copyFileSync(dbPath, backupPath);
    return { fileName, path: backupPath, url: `/backups/${fileName}` };
  } catch (error) {
    console.error("backupService.createBackup error:", error);
    throw error;
  }
}

function restoreBackup(fileName) {
  try {
    if (!fileName) throw new Error("Backup filename is required");
    const backupDir = ensureBackupDir();
    const source = path.join(backupDir, fileName);
    if (!fs.existsSync(source)) throw new Error("Backup file not found");
    fs.copyFileSync(source, dbPath);
    return { restored: true, fileName };
  } catch (error) {
    console.error("backupService.restoreBackup error:", error);
    throw error;
  }
}

module.exports = {
  createBackup,
  restoreBackup,
};
