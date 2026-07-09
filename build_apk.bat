@echo off
chcp 65001 >nul
echo ===============================================================
echo 🚀 СКРИПТ АВТОМАТИЧЕСКОЙ СБОРКИ APK ДЛЯ MEDSKLAD (RENDER)
echo ===============================================================
echo.
echo Пожалуйста, вставьте ссылку на ваш бекенд с Render.
echo Пример: https://medsklad-backend-a1b2.onrender.com
echo.
set /p RENDER_URL="Ссылка на бекенд: "

echo.
echo Обновление настроек мобильного приложения...
node -e "const fs=require('fs'); let f=fs.readFileSync('mobile/src/api/api.ts', 'utf8'); f=f.replace(/const baseURL = '.*';/, `const baseURL = '${process.env.RENDER_URL}/api';`); fs.writeFileSync('mobile/src/api/api.ts', f);"

echo.
echo 🛠 Запуск сборки APK в облаке Expo...
echo Это займет около 10 минут. Вы можете свернуть это окно и идти спать!
echo Ссылка на скачивание появится в консоли ниже.
echo.

cd mobile
set EXPO_TOKEN=uFrtxk7oiik0rUj6R7j-NrjwgvRLkgzcHqkP_d9S
call npx eas-cli build --profile preview -p android

echo.
echo ===============================================================
echo ✅ Сборка завершена (или поставлена в очередь)!
echo Ссылку можно отправить техническому директору.
echo ===============================================================
pause
