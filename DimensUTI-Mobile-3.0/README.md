# DimensUTI Mobile 3.0

Aplicativo Mobile First para organização operacional de plantões de enfermagem sem identificação nominal de pacientes.

## Novidades
- Rodízio automático entre plantões.
- Regra de sucessão de leitos: exemplo 1 e 6 → 2 e 7.
- Pré-dimensionamento baseado no plantão anterior quando a equipe permanece compatível.
- Redistribuição inteligente quando houver desfalques ou remanejamentos.
- Busca rápida por leito.
- Modo escuro.
- Backup e restauração local.
- Histórico local.
- PWA instalável.

## Rodízio automático
Quando os mesmos técnicos permanecem na escala e existe um dimensionamento anterior compatível, o aplicativo avança ciclicamente os leitos atribuídos a cada técnico.

Se a composição da equipe mudar, o sistema não força o rodízio anterior: realiza uma nova sugestão equilibrando a carga operacional.

## Aviso importante
O índice operacional e o dimensionamento são recursos de apoio à organização do trabalho. Não substituem protocolos institucionais, normas profissionais, legislação aplicável ou julgamento clínico e gerencial.

## Publicação
Para colocar o aplicativo online gratuitamente, recomenda-se Cloudflare Pages ou GitHub Pages com HTTPS.
