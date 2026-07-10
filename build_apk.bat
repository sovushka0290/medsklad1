@echo off
chcp 65001 >nul
echo ===============================================================
echo 🚀 СКРИПТ АВТОМАТИЧЕСКОЙ СБОРКИ APK ДЛЯ MEDSKLAD (RENDER)
echo ===============================================================
echo 🔍 Попытка автоматического получения URL бэкенда с Render API...
for /f "delims=" %%i in ('node get_render_url.js') do set RENDER_URL=%%i

if "%RENDER_URL%"=="" (
  echo ⚠️  Не удалось определить URL бэкенда автоматически.
  echo Пожалуйста, введите ссылку на ваш бекенд с Render вручную.
  echo Пример: https://medsklad-backend-a1b2.onrender.com
  echo.
  set /p RENDER_URL="Ссылка на бекенд: "
) else (
  echo ✅ Успешно определен URL бэкенда: %RENDER_URL%
)

if "%RENDER_URL%"=="" (
  echo Ошибка: Ссылка на бекенд не может быть пустой!
  pause
  exit /b 1
)

echo.
echo 📝 Создание файла конфигурации .env...
echo EXPO_PUBLIC_API_URL=%RENDER_URL%/api> mobile/.env
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
