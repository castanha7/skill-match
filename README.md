# SkillMatch

Plataforma de empregabilidade jovem para explorar oportunidades, acompanhar candidaturas e conectar candidatos a empresas.

## Integração com Supabase

O backend Express usa o Supabase Auth e o banco PostgreSQL do projeto. O bootstrap completo do banco está em [`supabase/schema.sql`](supabase/schema.sql); as instruções, incluindo configuração de chaves e execução local, estão em [`docs/INTEGRACAO-BACKEND.md`](docs/INTEGRACAO-BACKEND.md).

### Início rápido

1. No painel do Supabase, execute o conteúdo completo de `supabase/schema.sql` pelo **SQL Editor**.
2. Copie `backend/.env.example` para `backend/.env` e configure a URL do projeto, a chave `SUPABASE_PUBLISHABLE_KEY` e a chave secreta `SUPABASE_SECRET_KEY`.
3. Instale e inicie o servidor:

   ```bash
   cd backend
   npm ci
   npm start
   ```

4. Abra `http://localhost:3000` e confira `http://localhost:3000/api/health`.

Não coloque chaves secretas no frontend, no repositório ou em mensagens. O arquivo raiz `.env.example` é apenas uma referência para a URL pública da API quando o frontend estiver em domínio separado; páginas estáticas não carregam `.env` automaticamente. O GitHub Pages, sozinho, não executa o backend.

## Persistência e modo de demonstração

O modo normal usa a API; falhas de rede não trocam silenciosamente para dados fictícios. Na tela de login, selecione **Acessar demonstração** para usar contas e dados fictícios locais; use **Voltar ao acesso normal** para retornar à API. A escolha vale para a aba atual. Fixtures também podem ser ativadas explicitamente por `SKILLMATCH_CONFIG.mode = "demo"` nos testes e em ambientes de demonstração. No modo API, os registros da plataforma são enviados ao backend/Supabase, não usados como banco em `localStorage`. A sessão de autenticação pode usar armazenamento do navegador conforme a opção “Lembrar-me”; isso não é armazenamento de registros da plataforma.

## Testes

Na raiz:

```bash
npm test
```

Testes do backend:

```bash
cd backend
npm test
```

Os testes não usam credenciais reais e não confirmam a conexão com o projeto Supabase. A validação de conexão depende de executar a configuração no projeto do usuário e obter `database: "connected"` em `/api/health`.
