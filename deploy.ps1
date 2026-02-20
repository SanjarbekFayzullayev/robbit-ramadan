# Bot Server'ni serverga yuklash
# Foydalanish: .\deploy.ps1

$serverIP = "157.173.114.153"
$serverUser = "root"
$serverPath = "/root/robbit_new/robbit-ramadan/bot-server"

Write-Host "🚀 Bot-server fayllarini serverga yuklash..." -ForegroundColor Green

# Faqat kerakli fayllar
$files = @(
    "index.js",
    "package.json",
    "package-lock.json",
    ".env",
    "firebasekeys.json"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  📤 $file yuborilmoqda..." -ForegroundColor Yellow
        scp "$file" "${serverUser}@${serverIP}:${serverPath}/${file}"
    } else {
        Write-Host "  ⚠️ $file topilmadi, o'tkazildi" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📦 Serverda npm install va restart..." -ForegroundColor Green
ssh "${serverUser}@${serverIP}" "cd ${serverPath} && npm install && pm2 restart 1"

Write-Host ""
Write-Host "✅ Deploy tugadi!" -ForegroundColor Green
Write-Host "📊 Loglarni ko'rish: ssh ${serverUser}@${serverIP} 'pm2 logs 1 --lines 20'" -ForegroundColor Cyan
