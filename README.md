# Monte sua foto com GD!

Ferramenta mobile-first para montar artes quadradas de 1080×1080 com:

- fundo branco fixo;
- foto ajustável por arraste, pinça e controle de zoom (o usuário deve enviar a foto já com fundo branco, transparente ou recortada — o app não remove fundo automaticamente);
- dois modelos de máscara fixa: **Rosa** e **Azul**;
- troca de máscara sem perder posição nem zoom da pessoa;
- processamento local, sem enviar a foto para um servidor;
- exportação final em PNG 1080×1080.

## Rodar localmente

Use Python apenas para servir os arquivos estáticos durante o teste local:

```bash
python -m http.server 8000
```

Abra no navegador:

```text
http://127.0.0.1:8000
```

## Máscaras disponíveis

Os dois modelos ficam em:

```text
static/img/mascara-rosa-v1.png
static/img/mascara-azul-v1.png
```

A interface mostra os dois modelos antes do editor. O usuário pode alternar entre eles a qualquer momento, inclusive depois de posicionar a foto. O enquadramento da pessoa é preservado.

As máscaras fornecidas têm 1000×1000 px e são compostas no canvas 1080×1080 do navegador.

Novas versões devem receber um novo sufixo, como `mascara-rosa-v2.png`, sem substituir
silenciosamente um arquivo já publicado como immutable.

## Estrutura

```text
gerador-campanha/
├── index.html
├── vercel.json
└── static/
    ├── css/
    │   └── style.css
    ├── js/
    │   └── editor.js
    └── img/
        ├── mascara-rosa-v1.png
        └── mascara-azul-v1.png
```
