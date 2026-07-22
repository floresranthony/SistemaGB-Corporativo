import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'contratos-upload-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/api/upload-contrato' && req.method === 'POST') {
              const body: Uint8Array[] = [];
              req.on('data', (chunk) => {
                body.push(chunk);
              });
              req.on('end', () => {
                const buffer = Buffer.concat(body);
                const fileName = req.headers['x-file-name'];
                
                if (!fileName) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Falta el nombre de archivo (x-file-name)' }));
                  return;
                }

                const decodedFileName = decodeURIComponent(String(fileName));

                try {
                  const uploadDir = path.resolve(__dirname, 'public/uploads/contratos');
                  if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                  }

                  const filePath = path.join(uploadDir, decodedFileName);
                  fs.writeFileSync(filePath, buffer);

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, path: `/uploads/contratos/${decodedFileName}` }));
                } catch (err: any) {
                  console.error('Error saving contract file:', err);
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message || 'Error guardando el archivo local' }));
                }
              });
              return;
            } else if (req.url === '/api/upload-logo' && req.method === 'POST') {
              const body: Uint8Array[] = [];
              req.on('data', (chunk) => {
                body.push(chunk);
              });
              req.on('end', () => {
                const buffer = Buffer.concat(body);
                const fileName = req.headers['x-file-name'];
                
                if (!fileName) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Falta el nombre de archivo (x-file-name)' }));
                  return;
                }

                const decodedFileName = decodeURIComponent(String(fileName));

                try {
                  const uploadDir = path.resolve(__dirname, 'public/uploads/logos');
                  if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                  }

                  const filePath = path.join(uploadDir, decodedFileName);
                  fs.writeFileSync(filePath, buffer);

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, path: `uploads/logos/${decodedFileName}` }));
                } catch (err: any) {
                  console.error('Error saving logo file:', err);
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message || 'Error guardando el archivo local' }));
                }
              });
              return;
            }
            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
