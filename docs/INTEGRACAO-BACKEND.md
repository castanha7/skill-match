# Integração futura — Backend (Node.js + Express + MySQL)

Este documento descreve como o frontend do **SkillMatch** foi preparado para
ser ligado ao backend nas próximas etapas do TCC, **sem reescrever as telas**.

## 1. Como funciona hoje (etapa atual)

- `APP_CONFIG.useApi = false` em `assets/js/config/app.config.js`.
- Os serviços (`auth.service.js`, `user.service.js`) salvam e leem os dados
  no `localStorage` do navegador, simulando o comportamento de uma API.
- É criada automaticamente uma conta de demonstração:
  `demo@skillmatch.com` / `Skill@123`.

## 2. Como ligar a API depois

1. Desenvolver o backend (estrutura sugerida abaixo).
2. Alterar em `app.config.js`:
   ```js
   useApi: true,
   apiBaseUrl: "http://localhost:3000/api",
   ```
3. Pronto — as telas passam a consumir os endpoints via `api.service.js`
   (que já implementa `fetch` com token JWT no cabeçalho `Authorization`).

## 3. Endpoints esperados pela interface

| Método | Rota                  | Descrição                          | Corpo / Resposta |
|--------|-----------------------|------------------------------------|------------------|
| POST   | `/api/auth/register`  | Cadastro de candidato              | `{ nome, email, senha, ... }` → `{ usuario, token }` |
| POST   | `/api/auth/login`     | Login                              | `{ email, senha }` → `{ usuario, token }` |
| GET    | `/api/candidatos/me`  | Perfil do usuário logado           | Header `Authorization: Bearer <token>` |
| PUT    | `/api/candidatos/me`  | Atualizar perfil                   | Campos do perfil → usuário atualizado |
| DELETE | `/api/candidatos/me`  | Excluir conta                      | Header `Authorization: Bearer <token>` |

> Rotas futuras (próximas etapas): `/api/vagas`, `/api/empresas`,
> `/api/candidaturas` e `/api/matches` (algoritmo/IA de recomendação).

## 4. Estrutura sugerida do backend

```
server/
├── src/
│   ├── app.js                # configuração do Express
│   ├── server.js             # ponto de entrada (listen)
│   ├── config/
│   │   └── database.js       # pool de conexões MySQL (mysql2)
│   ├── routes/
│   │   ├── auth.routes.js
│   │   └── candidatos.routes.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   └── candidatos.controller.js
│   ├── models/
│   │   └── candidato.model.js  # queries SQL
│   ├── middlewares/
│   │   └── auth.middleware.js  # validação do JWT
│   └── utils/
│       └── validators.js
├── .env                      # DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET
└── package.json
```

Dependências sugeridas: `express`, `mysql2`, `dotenv`, `cors`,
`bcrypt`, `jsonwebtoken`, `express-validator`.

## 5. Modelo de dados (MySQL)

```sql
CREATE DATABASE skillmatch;
USE skillmatch;

CREATE TABLE candidatos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(120) NOT NULL,
  email           VARCHAR(160) NOT NULL UNIQUE,
  senha_hash      VARCHAR(255) NOT NULL,          -- bcrypt no servidor
  telefone        VARCHAR(20),
  data_nascimento DATE,
  cidade          VARCHAR(80),
  estado          CHAR(2),
  escolaridade    VARCHAR(60),
  curso           VARCHAR(120),
  instituicao     VARCHAR(160),
  area_interesse  VARCHAR(60),
  tipos_vaga      JSON,                            -- ["Estágio", "Jovem Aprendiz"]
  disponibilidade VARCHAR(40),
  resumo          TEXT,
  habilidades     JSON,                            -- ["Excel", "JavaScript", ...]
  linkedin        VARCHAR(255),
  github          VARCHAR(255),
  portfolio       VARCHAR(255),
  criado_em       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

> Observação: no frontend, `tiposVaga` e `habilidades` já são arrays —
> basta serializá-los em JSON (ou normalizar em tabelas próprias:
> `candidato_habilidades`, `candidato_tipos_vaga`, se preferirem o modelo relacional).

## 6. Segurança (próxima etapa)

- Senhas com **bcrypt** no servidor (o hash simples usado no `localStorage`
  é apenas demonstrativo e está sinalizado no código).
- Autenticação com **JWT**; rotas de perfil protegidas por middleware.
- Validação dos dados no backend (as mesmas regras de
  `assets/js/utils/validators.js`).
- Variáveis sensíveis no `.env`, nunca no código.
