const fs = require('fs');
const path = require('path');

async function getRenderUrl() {
  let apiKey = process.env.RENDER_API_KEY;
  if (!apiKey) {
    // Попробуем прочитать из .env в корне
    try {
      const envPath = path.join(__dirname, '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/RENDER_API_KEY\s*=\s*(.*)/);
        if (match) {
          apiKey = match[1].trim();
        }
      }
    } catch (e) {}
  }

  if (!apiKey) {
    console.error('RENDER_API_KEY не найден в окружении или в .env файле');
    process.exit(1);
  }

  try {
    const res = await fetch('https://api.render.com/v1/services?limit=50', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });
    if (!res.ok) {
      throw new Error(`Render API returned status ${res.status}`);
    }
    const services = await res.json();
    
    // Ищем сервис, тип которого web_service, и имя которого содержит 'medsklad' или 'backend' или 'medstorage'
    // В ответе API Render каждый элемент массива имеет структуру { service: { id, name, type, serviceDetails: { url } } }
    const backendService = services.find(item => {
      const s = item.service;
      const name = (s.name || '').toLowerCase();
      return s.type === 'web_service' && 
        s.suspended === 'not_suspended' && // Берем только активные
        (name.includes('med') || 
         name.includes('backend') || 
         name.includes('storage'));
    });

    if (backendService && backendService.service.serviceDetails && backendService.service.serviceDetails.url) {
      console.log(backendService.service.serviceDetails.url);
      process.exit(0);
    } else {
      // Если не нашли специфичный, берем любой не suspended web_service
      const anyWebService = services.find(item => item.service.type === 'web_service' && item.service.suspended === 'not_suspended');
      if (anyWebService && anyWebService.service.serviceDetails && anyWebService.service.serviceDetails.url) {
        console.log(anyWebService.service.serviceDetails.url);
        process.exit(0);
      }
    }
    console.error('Не удалось найти веб-сервис бэкенда на Render');
    process.exit(1);
  } catch (err) {
    console.error('Ошибка при обращении к Render API:', err.message);
    process.exit(1);
  }
}

getRenderUrl();
