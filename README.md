# SkillMatch

> **Seu primeiro emprego começa aqui.** Encontre oportunidades que combinam com você — explore antes de criar uma conta.

SkillMatch é uma plataforma de empregabilidade jovem construída sobre o projeto existente, com frontend estático, fluxos demonstrativos locais e uma API Express/MySQL preparada separadamente. A página pública agora é o catálogo; login e cadastro ficam em páginas próprias.

## Estado honesto do projeto

A página inicial mostra **quatro anúncios fictícios de demonstração** para exercitar pesquisa, filtros e detalhes. Não são vagas reais, empresas contratantes ou fontes externas. Nesta versão, o SkillMatch **não pesquisou na internet** e não confirma contratação. A interface não inventa links, salários, avaliação de usuários ou resultados de processo seletivo.

A experiência pública oferece busca por cargo/área e cidade, filtros de tipo, ordenação, detalhes da oportunidade, aviso de status demonstrativo, seção de empresas associadas aos exemplos, e convite para criar conta ao tentar salvar ou se candidatar. O fluxo de candidatura é explicativo: não envia dados para uma empresa.

Candidato, empresa e administração mantêm os fluxos de cadastro/login/painel que já existiam. No frontend publicado, esses fluxos continuam **demonstrativos e limitados ao navegador** (`localStorage`/`sessionStorage`). Nunca use senha reutilizada, dados sensíveis ou esse modo como autenticação de produção. O painel administrativo e os perfis de demonstração não são protegidos contra alteração pelo proprietário do navegador.

## O que funciona agora

- **Página pública (`index.html`)**: busca e filtro por cargo, empresa, requisito, cidade/UF e tipo; ordenação; detalhes e estados transparentes; menu responsivo; redirecionamento para cadastro/login ao tentar salvar/candidatar-se.
- **Cadastro/login demonstrativos**: validação, senha derivada localmente, editar perfil, foto, cursos, experiências, interesses, disponibilidade e preferências; recuperação de senha gera código local e não envia e-mail.
- **Painel do candidato**: início, vagas, Radar, candidaturas locais, currículo imprimível/exportável pela impressão do navegador, perfil, cursos/planejamento, notificações e configurações.
- **Radar local**: endereço de referência, cidade/UF, bairro/região, raio, tipo, área e modalidade são filtros persistidos neste navegador. O endereço é analisado localmente e reconhece sete centros urbanos do Paraná; o raio usa distância aproximada em linha reta entre centros, não o ponto exato da rua nem rota. Endereço não reconhecido deixa o raio sem aplicação, com aviso visível. Nenhum geocodificador externo ou mapa está conectado.
- **Compatibilidade demonstrativa**: serviço local explica correspondência de habilidades, área, tipo, localização e escolaridade (incluindo nível e “em curso/concluído”). Sugestões podem variar diariamente e excluem oportunidades com interesse já registrado; o percentual não é IA nem chance de contratação.
- **Empresa demonstrativa**: cadastro empresarial (`cadastro-empresa.html`) com validação dos dígitos verificadores do CNPJ (inclui formato alfanumérico), login, perfil, publicação/edição/pausa de vagas, consulta de candidaturas e alteração de status. CNPJ é armazenado localmente no modo demo; validar seus dígitos não confirma existência, situação cadastral nem titularidade. **Admin demonstrativo**: moderação, cadastros e relatos locais. Esses dados ficam no navegador e não são compartilhados; nenhuma vaga da conta de teste é divulgada como contratação real.
- **API inicial (`backend/`)**: autenticação com bcrypt/JWT no servidor, validação, CORS, rate limit, consultas parametrizadas, API pública de vagas, candidatura autenticada, provedor de busca estruturado autorizado e agendamento opcional. Ela **não foi conectada às telas autenticadas do frontend**, nem testada com MySQL ou credenciais externas nesta sessão.

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

São contas públicas fictícias, criadas no navegador. Não são credenciais de produção.

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

Se o banco já existia antes da coluna CNPJ, aplique uma vez `sql/migrations/001_company_cnpj.sql` (no diretório `backend/`) em vez de recriar o schema. A API escuta em `0.0.0.0:3000`. Verifique `GET /api/health`; serviços MySQL precisam estar disponíveis. Configure usuário MySQL com privilégios mínimos, HTTPS e segredos no gerenciador de variáveis do provedor de hospedagem — não publique `.env`.

Rotas atualmente implementadas:

- `POST /api/auth/register` e `/api/auth/login`; candidato ou empresa. Cadastro empresarial valida e exige CNPJ único (somente dígitos verificadores; sem consulta à Receita Federal). Senhas são armazenadas com bcrypt e sessões retornam JWT curto.
- `GET /api/auth/me` autenticada.
- `GET /api/jobs` para oportunidades ativas elegíveis, com status e origem.
- `POST /api/jobs/discovery/search` para candidato autenticado, usando somente o provedor autorizado configurado.
- `POST /api/jobs/:jobId/applications` e `GET /api/jobs/applications/mine` para candidatura/histórico.
- `GET /api/health`.

Essa API é um ponto de partida, não uma implantação completa do produto: faltam, entre outros, administração operacional, gestão empresarial completa, revisão humana de fontes, recuperação por e-mail, sessão em cookie/CSRF, trilha de auditoria, integração de mapas, serviço de IA e integração do frontend autenticado. O cadastro de administrador deve ser provisionado fora da rota pública e protegido operacionalmente.

### Ligar o catálogo público à API

Depois de publicar a API com CORS restrito ao domínio real do frontend, edite a meta tag em `index.html`:

```html
<meta name="skillmatch-api-base" content="https://api.seudominio.com">
```

Somente o catálogo público (`GET /api/jobs`) usa essa URL atualmente. Se a conexão falhar, a página informa o erro e volta a exibir apenas dados demonstrativos. **Login, perfil, candidatura e painéis ainda usam armazenamento local** até serem migrados e testados para o backend. A URL pública não é segredo; não inclua chaves/token de provedor nela.

### Busca externa e atualização periódica

Configure `SEARCH_PROVIDER_URL` e `SEARCH_PROVIDER_TOKEN` **no backend** com um fornecedor/API que autorize pesquisas e devolva resultados estruturados. O contrato esperado e os campos estão em [`docs/INTEGRACAO-BACKEND.md`](docs/INTEGRACAO-BACKEND.md). A aplicação não faz scraping de resultados do Google. Sem provedor, a rota devolve `503` e a interface não finge ter pesquisado.

Para habilitar a sincronização programada, configure `DISCOVERY_CITIES=Curitiba:PR,Araucaria:PR` e `DISCOVERY_CRON` (cron timezone `America/Sao_Paulo`). A rotina só ativa quando URL e token do provedor também existem. Duplicatas são agrupadas por empresa/cargo/localidade; resultados sem confirmação mantêm status `unverified`; registros que o provedor declara encerrados viram `possibly_closed`. A veracidade depende do contrato e da qualidade do serviço externo, e a fonte original é preservada.

Não há integração com Google Maps, Google Search API ou API de IA ativada. Nenhuma chave fica no código público.

## Testes

```bash
npm ci
npm test
```

Os testes automatizados cobrem cadastro/login/recuperação, validação de CNPJ (incluindo dígitos inválidos), fluxos de perfil, painel, vagas, Radar, empresas/admin e navegação, além de busca/filtro/modal da página pública, compatibilidade de habilidades/escolaridade, variação de recomendações e distâncias do Radar. São testes Node/JSDOM, não equivalem a teste visual em navegadores/dispositivos nem validam serviço MySQL real. Nesta sessão: **24 testes passaram**. A sintaxe dos módulos do backend foi verificada e `npm audit` do backend não reportou vulnerabilidades após atualizar as dependências.

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
