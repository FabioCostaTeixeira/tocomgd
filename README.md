# Gerador de Arte de Campanha

Ferramenta mobile-first para montar artes quadradas de 1080×1080 com:

- fundo branco fixo;
- foto ajustável por arraste, pinça e controle de zoom (o usuário deve enviar a foto já com fundo branco, transparente ou recortada — o app não remove fundo automaticamente);
- dois modelos de máscara fixa: **Rosa** e **Azul**;
- troca de máscara sem perder posição nem zoom da pessoa;
- exportação final em PNG 1080×1080.

## Requisitos

- Python 3.11, 3.12 ou 3.13
- pip

## Rodar localmente

```bash
python -m venv .venv

# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
python app.py
```

Abra no navegador:

```text
http://127.0.0.1:5000
```

Para testar no celular na mesma rede Wi-Fi, descubra o IP local do computador e abra, por exemplo:

```text
http://192.168.0.10:5000
```

O Flask já está configurado para escutar em `0.0.0.0` quando executado por `python app.py`.

## Máscaras disponíveis

Os dois modelos ficam em:

```text
static/img/mascara-rosa.png
static/img/mascara-azul.png
```

A interface mostra os dois modelos antes do editor. O usuário pode alternar entre eles a qualquer momento, inclusive depois de posicionar a foto. O enquadramento da pessoa é preservado.

As máscaras fornecidas têm 1000×1000 px. O backend as redimensiona automaticamente para 1080×1080 no arquivo final.

Se quiser substituir qualquer modelo no futuro, mantenha o mesmo nome de arquivo e use PNG com transparência.

## Produção

Com Gunicorn:

```bash
gunicorn app:app --bind 0.0.0.0:5000 --workers 1 --threads 4 --timeout 180
```

Use um único worker inicialmente porque cada worker pode carregar sua própria cópia do modelo de remoção de fundo na memória.

### Docker

```bash
docker build -t gerador-campanha .
docker run --rm -p 5000:5000 gerador-campanha
```

## Estrutura

```text
gerador-campanha/
├── app.py
├── requirements.txt
├── Dockerfile
├── Procfile
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── style.css
    ├── js/
    │   └── editor.js
    └── img/
        ├── mascara-rosa.png
        └── mascara-azul.png
```
