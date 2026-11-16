import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let serverProcess;
let baseUrl;

before(async () => {
  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '0',
      TRUST_PROXY_HOPS: '1',
      SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
      ADMIN_PASSWORD: 'test-admin-password-with-more-than-16-characters',
      SMTP_HOST: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      SMTP_FROM: '',
      CONTACT_TO: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  baseUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 10_000);
    serverProcess.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    });
    serverProcess.stderr.on('data', chunk => { output += chunk.toString(); });
    serverProcess.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    serverProcess.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`Server exited with code ${code}: ${output}`));
    });
  });
});

after(async () => {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  serverProcess.kill();
  await once(serverProcess, 'exit');
});

function forwardedOriginHeaders() {
  return {
    Origin: baseUrl.replace(/^http:/, 'https:'),
    'X-Forwarded-Proto': 'https'
  };
}

test('startup refuses weak secrets without exposing their values', () => {
  const result = spawnSync(process.execPath, ['server.js'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '3000',
      SESSION_SECRET: 'too-short',
      ADMIN_PASSWORD: 'weak-admin-password'
    }
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Configuration invalide/);
  assert.doesNotMatch(result.stderr, /too-short|weak-admin-password/);
});

test('security headers are set and public pages do not expose the admin link', async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.match(response.headers.get('permissions-policy'), /camera=\(\)/);
  assert.ok(response.headers.has('strict-transport-security'));
  assert.doesNotMatch(html, /href=["']admin\.html["']/);
});

test('admin page is directly accessible but marked private and not cacheable', async () => {
  const response = await fetch(`${baseUrl}/admin.html`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
});

test('admin authentication enforces origin and creates a protected session', async () => {
  const noOrigin = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' },
    body: JSON.stringify({ password: 'wrong-password' })
  });
  assert.equal(noOrigin.status, 403);

  const wrongPassword = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...forwardedOriginHeaders() },
    body: JSON.stringify({ password: 'wrong-password' })
  });
  assert.equal(wrongPassword.status, 401);

  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...forwardedOriginHeaders() },
    body: JSON.stringify({ password: 'test-admin-password-with-more-than-16-characters' })
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /^__Host-manoucrea\.sid=/);
  assert.match(setCookie, /;\s*Secure/i);
  assert.match(setCookie, /;\s*HttpOnly/i);
  assert.match(setCookie, /;\s*SameSite=Strict/i);
  assert.match(setCookie, /;\s*Path=\//i);
  const cookie = setCookie.split(';', 1)[0];
  assert.ok(cookie);

  const adminSession = await fetch(`${baseUrl}/api/admin/session`, {
    headers: { Cookie: cookie }
  });
  assert.deepEqual(await adminSession.json(), { authenticated: true });

  const invalidProduct = await fetch(`${baseUrl}/api/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...forwardedOriginHeaders(),
      Cookie: cookie
    },
    body: JSON.stringify({
      name: 'Test',
      ref: 'TEST-001',
      category: 'deco',
      price: 10,
      description: 'Test',
      image: 'http://example.com/image.jpg'
    })
  });
  assert.equal(invalidProduct.status, 400);

  const logout = await fetch(`${baseUrl}/api/admin/logout`, {
    method: 'POST',
    headers: { ...forwardedOriginHeaders(), Cookie: cookie }
  });
  assert.equal(logout.status, 200);
  assert.equal(logout.headers.get('cache-control'), 'no-store');
});

test('admin mutations require an authenticated session', async () => {
  const response = await fetch(`${baseUrl}/api/admin/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...forwardedOriginHeaders() },
    body: JSON.stringify({})
  });

  assert.equal(response.status, 401);
});

test('request validation rejects oversized and malformed JSON and unconfigured email', async () => {
  const oversized = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...forwardedOriginHeaders() },
    body: JSON.stringify({ password: 'x'.repeat(40_000) })
  });
  assert.equal(oversized.status, 413);

  const malformed = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...forwardedOriginHeaders() },
    body: '{'
  });
  assert.equal(malformed.status, 400);

  const noSmtp = await fetch(`${baseUrl}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...forwardedOriginHeaders() },
    body: JSON.stringify({
      firstName: 'Test',
      lastName: 'Visiteur',
      email: 'test@hotmail.fr',
      phone: '+33 6 12 34 56 78',
      message: 'Test',
      receiveCopy: true
    })
  });
  assert.equal(noSmtp.status, 503);

  const invalidPhone = await fetch(`${baseUrl}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...forwardedOriginHeaders() },
    body: JSON.stringify({
      firstName: 'Test',
      lastName: 'Visiteur',
      email: 'test@hotmail.fr',
      phone: 'tel:123',
      message: 'Test',
      receiveCopy: false
    })
  });
  assert.equal(invalidPhone.status, 400);
});
