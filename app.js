(() => {
  const ACCOUNT_KEY = 'skillmatch.candidates.v1';
  const SESSION_KEY = 'skillmatch.session.v1';
  const INTERESTS = ['Jovem Aprendiz', 'Estágio', 'Primeiro emprego', 'Administrativo', 'Tecnologia', 'Atendimento', 'Marketing', 'Design'];
  const iconPaths = {
    spark: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/>',
    eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A11.4 11.4 0 0 1 12 5c6.4 0 10 7 10 7a16.6 16.6 0 0 1-3.2 3.8M6.2 6.3C3.5 8.1 2 12 2 12s3.6 7 10 7c1.2 0 2.3-.3 3.3-.7"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="m15 18-6-6 6-6"/><path d="M20 12H9"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 8.9a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.8 2.1Z"/>',
    cap: '<path d="m2 10 10-5 10 5-10 5-10-5Z"/><path d="M6 12v5c3.5 3 8.5 3 12 0v-5M22 10v6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    briefcase: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  };
  const icon = (name, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || ''}</svg>`;
  const brand = (light = false) => `<a class="brand ${light ? 'art-brand' : ''}" href="#" data-action="home" aria-label="SkillMatch início"><span class="brand-mark">${icon('spark', '')}</span><span>skill<em>match</em></span></a>`;
  const app = document.getElementById('app');

  const safe = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const readAccounts = () => {
    try { const value = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  };
  const readSession = () => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  };
  const currentCandidate = () => {
    const session = readSession();
    if (!session) return null;
    if (session.demo) return session.candidate || null;
    return readAccounts().find(item => item.email.toLowerCase() === String(session.email).toLowerCase()) || null;
  };
  const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || 'SM';
  let view = currentCandidate() ? 'profile' : 'login';
  let editing = false;

  const toast = (message, error = false) => {
    const region = document.getElementById('toast-region');
    const element = document.createElement('div');
    element.className = `toast${error ? ' error' : ''}`;
    element.textContent = message;
    region.append(element);
    setTimeout(() => element.remove(), 3800);
  };
  const setView = (next, edit = false) => {
    view = next;
    editing = edit;
    render();
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const showLogin = () => setView('login');
  const candidatesLanding = () => setView('signup', false);

  function renderLogin() {
    return `<main class="auth-shell">
      <section class="auth-main">
        <header class="auth-header">${brand()}<div class="mini-link">Ainda não tem conta? <button type="button" data-action="signup">Criar conta</button></div></header>
        <div class="auth-content">
          <p class="eyebrow">Seu próximo passo começa aqui</p>
          <h1 class="heading">Que bom ter<br>você de volta<span style="color:var(--primary)">.</span></h1>
          <p class="auth-subtitle">Entre na sua conta e continue construindo o seu caminho profissional.</p>
          <form id="login-form" class="form-stack" novalidate>
            <div class="field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" autocomplete="email" placeholder="voce@exemplo.com" required></div>
            <div class="field"><label for="login-password">Senha</label><div class="password-wrap"><input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Digite sua senha" required><button class="password-toggle" type="button" data-action="toggle-password" aria-label="Mostrar senha">${icon('eye')}</button></div></div>
            <div class="form-row"><label class="check-label"><input type="checkbox" name="remember" checked> Manter conectado</label><button class="inline-action" type="button" data-action="forgot">Esqueceu a senha?</button></div>
            <p id="login-error" class="form-error" role="alert"></p>
            <button class="btn btn-primary btn-block" type="submit">Entrar na plataforma ${icon('arrow')}</button>
          </form>
          <div class="auth-divider">ou experimente a plataforma</div>
          <div class="demo-box"><strong>Quer conhecer antes de criar sua conta?</strong>Explore o perfil de demonstração. <button type="button" data-action="demo">Entrar no modo demonstração →</button></div>
        </div>
        <footer class="auth-foot">© 2026 SkillMatch · Feito para abrir portas</footer>
      </section>
      <aside class="auth-art" aria-label="Sobre a SkillMatch">
        ${brand(true)}
        <div class="float-card"><small>Oportunidade encontrada</small><strong>Assistente de Marketing</strong><span class="match">94% match</span></div>
        <div class="art-copy"><span class="art-pill"><i></i> O começo de uma grande jornada</span><h2>Seu talento merece <span>uma oportunidade.</span></h2><p>Descubra vagas que combinam com quem você é e com tudo o que ainda pode se tornar.</p><div class="art-proof"><div class="avatar-stack"><span>MA</span><span>JL</span><span>BC</span><span>+</span></div><div class="proof-copy"><strong>O futuro é seu.</strong><br>Um passo de cada vez.</div></div></div>
        <footer class="art-foot"><span>Suas habilidades. Sua oportunidade.</span><span>PRIMEIRO PASSO, GRANDES CONQUISTAS</span></footer>
      </aside>
    </main>`;
  }

  function field(name, label, value = '', opts = {}) {
    const { type = 'text', placeholder = '', required = false, full = false, autocomplete = '', maxlength = '' } = opts;
    return `<div class="field${full ? ' full' : ''}"><label for="${name}">${label}${required ? ' <span aria-hidden="true" style="color:#e16c78">*</span>' : ''}</label><input id="${name}" name="${name}" type="${type}" value="${safe(value)}" placeholder="${safe(placeholder)}" ${required ? 'required' : ''} ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${maxlength ? `maxlength="${maxlength}"` : ''}></div>`;
  }
  function renderSignup() {
    const candidate = editing ? currentCandidate() || {} : {};
    const choices = INTERESTS.map(item => `<label class="choice-chip"><input type="checkbox" name="interests" value="${safe(item)}" ${(candidate.interests || []).includes(item) ? 'checked' : ''}><span>${safe(item)}</span></label>`).join('');
    return `<main class="form-page">
      <header class="topbar">${brand()}<div class="topbar-side">${editing ? 'Perfil do candidato' : 'Já tem uma conta?'} <button type="button" data-action="${editing ? 'cancel-edit' : 'login'}">${editing ? 'Cancelar' : 'Fazer login'}</button></div></header>
      <div class="form-layout">
        <div class="stepper"><span class="step-dot">${editing ? icon('edit', '') : '1'}</span><strong style="color:#4b5570">${editing ? 'Editar perfil' : 'Dados do candidato'}</strong><span class="step-line"></span><span>Seu próximo passo profissional</span></div>
        <section class="signup-card">
          <div class="signup-heading"><div><p class="eyebrow">${editing ? 'Seu perfil, do seu jeito' : 'Vamos começar juntos'}</p><h1 class="heading">${editing ? 'Atualize suas informações' : 'Crie seu perfil'}</h1><p>${editing ? 'Mantenha seus dados em dia para mostrar todo o seu potencial.' : 'Conte um pouco sobre você para encontrar oportunidades com a sua cara.'}</p></div><span class="secure-note">${icon('shield')} Seus dados ficam seguros</span></div>
          <form id="candidate-form" novalidate>
            <div class="form-grid">
              <div class="section-divider">Informações pessoais</div>
              ${field('fullName', 'Nome completo', candidate.name || '', { placeholder: 'Como podemos chamar você?', required: true, full: true, autocomplete: 'name', maxlength: '90' })}
              ${field('email', 'E-mail', candidate.email || '', { type: 'email', placeholder: 'voce@exemplo.com', required: true, autocomplete: 'email' })}
              ${field('phone', 'Celular / WhatsApp', candidate.phone || '', { type: 'tel', placeholder: '(41) 99999-9999', required: true, autocomplete: 'tel', maxlength: '20' })}
              ${field('city', 'Cidade', candidate.city || '', { placeholder: 'Ex.: Curitiba', required: true, autocomplete: 'address-level2' })}
              <div class="field"><label for="state">Estado</label><select id="state" name="state"><option value="">Selecione</option>${['PR','SP','SC','RS','RJ','MG','BA','DF','GO','PE','CE','ES','MT','MS','PA','PB','RN','AL','AM','MA','PI','RO','TO','SE','AC','AP','RR'].map(st => `<option value="${st}" ${(candidate.state || 'PR') === st ? 'selected' : ''}>${st}</option>`).join('')}</select></div>
              <div class="section-divider">Seu caminho profissional</div>
              <div class="field"><label for="education">Escolaridade</label><select id="education" name="education" required><option value="">Selecione sua escolaridade</option>${['Ensino fundamental','Ensino médio cursando','Ensino médio completo','Ensino técnico cursando','Ensino técnico completo','Ensino superior cursando','Ensino superior completo'].map(v => `<option ${candidate.education === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
              <div class="field"><label for="course">Curso ou área de interesse</label><input id="course" name="course" value="${safe(candidate.course || '')}" placeholder="Ex.: Desenvolvimento de Sistemas"></div>
              <div class="field full"><label>Que tipo de oportunidade você busca? <span aria-hidden="true" style="color:#e16c78">*</span></label><div class="interest-grid">${choices}</div><span class="helper">Escolha pelo menos uma opção. Você pode mudar isso depois.</span></div>
              <div class="field full"><label for="skills">Habilidades</label><input id="skills" name="skills" value="${safe((candidate.skills || []).join(', '))}" placeholder="Ex.: comunicação, Excel, organização"><span class="helper">Separe por vírgulas. Inclua habilidades técnicas ou pessoais.</span></div>
              <div class="field full"><label for="about">Sobre você <span style="color:#9aa3b3;font-weight:400">(opcional)</span></label><input id="about" name="about" value="${safe(candidate.about || '')}" maxlength="220" placeholder="Conte brevemente seus objetivos ou o que gostaria de aprender"></div>
              ${!editing ? `<div class="section-divider">Acesso à plataforma</div>${field('password', 'Crie uma senha', '', { type: 'password', placeholder: 'Mínimo de 6 caracteres', required: true, autocomplete: 'new-password' })}${field('confirmPassword', 'Confirme sua senha', '', { type: 'password', placeholder: 'Digite a senha novamente', required: true, autocomplete: 'new-password' })}` : ''}
            </div>
            <p id="candidate-error" class="form-error" role="alert" style="margin-top:15px"></p>
            <div class="signup-actions"><span class="signup-terms">${editing ? 'Suas alterações serão salvas neste navegador.' : 'Ao continuar, você concorda com nossos <button type="button" data-action="terms">Termos de uso</button> e <button type="button" data-action="terms">Política de privacidade</button>.'}</span><button class="btn btn-primary" type="submit">${editing ? 'Salvar alterações' : 'Criar meu perfil'} ${icon('arrow')}</button></div>
          </form>
        </section>
      </div>
    </main>`;
  }

  const percentComplete = candidate => {
    const checks = [candidate.name, candidate.email, candidate.phone, candidate.city, candidate.education, candidate.interests?.length, candidate.skills?.length, candidate.about];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  };
  function renderProfile() {
    const candidate = currentCandidate();
    if (!candidate) { view = 'login'; return renderLogin(); }
    const complete = percentComplete(candidate);
    const skills = candidate.skills?.length ? candidate.skills : ['Adicione suas habilidades'];
    const interests = candidate.interests?.length ? candidate.interests.join(' · ') : 'Interesses a definir';
    const cityState = [candidate.city, candidate.state].filter(Boolean).join(', ');
    const education = candidate.education || 'Escolaridade não informada';
    const course = candidate.course || interests;
    const n = safe(candidate.name || 'Candidato');
    return `<main class="profile-page">
      <nav class="profile-nav"><div class="profile-nav-left">${brand()}<span class="nav-item active">${icon('user')} Meu perfil</span><span class="nav-item">${icon('briefcase')} Oportunidades</span></div><div class="profile-nav-right"><button type="button" class="nav-icon-btn" aria-label="Notificações" data-action="notifications">${icon('bell')}<span class="notification-dot"></span></button><div class="profile-user-mini"><span class="avatar small">${safe(initials(candidate.name))}</span><span class="user-meta"><span class="user-name">${n}</span><span class="user-sub">Candidato</span></span></div><button type="button" class="nav-icon-btn" aria-label="Sair" title="Sair" data-action="logout">${icon('logout')}</button></div></nav>
      <div class="profile-wrap">
        <div class="welcome-row"><div><p class="eyebrow">Seu espaço SkillMatch</p><h1 class="heading">Olá, ${safe((candidate.name || '').trim().split(/\s+/)[0] || 'candidato')} 👋</h1><p>Seu próximo passo começa com um perfil que mostra quem você é.</p></div><div class="welcome-actions"><button type="button" class="btn btn-outline" data-action="edit">${icon('edit')} Editar perfil</button><button type="button" class="btn btn-primary" data-action="share">${icon('user')} Ver meu perfil</button></div></div>
        <div class="dashboard-grid">
          <div class="main-column">
            <section class="profile-card"><div class="profile-banner"><span class="banner-label">PERFIL DO CANDIDATO</span></div><div class="profile-identity"><div class="avatar profile-avatar">${safe(initials(candidate.name))}</div><div class="identity-head"><div><h2>${n}</h2><p>${safe(course)}${candidate.course ? ` · ${safe(interests)}` : ''}</p></div><button class="btn btn-outline" type="button" data-action="edit" style="min-height:36px;padding:0 12px;font-size:11px">${icon('edit')} Editar</button></div><div class="identity-meta"><span>${icon('pin')}${safe(cityState || 'Localização não informada')}</span><span>${icon('mail')}${safe(candidate.email)}</span><span>${icon('phone')}${safe(candidate.phone || 'Celular não informado')}</span></div></div>
              <div class="profile-body"><div class="card-title-row"><h3 class="card-title">Sobre mim</h3></div><p class="about-text">${safe(candidate.about || 'Adicione uma apresentação para que as empresas conheçam melhor sua história, seus objetivos e o que você gostaria de aprender.')}</p></div>
              <div class="profile-body"><div class="card-title-row"><h3 class="card-title">Minhas habilidades</h3><button class="inline-action" type="button" data-action="edit" style="font-size:10px">+ Adicionar</button></div><div class="skill-list">${skills.map(skill => `<span class="skill-tag">${safe(skill)}</span>`).join('')}</div></div>
              <div class="profile-body"><div class="card-title-row"><h3 class="card-title">Formação</h3></div><div class="education-row"><span class="education-icon">${icon('cap')}</span><div><strong>${safe(education)}</strong><span>${safe(candidate.course || 'Área de interesse ainda não informada')}</span></div></div></div>
            </section>
            <section class="opportunities-card"><div class="card-title-row"><div><h3 class="card-title">Oportunidades para você</h3><p class="card-subtitle">Exemplos para explorar seu próximo passo</p></div><span style="color:#9ba4b4;font-size:9px">DEMONSTRAÇÃO</span></div>
              <div class="opportunity"><div class="opportunity-info"><span class="company-mark">N</span><div><strong>Jovem Aprendiz · Administrativo</strong><span>Nova Geração · Curitiba, PR · Presencial</span></div></div><span class="match-score">92% compatível</span></div>
              <div class="opportunity"><div class="opportunity-info"><span class="company-mark green">V</span><div><strong>Estágio em ${safe(candidate.course || 'Tecnologia')}</strong><span>Verde & Co. · Híbrido · Publicada há 2 dias</span></div></div><span class="match-score">88% compatível</span></div>
              <div class="opportunity"><div class="opportunity-info"><span class="company-mark orange">P</span><div><strong>Assistente de atendimento</strong><span>Ponto Norte · Curitiba, PR · Presencial</span></div></div><span class="match-score">84% compatível</span></div>
            </section>
          </div>
          <aside class="side-column">
            <section class="side-card progress-card"><div class="progress-head"><div><h3>Perfil completo</h3><p>Um perfil completo chama atenção</p></div><span class="progress-percent">${complete}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${complete}%"></div></div><p class="progress-tip"><span class="tip-dot">✦</span> ${complete < 100 ? 'Complete seu perfil para mostrar ainda mais do seu potencial às empresas.' : 'Seu perfil está completo. Continue explorando novas oportunidades!'}</p></section>
            <section class="side-card match-card"><div class="match-top"><span>SEU PRÓXIMO PASSO</span><span class="match-spark">${icon('spark', '')}</span></div><h3>Oportunidades que combinam com você</h3><p>Suas habilidades e interesses podem abrir portas para novas experiências.</p><button class="btn" type="button" data-action="opportunities">Explorar oportunidades ${icon('arrow')}</button></section>
            <section class="side-card progress-card"><div class="card-title-row" style="margin-bottom:8px"><h3 class="card-title">O que você busca?</h3><button class="inline-action" type="button" data-action="edit" style="font-size:10px">Editar</button></div><p class="about-text">${safe(interests)}</p></section>
          </aside>
        </div>
        <footer class="profile-footer">SkillMatch · Suas habilidades. Sua oportunidade. &nbsp;|&nbsp; Prévia de TCC — dados armazenados somente neste navegador</footer>
      </div>
    </main>`;
  }
  function render() {
    if (view === 'profile') app.innerHTML = renderProfile();
    else if (view === 'signup') app.innerHTML = renderSignup();
    else app.innerHTML = renderLogin();
  }

  function submitLogin(form) {
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');
    const found = readAccounts().find(person => person.email.toLowerCase() === email && person.password === password);
    if (!found) {
      const error = document.getElementById('login-error');
      error.textContent = 'E-mail ou senha não conferem. Verifique seus dados ou crie uma conta.';
      document.getElementById('login-password').setAttribute('aria-invalid', 'true');
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email: found.email }));
    setView('profile');
    toast('Bem-vindo(a) de volta!');
  }
  function submitCandidate(form) {
    const data = new FormData(form);
    const name = String(data.get('fullName') || '').trim();
    const email = String(data.get('email') || '').trim().toLowerCase();
    const phone = String(data.get('phone') || '').trim();
    const city = String(data.get('city') || '').trim();
    const interests = data.getAll('interests');
    const error = document.getElementById('candidate-error');
    error.textContent = '';
    if (name.split(/\s+/).length < 2) { error.textContent = 'Informe seu nome e sobrenome.'; document.getElementById('fullName').focus(); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { error.textContent = 'Digite um e-mail válido.'; document.getElementById('email').focus(); return; }
    if (!phone) { error.textContent = 'Informe seu celular ou WhatsApp.'; document.getElementById('phone').focus(); return; }
    if (!city) { error.textContent = 'Informe sua cidade.'; document.getElementById('city').focus(); return; }
    if (!String(data.get('education') || '')) { error.textContent = 'Selecione sua escolaridade.'; document.getElementById('education').focus(); return; }
    if (interests.length === 0) { error.textContent = 'Selecione pelo menos um tipo de oportunidade.'; document.querySelector('input[name="interests"]').focus(); return; }
    if (!editing) {
      const password = String(data.get('password') || '');
      const confirm = String(data.get('confirmPassword') || '');
      if (password.length < 6) { error.textContent = 'Sua senha precisa ter pelo menos 6 caracteres.'; document.getElementById('password').focus(); return; }
      if (password !== confirm) { error.textContent = 'As senhas não são iguais. Confira e tente novamente.'; document.getElementById('confirmPassword').focus(); return; }
      if (readAccounts().some(person => person.email.toLowerCase() === email)) { error.textContent = 'Este e-mail já tem uma conta. Faça login para continuar.'; document.getElementById('email').focus(); return; }
    }
    const prior = editing ? currentCandidate() || {} : {};
    const candidate = {
      ...prior, name, email, phone, city,
      state: String(data.get('state') || ''),
      education: String(data.get('education') || ''),
      course: String(data.get('course') || '').trim(),
      interests,
      skills: String(data.get('skills') || '').split(',').map(item => item.trim()).filter(Boolean).slice(0, 12),
      about: String(data.get('about') || '').trim(),
      ...(editing ? {} : { password: String(data.get('password') || '') }),
    };
    if (editing) {
      const session = readSession();
      if (session?.demo) localStorage.setItem(SESSION_KEY, JSON.stringify({ demo: true, candidate }));
      else {
        const accounts = readAccounts().map(person => person.email.toLowerCase() === String(session?.email || '').toLowerCase() ? candidate : person);
        localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
        localStorage.setItem(SESSION_KEY, JSON.stringify({ email: candidate.email }));
      }
      setView('profile');
      toast('Seu perfil foi atualizado com sucesso.');
    } else {
      const accounts = readAccounts(); accounts.push(candidate);
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
      localStorage.setItem(SESSION_KEY, JSON.stringify({ email: candidate.email }));
      setView('profile');
      toast('Perfil criado! Agora é só explorar suas oportunidades.');
    }
  }
  function startDemo() {
    const candidate = {
      name: 'Marina Almeida', email: 'marina.demo@skillmatch.com', phone: '(41) 99999-1234', city: 'Curitiba', state: 'PR',
      education: 'Ensino técnico cursando', course: 'Desenvolvimento de Sistemas', interests: ['Estágio', 'Tecnologia', 'Jovem Aprendiz'],
      skills: ['HTML e CSS', 'Comunicação', 'Organização', 'Trabalho em equipe'], about: 'Sou estudante de Desenvolvimento de Sistemas e estou em busca da minha primeira oportunidade para aprender, colaborar e crescer na área de tecnologia.'
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify({ demo: true, candidate }));
    setView('profile');
    toast('Você está no modo demonstração. Nenhuma conta foi criada.');
  }

  document.addEventListener('submit', event => {
    if (event.target.id === 'login-form') { event.preventDefault(); submitLogin(event.target); }
    if (event.target.id === 'candidate-form') { event.preventDefault(); submitCandidate(event.target); }
  });
  document.addEventListener('click', event => {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    const action = control.dataset.action;
    if (action === 'signup') candidatesLanding();
    if (action === 'login' || action === 'home') showLogin();
    if (action === 'edit') setView('signup', true);
    if (action === 'cancel-edit') setView('profile');
    if (action === 'demo') startDemo();
    if (action === 'logout') { localStorage.removeItem(SESSION_KEY); setView('login'); toast('Você saiu da sua conta.'); }
    if (action === 'toggle-password') {
      const input = document.getElementById('login-password');
      input.type = input.type === 'password' ? 'text' : 'password';
      control.innerHTML = icon(input.type === 'password' ? 'eye' : 'eyeOff');
      control.setAttribute('aria-label', input.type === 'password' ? 'Mostrar senha' : 'Ocultar senha');
    }
    if (action === 'forgot') toast('A recuperação de senha será habilitada quando o backend estiver integrado.');
    if (action === 'terms') toast('Termos e política serão publicados na próxima etapa do projeto.');
    if (action === 'share') toast('Este perfil está visível apenas para você nesta demonstração.');
    if (action === 'opportunities') toast('As oportunidades são exemplos visuais. A integração com vagas será feita em uma próxima etapa.');
    if (action === 'notifications') toast('Você não tem notificações novas.');
  });
  document.addEventListener('input', event => {
    if (event.target.matches('#login-form input')) {
      const error = document.getElementById('login-error');
      if (error) error.textContent = '';
      event.target.removeAttribute('aria-invalid');
    }
  });
  render();
})();
