@echo off
chcp 65001 >nul
echo ===============================================================
echo 🚀 СКРИПТ АВТОМАТИЧЕСКОЙ СБОРКИ APK ДЛЯ MEDSKLAD (RENDER)
echo ===============================================================
echo 🔍 Определение URL бэкенда...
set BACKEND_URL=https://backend-steel-sigma.vercel.app
echo По умолчанию используется бэкенд на Vercel: %BACKEND_URL%
set /p USER_URL="Нажмите Enter для подтверждения или введите другую ссылку: "

if not "%USER_URL%"=="" set BACKEND_URL=%USER_URL%

echo.
echo 📝 Создание файла конфигурации .env...
echo EXPO_PUBLIC_API_URL=%BACKEND_URL%/api> mobile/.env
echo Файл mobile/.env успешно обновлен.

echo.
echo 🛠 Запуск сборки APK в облаке Expo...
echo Это займет около 10 минут. Вы можете свернуть это окно и идти спать!
echo Ссылка на скачивание появится в консоли ниже.
echo.

cd mobile
set EXPO_TOKEN=uFrtxk7oiik0rUj6R7j-NrjwgvRLkgzcHqkP_d9S

if not exist node_modules (
  echo 📦 Установка локальных зависимостей (node_modules)...
  call npm install
)

call npx eas-cli build --profile preview -p android --non-interactive
if %errorlevel% neq 0 (
  echo.
  echo ⚠️  Облачная сборка не удалась ^(возможно, исчерпан бесплатный лимит^).
  echo 🛠 Попытка запустить сборку ЛОКАЛЬНО с флагом --local...
  echo.
  call npx eas-cli build --local --profile preview -p android --non-interactive
)

echo.
echo ===============================================================
echo ✅ Сборка завершена (или поставлена в очередь)!
echo Ссылку можно отправить техническому директору.
echo ===============================================================
pause
