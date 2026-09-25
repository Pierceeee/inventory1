import path from 'node:path'
import express from 'express'

/**
 * Serves the built client (`client/dist`) after `/api` (server/src/app.js),
 * so one process and one middleware order protects both the pages and the
 * API. Only mounted when `settings.clientDist` is given (index.js checks the
 * folder exists first) - `npm run dev` and every test keep serving nothing
 * here, unchanged.
 */
export function serveClient(dir) {
  const router = express.Router()

  // Hashed filenames (`/assets/app-abc123.js`) never change contents once
  // built, so they can be cached for a year. `index: false` stops this from
  // ever answering `/` itself - the fallback below always sets its own
  // (non-cached) headers on index.html. review fix #4: a literal
  // `GET /index.html` is still served directly by express.static (`index:
  // false` only disables the directory->index.html auto-resolution, not a
  // request that names the file itself) - `setHeaders` overrides the
  // immutable asset cache for that one file so a client that never revisits
  // `/` still picks up a new deploy.
  router.use(express.static(dir, {
    index: false,
    maxAge: '1y',
    immutable: true,
    setHeaders(res, filePath) {
      if (path.basename(filePath) === 'index.html') res.set('Cache-Control', 'no-cache')
    },
  }))

  // Express 5 / path-to-regexp v8: `'*'` throws. `/{*splat}` is the
  // supported "match anything" route (G-15). A request for a real file
  // (`/assets/missing.js`) that `express.static` above didn't find must stay
  // a 404 - handing it index.html instead would make a stale chunk request
  // silently load the wrong file and crash the app - so only extension-less
  // paths (app routes) fall through to the SPA shell.
  router.get('/{*splat}', (req, res, next) => {
    if (path.extname(req.path)) return next()
    res.set('Cache-Control', 'no-cache')
    // `root: dir` (rather than passing an already-joined absolute path) is
    // not just cleanliness: the `send` library's default dotfile handling
    // treats ANY path SEGMENT starting with `.` as hidden and 404s the whole
    // lookup - without `root`, that check runs over the entire absolute
    // path, so a clientDist under a dot-prefixed directory (e.g. the
    // isolated e2e build, e2e/.client-dist) would always 404 even though the
    // file exists. With `root`, the check only runs over the path relative
    // to it ('index.html' - never dot-prefixed).
    //
    // review fix #8: the callback turns a missing/unreadable index.html (a
    // bad build, or a typo'd clientDist) into a plain 404 instead of letting
    // res.sendFile's default error handling reach the generic error handler
    // as a 500. Only fires on failure - sendFile already ended the response
    // itself on success, so nothing else runs in that case.
    res.sendFile('index.html', { root: dir }, (err) => {
      if (err && !res.headersSent) res.status(404).end()
    })
  })

  return router
}
