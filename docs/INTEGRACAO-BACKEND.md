# Integração futura — Node.js, Express e MySQL

## Situação atual

O repositório contém somente frontend estático. `APP_CONFIG.useApi` é `false`, `apiBaseUrl` está vazio e os serviços de demonstração escrevem em `localStorage`/`sessionStorage`. Não existe servidor, tabela MySQL, Google Maps, API de IA, serviço de e-mail ou provedor de vagas conectado.

O cliente em `assets/js/services/api.service.js` é um ponto inicial para chamadas HTTP, mas **não é uma API pronta**: cada operação de empresa, vaga, candidatura, anúncio, notificação e administração precisará de contrato e implementação no backend. Não basta alternar uma flag.

## Arquitetura sugerida

```text
server/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/database.js
│   ├── routes/ (auth, candidates, companies, jobs, applications, admin)
│   ├── controllers/
│   ├── services/ (matching, notifications, moderation, maps)
│   ├── repositories/ (queries parametrizadas)
│   ├── middlewares/ (session, authorization, validation, rate limiting)
│   └── utils/
├── migrations/
└── .env.example
```

Dependências podem incluir `express`, `mysql2`, `dotenv`, `helmet`, `cors`, `express-validator`, `bcrypt` ou Argon2, biblioteca de sessões/JWT e testes de integração. Segredos ficam em um cofre/variáveis do servidor, nunca no HTML, JavaScript servido ao navegador ou repositório.

## Endpoints sugeridos

| Método | Endpoint | Acesso | Uso |
|---|---|---|---|
| `POST` | `/api/auth/register` | Público | Criar candidato; validar e-mail, consentimento e senha no servidor |
| `POST` | `/api/auth/login` | Público | Autenticar e criar sessão segura |
| `POST` | `/api/auth/password/forgot` | Público, limitado | Iniciar recuperação por e-mail verificado, sem revelar se a conta existe |
| `POST` | `/api/auth/password/reset` | Público, token de uso único | Concluir recuperação |
| `POST` | `/api/auth/logout` | Autenticado | Encerrar sessão no servidor |
| `GET/PUT/DELETE` | `/api/candidates/me` | Candidato dono | Consultar, alterar e remover perfil |
| `GET/PUT` | `/api/companies/me` | Empresa dona | Consultar e editar dados empresariais |
| `GET` | `/api/jobs` | Público/autenticado | Lista aprovada, filtros e paginação |
| `GET/POST` | `/api/companies/me/jobs` | Empresa dona | Listar e publicar vaga |
| `GET/PUT/DELETE` | `/api/jobs/:id` | Dono ou admin | Detalhes, edição, pausa e remoção |
| `POST` | `/api/jobs/:id/applications` | Candidato | Candidatar-se a uma vaga publicada e elegível |
| `GET` | `/api/candidates/me/applications` | Candidato dono | Acompanhar candidaturas próprias |
| `GET/PATCH` | `/api/companies/me/applications` | Empresa dona | Consultar inscritos na vaga da empresa e mudar status |
| `GET/PATCH` | `/api/candidates/me/notifications` | Candidato dono | Consultar e marcar notificações |
| `GET/PATCH` | `/api/admin/candidates` | Admin | Gerenciar contas com trilha de auditoria |
| `GET/PATCH` | `/api/admin/companies` | Admin | Revisar/verificar cadastros empresariais |
| `GET/PATCH/DELETE` | `/api/admin/jobs` | Admin | Revisar, aprovar, editar ou remover anúncios |
| `GET/POST/PATCH/DELETE` | `/api/admin/announcements` | Admin | Gerenciar comunicados/anúncios |
| `GET/PATCH` | `/api/admin/reports` | Admin | Revisar denúncias e problemas |
| `GET` | `/api/recommendations` | Candidato autenticado | Retornar critérios e oportunidades obtidas de fonte real |

Todas as respostas precisam filtrar campos por papel, aplicar paginação e validar entradas no servidor. A interface nunca deve decidir autorização apenas por esconder uma aba.

## Modelo de dados inicial (rascunho)

```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('candidate','company','admin') NOT NULL,
  status ENUM('active','blocked','pending') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE candidates (
  user_id BIGINT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20),
  birth_date DATE,
  city VARCHAR(100), state CHAR(2),
  education VARCHAR(100), current_course VARCHAR(160), institution VARCHAR(160),
  summary TEXT, photo_path VARCHAR(500), visibility ENUM('private','applied_only','public') DEFAULT 'applied_only',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE companies (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  sector VARCHAR(100), description TEXT,
  city VARCHAR(100), state CHAR(2), address VARCHAR(255), website VARCHAR(500),
  review_status ENUM('pending','verified','rejected','suspended') NOT NULL DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE jobs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  company_id BIGINT NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  requirements JSON,
  education VARCHAR(160), benefits JSON,
  area VARCHAR(100), employment_type VARCHAR(60), modality VARCHAR(40),
  city VARCHAR(100), state CHAR(2), address VARCHAR(255), application_url VARCHAR(1000),
  moderation_status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
  source VARCHAR(100), source_reference VARCHAR(255), confirmed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE applications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  job_id BIGINT NOT NULL,
  candidate_id BIGINT NOT NULL,
  status VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY one_application_per_candidate_job (job_id, candidate_id),
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (candidate_id) REFERENCES candidates(user_id)
);
```

Normalize habilidades, cursos, experiências, tipos de vaga e histórico de status em tabelas próprias se houver pesquisa, auditoria ou filtros. Não guarde currículo/foto como data URL em tabelas: use armazenamento de arquivos apropriado e política de acesso/remoção.

## Segurança, privacidade e confiabilidade

- Produção precisa de autenticação e autorização no servidor em cada rota; a conta admin de demonstração jamais deve migrar.
- Armazene senhas com Argon2id ou bcrypt com configuração atualizada e salt único. Nunca registre a senha nos logs.
- Prefira sessão com cookie `HttpOnly`, `Secure`, `SameSite` e proteção CSRF a token acessível em JavaScript. Planeje rotação, expiração e logout.
- Use HTTPS, CORS restrito, CSP, `helmet`, limites de requisição, rate limit, validação e queries parametrizadas.
- A recuperação deve usar token aleatório de curta duração e uso único enviado pelo serviço de e-mail; nunca exiba um código de reset no cliente.
- A área admin exige MFA/controle de acesso, auditoria imutável, aprovação de conteúdo e revisão operacional.
- Defina minimização, finalidade, retenção e exclusão de dados pessoais, controles de visibilidade do currículo e canal para solicitações de titulares; obtenha revisão de privacidade/jurídica antes do lançamento.
- Uma vaga só pode ser apresentada como confirmada se a origem e o estado forem verificados. Distinga sempre vaga demonstrativa, publicada por empresa, aprovada e confirmada por fonte real.

## Google Maps e distância

A distância atual do protótipo usa alguns pares de coordenadas estáticos de centros urbanos e é apenas ilustrativa. Uma integração real deve geocodificar locais com consentimento e termos apropriados, usar cache e cota, distinguir distância em linha reta de rota e não expor chaves restritas ao backend no cliente. O app deve continuar funcional quando a API falhar ou o local não estiver disponível.

## Recomendações/IA

A compatibilidade atual é uma heurística local e visível. Uma versão real precisa de critérios explicáveis, tratamento de dados apropriado, testes de viés, limites de uso, possibilidade de contestação e fallback sem IA. Não use o percentual como probabilidade de contratação.

## Implantação

1. Implementar e testar a API separadamente.
2. Criar configuração de ambiente de frontend somente com URL pública da API; nenhuma chave secreta.
3. Substituir gradualmente os métodos locais dos serviços por endpoints, incluindo os fluxos de empresa/admin e tratamento de erros.
4. Configurar CORS e cookies para o domínio hospedado.
5. Migrar os dados de demonstração apenas quando houver consentimento e política definida; nunca copie senhas demo.
6. Testar controle de acesso, privacidade, filtros, concorrência, remoção e falhas externas antes de produção.
