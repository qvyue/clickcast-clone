const fs = require('fs');
const https = require('https');

const url = 'https://www.bensound.com/bensound-music/bensound-ukulele.mp3';
const outputPath = 'C:/Users/cheng/.qclaw/workspace/clickcast-clone/public/bgm.mp3';

console.log('Downloading BGM from:', url);

// 首先检查文件是否存在，如果存在则删除
try {
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    console.log('Old file deleted');
  }
} catch (e) {
  console.log('No existing file or error deleting:', e.message);
}

const file = fs.createWriteStream(outputPath);

https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
}, (response) => {
  console.log('Status:', response.statusCode);
  
  if (response.statusCode === 200) {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      const stats = fs.statSync(outputPath);
      console.log('Download complete! Size:', stats.size, 'bytes');
    });
  } else {
    console.log('Download failed with status:', response.statusCode);
    file.close();
  }
}).on('error', (err) => {
  console.error('Error:', err.message);
  try { file.close(); } catch (e) {}
});
