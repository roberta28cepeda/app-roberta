# Minha Vida — PWA pessoal

Este pacote transforma o app financeiro enviado em um organizador pessoal para celular e tablet. A interface é um PWA estático; o login e a sincronização entre aparelhos usam Firebase Authentication e Cloud Firestore, serviços do Google. O app não exige que você mantenha um servidor próprio.

**Importante:** o código está pronto, mas ainda não foi conectado a uma conta/projeto Firebase nem publicado. Sem essa etapa, ele funciona apenas em modo local neste navegador e não sincroniza com outros aparelhos.

## O que o aplicativo inclui

- **Finanças:** navegação entre meses; despesas e recebimentos; saldo (recebido menos gasto); limite mensal e valor livre depois das parcelas previstas; pesquisa e filtros; categorias personalizadas; gráficos por categoria e por mês; dicas de economia; CSV.
- **Parcelamentos automáticos:** ao lançar uma compra parcelada, o app cria uma parcela por mês até o total informado. Cada mês aparece como prevista ou paga. Marcar uma parcela como paga não exige criar outro lançamento. Editar o plano atualiza a sequência; excluir o plano remove as parcelas dos meses associados.
- **Planner:** diário por data, tarefas, planos pessoais, calendário mensal, lista de compras/desejos com notas, preço opcional e até três prints comprimidos por item, lista de livros com status/progresso e lista de reposição do próximo mês.
- **Academia, metas e avisos locais** para tarefas vencidas, prazos de metas e rotina de treino, quando a pessoa autoriza notificações no aparelho.
- Os prints são reduzidos no aparelho e anexados ao item privado no Firestore; o pacote não depende de Firebase Storage. As regras do Firestore limitam os documentos à conta autenticada.
- As regras em `firestore.rules` isolam os dados pelo UID Google. O service worker não coloca respostas privadas do Firestore em cache.

Os avisos são verificados quando o app está aberto; este pacote não agenda notificações push para quando o app estiver fechado.

## Trazer os gastos do aplicativo anterior

1. No aplicativo antigo, exporte um arquivo CSV.
2. No Minha Vida, abra **Gastos → Importar gastos** e escolha esse arquivo.
3. A importação entende o formato enviado, preserva as despesas e os dados de parcela da planilha, cria categorias que faltarem e ignora registros duplicados ou inválidos.

O armazenamento local antigo não pode ser copiado automaticamente entre endereços. O CSV antigo não contém o limite mensal, então informe novamente o limite em cada mês. Parcelas importadas aparecem como lançamentos antigos; quando você editar e salvar um lançamento parcelado, poderá convertê-lo em um plano que cria as próximas parcelas automaticamente. Recebimentos podem ser importados/exportados no CSV da nova versão. O CSV é uma exportação de lançamentos e não recria sozinho metas pessoais, planos automáticos ou prints anexados.

## Usar em mais de um aparelho

É necessário configurar uma vez um projeto Firebase Google e publicar o endereço HTTPS do app no Firebase Hosting. Em seguida, entre com a mesma conta Google em cada aparelho.

Você comentou que só tem celular/tablet: **os comandos de terminal abaixo não são executáveis diretamente no Safari/Chrome móvel**. Por isso, não tente rodá-los no celular. Para concluir a publicação, será necessário um computador ou uma sessão guiada de configuração/autenticação; o ZIP, sozinho, ainda não faz login nem sincroniza. Nenhuma senha deve ser enviada por mensagem.

### Pré-requisitos de configuração no Firebase

1. No Firebase Console, crie um projeto e cadastre um app Web; copie os valores `apiKey`, `authDomain`, `projectId` e `appId` do SDK Web.
2. Em **Authentication → Sign-in method**, habilite **Google**. Para Safari móvel, mantenha o domínio padrão `SEU-PROJETO.firebaseapp.com` como domínio de autenticação.
3. Em **Firestore Database**, crie a base e publique as regras do arquivo `firestore.rules`. Não use regras abertas como `allow read, write: if true`.
4. Configure os quatro valores do SDK Web como variáveis `VITE_FIREBASE_*` antes de compilar. O `apiKey` do SDK Web não é uma credencial administrativa; as regras do Firestore são essenciais para a privacidade.

### Publicação por computador (opcional)

Em um computador com Node.js, na pasta do projeto e depois de preencher `.env.local` com os valores do Firebase:

```bash
corepack pnpm install
corepack pnpm build
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only hosting,firestore:rules
```

Escolha no `firebase use --add` o mesmo projeto configurado acima. Abra o endereço HTTPS padrão do Firebase Hosting. No iPhone/iPad, use o domínio de Hosting que termina em `firebaseapp.com` para o login por redirecionamento.

## Instalar depois da publicação

- **iPhone/iPad:** abra o endereço HTTPS no Safari, toque em **Compartilhar → Adicionar à Tela de Início**, ative **Abrir como App Web** e toque em **Adicionar**.
- **Android:** abra o endereço no Chrome, toque no menu e escolha **Instalar app** ou **Adicionar à tela inicial**.

Repita a instalação em cada aparelho e entre com a mesma conta Google.

## Privacidade e custos

Firebase é infraestrutura gerenciada pelo Google; o uso está sujeito aos limites e preços vigentes no Console. Confira o plano antes de ativar recursos adicionais. Não publique o banco com regras abertas e não coloque credenciais administrativas ou chaves de conta de serviço no frontend.
