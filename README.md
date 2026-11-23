# SkillMatch

> **Suas habilidades. Sua oportunidade.** Encontre oportunidades que combinam com você — explore antes de criar uma conta.

SkillMatch é uma plataforma de empregabilidade jovem construída sobre o projeto existente, com frontend estático, fluxos demonstrativos locais e uma API Express/MySQL preparada separadamente. A página pública agora é o catálogo; login e cadastro ficam em páginas próprias.

## Estado honesto do projeto

A página inicial mostra **quatro anúncios fictícios de demonstração** para exercitar pesquisa, filtros e detalhes. Não são vagas reais, empresas contratantes ou fontes externas. Nesta versão, o SkillMatch **não pesquisou na internet** e não confirma contratação. As faixas salariais dos exemplos são fictícias e identificadas como demonstrativas; não há links externos, avaliações de usuários ou resultados de processos seletivos inventados.

A experiência pública oferece busca por cargo/área e cidade, filtros de tipo, ordenação, detalhes da oportunidade, faixas salariais explicitamente demonstrativas, aviso de status, seção de empresas associadas aos exemplos e convite para criar conta ao tentar salvar ou se candidatar. O fluxo de candidatura é explicativo: não envia dados para uma empresa.

Candidato, empresa e administração mantêm os fluxos de cadastro/login/painel que já existiam. No frontend publicado, esses fluxos continuam **demonstrativos e limitados ao navegador** (`localStorage`/`sessionStorage`). Nunca use senha reutilizada, dados sensíveis ou esse modo como autenticação de produção. O painel administrativo e os perfis de demonstração não são protegidos contra alteração pelo proprietário do navegador.

## O que funciona agora

- **Página pública (`index.html`)**: busca e filtro por cargo, empresa, requisito, cidade/UF e tipo; ordenação; faixas salariais somente demonstrativas; detalhes e estados transparentes; menu responsivo; redirecionamento para cadastro/login ao tentar salvar/candidatar-se.
- **Cadastro/login demonstrativos**: validação, senha derivada localmente, edição de perfil, foto, cursos, experiências, interesses, disponibilidade e preferências; recuperação de senha gera código local e não envia e-mail.
- **Painel do candidato**: início, vagas com filtro por remuneração e ordenação, Radar, candidaturas locais, currículo imprimível/exportável pela impressão do navegador, perfil, cursos/planejamento, notificações e configurações.
- **Novos fluxos locais de engajamento**: favoritos; prática de entrevista contextual com respostas em texto, feedback acolhedor baseado em regras locais e histórico apagável; ditado opcional apenas quando o navegador oferece reconhecimento de fala. A prática do painel não usa IA nem decide aptidão.
- **Conexões e entrevistas demonstrativas**: diretório, apresentações e convites locais; mensagem só após aceite; empresas podem agendar entrevistas para candidaturas ativas, com data, formato, local/link e resposta aceitar/recusar; ambas as partes veem o histórico e a empresa pode cancelar. Tudo fica no navegador: não envia e-mail, cria videochamada ou agenda evento real. Também há bloqueio e denúncia. A exclusão da conta remove no navegador os dados associados e encerra a sessão. Candidato controla visibilidade; perfis começam ocultos até consentimento explícito. Contato fica oculto sem conexão autorizada ou candidatura e continua sujeito à preferência de privacidade. Nada é enviado a empresas reais.
- **Banco de talentos local**: filtros por habilidade, escolaridade e cidade, lista salva pela empresa e consulta restrita aos perfis que autorizaram visibilidade. São dados de teste no navegador, não um serviço real.
- **Radar local**: endereço de referência, cidade/UF, bairro/região, raio, tipo, área e modalidade são filtros persistidos neste navegador. O endereço é analisado localmente e reconhece sete centros urbanos do Paraná; o raio usa distância aproximada em linha reta entre centros, não o ponto exato da rua nem rota. Endereço não reconhecido deixa o raio sem aplicação, com aviso visível. Nenhum geocodificador externo ou mapa está conectado.
- **Compatibilidade demonstrativa**: serviço local explica correspondência de habilidades, área, tipo, localização e escolaridade (incluindo nível e “em curso/concluído”). Sugestões podem variar diariamente e excluem oportunidades com interesse já registrado; o percentual não é IA nem chance de contratação.
- **Empresa demonstrativa**: cadastro empresarial (`cadastro-empresa.html`) com validação dos dígitos verificadores do CNPJ (inclui formato alfanumérico), login, perfil, publicação/edição/pausa de vagas com faixa salarial opcional, consulta de candidaturas, histórico e painel do funil. CNPJ é armazenado localmente no modo demo; validar seus dígitos não confirma existência, situação cadastral nem titularidade. **Admin demonstrativo**: moderação, cadastros e relatos locais. Esses dados ficam no navegador e não são compartilhados; nenhuma vaga da conta de teste é divulgada como contratação real.
- **API (`backend/`)**: autenticação com bcrypt/JWT, verificação do estado da conta nas requisições autenticadas, perfil/consentimento, candidaturas, conexões/mensagens autorizadas, banco de talentos e rota opcional de feedback por IA. Vagas, mensagens e perfis do painel visual ainda usam dados locais: **as telas autenticadas não foram conectadas a essas rotas**, e MySQL/credenciais externas não foram configurados nem testados.

## Executar o frontend estático

Requer Python 3 ou qualquer servidor HTTP estático:

```bash
python3 -m http.server 5173
```

Abra `http://localhost:5173`. A rota inicial é `index.html`; acesso/login fica em `login.html`. O projeto pode ser publicado no GitHub Pages sem etapa de build. Módulos ES não funcionam ao abrir os arquivos via `file://`.

### Contas de demonstração

| Área | E-mail | Senha |
|---|---|---|
| Candidato | `demo@skillmatch.com` | `Skill@123` |
| Empresa | `empresa@skillmatch.com` | `Skill@123` |
| Administração | `admin@skillmatch.com` | `Admin@123` |

São contas públicas fictícias, criadas no navegador. Não são credenciais de produção. Para um passo a passo de apresentação com essas contas, consulte o [roteiro rápido](docs/ROTEIRO-APRESENTACAO.md).

## API separada (opcional)

Requer Node.js 20+, MySQL 8 e um ambiente de servidor próprio. **Não rode o backend no GitHub Pages.**

```bash
cd backend
cp .env.example .env
# Edite .env: configure segredo JWT forte, banco e origem autorizada do frontend.
npm ci
mysql -u root -p < sql/schema.sql
npm start
```

Para banco novo, `sql/schema.sql` cria a estrutura atual. Em banco que ainda não tem a coluna CNPJ, aplique **uma vez e nesta ordem** `sql/migrations/001_company_cnpj.sql` e `sql/migrations/002_connections_interviews.sql`; se o CNPJ já existe, aplique somente a migração 002. Não reaplique migrações nem use o schema-base sobre dados existentes. A migração 002 muda a visibilidade para privada, revoga o padrão permissivo legado (exigindo novo opt-in) e cria tabelas de favoritos, conexões, mensagens, notificações e entrevistas. Revise/backupeie antes de executar em produção. A API escuta em `0.0.0.0:3000`. Verifique `GET /api/health`; serviços MySQL precisam estar disponíveis. Configure usuário MySQL com privilégios mínimos, HTTPS e segredos no gerenciador de variáveis do provedor de hospedagem — não publique `.env`.

Rotas atualmente implementadas (servidor/API, não ligadas ao painel autenticado):

- `POST /api/auth/register` e `/api/auth/login`; candidato ou empresa. Cadastro empresarial valida e exige CNPJ único (dígitos verificadores, sem consulta à Receita Federal). Senhas usam bcrypt; sessões retornam JWT curto.
- `GET /api/auth/me`; `GET /api/auth/profile` e `PATCH /api/auth/profile` para perfil próprio de candidato e consentimento `visibility` (privado por padrão).
- `GET /api/jobs`, `POST /api/jobs/discovery/search`, `POST /api/jobs/:jobId/applications` e `GET /api/jobs/applications/mine`.
- `GET /api/companies` lista empresas ativas com verificação registrada; `GET /api/companies/mine` retorna o perfil empresarial do titular.
- `GET /api/connections`; `POST /api/connections` (candidato inicia conversa ou empresa envia convite); `PATCH /api/connections/:connectionId` para aceitar, recusar ou bloquear; `GET/POST /api/connections/:connectionId/messages`. Mensagens exigem conexão aceita; empresas precisam estar verificadas, e cada usuário só consulta conexões das quais participa.
- `GET /api/talents`, `GET /api/talents/saved`, `GET /api/talents/:candidateId`, `POST/DELETE /api/talents/:candidateId/saved`. Somente empresa verificada pode buscar; perfis exigem consentimento e contato não é retornado sem autorização.
- `GET /api/notifications`, `POST /api/notifications/read-all` e `PATCH /api/notifications/:id/read` para notificações da própria conta.
- `GET /api/interviews/mine` e `POST /api/interviews/feedback`. A rota exige `consentToExternalProcessing: true`; só chama um provedor Chat Completions compatível se `AI_PROVIDER_URL`, `AI_PROVIDER_TOKEN` e `AI_PROVIDER_MODEL` estiverem configurados. Sem configuração retorna `503`; a resposta do provedor passa por validação estruturada. Esta rota de backend **não está conectada ao treino do painel**, que continua baseado em regras locais.
- `GET /api/health`.

A API segue parcial: ainda faltam administração operacional/moderação/relatos, gestão empresarial completa e ciclo de vida de vagas, notificações para todos os eventos, recuperação de senha por e-mail, sessão em cookie/CSRF, trilha de auditoria, exclusão de conta pela API, integração das telas autenticadas e teste com MySQL real. O cadastro de administrador deve ser provisionado fora da rota pública e protegido operacionalmente. O uso de IA remota exige revisão de privacidade, retenção e termos do fornecedor antes de produção.

### Ligar o catálogo público à API

Depois de publicar a API com CORS restrito ao domínio real do frontend, edite a meta tag em `index.html`:

```html
<meta name="skillmatch-api-base" content="https://api.seudominio.com">
```

Somente o catálogo público (`GET /api/jobs`) usa essa URL atualmente. Se a conexão falhar, a página informa o erro e volta a exibir apenas dados demonstrativos. **Login, perfil, candidatura e painéis ainda usam armazenamento local** até serem migrados e testados para o backend. A URL pública não é segredo; não inclua chaves/token de provedor nela.

### Busca externa e atualização periódica

Configure `SEARCH_PROVIDER_URL` e `SEARCH_PROVIDER_TOKEN` **no backend** com um fornecedor/API que autorize pesquisas e devolva resultados estruturados. O contrato esperado e os campos estão em [`docs/INTEGRACAO-BACKEND.md`](docs/INTEGRACAO-BACKEND.md). A aplicação não faz scraping de resultados do Google. Sem provedor, a rota devolve `503` e a interface não finge ter pesquisado.

Para habilitar a sincronização programada, configure `DISCOVERY_CITIES=Curitiba:PR,Araucaria:PR` e `DISCOVERY_CRON` (cron timezone `America/Sao_Paulo`). A rotina só ativa quando URL e token do provedor também existem. Duplicatas são agrupadas por empresa/cargo/localidade; resultados sem confirmação mantêm status `unverified`; registros que o provedor declara encerrados viram `possibly_closed`. A veracidade depende do contrato e da qualidade do serviço externo, e a fonte original é preservada.

Não há integração com Google Maps ou Google Search API. A rota de IA é opcional, não configurada por padrão e não conectada ao painel; se habilitada, encaminha resposta e habilidades do candidato ao fornecedor após consentimento explícito. Nenhuma chave fica no código público.

## Testes

```bash
npm ci
npm test
```

Os testes de frontend cobrem cadastro/login/recuperação, CNPJ numérico/alfanumérico, painel e navegação, favoritos, consentimento de perfil, mensagens/convites, denúncia/bloqueio, histórico de entrevista, limpeza local de dados, empresa/admin, Radar e página pública. Rode `npm test` na raiz. No backend, `cd backend && npm test` verifica o consentimento exigido e o serviço de feedback IA com provedor simulado, ausência de configuração, formato inválido e HTTPS; não chama serviço externo. Nesta revisão: **26 testes do frontend e 5 do backend passaram**; `node --check` e `git diff --check` também passaram. `npm ci` no backend reportou 0 vulnerabilidades. JSDOM não é teste visual em navegadores/dispositivos, e nenhuma rota foi validada contra um MySQL real.

## Estrutura

```text
index.html                 # Página pública e catálogo
login.html                 # Login demonstrativo mantido separado
cadastro.html              # Cadastro demonstrativo de candidatos
cadastro-empresa.html       # Cadastro demonstrativo de empresas
painel.html / perfil.html  # Áreas candidatas, empresa e administração
assets/css/                # Design system, painel e página pública responsiva
assets/js/pages/landing.js # Busca pública, filtro e fluxo de cadastro
assets/js/services/        # Armazenamento local e contratos de API
backend/                   # Express, autenticação, schema SQL e busca autorizada
 docs/INTEGRACAO-BACKEND.md
 tests/                    # Fluxos de serviços, páginas e catálogo público
```

### Publicação

- **GitHub Pages:** publicar a raiz do repositório. O catálogo público funciona em modo demonstrativo sem backend.
- **API real:** publicar `backend/` separadamente, configurar `.env` no servidor, aplicar `backend/sql/schema.sql`, restringir CORS e então apontar a meta tag ao host HTTPS da API.
- Antes de operar com jovens/candidatos reais, implementar as rotas faltantes, revisar segurança e LGPD, política de retenção, verificação de empresas/fontes, denúncia/moderação, backups e suporte. O modo local atual não atende esses requisitos de produção.
