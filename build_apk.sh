#!/bin/bash
echo "==============================================================="
echo "🚀 СКРИПТ АВТОМАТИЧЕСКОЙ СБОРКИ APK ДЛЯ MEDSKLAD (RENDER)"
echo "==============================================================="
echo "🔍 Попытка автоматического получения URL бэкенда с Render API..."
RENDER_URL=$(node get_render_url.js 2>/dev/null)

if [ -z "$RENDER_URL" ]; then
  echo "⚠️  Не удалось определить URL бэкенда автоматически."
  echo "Пожалуйста, введите ссылку на ваш бекенд с Render вручную."
  echo "Пример: https://medsklad-backend-a1b2.onrender.com"
  echo ""
  read -p "Ссылка на бекенд: " RENDER_URL
else
  echo "✅ Успешно определен URL бэкенда: $RENDER_URL"
fi

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
