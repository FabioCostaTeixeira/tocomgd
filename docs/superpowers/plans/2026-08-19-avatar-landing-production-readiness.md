# Avatar Landing Page — Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 4 remaining gaps found in the pre-release security/LGPD audit of `public/landing.html` (avatar.app.br) before it goes to production: missing privacy notice, missing consent link, unoptimized hero image, and an abrupt redirect-on-submit UX.

**Architecture:** Static-first. Everything lives under `public/` and is served by the existing Cloudflare Worker (`src/index.js` + `[assets]` in `wrangler.toml`). No new backend, no new dependencies in the shipped page — the one build-time tool (`sharp-cli` via `npx`) is used only to produce the WEBP asset, it never ships to the browser.

**Tech Stack:** Cloudflare Workers + Workers Assets, vanilla HTML/CSS/JS (no framework), `wrangler dev`/`wrangler deploy --env dev` for local/staging verification.

## Global Constraints

- WhatsApp number is already configured (`5531996569799` at `public/landing.html:159`) — do not touch it.
- No build step / bundler exists for this page. All HTML/CSS/JS edits must remain plain, inline, and directly servable as static assets.
- CSP is defined in `public/_headers` (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`). Any new resource type (e.g. a new image format) must stay within `img-src 'self'` — WEBP served from `/static/img/` already qualifies, no CSP change needed.
- `public/landing.html:144-148` already has `loading="lazy" decoding="async"` on the hero image — do not duplicate these attributes when editing that block.
- Every task must be verifiable locally via `npx wrangler dev --local` before `wrangler deploy --env dev` is ever run. Do not deploy in this plan — deployment is a separate, explicit step the user triggers.

---

### Task 1: Privacy notice page (`/privacy.html`)

**Files:**
- Create: `public/privacy.html`
- Test: manual, via `npx wrangler dev --local` + `curl`

**Interfaces:**
- Consumes: nothing.
- Produces: a static route at `/privacy.html`, served directly by the Assets binding (no worker code change — `src/index.js` only special-cases `/`; every other path already falls through to `env.ASSETS.fetch(request)`, which serves any file that exists under `public/` by exact path match before SPA fallback kicks in). Task 2 links to this exact path.

- [ ] **Step 1: Create the privacy notice page**

Create `public/privacy.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Aviso de Privacidade — Avatar</title>
<meta name="robots" content="noindex" />
<style>
  :root{--bg:#0b0d10;--panel:#12151a;--text:#e8ebef;--muted:#9aa3af;--accent:#22c55e;--border:#20242b}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6}
  .wrap{max-width:720px;margin:0 auto;padding:48px 24px 96px}
  a{color:var(--accent)}
  h1{font-size:1.8rem;margin-bottom:4px}
  .updated{color:var(--muted);font-size:.85rem;margin-bottom:32px}
  h2{font-size:1.15rem;margin-top:32px;border-top:1px solid var(--border);padding-top:24px}
  p,li{color:#c7cdd6}
  .back{display:inline-block;margin-bottom:24px;color:var(--muted);text-decoration:none}
  .back:hover{color:var(--text)}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--border);font-size:.92rem}
  th{color:var(--muted);font-weight:600}
</style>
</head>
<body>
  <div class="wrap">
    <a class="back" href="/">&larr; Voltar</a>
    <h1>Aviso de Privacidade</h1>
    <div class="updated">Última atualização: 19/08/2026</div>

    <p>Este aviso explica como os dados enviados pelo formulário de contato da página do Avatar (avatar.app.br) são coletados e utilizados.</p>

    <h2>Quem coleta</h2>
    <p>Os dados são coletados diretamente pela equipe responsável pelo produto Avatar, para fins de qualificação comercial dos interessados no produto.</p>

    <h2>Quais dados coletamos</h2>
    <table>
      <tr><th>Campo</th><th>Finalidade</th></tr>
      <tr><td>Nome</td><td>Identificação do contato</td></tr>
      <tr><td>Campanha/candidatura</td><td>Contextualizar a demonstração</td></tr>
      <tr><td>Cargo em disputa</td><td>Contextualizar a demonstração</td></tr>
      <tr><td>Cidade/UF</td><td>Contextualizar a demonstração</td></tr>
      <tr><td>WhatsApp</td><td>Canal de contato comercial</td></tr>
      <tr><td>Base ativa estimada</td><td>Dimensionar a proposta</td></tr>
      <tr><td>Mensagem (opcional)</td><td>Contexto adicional informado pelo interessado</td></tr>
    </table>

    <h2>Para que usamos</h2>
    <p>Exclusivamente para responder ao seu interesse no Avatar e conduzir uma conversa comercial sobre o produto. Não usamos esses dados para nenhuma outra finalidade.</p>

    <h2>Para onde os dados vão</h2>
    <p>Ao enviar o formulário, os dados preenchidos são usados para montar uma mensagem que é aberta diretamente no WhatsApp (WhatsApp Business, operado pela Meta Platforms, Inc.) do número de contato comercial do Avatar. O envio ocorre no seu próprio navegador — não existe um servidor intermediário nosso que armazene os dados do formulário antes desse envio.</p>
    <p>Por ser uma aplicação do WhatsApp/Meta, o processamento subsequente da conversa segue a política de privacidade da própria Meta, disponível em <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener">whatsapp.com/legal/privacy-policy</a>, incluindo eventual transferência internacional de dados operada pela Meta.</p>

    <h2>Por quanto tempo guardamos</h2>
    <p>Não mantemos um banco de dados próprio com as respostas deste formulário. Os dados enviados passam a existir como uma conversa de WhatsApp, sujeita à retenção padrão do próprio WhatsApp para suas conversas.</p>

    <h2>Seus direitos</h2>
    <p>Você pode solicitar a qualquer momento a exclusão da conversa iniciada, correção de dados ou esclarecimentos sobre este aviso, entrando em contato pelo mesmo número de WhatsApp usado no formulário.</p>
  </div>
</body>
</html>
```

- [ ] **Step 2: Verify the file is valid, self-contained HTML**

Run: `node -e "require('fs').readFileSync('public/privacy.html','utf-8').includes('</html>') || process.exit(1)"`
Expected: exit code `0` (no output, no error).

- [ ] **Step 3: Start local dev server and confirm the route serves the file**

Run (from repo root `gerador-campanha-v2/gerador-campanha`, in a background/second terminal): `npx wrangler dev --local --port 8787`
Then in another terminal: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/privacy.html`
Expected output: `200`

Also confirm the content is the privacy page and not the SPA fallback:
Run: `curl -s http://127.0.0.1:8787/privacy.html | grep -c "Aviso de Privacidade"`
Expected output: `1` (or higher)

Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 4: Commit**

```bash
git add public/privacy.html
git commit -m "docs(landing): add privacy notice page for lead form"
```

---

### Task 2: Consent checkbox links to the privacy notice

**Files:**
- Modify: `public/landing.html:155`

**Interfaces:**
- Consumes: `/privacy.html` route produced by Task 1.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Locate and replace the privacy checkbox label**

In `public/landing.html:155`, find this exact fragment inside the `<form class="lead-form" id="leadForm">` block:

```html
<label class="privacy"><input type="checkbox" id="privacy" required /><span>Autorizo o uso destes dados para contato comercial sobre o Avatar e declaro que li o aviso de privacidade.</span></label>
```

Replace it with:

```html
<label class="privacy"><input type="checkbox" id="privacy" required /><span>Autorizo o uso destes dados para contato comercial sobre o Avatar e declaro que li o <a href="/privacy.html" target="_blank" rel="noopener">aviso de privacidade</a>.</span></label>
```

The only change is wrapping "aviso de privacidade" in an `<a href="/privacy.html" target="_blank" rel="noopener">` link, so the form isn't lost if the user follows it. Everything else on that line (the rest of the form markup) stays exactly as-is — this is a single-line file, do not reformat surrounding markup.

- [ ] **Step 2: Confirm the link renders and CSP doesn't block it**

Run: `npx wrangler dev --local --port 8787` (background terminal)
Run: `curl -s http://127.0.0.1:8787/ | grep -o '<a href="/privacy.html"[^>]*>aviso de privacidade</a>'`
Expected output: `<a href="/privacy.html" target="_blank" rel="noopener">aviso de privacidade</a>`

This is a plain same-origin anchor tag, not a script-injected resource, so no `_headers` CSP change is needed (CSP's `script-src`/`style-src` don't govern `<a href>` navigation). Confirm visually too: open `http://127.0.0.1:8787/` in a browser, scroll to the form, click "aviso de privacidade", confirm it opens `/privacy.html` in a new tab and the original form still has your entered data intact.

Stop the dev server once confirmed.

- [ ] **Step 3: Commit**

```bash
git add public/landing.html
git commit -m "feat(landing): link consent checkbox to privacy notice"
```

---

### Task 3: Optimize the hero image (WEBP with PNG fallback)

**Files:**
- Create: `public/static/img/landing-showcase.webp`
- Modify: `public/landing.html:142-149`

**Interfaces:**
- Consumes: existing `public/static/img/landing-showcase.png` (1.8MB, already in the repo).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Generate the WEBP version**

Run (from repo root):
```bash
npx --yes sharp-cli@2 -i public/static/img/landing-showcase.png -o public/static/img/landing-showcase.webp -f webp
```
Expected: a new file `public/static/img/landing-showcase.webp` is created, noticeably smaller than the 1.8MB PNG (typically 60-80% smaller for this kind of screenshot/mockup image).

If `npx` cannot reach the registry (no internet / offline), stop and report this as a blocker — do not skip the task silently. The image must not ship at 1.8MB to production.

- [ ] **Step 2: Verify the WEBP file was created and is smaller**

Run: `node -e "const fs=require('fs');const p=fs.statSync('public/static/img/landing-showcase.png').size;const w=fs.statSync('public/static/img/landing-showcase.webp').size;console.log(p,w,w<p)"`
Expected output: three values where the third is `true` (WEBP smaller than PNG), e.g. `1887436 412300 true`.

- [ ] **Step 3: Replace the `<img>` with a `<picture>` element serving WEBP with PNG fallback**

In `public/landing.html:142-149`, find:

```html
        <div class="showcase-frame tilt">
          <img
            src="/static/img/landing-showcase.png"
            alt="Exemplos fictícios de foto de perfil, publicação de feed e story criados para demonstrar o Avatar, com número de campanha 12345."
            loading="lazy"
            decoding="async"
          />
        </div>
```

Replace with:

```html
        <div class="showcase-frame tilt">
          <picture>
            <source srcset="/static/img/landing-showcase.webp" type="image/webp" />
            <img
              src="/static/img/landing-showcase.png"
              alt="Exemplos fictícios de foto de perfil, publicação de feed e story criados para demonstrar o Avatar, com número de campanha 12345."
              loading="lazy"
              decoding="async"
            />
          </picture>
        </div>
```

Browsers that support WEBP (all current evergreen browsers) load the `<source>`; anything that doesn't falls back to the existing PNG `<img>`, so this is a strict enhancement with zero regression risk. `loading="lazy" decoding="async"` stay exactly where they already were on the `<img>` — do not add them to `<source>` or `<picture>`.

- [ ] **Step 4: Verify in local dev**

Run: `npx wrangler dev --local --port 8787` (background terminal)
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/static/img/landing-showcase.webp`
Expected output: `200`

Open `http://127.0.0.1:8787/` in a browser, open DevTools → Network, reload, filter by "img", confirm `landing-showcase.webp` is the file actually downloaded (not the `.png`) in a modern browser.

Stop the dev server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add public/static/img/landing-showcase.webp public/landing.html
git commit -m "perf(landing): serve WEBP hero image with PNG fallback"
```

---

### Task 4: Visual confirmation before WhatsApp redirect

**Files:**
- Modify: `public/landing.html:155` (add a status element inside the form)
- Modify: `public/landing.html:165` (submit handler)

**Interfaces:**
- Consumes: existing `leadForm` submit flow (`public/landing.html:165`), `WHATSAPP_NUMBER` constant (`public/landing.html:159`) — untouched.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add a status element to the form**

In `public/landing.html:155`, find the end of the form (still the same single line as Task 2's edit):

```html
<button type="submit" class="btn btn-whatsapp">Continuar pelo WhatsApp</button><div class="after">Seus dados serão usados para dar continuidade a este contato comercial.</div></form>
```

Replace with:

```html
<button type="submit" class="btn btn-whatsapp" id="leadSubmitBtn">Continuar pelo WhatsApp</button><div class="form-status" id="formStatus" role="status" aria-live="polite" hidden>Enviando para o WhatsApp…</div><div class="after">Seus dados serão usados para dar continuidade a este contato comercial.</div></form>
```

This adds `id="leadSubmitBtn"` to the existing button (no visual change) and a hidden status line right after it, using `role="status" aria-live="polite"` so screen readers announce it when it appears.

- [ ] **Step 2: Add minimal CSS for the status element**

In `public/landing.html`, inside the existing `<style>` block (find the `.after{` rule near the other form-related styles), add immediately after it:

```css
.form-status{margin-top:10px;font-size:.9rem;color:#22c55e;font-weight:600}
.btn-whatsapp[disabled]{opacity:.7;cursor:not-allowed}
```

- [ ] **Step 3: Update the submit handler to show confirmation before redirecting**

In `public/landing.html:165`, find:

```html
document.getElementById("leadForm").addEventListener("submit",function(event){event.preventDefault();if(!/^\d+$/.test(WHATSAPP_NUMBER)){alert("Configure o número do WhatsApp no código antes de publicar.");return}const data=new FormData(event.currentTarget);const text=["Olá! Tenho interesse em conhecer o Avatar.","",`Nome: ${data.get("name")}`,`Campanha/candidatura: ${data.get("campaign")}`,`Cargo: ${data.get("role")}`,`Cidade/UF: ${data.get("city")}`,`Meu WhatsApp: ${data.get("phone")}`,`Base ativa estimada: ${data.get("baseSize")}`,data.get("message")?`Interesse/comentário: ${data.get("message")}`:"","",utm.source?`Origem: ${utm.source}`:"",utm.medium?`Mídia: ${utm.medium}`:"",utm.campaign?`Campanha UTM: ${utm.campaign}`:"",utm.content?`Conteúdo UTM: ${utm.content}`:""].filter(Boolean).join("\n");window.location.href=`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`});
```

Replace with:

```html
document.getElementById("leadForm").addEventListener("submit",function(event){event.preventDefault();if(!/^\d+$/.test(WHATSAPP_NUMBER)){alert("Configure o número do WhatsApp no código antes de publicar.");return}const data=new FormData(event.currentTarget);const text=["Olá! Tenho interesse em conhecer o Avatar.","",`Nome: ${data.get("name")}`,`Campanha/candidatura: ${data.get("campaign")}`,`Cargo: ${data.get("role")}`,`Cidade/UF: ${data.get("city")}`,`Meu WhatsApp: ${data.get("phone")}`,`Base ativa estimada: ${data.get("baseSize")}`,data.get("message")?`Interesse/comentário: ${data.get("message")}`:"","",utm.source?`Origem: ${utm.source}`:"",utm.medium?`Mídia: ${utm.medium}`:"",utm.campaign?`Campanha UTM: ${utm.campaign}`:"",utm.content?`Conteúdo UTM: ${utm.content}`:""].filter(Boolean).join("\n");const submitBtn=document.getElementById("leadSubmitBtn"),statusEl=document.getElementById("formStatus");submitBtn.disabled=true;submitBtn.textContent="Enviando…";statusEl.hidden=false;setTimeout(function(){window.location.href=`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`},700)});
```

The only changes: after building `text` (unchanged), the button is disabled and relabeled, the status line is unhidden, and the existing `window.location.href` assignment moves inside a 700ms `setTimeout` instead of firing immediately. The message text, UTM handling, and WhatsApp URL construction are byte-for-byte identical to before.

- [ ] **Step 4: Verify in local dev**

Run: `npx wrangler dev --local --port 8787` (background terminal)
Open `http://127.0.0.1:8787/` in a browser, fill every required field in the form, check the consent checkbox, click "Continuar pelo WhatsApp".
Expected: the button becomes disabled and shows "Enviando…", the green "Enviando para o WhatsApp…" line appears below it, and roughly 700ms later the browser navigates to a `web.whatsapp.com` / `api.whatsapp.com` URL (or shows a "open WhatsApp?" prompt) with the message pre-filled including the values you typed.

Also confirm validation still blocks submission: leave a required field empty, click submit, confirm the browser's native validation message appears and no redirect happens.

Stop the dev server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add public/landing.html
git commit -m "feat(landing): show visual confirmation before WhatsApp redirect"
```

---

## After all 4 tasks

Deployment is intentionally **not** part of this plan. Once all tasks are committed and each has been manually verified per its own steps, the next explicit action (outside this plan) is:

```bash
npx wrangler deploy --env dev
```

...followed by a manual pass on `avatar-dev.<subdomain>.workers.dev` covering: `/`, `/privacy.html`, the consent link, the WEBP image loading, and a full form submission — before ever running `wrangler deploy` against production.
