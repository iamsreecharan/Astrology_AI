import express from 'express';
import path from 'node:path';
import { existsSync, realpathSync } from 'node:fs';

function cachePolicy(filename) {
  return /(?:^|[\\/])assets[\\/].*-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(filename)
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=0, must-revalidate';
}

/** Compression runs during the build; requests only stream existing files. */
export function productionAssets(directory) {
  const root = path.resolve(directory);
  const realRoot = realpathSync(root);
  const insideRoot = filename => realpathSync(filename).startsWith(`${realRoot}${path.sep}`);
  const plain = express.static(root, {
    dotfiles: 'deny',
    setHeaders: (response, filename) => response.setHeader('Cache-Control', cachePolicy(filename)),
  });
  return (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next();
    let pathname;
    try { pathname = decodeURIComponent(req.path); }
    catch { return res.status(400).set('Cache-Control', 'no-store').send('Invalid asset path.'); }
    const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(`${root}${path.sep}`) || pathname.includes('\0') || pathname.includes('\\')) {
      return res.status(400).set('Cache-Control', 'no-store').send('Invalid asset path.');
    }
    const missing = () => res.status(404).set('Cache-Control', 'no-store').send('Asset not found.');
    if (/\.(?:br|gz)$/.test(pathname)) return missing();
    if (existsSync(filename) && !insideRoot(filename)) return missing();
    const eligible = /\.(?:js|css|html|svg|json)$/.test(filename)
      && !pathname.split('/').some(part => part.startsWith('.')) && existsSync(filename);
    if (eligible) res.vary('Accept-Encoding');
    if (eligible && req.get('range') && !req.acceptsEncodings('identity')) {
      return res.status(406).set('Cache-Control', 'no-store').send('No acceptable asset encoding.');
    }
    if (eligible && !req.get('range')) {
      const available = ['br', 'gzip'].filter(encoding => {
        const variant = `${filename}.${encoding === 'gzip' ? 'gz' : 'br'}`;
        return existsSync(variant) && insideRoot(variant);
      });
      const encoding = req.acceptsEncodings(...available, 'identity');
      if (!encoding) return res.status(406).set('Cache-Control', 'no-store').send('No acceptable asset encoding.');
      if (encoding !== 'identity') {
        res.type(path.extname(filename));
        res.set('Content-Encoding', encoding);
        res.set('Cache-Control', cachePolicy(filename));
        return res.sendFile(`${filename}.${encoding === 'gzip' ? 'gz' : 'br'}`, { dotfiles: 'deny' }, error => {
          if (!error) return;
          if (res.headersSent) return next(error);
          res.removeHeader('Content-Encoding');
          if (error.status === 404) return missing();
          next(error);
        });
      }
    }
    plain(req, res, error => {
      if (error) return next(error);
      if (pathname.startsWith('/assets/')) return missing();
      next();
    });
  };
}
