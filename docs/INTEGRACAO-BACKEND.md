# SkillMatch: backend, busca de vagas e integrações

## Estado desta implementação

O projeto preserva o frontend e os serviços demonstrativos preexistentes. Foi acrescentado `backend/`, uma API Express/MySQL separada. O backend não foi inicializado contra um banco real nesta sessão, porque não há serviço/credenciais MySQL nem provedor externo configurados. Há testes unitários com provedor de IA simulado, mas não testes de integração HTTP/MySQL.

O cliente de rede público lê a meta tag `skillmatch-api-base` somente na página inicial e tenta `GET /api/jobs` quando ela contém uma URL. As operações autenticadas nas telas continuam usando demonstração local; apenas apontar a meta tag **não migra** cadastro/login, perfil, candidaturas, empresa ou administração para o banco.

O cadastro empresarial do frontend exige CNPJ e verifica o formato e os dígitos verificadores (incluindo o formato alfanumérico), tanto na validação da interface quanto no serviço local. O dado fica no armazenamento demonstrativo do navegador. Essa validação matemática **não consulta a Receita Federal** e não confirma existência, situação cadastral, titularidade nem regularidade. A API também valida e aplica unicidade ao CNPJ, mas não realiza verificação oficial.

## Rotas já implementadas

| Método | Rota | Acesso | Comportamento |
|---|---|---|---|
| `GET` | `/api/health` | Público | Verifica conectividade com MySQL sem revelar detalhes internos |
| `POST` | `/api/auth/register`, `/api/auth/login` | Público, limitado | Cadastro/login, CNPJ único e matematicamente válido para empresa, hash bcrypt e JWT HS256 |
| `GET` | `/api/auth/me` | JWT ativo | Retorna identidade pública; middleware confere no banco o status e o papel atual em cada chamada autenticada |
| `GET`, `PATCH` | `/api/auth/profile` | Candidato autenticado | Lê/atualiza o perfil profissional e preferência de visibilidade, privada por padrão |
| `GET` | `/api/jobs` | Público | Anúncios ativos `confirmed`/`unverified`; preserva status e fonte |
| `GET` | `/api/companies` | Público | Diretório de empresas ativas cuja revisão está registrada (`verified_at`) |
| `GET` | `/api/companies/mine` | Empresa autenticada | Lê o próprio perfil empresarial |
| `POST` | `/api/jobs/discovery/search` | Candidato autenticado | Executa busca somente pelo provedor configurado e persiste resultados |
| `POST`, `GET` | `/api/jobs/:jobId/applications`, `/api/jobs/applications/mine` | Candidato autenticado | Registra interesse uma vez em anúncio ativo e lista as candidaturas próprias |
| `GET`, `POST` | `/api/connections` | Candidato ou empresa | Lista conexões próprias; candidato pode iniciar uma conversa e empresa verificada pode enviar convite a candidato visível |
| `PATCH` | `/api/connections/:connectionId` | Participante autenticado | Aceita/recusa convite pendente ou bloqueia a conexão |
| `GET`, `POST` | `/api/connections/:connectionId/messages` | Participante autenticado | Lê histórico e envia mensagens apenas após conexão aceita |
| `GET` | `/api/talents`, `/api/talents/saved`, `/api/talents/:candidateId` | Empresa verificada | Busca perfis com opt-in, vê lista salva e consulta perfil autorizado; contato não é exposto sem consentimento e conexão/candidatura |
| `POST`, `DELETE` | `/api/talents/:candidateId/saved` | Empresa verificada | Salva/remove perfil visível da lista empresarial |
| `GET`, `POST`, `PATCH` | `/api/notifications`, `/api/notifications/read-all`, `/api/notifications/:id/read` | Conta autenticada | Lista, marca todas ou marca uma notificação própria como lida |
| `GET`, `POST` | `/api/interviews/mine`, `/api/interviews/feedback` | Candidato autenticado | Histórico próprio; análise opcional através de IA externa, com consentimento explícito, validação do retorno e rate limit |

A API ainda não implementa gestão empresarial completa de anúncios e candidaturas, provisionamento operacional/verificação de empresas, operações administrativas, notificações automáticas para todos os eventos, autenticação por cookie, verificação/reset por e-mail, auditoria, recuperação/exclusão de conta ou processo persistente de denúncias. Empresas só conseguem usar rotas de talentos/conexões se `verified_at` já tiver sido preenchido por um processo administrativo que ainda não existe. As ações equivalentes do painel frontend continuam locais e demonstrativas.

## Inicialização e configuração

```bash
cd backend
cp .env.example .env
# Defina JWT_SECRET (mínimo 32 caracteres aleatórios), credenciais SQL e FRONTEND_ORIGIN.
npm ci
mysql -u root -p < sql/schema.sql
npm start
```

Use Node.js 20+, MySQL 8+, HTTPS em produção, um usuário SQL restrito e cofre/variáveis do host para segredos. Não publique `.env`. Configure `FRONTEND_ORIGIN` para a origem exata do GitHub Pages/domínio (a lista pode conter origens separadas por vírgula). GitHub Pages não executa Express, MySQL, chaves ou tarefas agendadas.

Para banco anterior à coluna CNPJ, aplique uma única vez `sql/migrations/001_company_cnpj.sql` e depois `sql/migrations/002_connections_interviews.sql`. Se CNPJ já foi migrado, aplique somente a 002. Não reaplique migrações nem recrie o schema sobre dados existentes. A migração 002 define a visibilidade como privada, revoga consentimentos implícitos do esquema anterior (perfis precisam de novo opt-in), registra o horário do consentimento e cria tabelas de favoritos, talentos salvos, conexões, mensagens, notificações e sessões de entrevista. Registros empresariais antigos permanecem sem CNPJ (`NULL`) até revisão; novos cadastros pela API exigem um CNPJ válido e único. Em banco novo, `sql/schema.sql` contém a estrutura atual. Faça backup e valide as migrações em ambiente de teste antes de produção.

## Provedor autorizado de pesquisa

Configure `SEARCH_PROVIDER_URL` e `SEARCH_PROVIDER_TOKEN` **somente no servidor**. O serviço configurado deve aceitar `POST` com Bearer token e JSON semelhante a:

```json
{
  "location": { "city": "Araucária", "state": "PR", "radiusKm": 10 },
  "query": ["administração"],
  "categories": ["primeiro emprego", "jovem aprendiz", "estágio", "sem experiência"]
}
```

E retornar `{ "results": [...] }` com objetos estruturados contendo `companyName`, `title`, `description`, `city`, `state`, `requirements`, `education`, `employmentType`, `modality`, `sourceName`, `sourceUrl`, `publishedAt`, `availability`, `verifiedAt`, `expiresAt` e `externalId` (campos opcionais ausentes não são inventados). `sourceUrl` HTTP/HTTPS original é obrigatório para persistir; URLs inseguras são descartadas. `expiresAt` é opcional e, quando ausente, o registro recebe janela de exibição de 14 dias renovada apenas se for reencontrado numa sincronização. O provedor deve ter autorização/termos adequados para consultar suas fontes.

A integração **não** acessa resultados HTML do Google nem ignora robots, limites ou termos de uso. Se o serviço não estiver configurado, a rota responde `503`. O backend marca `confirmed` somente quando a fonte contratada devolve `availability: "active"` e `verifiedAt` junto a um link válido; sem isso mantém `unverified`. `availability: "closed"` é armazenado como `possibly_closed` e não aparece no catálogo público. O sistema preserva fonte, URL e data de verificação retornada pelo fornecedor. Essa verificação é tão confiável quanto o processo do provedor; produção deve auditar amostras e tratar links quebrados.

`DISCOVERY_CITIES` aceita uma lista como `Curitiba:PR,Araucaria:PR`. `DISCOVERY_CRON` permite agendar sincronização (padrão `0 7 * * *`, horário `America/Sao_Paulo`). O agendador só inicia quando cidades e provedor autorizado estão configurados. A deduplicação usa hash de nome da empresa, cargo e localidade. Ajuste a regra conforme fontes e anúncios reais, pois diferenças de grafia podem exigir normalização/registro de identificador externo.

## Conectar o catálogo estático

Edite no `index.html`:

```html
<meta name="skillmatch-api-base" content="https://api.exemplo.com">
```

O frontend faz `GET /api/jobs`. O backend deve responder `{"jobs": [...]}`. CORS precisa permitir a origem do frontend. A página exibe apenas os dados recebidos e status enviados pelo backend; falha de rede mostra aviso e os dados de demonstração locais. Esta configuração **não liga autenticação, candidatura, painel, Radar ou dados de perfil** à API.

Para completar essa migração, criar um serviço de sessão HTTPOnly/CSRF, adaptar `AuthService`, `UserService` e `PlatformService`, substituir cada operação local por endpoints, definir tratamento offline e testes de contrato, e impedir que dados locais de demonstração se confundam com contas reais. Não copie as credenciais públicas de demonstração para o banco.

## Testes disponíveis

```bash
cd backend
npm ci
npm test
```

Há cinco testes unitários que verificam consentimento explícito e o serviço `interview-ai` com provedor simulado: não configurado, resposta válida, conteúdo malformado e HTTPS obrigatório em produção. Os testes não sobem o servidor HTTP nem conectam MySQL. Na raiz do repositório, `npm test` cobre os fluxos demonstrativos de navegador. Ambos não substituem testes de integração com banco, segurança e navegadores reais.

## Segurança e implantação ainda necessárias

- Configure sessão por cookie `HttpOnly`, `Secure`, `SameSite` e proteção CSRF, ou trate o JWT atual apenas como scaffold (o token em armazenamento acessível ao JS é vulnerável a XSS).
- Provisionamento de `admin` deve ser manual/controlado; o endpoint de registro público não permite administrador. Adicione MFA, política de menor privilégio e trilha de auditoria antes de painel operacional.
- Implementar validação/verificação de empresas, revisão humana, denúncias e decisões de publicação.
- Implementar propriedade do recurso para todas as rotas futuras, paginação, limites, proteção de arquivos/currículos e política de retenção/exclusão.
- Configurar serviço de busca autorizado, teste de disponibilidade, observabilidade e limite de custo. A chave nunca vai ao frontend.
- Google Maps/alternativa: geocodificação precisa e distância/rota devem ser solicitadas pelo backend, com chaves restritas, consentimento, cache e cota. O Radar demonstrativo aceita endereço de referência sem enviá-lo a terceiros, mas só reconhece sete cidades do Paraná e estima a distância em linha reta entre centros urbanos; não calcula rua, CEP ou rota. Endereço não reconhecido não aplica o raio, e a interface avisa isso.
- IA: `/api/interviews/feedback` é uma rota opcional de backend, ainda sem credenciais nem integração no painel. Exige `consentToExternalProcessing: true`, envia pergunta/resposta/habilidades ao endpoint configurado (`AI_PROVIDER_URL`, `AI_PROVIDER_TOKEN`, `AI_PROVIDER_MODEL`) e grava resposta/feedback e horário de consentimento. Sem configuração retorna `503`; rejeita HTTPS ausente em produção e valida o JSON do provedor. Testes usam um `fetch` simulado, não um provedor real. Antes de ativar, avaliar retenção, contrato, transferência internacional e política de dados do fornecedor. O treino atual do painel é exclusivamente local e determinístico; a compatibilidade também é regra local.
- Criar testes de integração com MySQL/API simulada e testes de autorização (candidato não lê outro currículo, empresa não altera vaga alheia, admin isolado) antes da publicação.

## Modelo de dados

`backend/sql/schema.sql` cria `users`, `candidate_profiles`, `companies`, `jobs`, `applications`, `candidate_favorites`, `company_saved_talents`, `connections`, `connection_messages`, `notifications` e `interview_sessions` com relações e restrições. Perfis ficam invisíveis por padrão; sessões de entrevista guardam resposta, feedback, provedor e horário de consentimento para processamento externo. `companies` guarda CNPJ normalizado (14 caracteres alfanuméricos, único); a validação aritmética não é consulta oficial. Bancos existentes usam as migrações 001 e 002, uma única vez e com backup. Dados reais de candidatos exigem controles de privacidade, acesso restrito e política LGPD revisada.
