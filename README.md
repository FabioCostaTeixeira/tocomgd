# Avatar

Editor client-side de artes de campanha. Um único deploy atende vários clientes por slug (`/gd`, `/joao`), cada um com marca, textos, templates e formatos habilitados próprios.

Toda foto é processada no navegador. O core compartilha importação, EXIF, movimento, zoom, rotação, preview, canvas e exportação PNG entre tenants.

## Arquitetura

```text
URL /slug
  → public/static/js/tenant.js
  → public/static/js/bootstrap.js
  → public/static/js/editor.js
```

`tenant.js` lê e valida configuração pública, resolve assets e falha fechado. `bootstrap.js` controla landing, loading, marca e erro. `editor.js` é genérico: não conhece clientes ou templates.

`gd` é tenant comum, sem tratamento especial no core.

## Estrutura

```text
public/
├── index.html
├── _headers
└── static/
    ├── css/style.css
    ├── js/{tenant,bootstrap,editor}.js
    └── tenants/
        ├── _template/
        ├── gd/
        └── joao/
tests/
docs/
wrangler.toml
requirements-dev.txt
```

## Rodar localmente

```bash
node tests/server.js 8000
```

Abra `http://127.0.0.1:8000/`, `http://127.0.0.1:8000/gd` ou `http://127.0.0.1:8000/joao`.

Não há deploy Cloudflare executado nesta entrega. `wrangler.toml` apenas prepara Workers Static Assets com `public/` como raiz e fallback SPA.

## Formatos oficiais

O enum do core é fechado:

| ID | Dimensão |
| --- | --- |
| `quadrado` | 1080×1080 |
| `feed` | 1080×1350 |
| `story` | 1080×1920 |

Tenant habilita um subset em `formats`; não define dimensões novas. Trocar template preserva enquadramento. Trocar formato faz reset e `autoFit`.

## Contrato `config.json`

Exemplo mínimo:

```json
{
  "slug": "cliente",
  "version": "1",
  "brand": {
    "name": "Cliente",
    "title": "Monte sua foto",
    "description": "Personalize sua campanha.",
    "primaryColor": "#123456",
    "secondaryColor": "#abcdef",
    "logo": "logo.png"
  },
  "formats": ["quadrado"],
  "templates": [
    {
      "id": "principal",
      "name": "Modelo Principal",
      "assets": {
        "quadrado": "masks/principal/quadrado.png"
      }
    }
  ],
  "defaults": {
    "template": "principal",
    "format": "quadrado"
  }
}
```

Regras principais:

- slug: `^[a-z0-9-]+$`; `admin`, `api`, `assets`, `static`, `tenants` e `login` são reservados;
- `version`, `brand.name`, `brand.primaryColor`, `formats`, `templates` e `defaults` são obrigatórios;
- IDs de template seguem `^[a-z0-9-]+$` e não podem repetir;
- cada template precisa de asset para todo formato habilitado;
- `formats` e template IDs não podem repetir;
- cores aceitam HEX com 3, 4, 6 ou 8 dígitos;
- `logo` é opcional; title/description/secondaryColor têm fallback seguro.

Configuração é dado público e nunca executa código.

## Cadastrar cliente

1. Copie `public/static/tenants/_template` para `public/static/tenants/<slug>`.
2. Defina `slug` válido em `config.json`.
3. Edite marca, textos, cores e defaults.
4. Troque o logo, se houver.
5. Adicione templates com IDs únicos.
6. Adicione um asset por formato habilitado em cada template.
7. Revise `defaults.template` e `defaults.format`.
8. Incremente `version` quando substituir qualquer asset.
9. Valide: `node tests/validate-tenant.js <slug>`.
10. Rode testes focados.
11. Faça commit e push.

Não edite `public/static/js/editor.js` para cadastrar cliente, template ou asset. Não use o caminho antigo `static/tenants/_template`.

## Assets, cache e segurança

Assets declarados são relativos, sem `..`, URL externa, query, hash, `%`, `:` ou barra invertida. O runtime monta:

```text
/static/tenants/{slug}/{asset}?v={version}
```

`config.json` é carregado sem query string. O versionamento só é aplicado depois que a configuração foi lida. `_headers` define CSP, `nosniff`, políticas de referência/permissões e revalidação de `config.json`.

## Testes

```bash
python tests/fixtures.py
python -m unittest discover -s tests -v
node --test tests/tenant.test.js
node --test tests/server.test.js
node tests/server.js 8000
node tests/run.js http://127.0.0.1:8000/joao
node tests/validate-tenant.js gd
node tests/validate-tenant.js joao
python tests/verify_migration.py
```

Checklist antes de publicar:

- slug e config válidos;
- assets e logo existentes;
- templates, formatos, defaults e version revisados;
- upload, zoom, rotação e export testados;
- isolamento entre tenants verificado;
- matriz WYSIWYG sem diferenças de pixels;
- nenhum segredo em `config.json`;
- nenhuma alteração de core necessária para novo tenant.
