import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test, mock } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { deleteApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import handler from '../api/cloudinary/sign';

const fixture = {
  CLOUDINARY_CLOUD_NAME: 'test-cloud',
  CLOUDINARY_API_KEY: 'test-api-key',
  CLOUDINARY_API_SECRET: 'test-secret-never-log',
  FIREBASE_ADMIN_PROJECT_ID: 'test-project',
  FIREBASE_ADMIN_CLIENT_EMAIL: 'test@test-project.iam.gserviceaccount.com',
  FIREBASE_ADMIN_PRIVATE_KEY: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().replace(/\n/g, '\\n'),
};

async function invoke(body: unknown = { folder: 'banners', recordId: 'banner-1-desktop' }, token = 'test-token', method = 'POST') {
  let status = 0;
  let data: any;
  await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, {
    status(code) { status = code; return { json(value) { data = value; } }; },
  });
  return { status, data };
}

test('Vercel require(ESM) failure is reproduced and the documented runtime flag fixes it', () => {
  const code = "import('firebase-admin/auth').then(() => console.log('loaded')).catch(e => { console.log(e.code); process.exitCode = 1; })";
  for (const enabled of [false, true]) {
    const result = spawnSync(process.execPath, [enabled ? '--experimental-require-module' : '--no-experimental-require-module', '--input-type=module', '-e', code], {
      encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' }, timeout: 30000,
    });
    assert.equal(result.status, enabled ? 0 : 1);
    assert.match(result.stdout, enabled ? /loaded/ : /ERR_REQUIRE_ESM/);
  }
});

test('SDK load failure becomes safe JSON instead of a crashed invocation', () => {
  const source = readFileSync(new URL('../api/cloudinary/sign.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const code = `
    ${compiled.replace('export default async function handler', 'async function handler')}
    await handler({ method: 'POST', headers: { authorization: 'Bearer test-token' } }, {
      status(code) { return { json(body) { console.log(JSON.stringify({ code, body })); } }; }
    });
  `;
  // Plain Node is intentional: tsx's dependency loader can mask the production ESM failure.
  const result = spawnSync(process.execPath, ['--no-experimental-require-module', '--input-type=module', '-e', code], {
    encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' }, timeout: 30000,
  });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout.trim()).code, 503);
  assert.match(result.stderr, /ERR_REQUIRE_ESM/);
  assert.doesNotMatch(result.stderr, /test-token/);
});

test('authorization, configuration, signature and shared upload contract', async (t) => {
  const originalEnv = Object.fromEntries(Object.keys(fixture).map(key => [key, process.env[key]]));
  Object.assign(process.env, fixture);
  const logs: unknown[][] = [];
  mock.method(console, 'error', (...args: unknown[]) => { logs.push(args); });
  t.after(async () => {
    mock.restoreAll();
    await Promise.all(getApps().map(deleteApp));
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  await t.test('method, missing token and missing/invalid Firebase configuration', async () => {
    assert.equal((await invoke(undefined, '', 'GET')).status, 405);
    assert.equal((await invoke(undefined, '')).status, 401);
    for (const key of ['FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_ADMIN_PRIVATE_KEY']) {
      process.env[key] = ' ';
      assert.equal((await invoke()).status, 503);
      process.env[key] = fixture[key as keyof typeof fixture];
    }
    process.env.FIREBASE_ADMIN_PRIVATE_KEY = 'invalid-private-key-never-log';
    assert.equal((await invoke()).status, 503);
    process.env.FIREBASE_ADMIN_PRIVATE_KEY = fixture.FIREBASE_ADMIN_PRIVATE_KEY;
    // Real SDK rejects a malformed token without a network request, and initializes the app.
    assert.equal((await invoke()).status, 401);
  });

  let decoded: { admin?: unknown } = { admin: true };
  let tokenError: Error | undefined;
  const auth = getAuth(getApps()[0]);
  mock.method(auth, 'verifyIdToken', async () => {
    if (tokenError) throw tokenError;
    return decoded;
  });

  await t.test('admin claim stays strict; token failures differ from service failures', async () => {
    for (const admin of [undefined, false, 'true']) {
      decoded = { admin };
      assert.equal((await invoke()).status, 403);
    }
    decoded = { admin: true };
    tokenError = Object.assign(new Error('sensitive-token-never-log'), { code: 'auth/id-token-expired' });
    assert.equal((await invoke()).status, 401);
    tokenError = Object.assign(new Error('sensitive-token-never-log'), { code: 'auth/internal-error' });
    assert.equal((await invoke()).status, 503);
    tokenError = undefined;
  });

  await t.test('rejects malformed JSON and invalid folder/record types', async () => {
    for (const body of ['{', null, [], { folder: 'other', recordId: 'id' }, { folder: 'banners', recordId: '../id' }, { folder: 'banners', recordId: 123 }, { folder: 'banners', recordId: 'x'.repeat(101) }]) {
      assert.equal((await invoke(body)).status, 400);
    }
  });

  await t.test('missing or blank Cloudinary settings produce safe 503 responses', async () => {
    for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      delete process.env[key];
      assert.deepEqual(await invoke(), { status: 503, data: { error: 'Cloudinary server configuration is incomplete.' } });
      process.env[key] = ' ';
      assert.equal((await invoke()).status, 503);
      process.env[key] = fixture[key as keyof typeof fixture];
    }
  });

  await t.test('desktop, mobile, product and About uploads send exactly the signed fields', async () => {
    // Execute the actual shared service with only Firebase and browser transport mocked.
    const source = readFileSync(new URL('../src/services/mediaUploadService.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports: any = {};
    let signed: any;
    class UploadRequest {
      status = 200;
      responseText = '';
      upload: any = {};
      onload = () => {};
      open(method: string, url: string) {
        assert.equal(method, 'POST');
        assert.equal(url, `https://api.cloudinary.com/v1_1/${fixture.CLOUDINARY_CLOUD_NAME}/image/upload`);
      }
      send(form: FormData) {
        assert.deepEqual([...form.keys()].sort(), ['api_key', 'file', 'folder', 'public_id', 'signature', 'timestamp']);
        assert.equal(form.get('api_key'), fixture.CLOUDINARY_API_KEY);
        const params = ['folder', 'public_id', 'timestamp'].map(key => `${key}=${form.get(key)}`).join('&');
        assert.equal(form.get('signature'), createHash('sha1').update(params + fixture.CLOUDINARY_API_SECRET).digest('hex'));
        assert.equal(form.get('folder'), signed.folder);
        assert.equal(form.get('public_id'), signed.publicId);
        this.upload.onprogress({ lengthComputable: true, loaded: 5, total: 10 });
        this.responseText = JSON.stringify({ secure_url: 'https://example.test/image.png', public_id: `${signed.folder}/${signed.publicId}` });
        this.onload();
      }
    }
    runInNewContext(compiled, {
      exports, FormData, XMLHttpRequest: UploadRequest,
      require(name: string) {
        assert.equal(name, '../firebase/config');
        return { firebaseAuth: { currentUser: { getIdToken: async () => 'test-token' } } };
      },
      fetch: async (url: string, options: any) => {
        assert.equal(url, '/api/cloudinary/sign');
        assert.equal(options.method, 'POST');
        assert.equal(options.headers.Authorization, 'Bearer test-token');
        const result = await invoke(options.body);
        assert.equal(result.status, 200);
        signed = result.data;
        assert.deepEqual(Object.keys(signed).sort(), ['apiKey', 'cloudName', 'folder', 'publicId', 'signature', 'timestamp']);
        assert.ok(Math.abs(signed.timestamp - Math.floor(Date.now() / 1000)) <= 2);
        return { ok: true, json: async () => signed };
      },
    });
    for (const [folder, recordId] of [['banners', 'banner-1-desktop'], ['banners', 'banner-1-mobile'], ['products', 'product-1'], ['about', 'main']]) {
      const progress: number[] = [];
      const result = await exports.uploadMedia(new File(['test-image'], 'test.png', { type: 'image/png' }), folder, recordId, (percent: number) => progress.push(percent));
      assert.equal(signed.folder, `ab-collections/${folder}/${recordId}`);
      assert.equal(result.secureUrl, 'https://example.test/image.png');
      assert.equal(result.publicId, `${signed.folder}/${signed.publicId}`);
      assert.deepEqual(progress, [50]);
    }
  });

  await t.test('logs never contain secrets, private keys, tokens or raw SDK messages', () => {
    const output = JSON.stringify(logs);
    for (const value of [fixture.CLOUDINARY_API_SECRET, fixture.FIREBASE_ADMIN_PRIVATE_KEY, 'invalid-private-key-never-log', 'sensitive-token-never-log', 'test-token']) {
      assert.ok(!output.includes(value));
    }
    assert.ok(logs.length > 0);
  });
});
