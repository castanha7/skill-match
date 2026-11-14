# SkillMatch

> **Suas habilidades. Sua oportunidade.**

Protótipo de empregabilidade jovem para explorar o fluxo entre candidatos, empresas e administração. O projeto mantém HTML, CSS e JavaScript sem framework e foi ampliado sobre a base existente de login, cadastro e perfil.

## Estado e limites da versão

O site é uma **demonstração frontend estática**. Não há API, banco de dados MySQL, geocodificação, Google Maps, inteligência artificial, envio de e-mail, integração com empregadores ou encaminhamento real de candidaturas. Empresas, oportunidades, anúncios, notificações e contas demo são identificados como fictícios/demonstrativos. Não são vagas abertas nem promessas de contratação.

Os dados criados no uso ficam em `localStorage`/`sessionStorage` do navegador e não são compartilhados entre visitantes. Esse armazenamento pode ser lido, alterado ou removido por quem controla o navegador; **não é autenticação, autorização nem persistência segura de produção**. As três contas de demonstração são públicas. Não use senhas reais nem cadastre documentos ou dados sensíveis.

## Como executar

A aplicação é estática. Na raiz do projeto, use um servidor HTTP:

```bash
python3 -m http.server 5173
```

Acesse `http://localhost:5173`. Também pode ser publicada no GitHub Pages sem etapa de build. Os módulos ES precisam ser servidos por HTTP(S), não abertos diretamente com `file://`.

### Testes automatizados

```bash
npm install
npm test
```

Os testes usam JSDOM para verificar cadastro em três etapas, login e recuperação local, filtros, candidaturas, privacidade, configurações da conta, perfil, fluxo entre candidato/empresa/admin, publicação e moderação de anúncios, notificações, logout, além de links, IDs e rótulos básicos nas páginas estáticas. São testes de DOM/serviços em Node, não substituem testes em navegador real. O pacote de teste é somente uma dependência de desenvolvimento; não é necessário para hospedar a aplicação.

## Acessos públicos de demonstração

| Área | E-mail | Senha |
|---|---|---|
| Candidato | `demo@skillmatch.com` | `Skill@123` |
| Empresa | `empresa@skillmatch.com` | `Skill@123` |
| Administração | `admin@skillmatch.com` | `Admin@123` |

Os dados e permissões são demonstrativos e ficam no navegador. **A área administrativa não é segura para produção**, pois a autorização está no frontend.

## Áreas e funcionalidades

### Login e cadastro

- `index.html`: login separado por candidato, empresa e administração; mostrar/ocultar senha; lembrar sessão; preenchimento rápido das contas demo.
- Recuperação de senha demonstrativa: gera código temporário local e permite trocar a senha; **não envia e-mail**.
- `cadastro.html`: cadastro de candidato em três etapas, validação de nome, e-mail, senha, telefone, data de nascimento, cidade/UF, escolaridade, aceite de termos e no mínimo três habilidades. Os campos permanecem preenchidos ao avançar/voltar.
- `termos.html` e `privacidade.html`: avisos demonstrativos. Os textos não substituem revisão jurídica ou uma política LGPD de produção.
- Senhas novas são derivadas localmente por PBKDF2 com salt antes de serem guardadas. Isso reduz armazenamento acidental em texto simples, mas **não transforma o protótipo em um sistema de autenticação seguro**. Uma versão real deve validar credenciais no servidor, usar hash forte no backend, autorização por função e recuperação por canal verificado.

### Candidato

- `painel.html`: início, radar, catálogo de vagas, candidaturas, currículo, cursos/sugestões, notificações e configurações.
- `perfil.html`: dados pessoais/formação, foto local, resumo, habilidades, cursos complementares, experiências/projetos, links e preferências; edição e salvamento por seção.
- Vagas e empresas do radar são registros marcados como fictícios/demonstrativos. O percentual é uma regra local explicável, não uma IA. Distância, quando disponível, é uma aproximação entre centros urbanos cadastrados no projeto; não há Google Maps nem geolocalização.
- “Registrar interesse” salva uma candidatura **local de teste**. Não envia currículo para empresas reais. As mudanças de status realizadas pela empresa ficam no mesmo navegador.
- Currículo pode ser impresso ou salvo em PDF pela função de impressão do navegador.
- Cursos são sugestões de temas; não representam inscrição, parceiro ou certificado.

### Empresa

- Painel separado com edição dos dados empresariais, publicação, edição, pausa/arquivamento de vagas e consulta de candidaturas/currículos de teste.
- Novos anúncios ficam pendentes de aprovação na área administrativa demonstrativa; após aprovação aparecem no catálogo local do candidato.
- O estado “verificada” é apenas uma marca de demonstração. Não valida CNPJ, identidade ou vínculo empregatício.

### Administração

- Dashboard com contagens dos dados locais; consulta e bloqueio de contas de candidatos; edição/revisão de registros empresariais; aprovação, suspensão, edição e remoção de anúncios; controle de comunicados demonstrativos; revisão de relatos.
- Essas ações só alteram o `localStorage` deste navegador. Não existe autorização segura, log de auditoria ou operação remota.

## Dados e teste entre áreas

Para percorrer um fluxo completo no mesmo navegador:

1. Entre como candidato e registre interesse em uma oportunidade de demonstração.
2. Saia e entre como empresa para consultar o candidato e alterar o status.
3. Entre como administração para revisar o anúncio criado pela empresa ou um relato local.
4. Volte ao candidato para conferir candidaturas e notificações.

Os dados permanecem até limpar o armazenamento do site ou excluir a conta. Não há sincronização com o GitHub Pages ou outros usuários.

## Estrutura

```text
skill-match/
├── index.html                 # Login e recuperação demonstrativa
├── cadastro.html              # Cadastro em 3 etapas
├── perfil.html                # Perfil detalhado do candidato
├── painel.html                # Painel por função (candidato/empresa/admin)
├── termos.html                # Termos ilustrativos
├── privacidade.html           # Aviso de privacidade demonstrativo
├── assets/
│   ├── css/                   # Design system, autenticação, perfil e painel
│   └── js/
│       ├── components/        # Senha, habilidades
│       ├── config/            # Catálogos e configuração sem segredos
│       ├── pages/             # Lógica das páginas
│       ├── services/          # Storage, auth, perfil, API e dados de demonstração
│       └── utils/             # Validação, formatação e DOM
├── docs/
│   └── INTEGRACAO-BACKEND.md # Contratos sugeridos para uma implementação futura
├── package.json              # Comando npm test e dependência de desenvolvimento
├── package-lock.json         # Versões reproduzíveis para os testes
└── tests/
    ├── app.test.js           # Fluxos demonstrativos e regras dos serviços
    └── pages.test.js         # Links, IDs, rótulos e recursos locais
```

## Próximas integrações reais

A versão atual **não** se conecta a Node.js, Express, MySQL, Google Maps Platform, e-mail ou IA. O cliente HTTP está preparado como ponto de extensão, mas `APP_CONFIG.useApi` permanece `false` e `apiBaseUrl` não aponta para um serviço inexistente. A documentação de integração descreve a arquitetura que ainda precisa ser implementada.

Não coloque chaves de API, segredos JWT, credenciais de banco ou tokens no frontend público. A autorização administrativa, validação das empresas, moderação, persistência e cálculos que dependam de dados confiáveis devem ficar no backend.

## Identidade visual e tecnologia

- Azul-marinho, azul, ciano, superfícies claras e cartões arredondados.
- Fontes Sora e Inter, ícones SVG e animações discretas; respeito a `prefers-reduced-motion`.
- Layout responsivo para desktop, tablet e celular, com menu recolhível.
- HTML5, CSS3 e JavaScript ES Modules sem framework ou build obrigatório.
