#!/bin/bash
echo "==============================================================="
echo "🚀 СКРИПТ АВТОМАТИЧЕСКОЙ СБОРКИ APK ДЛЯ MEDSKLAD (RENDER)"
echo "==============================================================="
echo ""
echo "Пожалуйста, введите ссылку на ваш бекенд с Render."
echo "Пример: https://medsklad-backend-a1b2.onrender.com"
echo ""
read -p "Ссылка на бекенд: " RENDER_URL

if [ -z "$RENDER_URL" ]; then
  echo "Ошибка: Ссылка на бекенд не может быть пустой!"
  exit 1
fi

echo ""
echo "📝 Создание файла конфигурации .env..."
echo "EXPO_PUBLIC_API_URL=${RENDER_URL}/api" > mobile/.env
echo "Файл mobile/.env успешно обновлен."

echo ""
echo "🛠 Запуск сборки APK в облаке Expo..."
echo "Это займет около 10 минут. Ссылка на скачивание появится в консоли ниже."
echo ""

cd mobile
export EXPO_TOKEN=Uomw4MQI4lA4IXnNxAyFNHltXZkOEQkTSv6KojUW

# Используем профиль preview, так как в eas.json именно он настроен на сборку APK, 
# в то время как production собирает AAB (App Bundle для Google Play).
npx eas-cli build --profile preview -p android --non-interactive
