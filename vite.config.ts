import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { generateZIP } from "./scripts/pack-project.js";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 5173;
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'project-zip-exporter',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const rawUrl = req.url || '';
          const cleanedPath = rawUrl.split('?')[0];
          
          let zipType = '';
          let downloadFilename = '';

          if (cleanedPath === '/project-export.zip' || cleanedPath.endsWith('/project-export.zip')) {
            zipType = 'all';
            downloadFilename = 'project-export.zip';
          } else if (cleanedPath === '/sri-chaitanya-dental-crm-source.zip' || cleanedPath.endsWith('/sri-chaitanya-dental-crm-source.zip')) {
            zipType = 'source';
            downloadFilename = 'sri-chaitanya-dental-crm-source.zip';
          } else if (cleanedPath === '/sri-chaitanya-dental-crm-database.zip' || cleanedPath.endsWith('/sri-chaitanya-dental-crm-database.zip')) {
            zipType = 'database';
            downloadFilename = 'sri-chaitanya-dental-crm-database.zip';
          } else if (cleanedPath === '/sri-chaitanya-dental-crm-production-package.zip' || cleanedPath.endsWith('/sri-chaitanya-dental-crm-production-package.zip')) {
            zipType = 'production';
            downloadFilename = 'sri-chaitanya-dental-crm-production-package.zip';
          } else if (cleanedPath === '/Sri-Chaitanya-Dental-CRM-Full-Repository.zip' || cleanedPath.endsWith('/Sri-Chaitanya-Dental-CRM-Full-Repository.zip')) {
            zipType = 'master';
            downloadFilename = 'Sri-Chaitanya-Dental-CRM-Full-Repository.zip';
          }

          if (zipType !== '') {
            try {
              console.log(`[ZIP REQ] Dynamic ZIP generation requested via path "${cleanedPath}" for type "${zipType}"...`);
              const zipBuffer = await generateZIP(zipType);
              res.setHeader('Content-Type', 'application/zip');
              res.setHeader('Content-Disposition', `attachment; filename=${downloadFilename}`);
              res.end(zipBuffer);
              return;
            } catch (error) {
              console.error('[ZIP API] Error generating on-demand ZIP:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Failed to generate ZIP archive' }));
              return;
            }
          }
          next();
        });
      },
      async buildStart() {
        try {
          await generateZIP();
        } catch (err) {
          console.error('[ZIP PLUGIN] Failed to generate build-time project ZIP:', err);
        }
      }
    },
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) => m.default()),
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({ root: path.resolve(import.meta.dirname, "..") })
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: false,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
