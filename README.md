# SkillMatch

> **Suas habilidades. Sua oportunidade.**

Plataforma inteligente que conecta jovens em busca do **primeiro emprego** a empresas
que oferecem vagas de **Jovem Aprendiz, estágio, trainee e primeiro emprego**.

Projeto desenvolvido como **Trabalho de Conclusão de Curso (TCC)** do curso técnico
de **Desenvolvimento de Sistemas**.

---

## 📌 Status do projeto

| Etapa | Descrição | Status |
|-------|-----------|--------|
| 1 | Frontend: login, cadastro e perfil do candidato | ✅ Concluída |
| 2 | Backend com Node.js + Express + MySQL | 🔜 Próxima etapa |
| 3 | Área da empresa e publicação de vagas | ⏳ Planejada |
| 4 | Algoritmo de match / inteligência artificial | ⏳ Planejada |

> Nesta primeira etapa **não há banco de dados nem backend**: os dados são
> persistidos temporariamente no **`localStorage`** do navegador, apenas para
> demonstrar o funcionamento completo das telas.

## 🚀 Como executar

Não é necessário instalar nada. Basta servir a pasta do projeto com qualquer
servidor estático:

```bash
# Opção 1 — Python
python3 -m http.server 5173

# Opção 2 — Node.js
npx serve . -l 5173
```

Depois acesse **http://localhost:5173** no navegador.

## 🔑 Conta de demonstração

Na primeira execução, uma conta fictícia é criada automaticamente:

| E-mail | Senha |
|--------|-------|
| `demo@skillmatch.com` | `Skill@123` |

Você também pode criar sua própria conta em **Cadastre-se grátis** e testar
todo o fluxo: cadastro → login automático → perfil editável.

## 🖥️ Telas implementadas

### 1. Login (`index.html`)
- Logo e slogan, painel de marca com cartão de "match" animado
- E-mail e senha com **mostrar/ocultar senha**
- Opção "lembrar-me", validação de campos e mensagens de erro
- Botão para preencher a conta de demonstração
- Usuário já logado é redirecionado direto ao perfil

### 2. Cadastro de candidato (`cadastro.html`)
Cadastro guiado em **3 passos** com barra de progresso:
1. **Sua conta** — nome, e-mail (com verificação de duplicidade), senha com
   medidor de força, confirmação e aceite dos termos
2. **Seu perfil** — telefone com máscara automática, data de nascimento,
   cidade/UF, escolaridade, curso e instituição
3. **Habilidades** — área de interesse, tipos de vaga, disponibilidade,
   editor de habilidades com sugestões e resumo pessoal

### 3. Perfil do candidato (`perfil.html`)
- Rota protegida (redireciona ao login sem sessão)
- Cartão de identidade com avatar de iniciais, idade e localização
- **Anel de completude do perfil** com checklist do que falta preencher
- Seções editáveis inline: dados pessoais e formação, sobre mim,
  habilidades e preferências de vaga
- Sair da conta e excluir conta (com modal de confirmação)

## 🧱 Estrutura do projeto

```
skill-match/
├── index.html                  # Tela de login
├── cadastro.html               # Tela de cadastro (3 passos)
├── perfil.html                 # Tela de perfil do candidato
├── assets/
│   ├── css/
│   │   ├── base.css            # Design tokens, componentes, toast/modal
│   │   ├── auth.css            # Login e cadastro
│   │   └── profile.css         # Perfil
│   └── js/
│       ├── config/
│       │   └── app.config.js   # Configuração global + catálogos
│       ├── services/           # ★ Camada de acesso a dados
│       │   ├── storage.service.js
│       │   ├── api.service.js      # Cliente HTTP (pronto p/ a API)
│       │   ├── auth.service.js     # Login, cadastro e sessão
│       │   └── user.service.js     # Perfil do candidato
│       ├── utils/              # Validadores, máscaras e DOM/toast
│       ├── components/         # Mostrar/ocultar senha, editor de habilidades
│       └── pages/              # Lógica de cada tela
└── docs/
    └── INTEGRACAO-BACKEND.md   # Guia da próxima etapa (API + MySQL)
```

## 🔌 Preparação para o backend

As telas **nunca** acessam o `localStorage` diretamente: tudo passa pelos
serviços em `assets/js/services/`. Quando a API estiver pronta, basta mudar
`useApi: true` e `apiBaseUrl` em `app.config.js` — nenhuma tela precisa ser
reesrita. Detalhes em [`docs/INTEGRACAO-BACKEND.md`](docs/INTEGRACAO-BACKEND.md).

## 🎨 Identidade visual

- **Cores:** azul-marinho `#0a1730`, azul vibrante `#2563eb` e ciano `#22d3ee`
- **Tipografia:** Sora (títulos) + Inter (texto)
- Estilo moderno, minimalista e tecnológico, com animações suaves
- Totalmente **responsivo** (celular, tablet e computador)

## 🛠️ Tecnologias (etapa atual)

HTML5 · CSS3 (variáveis, grid, flexbox, animações) · JavaScript ES Modules
(vanilla, sem frameworks) · `localStorage`

**Próximas etapas:** Node.js · Express · MySQL · JWT · bcrypt ·
algoritmo de recomendação de vagas (match)
