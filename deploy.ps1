# Ramadan Bot — Serverga deploy
# Foydalanish: .\deploy.ps1
# Bu FAQAT ramadan-bot'ga tegadi, robbit-bot'ga ta'sir qilmaydi!

$server = "root@157.173.114.153"
$remotePath = "/root/bots/ramadan-bot"

Write-Host ""
Write-Host "===== Ramadan Bot Deploy =====" -ForegroundColor Cyan
Write-Host "Server: $server" -ForegroundColor Gray
Write-Host "Papka:  $remotePath" -ForegroundColor Gray
Write-Host ""

# 1. Fayllarni yuborish
Write-Host "[1/2] Fayllar yuborilmoqda... (parol kiriting)" -ForegroundColor Yellow
scp index.js package.json package-lock.json .env firebasekeys.json "${server}:${remotePath}/"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Papka yo'q bo'lishi mumkin. Yaratib qayta yuboraman..." -ForegroundColor Red
    ssh $server "mkdir -p $remotePath"
    scp index.js package.json package-lock.json .env firebasekeys.json "${server}:${remotePath}/"
}

# 2. Restart
Write-Host ""
Write-Host "[2/2] Serverda restart... (parol kiriting)" -ForegroundColor Yellow
ssh $server "cd $remotePath && npm install --production 2>&1 && pm2 restart ramadan-bot 2>/dev/null || pm2 start index.js --name ramadan-bot && echo '' && pm2 logs ramadan-bot --lines 15 --nostream"

Write-Host ""
Write-Host "===== Deploy tugadi! =====" -ForegroundColor Green
