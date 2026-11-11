# SkillMatch

**Suas habilidades. Sua oportunidade.**

Primeira versão frontend da plataforma para aproximar jovens de vagas de Jovem Aprendiz, estágio e primeira oportunidade profissional. Projeto desenvolvido como base para um TCC do curso técnico de Desenvolvimento de Sistemas.

## Como executar

A aplicação é estática e não precisa de dependências nem de processo de build. Sirva a pasta raiz por um servidor HTTP local, por exemplo:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Depois, acesse `http://localhost:4173`. Também é possível abrir `index.html` diretamente, embora um servidor HTTP seja recomendado.

## Fluxos disponíveis

- **Login:** autenticação demonstrativa de uma conta cadastrada neste navegador.
- **Cadastro de candidato:** dados pessoais, escolaridade, área de interesse, habilidades e senha, com validação básica.
- **Perfil:** visualização dos dados, indicador de preenchimento, edição, encerramento de sessão e exemplos estáticos de oportunidades.
- **Modo demonstração:** acesso a um perfil de exemplo sem precisar se cadastrar.

Os dados de cadastro e a sessão são armazenados no `localStorage` deste navegador (`skillmatch.candidates.v1` e `skillmatch.session.v1`). Use apenas dados fictícios nesta versão. O armazenamento local **não é seguro para credenciais reais** e não substitui autenticação ou persistência no servidor.

## Organização

- `index.html`: documento e ponto de entrada.
- `styles.css`: identidade visual responsiva.
- `app.js`: telas, validações e persistência temporária no navegador.

A camada de dados está concentrada no JavaScript para facilitar a substituição futura por chamadas a uma API Node.js/Express. A próxima etapa pode separar serviços de autenticação e candidatos e integrar a persistência com MySQL. Não há backend, banco de dados ou inteligência artificial nesta entrega; oportunidades e percentuais exibidos são exemplos visuais.
