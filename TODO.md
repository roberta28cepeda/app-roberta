# Minha Vida — entregas

**Legenda:** `[x]` implementado e compilado; `[~]` parcial ou aguardando configuração externa; `[ ]` pendente.

## Instalação e navegação do PWA
- [x] Reunir o acompanhamento pessoal em um único aplicativo em português, com telas responsivas e confortáveis em celular e tablet.
- [~] Permitir instalar pela tela inicial, apresentar ícone próprio e abrir em modo independente de aplicativo, sem exigir publicação na App Store ou Play Store. O manifesto, ícones e service worker estão no pacote; falta publicar no endereço HTTPS final do Firebase.

## Conta Google, privacidade e sincronização
- [~] Permitir entrar com uma conta Google. O fluxo Firebase Auth está no app; falta configurar o provedor Google e os valores do projeto da usuária.
- [~] Restringir cada pessoa aos próprios dados privados. As regras Firestore estão em `firestore.rules`; falta implantá-las no projeto Firebase da usuária.
- [~] Sincronizar automaticamente gastos, recebimentos, limites mensais, metas, tarefas, planos, parcelas automáticas, anotações diárias, compras com prints, livros, itens de reposição e registros de academia entre celulares/tablets conectados à mesma conta Google. O suporte Firebase para todas as coleções está implementado; falta configurar e publicar o Firebase da usuária.
- [~] Usar serviços gerenciados pelo Google para interface e dados; não exigir que a usuária mantenha ou administre servidor próprio. A configuração de Hosting/Firestore está preparada, mas nenhum app foi publicado em uma conta Google.

## Controle financeiro completo
- [x] Preservar o controle financeiro do app anterior e acrescentar recebimentos: registrar o que foi gasto e o que ainda não foi gasto, parcelas, quanto ainda pode gastar no mês e quanto recebeu.
- [x] Permitir navegar entre meses e voltar ao mês atual; mostrar total gasto, quantidade de lançamentos, média e categoria de maior gasto do período analisado.
- [x] Permitir definir um limite de gastos para cada mês, mostrar progresso/percentual utilizado, quanto ainda pode gastar e quanto ultrapassou quando o limite for excedido.
- [x] Registrar, editar e excluir despesas com descrição, valor e data; guardar o valor de cada parcela, parcela atual e quantidade total, mostrar quantas parcelas ainda faltam e o valor restante estimado.
- [x] Ao registrar uma despesa parcelada, criar automaticamente uma parcela em cada mês da sequência, sem exigir que a pessoa cadastre manualmente cada parcela.
- [x] Exibir parcelas ainda não pagas como previstas, parcelas já pagas como pagas e descontar compromissos previstos do valor ainda livre no mês, sem somá-los como gasto efetivamente pago.
- [x] Permitir editar ou excluir o plano de parcelamento e refletir a alteração ou exclusão em todas as parcelas mensais associadas; permitir marcar cada parcela como paga ou desfazer essa marcação.
- [x] Registrar, editar e excluir recebimentos com descrição, origem, valor e data; somar o que foi recebido no mês escolhido.
- [x] Mostrar separadamente total recebido, total gasto, saldo do mês (recebido menos gasto) e restante do limite de gastos, sem confundir saldo com limite.
- [x] Permitir pesquisar lançamentos, filtrar por categoria e alternar entre mês selecionado e todos os períodos; mostrar o total visível do filtro.
- [x] Permitir criar categorias personalizadas e usá-las nos gastos, filtros e gráficos.
- [x] Mostrar distribuição de gastos por categoria com valores e percentuais, evolução de gastos mês a mês no ano e ideias para economizar relacionadas à categoria de maior gasto.
- [x] Exportar despesas para CSV e importar o CSV exportado pelo app anterior, preservando descrição, valor, data, categoria e informações de parcelas; exportar/importar recebimentos em CSV.

## Planner diário, calendário e listas pessoais
- [x] Oferecer uma área com aparência de planner limpo e fácil de entender, com lançamento rápido pelo celular/tablet.
- [x] Permitir escrever e consultar uma anotação/diário vinculada a cada dia.
- [x] Permitir manter uma lista do que a pessoa deseja comprar, com título, notas, preço opcional e prints/fotos anexados; permitir editar e excluir itens. Prints são comprimidos no aparelho e anexados ao item.
- [x] Permitir manter uma lista de livros para ler, em leitura e lidos, com progresso e notas.
- [x] Permitir listar itens que precisam ser repostos no próximo mês e marcar quando forem resolvidos.
- [x] Oferecer uma aba de calendário mensal para consultar tarefas, planos, metas com data, treinos e parcelas previstas/pagas.
- [x] Permitir cadastrar, acompanhar e atualizar objetivos pessoais.
- [x] Permitir organizar compromissos, ações e planejamentos pessoais em tarefas e planos.

## Rotina de academia
- [x] Permitir registrar e acompanhar a rotina de treinos, exercícios e sessões concluídas.

## Avisos pessoais
- [~] Permitir avisos relacionados a vencimentos, tarefas, metas ou horários de treino quando essas condições forem configuradas no aplicativo e a pessoa tiver concedido a permissão necessária. A versão preparada verifica os avisos quando o app está aberto; notificações push agendadas enquanto o app está fechado não foram configuradas.
