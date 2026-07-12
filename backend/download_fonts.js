const fs = require('fs');
const path = require('path');
const https = require('https');

const fontsDir = path.join(__dirname, 'assets', 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

const fonts = [
  {
    name: 'Roboto-Regular.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/static/Roboto-Regular.ttf'
  },
  {
    name: 'Roboto-Bold.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/static/Roboto-Bold.ttf'
  }
];

function downloadFont(font) {
  const dest = path.join(fontsDir, font.name);
  console.log(`Downloading ${font.name} from ${font.url}...`);
  const file = fs.createWriteStream(dest);
  https.get(font.url, (response) => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log(`Successfully downloaded ${font.name} to ${dest}`);
    });
  }).on('error', (err) => {
    fs.unlink(dest, () => {});
    console.error(`Error downloading ${font.name}:`, err.message);
  });
}

fonts.forEach(downloadFont);
