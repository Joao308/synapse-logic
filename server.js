import http from 'node:http';
import { randomUUID, scryptSync, timingSafeEqual, randomBytes, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY = 1_000_000;
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon', '.json':'application/json; charset=utf-8', '.txt':'text/plain; charset=utf-8' };
const telemetry = [];
const ipBuckets = new Map();
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const sessions = new Map();
let store = { users: [], conversations: [] };
fs.mkdirSync(DATA_DIR, { recursive: true });
try { const saved = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); if (saved && Array.isArray(saved.users) && Array.isArray(saved.conversations)) store = saved; } catch { /* first run: empty store */ }
function saveStore() { const tmp = STORE_PATH + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 }); fs.renameSync(tmp, STORE_PATH); }
function cookie(req, name) { const raw = req.headers.cookie || ''; const part = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '=')); return part ? decodeURIComponent(part.slice(name.length + 1)) : ''; }
function currentUser(req) { const token = cookie(req, 'synapse_session'); const session = sessions.get(token); if (!session || session.expires < Date.now()) { if (token) sessions.delete(token); return null; } return store.users.find(u => u.id === session.userId) || null; }
function publicUser(u) { return { id:u.id, email:u.email, createdAt:u.createdAt }; }
function passwordHash(password, salt=randomBytes(16).toString('hex')) { return { salt, hash:scryptSync(password, salt, 64).toString('hex') }; }
function verifyPassword(password, user) { const actual = scryptSync(password, user.salt, 64); const expected = Buffer.from(user.passwordHash, 'hex'); return actual.length === expected.length && timingSafeEqual(actual, expected); }
function setSession(res, user) { const token = randomBytes(32).toString('hex'); sessions.set(token, { userId:user.id, expires:Date.now()+7*24*60*60*1000 }); res.setHeader('Set-Cookie', `synapse_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`); }
function clearSession(req,res) { const token=cookie(req,'synapse_session'); if(token) sessions.delete(token); res.setHeader('Set-Cookie', 'synapse_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' + (process.env.NODE_ENV==='production'?'; Secure':'')); }
function requireUser(req,res) { const user=currentUser(req); if(!user) { json(res,401,{error:'Faça login para acessar este recurso.'}); return null; } return user; }


function json(res, status, body) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''; let size = 0;
    req.on('data', chunk => { size += chunk.length; if (size > MAX_BODY) { reject(Object.assign(new Error('Corpo muito grande.'), { status:413 })); req.destroy(); return; } data += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(Object.assign(new Error('JSON inválido.'), { status:400 })); } });
    req.on('error', reject);
  });
}
function rateLimit(req) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now(); const old = ipBuckets.get(ip) || { start:now, count:0 };
  if (now - old.start > 60_000) { old.start = now; old.count = 0; }
  old.count++; ipBuckets.set(ip, old);
  return old.count <= 40;
}
async function callAI(input, instructions) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { configured:false };
  const response = await fetch('https://api.openai.com/v1/responses', {
    method:'POST', headers:{ 'Authorization':`Bearer ${key}`, 'Content-Type':'application/json' },
    body:JSON.stringify({ model:process.env.OPENAI_MODEL || 'gpt-6-astra', instructions, input, max_output_tokens:1200, store:false })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 401 ? 'A chave da API foi recusada. Confira OPENAI_API_KEY.' : response.status === 429 ? 'Limite ou cota do provedor atingido. Verifique a conta da API.' : `O provedor de IA respondeu com erro (${response.status}).`;
    const err = new Error(message); err.status = response.status === 429 ? 429 : 502; throw err;
  }
  let output = data.output_text || '';
  if (!output && Array.isArray(data.output)) output = data.output.flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n');
  return { configured:true, text:output || 'A IA não retornou texto nesta resposta.' };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok:true, aiConfigured:Boolean(process.env.OPENAI_API_KEY), model:process.env.OPENAI_MODEL || 'gpt-6-astra', edgeMode:'demo-and-ingestion', authEnabled:true, timestamp:new Date().toISOString() });
    if (req.method === 'GET' && url.pathname === '/api/auth/me') { const user=currentUser(req); return json(res,200,{authenticated:Boolean(user),user:user?publicUser(user):null}); }
    if (req.method === 'POST' && url.pathname === '/api/auth/register') {
      const body=await readBody(req); const email=typeof body.email==='string'?body.email.trim().toLowerCase():''; const password=typeof body.password==='string'?body.password:'';
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254) return json(res,400,{error:'Informe um e-mail válido.'});
      if(password.length<10||password.length>128) return json(res,400,{error:'A senha deve ter entre 10 e 128 caracteres.'});
      if(store.users.some(u=>u.email===email)) return json(res,409,{error:'Já existe uma conta com este e-mail.'});
      const ph=passwordHash(password); const user={id:randomUUID(),email,...{salt:ph.salt,passwordHash:ph.hash},createdAt:new Date().toISOString()}; store.users.push(user); saveStore(); setSession(res,user); return json(res,201,{user:publicUser(user)});
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const body=await readBody(req); const email=typeof body.email==='string'?body.email.trim().toLowerCase():''; const password=typeof body.password==='string'?body.password:''; const user=store.users.find(u=>u.email===email);
      if(!user||!verifyPassword(password,user)) return json(res,401,{error:'E-mail ou senha incorretos.'}); setSession(res,user); return json(res,200,{user:publicUser(user)});
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') { clearSession(req,res); return json(res,200,{ok:true}); }
    if (req.method === 'GET' && url.pathname === '/api/conversations') { const user=requireUser(req,res); if(!user)return; return json(res,200,{items:store.conversations.filter(c=>c.userId===user.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,100).map(({id,title,updatedAt,messages})=>({id,title,updatedAt,messages}))}); }
    if (req.method === 'POST' && url.pathname === '/api/conversations') { const user=requireUser(req,res); if(!user)return; const body=await readBody(req); if(!Array.isArray(body.messages)||body.messages.length>100||!body.messages.every(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string'&&m.content.length<=8000))return json(res,400,{error:'Formato de conversa inválido.'}); const id=typeof body.id==='string'?body.id:''; let conv=store.conversations.find(c=>c.id===id&&c.userId===user.id); const messages=body.messages; if(!conv){conv={id:randomUUID(),userId:user.id,title:(messages.find(m=>m.role==='user')?.content||'Nova conversa').slice(0,80),messages:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};store.conversations.push(conv)} conv.messages=messages.slice(-100);conv.updatedAt=new Date().toISOString();saveStore();return json(res,200,{id:conv.id,updatedAt:conv.updatedAt}); }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/conversations/')) { const user=requireUser(req,res); if(!user)return; const id=decodeURIComponent(url.pathname.slice('/api/conversations/'.length)); const before=store.conversations.length; store.conversations=store.conversations.filter(c=>!(c.id===id&&c.userId===user.id)); if(before===store.conversations.length)return json(res,404,{error:'Conversa não encontrada.'});saveStore();return json(res,200,{ok:true}); }
    if (url.pathname.startsWith('/api/') && !rateLimit(req)) return json(res, 429, { error:'Muitas requisições. Aguarde um minuto e tente novamente.' });

    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const user = requireUser(req,res); if(!user)return;
      const body = await readBody(req);
      const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
      if (!messages.length || !messages.every(m => ['user','assistant'].includes(m.role) && typeof m.content === 'string')) return json(res, 400, { error:'Envie uma conversa válida.' });
      if (messages.some(m => m.content.length > 8000)) return json(res, 413, { error:'Cada mensagem deve ter até 8.000 caracteres.' });
      const result = await callAI(messages.map(m => ({ role:m.role, content:[{ type:'input_text', text:m.content }] })), 'Você é Synapse AI, assistente da plataforma Synapse Logic. Responda em português brasileiro por padrão, seja claro e não invente dados, medições, integrações ou testes. Diferencie fatos de hipóteses.');
      if (!result.configured) return json(res, 503, { error:'IA não configurada. Adicione OPENAI_API_KEY no ambiente do servidor e reinicie a aplicação. Nenhuma resposta simulada será apresentada como IA real.' });
      return json(res, 200, { text:result.text, model:process.env.OPENAI_MODEL || 'gpt-6-astra' });
    }

    if (req.method === 'POST' && url.pathname === '/api/analytics/insight') {
      const user = requireUser(req,res); if(!user)return;
      const body = await readBody(req);
      if (!body.summary || typeof body.summary !== 'object') return json(res, 400, { error:'Resumo de dados ausente.' });
      const result = await callAI(`Analise este resumo calculado localmente a partir de um arquivo do usuário. Não invente valores. Separe observações, possíveis interpretações e limitações.\n${JSON.stringify(body.summary).slice(0,18000)}`, 'Você é um analista de dados cuidadoso. Use apenas os números fornecidos. Explique em português simples e destaque que correlação não prova causalidade.');
      if (!result.configured) return json(res, 503, { error:'IA não configurada. A análise estatística local funciona sem IA; configure OPENAI_API_KEY para receber interpretação por modelo.' });
      return json(res, 200, { text:result.text });
    }

    if (req.method === 'GET' && url.pathname === '/api/edge/telemetry') return json(res, 200, { mode:'demo-and-ingestion', items:telemetry.slice(-100).reverse() });
    if (req.method === 'POST' && url.pathname === '/api/edge/telemetry') {
      const body = await readBody(req);
      if (typeof body.deviceId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(body.deviceId)) return json(res, 400, { error:'deviceId deve conter 1–64 caracteres alfanuméricos, _ ou -.' });
      if (!body.values || typeof body.values !== 'object' || Array.isArray(body.values)) return json(res, 400, { error:'values deve ser um objeto de medições numéricas.' });
      const entries = Object.entries(body.values);
      if (!entries.length || entries.length > 30 || entries.some(([k,v]) => !/^[a-zA-Z0-9_.-]{1,40}$/.test(k) || typeof v !== 'number' || !Number.isFinite(v))) return json(res, 400, { error:'Envie de 1 a 30 campos com nomes válidos e valores numéricos finitos.' });
      const item = { id:randomUUID(), deviceId:body.deviceId, values:body.values, source:'ingested', receivedAt:new Date().toISOString() };
      telemetry.push(item); if (telemetry.length > 500) telemetry.splice(0, telemetry.length - 500);
      return json(res, 201, { accepted:true, item });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error:'Método não permitido.' });
    let requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.resolve(__dirname, `.${requested}`);
    if (!filePath.startsWith(__dirname + path.sep)) return json(res, 403, { error:'Acesso negado.' });
    let stat; try { stat = fs.statSync(filePath); } catch { return json(res, 404, { error:'Arquivo não encontrado.' }); }
    if (!stat.isFile()) return json(res, 404, { error:'Arquivo não encontrado.' });
    res.writeHead(200, { 'Content-Type':MIME[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control':path.extname(filePath)==='.html'?'no-cache':'public, max-age=3600' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    if (res.headersSent) return;
    json(res, err.status || 500, { error:err.status ? err.message : 'Erro interno ao processar a solicitação.' });
  }
});
server.listen(PORT, '0.0.0.0', () => console.log(`Synapse Logic disponível em http://localhost:${PORT}`));
