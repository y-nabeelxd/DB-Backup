const mysql = require('mysql');
const cron = require('node-cron');
const fetch = require('node-fetch');
const fs = require('fs');
const FormData = require('form-data');
const { exec } = require('child_process');
const inquirer = require('inquirer');
const path = require('path');

const dbConfig = {
  host: 'localhost',
  user: 'admindb',
  password: 'admin',
};

const telegramBotToken = 'BOT_TOKEN';
const chatId = 'ID';
const backupDir = path.join(__dirname, 'backupdb/db');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

function backupAllDatabases() {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

  const command = `mysqldump --all-databases -h ${dbConfig.host} -u ${dbConfig.user} -p${dbConfig.password} > ${backupFile}`;

  exec(command, (err) => {
    if (err) {
      console.error('Error during backup:', err);
      return;
    }
    console.log('Backup completed:', backupFile);
    sendBackupToTelegram(backupFile);
  });
}

async function sendBackupToTelegram(filePath) {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('document', fs.createReadStream(filePath));

  try {
    const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (result.ok) {
      console.log('Backup sent to Telegram successfully');
      deleteBackup(filePath);
    } else {
      console.error('Failed to send backup to Telegram:', result.description);
    }
  } catch (error) {
    console.error('Error sending backup to Telegram:', error);
  }
}

function deleteBackup(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Error deleting backup:', err);
    } else {
      console.log('Backup file deleted:', filePath);
    }
  });
}

async function askForBackup() {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'backup',
      message: 'Do you want to backup the database now?',
      default: true
    }
  ]);

  if (answers.backup) {
    backupAllDatabases();
  }
  askForBackup();
}

cron.schedule('0 0,12 * * *', () => {
  backupAllDatabases();
});

askForBackup();
