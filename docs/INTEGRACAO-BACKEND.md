# SkillMatch: backend, busca de vagas e integrações

## Estado desta implementação

O projeto preserva o frontend e os serviços demonstrativos preexistentes. Foi acrescentado `backend/`, uma API Express/MySQL separada. O backend não foi inicializado contra um banco real nesta sessão, porque não há serviço/credenciais MySQL nem provedor externo configurados. Os testes do frontend não são testes de integração da API.

O cliente de rede público lê a meta tag `skillmatch-api-base` somente na página inicial e tenta `GET /api/jobs` quando ela contém uma URL. As operações autenticadas nas telas continuam usando demonstração local; apenas apontar a meta tag **não migra** cadastro/login, perfil, candidaturas, empresa ou administração para o banco.

O cadastro empresarial do frontend exige CNPJ e verifica o formato e os dígitos verificadores (incluindo o formato alfanumérico), tanto na validação da interface quanto no serviço local. O dado fica no armazenamento demonstrativo do navegador. Essa validação matemática **não consulta a Receita Federal** e não confirma existência, situação cadastral, titularidade nem regularidade. A API também valida e aplica unicidade ao CNPJ, mas não realiza verificação oficial.

## Rotas já implementadas

| Método | Rota | Acesso | Comportamento |
|---|---|---|---|
| `GET` | `/api/health` | Público | Verifica conectividade com MySQL sem revelar detalhes internos |
| `POST` | `/api/auth/register` | Público, limitado | Cadastro candidato/empresa, validação Zod (incluindo dígitos verificadores e unicidade do CNPJ empresarial) e hash bcrypt |
| `POST` | `/api/auth/login` | Público, limitado | Verificação bcrypt, estado da conta e JWT HS256 |
| `GET` | `/api/auth/me` | JWT válido | Retorna identidade pública |
| `GET` | `/api/jobs` | Público | Anúncios ativos `confirmed`/`unverified`; preserva status e fonte |
| `POST` | `/api/jobs/discovery/search` | Candidato autenticado | Executa busca apenas pelo provedor configurado e persiste os resultados |
| `POST` | `/api/jobs/:jobId/applications` | Candidato autenticado | Registra interesse uma única vez e somente para anúncio ativo |
| `GET` | `/api/jobs/applications/mine` | Candidato autenticado | Lista as candidaturas do próprio usuário |

A API inicial ainda não implementa gestão empresarial completa de anúncios e candidaturas, operações administrativas, autenticação por cookie, verificação de e-mail, reset por e-mail, rotas completas de perfil/currículo, notificações, Google Maps, IA, auditoria ou processo de denúncias. As ações equivalentes existentes no painel frontend continuam locais e demonstrativas.

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

Para bancos já existentes criados antes do campo CNPJ, aplique uma única vez `sql/migrations/001_company_cnpj.sql` em vez de recriar o schema. Os registros empresariais antigos permanecem sem CNPJ (`NULL`) até revisão; novos cadastros pela API exigem um CNPJ válido e único. Em banco novo, `sql/schema.sql` já cria a coluna obrigatória.

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

## Segurança e implantação ainda necessárias

- Configure sessão por cookie `HttpOnly`, `Secure`, `SameSite` e proteção CSRF, ou trate o JWT atual apenas como scaffold (o token em armazenamento acessível ao JS é vulnerável a XSS).
- Provisionamento de `admin` deve ser manual/controlado; o endpoint de registro público não permite administrador. Adicione MFA, política de menor privilégio e trilha de auditoria antes de painel operacional.
- Implementar validação/verificação de empresas, revisão humana, denúncias e decisões de publicação.
- Implementar propriedade do recurso para todas as rotas futuras, paginação, limites, proteção de arquivos/currículos e política de retenção/exclusão.
- Configurar serviço de busca autorizado, teste de disponibilidade, observabilidade e limite de custo. A chave nunca vai ao frontend.
- Google Maps/alternativa: geocodificação precisa e distância/rota devem ser solicitadas pelo backend, com chaves restritas, consentimento, cache e cota. O Radar demonstrativo aceita endereço de referência sem enviá-lo a terceiros, mas só reconhece sete cidades do Paraná e estima a distância em linha reta entre centros urbanos; não calcula rua, CEP ou rota. Endereço não reconhecido não aplica o raio, e a interface avisa isso.
- IA: não conectada. Um serviço futuro deve explicar sinais e lacunas, evitar inferir atributos sensíveis, permitir revisão e nunca apresentar percentual como chance de contratação. A compatibilidade do protótipo é regra determinística local.
- Criar testes de integração com MySQL/API simulada e testes de autorização (candidato não lê outro currículo, empresa não altera vaga alheia, admin isolado) antes da publicação.

## Modelo de dados

`backend/sql/schema.sql` cria `users`, `candidate_profiles`, `companies`, `jobs` e `applications` com relações, status, unicidade de candidatura e chave de deduplicação. A tabela `companies` guarda o CNPJ normalizado (14 caracteres alfanuméricos, único); a verificação aritmética não é consulta oficial. Bancos existentes podem usar `sql/migrations/001_company_cnpj.sql`. As migrações para produção devem ser versionadas, testadas e aplicadas com backup. Dados reais de candidatos exigem controles de privacidade, acesso restrito e política LGPD revisada.
