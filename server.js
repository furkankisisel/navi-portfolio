const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
http.createServer((request, response) => {
  const requested = request.url === '/' ? 'index.html' : decodeURIComponent(request.url);
  const filePath = path.join(root, requested);
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.glb': 'model/gltf-binary',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  response.setHeader('Content-Type', contentTypes[extension] || 'application/octet-stream');
  fs.createReadStream(filePath)
    .on('error', () => { response.statusCode = 404; response.end('Not found'); })
    .pipe(response);
}).listen(4173, () => console.log('Preview: http://localhost:4173'));
