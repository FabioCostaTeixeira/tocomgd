# CODEX Handoff — tocomgd Client-Side Migration

## Objetivo

Concluir a migração do editor tocomgd para renderização client-side: a foto é carregada no navegador, composta em um canvas de 1080×1080 com a máscara selecionada e exportada localmente como PNG, sem chamada ao backend.

## Estado

Concluído. Não há trabalho funcional pendente neste ciclo.

## Escopo implementado

- Carregamento local de JPEG, PNG e WebP, com limite de 15 MB.
- Normalização de orientação EXIF e composição WYSIWYG no canvas.
- Ajustes de arraste, pinça, zoom, rotação e Centralizar.
- Troca das máscaras Rosa/Azul sem perder o enquadramento.
- Exportação por `canvas.toBlob()` e download local do PNG 1080×1080.
- Invalidação centralizada do resultado sempre que o estado editável muda.
- Controle monotônico `editorStateVersion` para identificar exportações obsoletas.
- Barreira de versão dentro de `showResult(blob, expectedStateVersion)`: nenhum blob é exibido se o estado mudou enquanto `toBlob()` estava pendente.
- Regressão ponta a ponta que deixa um resultado anterior visível, inicia uma nova exportação atrasada, altera o zoom para 150% durante `toBlob()` e confirma que `resultCard` fica oculto, sem `src` obsoleto.

## Decisões técnicas

- Foi escolhido descartar o blob obsoleto, em vez de bloquear o zoom e o botão Centralizar durante toda a operação assíncrona. Assim, a interação continua responsiva; cada mutação chama `invalidateResult()` e incrementa a versão.
- `clearResult()` foi separado de `invalidateResult()`. Limpar o card durante a exibição de um resultado válido não altera a versão do estado; mutações do editor continuam sendo as únicas responsáveis por invalidá-la.
- A versão é capturada antes do `toBlob()` e validada no próprio ponto de exibição. Isso protege todos os futuros chamadores de `showResult`, além do fluxo atual de download.

## Restrições

- A imagem não é enviada para `/api/` nem processada por servidor.
- O editor permanece dependente apenas dos arquivos estáticos publicados.
- O resultado final deve continuar sendo PNG 1080×1080 e coincidir pixel a pixel com a prévia do canvas.

## Critérios de aceite

- [x] A migração client-side permanece sem rota de renderização backend.
- [x] Zoom e Centralizar invalidam o resultado quando alteram o estado.
- [x] Um blob gerado antes de uma mutação não pode aparecer no `resultCard`.
- [x] Todos os pontos de exibição do blob passam pela validação de versão.
- [x] Os 13 casos WYSIWYG continuam passando.
- [x] A regressão de zoom durante exportação confirma `resultCard.hidden === true` e ausência de `resultImage.src`.
- [x] Não há TODO, stub ou implementação parcial introduzidos neste ciclo.

## Testes executados

- `python tests/verify_migration.py`
- `node tests/run.js` com servidor estático local em `127.0.0.1:8000`.
- A suíte cobre 13 casos WYSIWYG, orientação EXIF, ausência de chamadas `/api/` e a corrida de exportação com zoom.

## Arquivos alterados neste ciclo

- `static/js/editor.js` — separação da limpeza do resultado e validação de versão no ponto de exibição.
- `tests/harness.js` — regressão com resultado anterior visível e `toBlob()` atrasado.
- `tests/run.js` — execução da regressão de exportação junto à matriz WYSIWYG.
- `tests/verify_migration.py` — contrato estrutural para a barreira de versão.
- `CODEX_HANDOFF.md` — este handoff técnico.
