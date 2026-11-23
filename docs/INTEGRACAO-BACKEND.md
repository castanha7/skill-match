# Configuração do SkillMatch com Supabase

Este guia conecta o SkillMatch ao projeto Supabase existente usando o backend Express incluído no repositório. O frontend não recebe a chave secreta do Supabase. O schema cria somente as tabelas utilizadas pela API; não insere usuários, empresas, vagas ou outros registros fictícios.

> A configuração no código não significa que o projeto já esteja conectado. As credenciais reais ficam no servidor do usuário, e o passo de verificação abaixo deve ser feito após configurá-las.

## 1. Pré-requisitos

- Projeto Supabase criado.
- Node.js 20 ou superior e npm.
- Acesso ao SQL Editor e às configurações de API e Authentication do projeto Supabase.
- Um servidor Node/Express para hospedar a API. GitHub Pages hospeda apenas arquivos estáticos e não executa este backend.

## 2. Criar as tabelas e políticas

1. No Dashboard do Supabase, abra **SQL Editor** e crie uma consulta.
2. Copie o conteúdo integral de [`../supabase/schema.sql`](../supabase/schema.sql) para a consulta e execute.
3. Confira se a consulta terminou sem erro.

O script usa `auth.users` do Supabase Auth e cria as tabelas de perfis, contatos privados, empresas, vagas, candidaturas, conexões, mensagens, entrevistas, notificações, preferências, cursos, relatos e auditoria. Inclui chaves estrangeiras, índices, triggers, RLS e concessões explícitas de acesso. A conta de candidato é criada pelo trigger quando o Supabase Auth cria um usuário. Não crie manualmente uma tabela `auth.users`.

O script pode ser executado novamente sobre a mesma versão do schema: preserva registros e recria as policies e os triggers do SkillMatch. **Não é um mecanismo de migração de versões antigas.** Se as tabelas já existirem ou houver dados no schema `public`, faça backup e revise a estrutura antes de executar; `CREATE TABLE IF NOT EXISTS` não adapta automaticamente colunas de versões anteriores.

## 3. Configurar chaves no backend

No terminal, na raiz do repositório:

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env` e substitua os exemplos pelos valores do seu projeto. No Dashboard, consulte **Project Settings → API** (ou a seção equivalente de API Keys):

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | Project URL do projeto, por exemplo `https://<project-ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key. O backend também aceita o nome legado `SUPABASE_ANON_KEY`. |
| `SUPABASE_SECRET_KEY` | Secret key. O backend também aceita o nome legado `SUPABASE_SERVICE_ROLE_KEY`. Trate-a como segredo. |

`SUPABASE_SECRET_KEY` só pode ficar no ambiente privado do backend. Não a coloque em HTML, JavaScript, `.env.example`, GitHub Pages nem em chamados ou conversas. A publishable key não substitui a secret key: o servidor precisa das duas para os fluxos atuais.

Mantenha também, no mínimo:

```dotenv
NODE_ENV=development
PORT=3000
FRONTEND_ORIGIN=http://localhost:3000
TRUST_PROXY=0
AUTH_EMAIL_REDIRECT_URL=http://localhost:3000/auth-callback.html
```

`FRONTEND_ORIGIN` deve corresponder exatamente à origem do navegador, sem barra final. Para uma implantação em domínio próprio, use a origem HTTPS real. `TRUST_PROXY` deve permanecer `0` quando o backend não está atrás de proxy; ajuste para o número exato de proxies reversos confiáveis somente se necessário.

O arquivo `backend/.env.example` contém esses campos e comentários. O `.env` real é ignorado pelo Git. Nunca o adicione ao repositório.

## 4. Configurar confirmação e retorno de e-mail

No Dashboard do Supabase, abra **Authentication → URL Configuration** e inclua como URL permitida o valor exato de `AUTH_EMAIL_REDIRECT_URL` (para desenvolvimento local, `http://localhost:3000/auth-callback.html`). Configure também a Site URL para a origem em que o frontend será servido. Em produção, use HTTPS e o domínio público real.

O provedor de e-mail do Supabase deve estar habilitado para confirmações e recuperação de senha. O cadastro público cria candidatos e empresas; uma confirmação pode ser exigida conforme as configurações do projeto. O cadastro empresarial não marca a empresa como verificada e novas vagas começam pendentes de revisão.

### Conta administrativa

O cadastro público não pode criar uma conta administrativa, e o schema não semeia uma conta fictícia. Crie/confirme uma conta de operador por um canal confiável e promova **somente essa conta** no SQL Editor do Supabase, conferindo o e-mail antes de executar. Exemplo para substituir pelo e-mail exato da conta controlada:

```sql
update public.profiles p
set role = 'admin',
    terms_accepted_at = coalesce(p.terms_accepted_at, now())
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('operador@seudominio.com');
```

Não conceda o papel `admin` a partir de dados enviados pelo frontend. Restrinja o acesso ao SQL Editor e proteja as credenciais do operador.

## 5. Instalar e iniciar

```bash
cd backend
npm ci
npm start
```

O servidor escuta em `0.0.0.0:3000` por padrão e serve tanto as páginas do SkillMatch quanto a API. Abra:

- Aplicativo: `http://localhost:3000/`
- Verificação da API/Supabase: `http://localhost:3000/api/health`
- Catálogo público: `http://localhost:3000/api/jobs`

Com schema e variáveis válidos, `/api/health` deve responder HTTP 200 com `{"status":"ok","database":"connected","provider":"supabase"}`. Uma resposta 503 indica que o servidor não reconhece a configuração, não alcança o projeto ou não consegue consultar o schema. Verifique os logs do backend, as três variáveis Supabase, a URL, a rede e se `supabase/schema.sql` foi executado. Não exponha valores das chaves ao pedir ajuda.

## 6. Frontend em domínio separado (opcional)

Quando as páginas e a API estiverem em origens diferentes:

1. Hospede o backend em um servidor Node com URL HTTPS pública.
2. No valor `content` de `<meta name="skillmatch-api-base">` em cada página HTML do frontend, informe a URL HTTPS pública da API, sem barra final. Exemplo: `<meta name="skillmatch-api-base" content="https://api.seudominio.com">`.
3. Defina `FRONTEND_ORIGIN` em `backend/.env` com a origem exata do frontend. Para mais de uma origem, separe-as por vírgula.
4. Adicione a URL HTTPS de `auth-callback.html` às Redirect URLs permitidas no Supabase.

O arquivo raiz [`.env.example`](../.env.example) é apenas uma referência: frontend estático não carrega arquivos `.env` automaticamente. Ele não contém nem deve conter chaves Supabase. Se o frontend e a API forem servidos pela mesma instância Express, a origem é inferida e não é necessário preencher a meta tag.

## 7. Testes e limites conhecidos

Execute os testes locais:

```bash
# Na raiz do repositório
npm test

# Em outro terminal ou após o primeiro comando
cd backend
npm test
```

Esses testes não usam credenciais reais nem validam o projeto Supabase. O schema pode ser conferido localmente, mas somente `/api/health` no backend configurado confirma que o processo conseguiu consultar o projeto. Faça também um cadastro de teste e confira o usuário e os registros relacionados no Dashboard, sem usar dados pessoais reais durante a validação inicial.

O modo padrão do frontend usa a API; se a API estiver indisponível, os registros fictícios locais não são usados como fallback. Fixtures em `localStorage` são exclusivas do modo de demonstração habilitado explicitamente (`SKILLMATCH_CONFIG.mode = "demo"`). No modo API, `localStorage`/`sessionStorage` podem guardar a sessão de autenticação, não os registros da plataforma. A sessão acessível pelo JavaScript requer proteção contra XSS; para produção, avalie migrar a autenticação para cookies `HttpOnly`, `Secure`, `SameSite` e proteção CSRF.

O fluxo de foto não está conectado ao Supabase Storage e fica indisponível no perfil remoto. O provedor de IA é opcional e não é necessário para conectar o banco. Antes da publicação, valide autenticação, políticas de e-mail, domínio HTTPS, permissões RLS e procedimentos de recuperação e exclusão de conta no projeto real.
