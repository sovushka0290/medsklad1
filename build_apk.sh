#!/bin/bash
echo "==============================================================="
echo "🚀 СКРИПТ АВТОМАТИЧЕСКОЙ СБОРКИ APK ДЛЯ MEDSKLAD (RENDER)"
echo "==============================================================="
echo "🔍 Определение URL бэкенда..."
DEFAULT_URL="https://backend-steel-sigma.vercel.app"
echo "По умолчанию используется бэкенд на Vercel: $DEFAULT_URL"
read -p "Нажмите Enter для подтверждения или введите другую ссылку: " USER_URL

if [ -z "$USER_URL" ]; then
  BACKEND_URL=$DEFAULT_URL
else
  BACKEND_URL=$USER_URL
fi


echo ""
echo "📝 Создание файла конфигурации .env..."
echo "EXPO_PUBLIC_API_URL=${BACKEND_URL}/api" > mobile/.env
echo "Файл mobile/.env успешно обновлен."

echo ""
echo "🛠 Запуск сборки APK в облаке Expo..."
echo "Это займет около 10 минут. Ссылка на скачивание появится в консоли ниже."
echo ""

cd mobile
export EXPO_TOKEN=uFrtxk7oiik0rUj6R7j-NrjwgvRLkgzcHqkP_d9S
export ANDROID_HOME=/home/megumin/android-sdk-local
export JAVA_HOME=/home/megumin/jdk-17
export PATH=$JAVA_HOME/bin:$PATH

if [ ! -d "node_modules" ]; then
  echo "📦 Установка локальных зависимостей (node_modules)..."
  npm install
fi

# Используем профиль preview, так как в eas.json именно он настроен на сборку APK.
# Если лимиты облака Expo исчерпаны, автоматически переключаемся на локальную сборку (--local).
if npx eas-cli build --profile preview -p android --non-interactive; then
  echo "✅ Сборка успешно завершена в облаке!"
else
  echo ""
  echo "⚠️  Облачная сборка не удалась (возможно, исчерпан бесплатный лимит)."
  echo "🛠 Попытка запустить сборку ЛОКАЛЬНО с флагом --local..."
  echo ""
  npx eas-cli build --local --profile preview -p android --non-interactive
fi
