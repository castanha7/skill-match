# Roteiro rápido de apresentação do SkillMatch

## Iniciar

Na raiz do repositório, execute:

```bash
python3 -m http.server 5173
```

Abra `http://localhost:5173`. Não abra os HTML com `file://`: os módulos JavaScript precisam de um servidor HTTP. Use o mesmo navegador e a mesma origem durante a demonstração, pois os dados do protótipo ficam no armazenamento local daquele navegador.

## Contas fictícias

| Perfil | E-mail | Senha |
|---|---|---|
| Candidato | `demo@skillmatch.com` | `Skill@123` |
| Empresa | `empresa@skillmatch.com` | `Skill@123` |
| Administração | `admin@skillmatch.com` | `Admin@123` |

São contas abertas de demonstração, não credenciais privadas. Não informe dados pessoais reais durante a apresentação.

## Fluxo sugerido (5–10 minutos)

1. **Página inicial:** apresente o slogan “Suas habilidades. Sua oportunidade.” e pesquise o catálogo. Os quatro anúncios e as faixas salariais são fictícios e aparecem identificados como demonstração.
2. **Candidato:** entre com a conta de candidato. Em **Vagas**, abra os detalhes para ver compatibilidade explicada, filtre por remuneração e registre interesse/salve uma oportunidade. Em **Minhas candidaturas**, mostre o status. Em **Preparação para Entrevistas**, escolha um tipo, escreva uma resposta e veja os pontos positivos e sugestões; o feedback usa regras locais, não IA.
3. **Consentimento:** em **Configurações**, habilite a visibilidade do perfil. Isso demonstra que o banco de talentos e os convites dependem de opt-in; dados de contato continuam sujeitos às regras de autorização.
4. **Empresa:** saia e entre com a conta empresarial. Em **Candidaturas**, veja o interesse do candidato, atualize o status e use **Convidar para entrevista** para definir data, formato e local/link. Em **Banco de talentos**, localize um perfil autorizado e envie também um convite de conexão.
5. **Resposta e conversa:** volte à conta de candidato. Em **Empresas e mensagens**, aceite ou recuse o convite de entrevista e, se quiser, aceite a conexão da empresa. Só depois da conexão aceita troque mensagens; retorne à empresa para conferir a resposta do convite e conversar.
6. **Administração (opcional):** entre com a conta administrativa e demonstre revisão de vaga e moderação de relato. As ações alteram apenas os dados locais.

## O que esta demonstração não representa

- Cadastro, autenticação, perfis, vagas, candidaturas, mensagens e moderação do painel são persistidos no navegador; não são gravados em um servidor compartilhado nem oferecem segurança de produção.
- Não há vagas reais importadas, conexão com provedor externo de empregos, mapas/geocodificação, envio de e-mail para recuperação de senha, nem confirmação de contratação.
- A prática de entrevista é simulada por regras locais. O endpoint opcional de IA não está configurado nem conectado à tela.
- A API Express existe separadamente, mas o frontend autenticado não está integrado a ela. Neste ambiente não há `backend/.env`, cliente MySQL instalado ou banco MySQL configurado/testado. O schema e os passos de configuração estão em `backend/sql/` e `docs/INTEGRACAO-BACKEND.md`.

Para validar antes de apresentar: `npm test` na raiz (26 testes de frontend) e `cd backend && npm test` (5 testes unitários da API). Os testes da API não iniciam MySQL nem chamam um provedor externo.
