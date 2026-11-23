import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { JSDOM, VirtualConsole } from "jsdom";

const root = process.cwd();
const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
const pause = (ms = 15) => new Promise((resolvePause) => nativeSetTimeout(resolvePause, ms));

function setDocument(dom, file) {
  const html = readFileSync(resolve(root, file), "utf8");
  dom.window.document.open();
  dom.window.document.write(html);
  dom.window.document.close();
  return dom.window.document;
}

function setBrowserGlobals(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.sessionStorage = dom.window.sessionStorage;
  globalThis.FileReader = dom.window.FileReader;
  dom.window.scrollTo = () => {};
  dom.window.HTMLElement.prototype.scrollTo = () => {};
  globalThis.setTimeout = (callback, delay, ...args) => {
    // The real browser follows the post-action redirect. JSDOM cannot navigate;
    // suppress delayed redirects/toast cleanup while keeping immediate UI tasks.
    if (Number(delay) >= 500) return nativeSetTimeout(() => {}, 0);
    return nativeSetTimeout(callback, delay, ...args);
  };
}

function click(elementOrSelector, scope = document) {
  const element = typeof elementOrSelector === "string" ? scope.querySelector(elementOrSelector) : elementOrSelector;
  assert.ok(element, `Elemento não encontrado: ${String(elementOrSelector)}`);
  element.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  return element;
}

function submit(form) {
  assert.ok(form, "Formulário não encontrado");
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
}

function change(element) {
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function setValue(id, value, scope = document) {
  const input = scope.querySelector(`#${id}`);
  assert.ok(input, `Campo #${id} não encontrado`);
  input.value = value;
  return input;
}

async function waitFor(predicate, message, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await pause(20);
  }
  assert.fail(message);
}

async function importPageModule(relativePath, tag) {
  const url = pathToFileURL(resolve(root, relativePath)).href;
  return import(`${url}?test=${encodeURIComponent(tag)}`);
}

test("fluxos principais do SkillMatch funcionam em modo demonstrativo", async (t) => {
  const unexpectedJSDOMErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => {
    // A navegação de página completa não é implementada pelo JSDOM, mas as
    // ações e mudanças de estado anteriores ao redirecionamento são testadas.
    if (!String(error.message).startsWith("Not implemented: navigation")) unexpectedJSDOMErrors.push(error);
  });
  const dom = new JSDOM(readFileSync(resolve(root, "cadastro.html"), "utf8"), {
    url: "http://localhost/cadastro.html",
    pretendToBeVisual: true,
    virtualConsole,
  });
  setBrowserGlobals(dom);

  const [{ AuthService }, { UserService }, { PlatformService }, { APP_CONFIG }] = await Promise.all([
    import("../assets/js/services/auth.service.js"),
    import("../assets/js/services/user.service.js"),
    import("../assets/js/services/platform.service.js"),
    import("../assets/js/config/app.config.js"),
  ]);

  await t.test("cadastro em 3 etapas valida, mantém os dados e não salva senha em texto puro", async () => {
    await importPageModule("assets/js/pages/cadastro.js", "signup");
    setValue("nome", "Teste Pessoa");
    setValue("email", "teste.integracao@skillmatch.test");
    setValue("senha", "Teste@1234");
    setValue("confirmarSenha", "Teste@1234");
    document.querySelector("#aceiteTermos").checked = true;
    click('[data-step="1"] [data-next]');
    assert.equal(document.querySelector(".step-panel.active").dataset.step, "2");

    setValue("telefone", "41999998888");
    setValue("dataNascimento", "2000-05-14");
    setValue("cidade", "Araucária");
    setValue("estado", "PR");
    setValue("escolaridade", "Ensino Médio (cursando)");
    click('[data-step="2"] [data-next]');
    assert.equal(document.querySelector(".step-panel.active").dataset.step, "3");
    assert.equal(document.querySelector("#nome").value, "Teste Pessoa");

    setValue("areaInteresse", "Administração");
    document.querySelector('input[name="tiposVaga"]').checked = true;
    setValue("disponibilidade", "Período integral");
    [...document.querySelectorAll("#skillsEditor .skill-chip")].slice(0, 3).forEach((chip) => click(chip));
    assert.equal(document.querySelectorAll("#skillsEditor .tag").length, 3);
    submit(document.querySelector("#registerForm"));
    await waitFor(() => UserService.listByRole("candidate").some((user) => user.email === "teste.integracao@skillmatch.test"), "O cadastro não foi salvo.");

    const storedUsers = JSON.parse(localStorage.getItem(APP_CONFIG.storageKeys.users));
    const registered = storedUsers.find((user) => user.email === "teste.integracao@skillmatch.test");
    assert.equal(registered.role, "candidate");
    assert.match(registered.senhaHash, /^pbkdf2\$/);
    assert.equal(registered.senhaHash.includes("Teste@1234"), false);
    assert.equal(AuthService.getSession()?.role, "candidate");
    assert.equal(PlatformService.getCandidateSettings(registered.id).visibleToCompanies, false, "Perfil novo deve permanecer privado até consentimento explícito.");
    AuthService.logout();
  });

  await t.test("login, mostrar senha e recuperação local de senha executam", async () => {
    setDocument(dom, "login.html");
    await importPageModule("assets/js/pages/login.js", "login");
    click('.toggle-password[data-target="senha"]');
    assert.equal(document.querySelector("#senha").type, "text");
    click('.toggle-password[data-target="senha"]');
    assert.equal(document.querySelector("#senha").type, "password");

    click('[data-demo-role="candidate"]');
    assert.equal(document.querySelector("#email").value, "demo@skillmatch.com");
    setValue("senha", "senha-incorreta");
    submit(document.querySelector("#loginForm"));
    await waitFor(() => document.querySelector("#loginAlert").classList.contains("show"), "O login deveria informar credenciais inválidas.");
    assert.match(document.querySelector("#loginAlertText").textContent, /incorretos/i);
    setValue("senha", "Skill@123");
    submit(document.querySelector("#loginForm"));
    await waitFor(() => AuthService.getSession()?.userId === "usr-demo-candidate", "O formulário de login não criou a sessão demonstrativa.");
    AuthService.logout();

    click('#forgotLink');
    setValue("resetEmail", "demo@skillmatch.com");
    submit(document.querySelector("#forgotRequestForm"));
    assert.equal(document.querySelector("#forgotCompleteForm").hidden, false);
    const code = document.querySelector("#resetCodeText").textContent.match(/\d{6}/)?.[0];
    assert.ok(code, "A recuperação deve gerar um código local visível e temporário.");
    const oldHash = JSON.parse(localStorage.getItem(APP_CONFIG.storageKeys.users)).find((user) => user.email === "demo@skillmatch.com").senhaHash;
    setValue("resetCode", code);
    setValue("resetNewPassword", "Recuperada@456");
    setValue("resetConfirmPassword", "Recuperada@456");
    submit(document.querySelector("#forgotCompleteForm"));
    await waitFor(() => JSON.parse(localStorage.getItem(APP_CONFIG.storageKeys.users)).find((user) => user.email === "demo@skillmatch.com").senhaHash !== oldHash, "A senha demonstrativa não foi alterada.");
    assert.match(document.querySelector("#resetCodeText").textContent, /nenhum e-mail foi enviado/i);
    await assert.rejects(AuthService.login("demo@skillmatch.com", "Skill@123", false, "candidate"), /incorretos/);
    await assert.rejects(AuthService.login("demo@skillmatch.com", "Recuperada@456", false, "admin"), /área de candidato/);
    await AuthService.login("demo@skillmatch.com", "Recuperada@456", false, "candidate");
    AuthService.logout();
  });

  await t.test("painel do candidato navega, filtra, registra interesses, plano e relatos", async () => {
    await AuthService.login("demo@skillmatch.com", "Recuperada@456", false, "candidate");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "candidate");
    assert.equal(document.querySelector("#sidebarRole").textContent, "Candidato");
    assert.equal(document.querySelector("#pageHeader h1").textContent, "Início");
    assert.equal(document.querySelectorAll("#appNav [data-view]").length, 11);

    click('#appNav [data-view="radar"]');
    assert.match(document.querySelector("#appContent").textContent, /Empresas no catálogo demonstrativo/);
    setValue("radarRadius", "25");
    change(document.querySelector("#radarRadius"));
    assert.equal(PlatformService.getCandidateSettings("usr-demo-candidate").distanceMaxKm, 25);
    setValue("radarCity", "Araucária");
    change(document.querySelector("#radarCity"));
    assert.equal(PlatformService.getCandidateSettings("usr-demo-candidate").radarCity, "Araucária");
    setValue("radarType", "Jovem Aprendiz");
    change(document.querySelector("#radarType"));
    assert.equal(PlatformService.getCandidateSettings("usr-demo-candidate").radarType, "Jovem Aprendiz");

    setValue("radarCity", "");
    change(document.querySelector("#radarCity"));
    setValue("radarType", "");
    change(document.querySelector("#radarType"));
    setValue("radarAddress", "Rua das Flores, Centro, Araucária - PR");
    submit(document.querySelector('form[data-form="radar-address"]'));
    assert.equal(PlatformService.getCandidateSettings("usr-demo-candidate").radarAddress, "Rua das Flores, Centro, Araucária - PR");
    setValue("radarRadius", "10");
    change(document.querySelector("#radarRadius"));
    assert.equal(document.querySelectorAll("#appContent .job-card").length, 1);
    assert.match(document.querySelector("#appContent").textContent, /Raio de até 10 km aplicado/);
    setValue("radarAddress", "Rua sem cidade reconhecida, 10");
    submit(document.querySelector('form[data-form="radar-address"]'));
    assert.match(document.querySelector("#appContent").textContent, /Endereço não reconhecido.*raio não foi aplicado/i);
    assert.equal(document.querySelectorAll("#appContent .job-card").length, 4);

    click('#appNav [data-view="jobs"]');
    assert.equal(document.querySelectorAll("#jobResults .job-card").length, 4);
    assert.match(document.querySelector("#jobResults").textContent, /R\$\s?1\.200/);
    click('#jobResults [data-action="job-details"][data-id="job-demo-ti"]');
    assert.match(document.querySelector("#appModalContent").textContent, /Por que esta oportunidade combina\?/);
    assert.match(document.querySelector("#appModalContent").textContent, /Requisitos atendidos:/);
    click('#appModalContent [data-action="close-modal"]');
    setValue("jobMinSalary", "1500");
    document.querySelector("#jobMinSalary").dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.equal(document.querySelectorAll("#jobResults .job-card").length, 2);
    setValue("jobSort", "salary");
    change(document.querySelector("#jobSort"));
    const salarySortedIds = [...document.querySelectorAll('#jobResults [data-action="job-details"]')].map((button) => button.dataset.id);
    assert.deepEqual(salarySortedIds, ["job-demo-atendimento", "job-demo-ti"]);
    setValue("jobMinSalary", "");
    document.querySelector("#jobMinSalary").dispatchEvent(new window.Event("input", { bubbles: true }));
    setValue("jobSort", "match");
    change(document.querySelector("#jobSort"));
    assert.equal(document.querySelectorAll("#jobResults .job-card").length, 4);
    setValue("jobSearch", "logística");
    document.querySelector("#jobSearch").dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.equal(document.querySelectorAll("#jobResults .job-card").length, 1);
    const opportunityId = document.querySelector('#jobResults [data-action="apply-job"]').dataset.id;
    click('#jobResults [data-action="apply-job"]');
    assert.equal(PlatformService.getCandidateApplications("usr-demo-candidate").length, 1);
    assert.equal(PlatformService.getCandidateApplications("usr-demo-candidate")[0].jobId, opportunityId);
    assert.match(document.querySelector("#jobResults").textContent, /Interesse registrado/);
    setValue("jobArea", "Logística");
    change(document.querySelector("#jobArea"));
    setValue("jobType", "Jovem Aprendiz");
    change(document.querySelector("#jobType"));
    setValue("jobModality", "Presencial");
    change(document.querySelector("#jobModality"));
    setValue("jobCity", "Araucária");
    document.querySelector("#jobCity").dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.equal(document.querySelectorAll("#jobResults .job-card").length, 1);
    setValue("jobCity", "Curitiba");
    document.querySelector("#jobCity").dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.equal(document.querySelectorAll("#jobResults .job-card").length, 0);
    click('#pageHeader [data-action="clear-job-filters"]');
    assert.equal(document.querySelectorAll("#jobResults .job-card").length, 4);

    click('#appNav [data-view="home"]');
    const recommendationSection = [...document.querySelectorAll("#appContent .panel-card")]
      .find((card) => card.querySelector("h2")?.textContent === "Oportunidades recomendadas");
    assert.ok(recommendationSection);
    assert.doesNotMatch(recommendationSection.textContent, /Auxiliar de logística/);

    click('#appNav [data-view="applications"]');
    assert.match(document.querySelector("#appContent").textContent, /Minhas candidaturas|Interesses registrados/);
    click('#appNav [data-view="courses"]');
    click('#appContent [data-progress="plan"]');
    assert.equal(PlatformService.getCourseProgress("usr-demo-candidate").planned.length, 1);
    click('#appNav [data-view="notifications"]');
    click('#appContent [data-action="mark-all-notifications"]');
    assert.equal(PlatformService.getCandidateNotifications("usr-demo-candidate").filter((item) => !item.read).length, 0);

    click('#appNav [data-view="settings"]');
    click('#appContent [data-action="open-report"]');
    setValue("reportCategory", "Problema técnico", document.querySelector("#appModalContent"));
    setValue("reportDescription", "Teste local do formulário de relato.", document.querySelector("#appModalContent"));
    submit(document.querySelector('#appModalContent form[data-form="report"]'));
    assert.equal(PlatformService.getReports().length, 1);
    assert.equal(PlatformService.getReports()[0].status, "Aberto");

    click('#appNav [data-view="settings"]');
    const settingsForm = document.querySelector('form[data-form="candidate-settings"]');
    setValue("settingDistance", "100", settingsForm);
    document.querySelector("#settingVisible").checked = false;
    document.querySelector("#settingJobNotifications").checked = false;
    submit(settingsForm);
    assert.deepEqual(
      (({ distanceMaxKm, visibleToCompanies, notifyNewJobs }) => ({ distanceMaxKm, visibleToCompanies, notifyNewJobs }))(PlatformService.getCandidateSettings("usr-demo-candidate")),
      { distanceMaxKm: 100, visibleToCompanies: false, notifyNewJobs: false },
    );

    setValue("accountEmail", "  Mari.Costa+Teste@skillmatch.test  ");
    submit(document.querySelector('form[data-form="account-email"]'));
    await waitFor(() => UserService.listByRole("candidate").some((user) => user.id === "usr-demo-candidate" && user.email === "mari.costa+teste@skillmatch.test"), "O e-mail não foi atualizado.");
    assert.equal(AuthService.getSession().email, "mari.costa+teste@skillmatch.test");
    setValue("accountEmail", "empresa@skillmatch.com");
    submit(document.querySelector('form[data-form="account-email"]'));
    await pause();
    assert.equal((await UserService.getById("usr-demo-candidate")).email, "mari.costa+teste@skillmatch.test");

    const passwordForm = document.querySelector('form[data-form="password-change"]');
    const oldHash = JSON.parse(localStorage.getItem(APP_CONFIG.storageKeys.users)).find((user) => user.id === "usr-demo-candidate").senhaHash;
    setValue("currentPassword", "Recuperada@456", passwordForm);
    setValue("newPassword", "SeguraNova@789", passwordForm);
    setValue("confirmNewPassword", "SeguraNova@789", passwordForm);
    await assert.rejects(AuthService.changePassword("usr-demo-candidate", "senha errada", "SeguraNova@789"), /senha atual não confere/i);
    submit(passwordForm);
    await waitFor(() => JSON.parse(localStorage.getItem(APP_CONFIG.storageKeys.users)).find((user) => user.id === "usr-demo-candidate").senhaHash !== oldHash, "A troca de senha não foi salva.");
    AuthService.logout();
    await assert.rejects(AuthService.login("mari.costa+teste@skillmatch.test", "Recuperada@456", false, "candidate"), /incorretos/);
    await AuthService.login("mari.costa+teste@skillmatch.test", "SeguraNova@789", false, "candidate");

    click("#menuToggle");
    assert.equal(document.querySelector("#appSidebar").classList.contains("open"), true);
    click("#sidebarScrim");
    assert.equal(document.querySelector("#appSidebar").classList.contains("open"), false);
  });

  await t.test("perfil detalhado salva resumo, cursos e experiências", async () => {
    setDocument(dom, "perfil.html");
    await importPageModule("assets/js/pages/perfil.js", "profile");
    await waitFor(() => document.querySelector("#displayName")?.textContent === "Mariana Costa", "O perfil não carregou.");
    click('[data-edit="sobre"]');
    setValue("edit-resumo", "Resumo atualizado durante o teste de integração.");
    submit(document.querySelector('form[data-form="sobre"]'));
    await waitFor(async () => (await UserService.getById("usr-demo-candidate")).resumo.includes("teste de integração"), "O resumo não foi salvo.");

    click('[data-edit="cursos-experiencias"]');
    setValue("edit-cursos", "Curso complementar de teste\nPlanilhas demonstrativas");
    setValue("edit-experiencias", "Projeto escolar de integração");
    submit(document.querySelector('form[data-form="cursos-experiencias"]'));
    await waitFor(async () => (await UserService.getById("usr-demo-candidate")).cursos.length === 2, "Cursos e experiências não foram salvos.");
    const user = await UserService.getById("usr-demo-candidate");
    assert.deepEqual(user.cursos, ["Curso complementar de teste", "Planilhas demonstrativas"]);
    assert.deepEqual(user.experiencias, ["Projeto escolar de integração"]);
  });

  await t.test("cadastro empresarial valida, salva dados locais e cria acesso protegido por hash", async () => {
    AuthService.logout();
    setDocument(dom, "cadastro-empresa.html");
    await importPageModule("assets/js/pages/cadastro-empresa.js", "company-signup");
    setValue("companyName", "Oficina Horizonte Ltda.");
    setValue("companyCnpj", "11.222.333/0001-80");
    submit(document.querySelector("#companyRegisterForm"));
    assert.equal(document.querySelector("#companyCnpj").getAttribute("aria-invalid"), "true", "CNPJ com dígito incorreto deve impedir o cadastro");
    assert.equal(UserService.listByRole("company").some((user) => user.email === "contato.empresa@skillmatch.test"), false);
    setValue("companyCnpj", "11.222.333/0001-81");
    setValue("companySector", "Serviços");
    setValue("companyWebsite", "https://horizonte.example");
    setValue("companyDescription", "Empresa demonstrativa de serviços para teste de cadastro.");
    setValue("companyCity", "Curitiba");
    setValue("companyState", "PR");
    setValue("contactName", "Lucas Ribeiro");
    setValue("companyEmail", "contato.empresa@skillmatch.test");
    setValue("companyPassword", "EmpresaTeste@123");
    setValue("companyPasswordConfirm", "EmpresaTeste@123");
    document.querySelector("#companyTerms").checked = true;
    submit(document.querySelector("#companyRegisterForm"));
    await waitFor(() => UserService.listByRole("company").some((user) => user.email === "contato.empresa@skillmatch.test"), "A conta empresarial não foi criada.");
    const companyUser = UserService.listByRole("company").find((user) => user.email === "contato.empresa@skillmatch.test");
    assert.equal(AuthService.getSession()?.role, "company");
    assert.match(JSON.parse(localStorage.getItem(APP_CONFIG.storageKeys.users)).find((user) => user.id === companyUser.id).senhaHash, /^pbkdf2\$/);
    assert.equal(PlatformService.getCompany(companyUser.companyId).name, "Oficina Horizonte Ltda.");
    assert.equal(PlatformService.getCompany(companyUser.companyId).cnpj, "11222333000181");
    assert.equal(PlatformService.getCompany(companyUser.companyId).isDemo, true);
    assert.throws(() => PlatformService.createCompany("company-duplicate-test", "owner-duplicate-test", {
      name: "Outra empresa de teste", cnpj: "11.222.333/0001-81", city: "Curitiba", state: "PR",
    }), /CNPJ já está cadastrado/i);
    await assert.rejects(AuthService.login("contato.empresa@skillmatch.test", "EmpresaTeste@123", false, "candidate"), /área de empresa/i);
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "registered-company-panel");
    assert.equal(document.querySelector("#sidebarRole").textContent, "Empresa");
    assert.equal(document.querySelector("#sidebarName").textContent, "Lucas Ribeiro");
    click('#appNav [data-view="company-profile"]');
    assert.equal(document.querySelector("#companyCnpj").value, "11.222.333/0001-81");
    assert.equal(document.querySelector("#companyCnpj").readOnly, true);
    assert.match(document.querySelector("#companyCnpjHelp").textContent, /não consulta a Receita Federal/i);
    AuthService.logout();
  });

  await t.test("empresa publica, consulta candidatos e atualiza candidatura", async () => {
    AuthService.logout();
    await AuthService.login("empresa@skillmatch.com", "Skill@123", false, "company");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "company");
    assert.equal(document.querySelector("#sidebarRole").textContent, "Empresa");
    click('#appNav [data-view="company-applicants"]');
    assert.equal(document.querySelectorAll('#appContent [data-application-status]').length, 1);
    const statusSelect = document.querySelector("[data-application-status]");
    statusSelect.value = "Entrevista";
    change(statusSelect);
    assert.equal(PlatformService.getCompanyApplications("company-demo")[0].status, "Entrevista");
    const demoApplication = PlatformService.getCompanyApplications("company-demo")[0];
    click(`#appContent [data-action="schedule-interview"][data-id="${demoApplication.id}"]`);
    const interviewModal = document.querySelector("#appModalContent");
    const pastDate = new Date(Date.now() - 60 * 60 * 1000);
    setValue("interviewInviteStart", new Date(pastDate.getTime() - pastDate.getTimezoneOffset() * 60_000).toISOString().slice(0, 16), interviewModal);
    submit(interviewModal.querySelector('form[data-form="interview-invitation"]'));
    await waitFor(() => interviewModal.querySelector("#interviewInviteStart")?.closest(".field")?.classList.contains("invalid"), "O convite deveria recusar um horário passado.");
    assert.equal(PlatformService.getCompanyInterviewInvitations("company-demo").length, 0);
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setValue("interviewInviteStart", new Date(futureDate.getTime() - futureDate.getTimezoneOffset() * 60_000).toISOString().slice(0, 16), interviewModal);
    setValue("interviewInviteMode", "Online", interviewModal);
    setValue("interviewMeetingDetails", "https://meet.example.test/skillmatch", interviewModal);
    setValue("interviewInviteMessage", "Vamos conversar sobre sua candidatura e seus projetos de estudo.", interviewModal);
    submit(interviewModal.querySelector('form[data-form="interview-invitation"]'));
    await waitFor(() => PlatformService.getCompanyInterviewInvitations("company-demo").length === 1, "A empresa não conseguiu enviar o convite de entrevista.");
    const demoInterviewInvite = PlatformService.getCompanyInterviewInvitations("company-demo")[0];
    assert.equal(demoInterviewInvite.status, "pending");
    assert.equal(demoInterviewInvite.applicationId, demoApplication.id);
    assert.ok(PlatformService.getCandidateNotifications("usr-demo-candidate").some((item) => item.linkId === demoInterviewInvite.id));
    assert.match(document.querySelector("#appContent .application-history").textContent, /Recebida/);
    assert.match(document.querySelector("#appContent .application-history").textContent, /Entrevista/);
    click('#appNav [data-view="home"]');
    assert.match(document.querySelector("#appContent").textContent, /Funil de candidaturas/);
    assert.match(document.querySelector("#appContent").textContent, /Entrevista: 1/);
    click('#appNav [data-view="company-applicants"]');
    click('#appContent [data-action="view-candidate"][data-id="usr-demo-candidate"]');
    assert.match(document.querySelector("#appModalContent").textContent, /ocultos pela preferência de privacidade/);
    assert.doesNotMatch(document.querySelector("#appModalContent").textContent, /mari\.costa\+teste@skillmatch\.test|98765-4321/);
    click('#appModalContent [data-action="close-modal"]');

    AuthService.logout();
    await AuthService.login("mari.costa+teste@skillmatch.test", "SeguraNova@789", false, "candidate");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "candidate-privacy-update");
    click('#appNav [data-view="settings"]');
    document.querySelector("#settingVisible").checked = true;
    submit(document.querySelector('form[data-form="candidate-settings"]'));
    assert.equal(PlatformService.getCandidateSettings("usr-demo-candidate").visibleToCompanies, true);
    click('#appNav [data-view="connections"]');
    assert.match(document.querySelector("#appContent").textContent, /Convites para entrevistas/);
    assert.ok(document.querySelector(`[data-action="respond-interview-invitation"][data-response="accepted"][data-id="${demoInterviewInvite.id}"]`));
    click(`[data-action="respond-interview-invitation"][data-response="accepted"][data-id="${demoInterviewInvite.id}"]`);
    assert.equal(PlatformService.getCandidateInterviewInvitations("usr-demo-candidate")[0].status, "accepted");

    AuthService.logout();
    await AuthService.login("empresa@skillmatch.com", "Skill@123", false, "company");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "company-return");
    click('#appNav [data-view="company-connections"]');
    assert.match(document.querySelector("#appContent").textContent, /Entrevista aceita/);
    click('#appNav [data-view="company-applicants"]');
    click(`#appContent [data-action="schedule-interview"][data-id="${demoApplication.id}"]`);
    const secondInterviewModal = document.querySelector("#appModalContent");
    const secondFutureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    setValue("interviewInviteStart", new Date(secondFutureDate.getTime() - secondFutureDate.getTimezoneOffset() * 60_000).toISOString().slice(0, 16), secondInterviewModal);
    setValue("interviewInviteMode", "Presencial", secondInterviewModal);
    setValue("interviewMeetingDetails", "Sala demonstrativa, região central", secondInterviewModal);
    setValue("interviewInviteMessage", "Se preferir, podemos marcar outra data para conversar sobre a vaga.", secondInterviewModal);
    submit(secondInterviewModal.querySelector('form[data-form="interview-invitation"]'));
    await waitFor(() => PlatformService.getCompanyInterviewInvitations("company-demo").length === 2, "A empresa não conseguiu enviar um segundo convite.");
    const declinedInterviewInvite = PlatformService.getCompanyInterviewInvitations("company-demo").find((entry) => entry.status === "pending");

    AuthService.logout();
    await AuthService.login("mari.costa+teste@skillmatch.test", "SeguraNova@789", false, "candidate");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "candidate-decline-interview");
    click('#appNav [data-view="connections"]');
    click(`[data-action="respond-interview-invitation"][data-response="declined"][data-id="${declinedInterviewInvite.id}"]`);
    assert.equal(PlatformService.getCandidateInterviewInvitations("usr-demo-candidate").find((entry) => entry.id === declinedInterviewInvite.id).status, "declined");
    assert.ok(PlatformService.getCandidateNotifications("usr-demo-company").some((notification) => notification.linkId === declinedInterviewInvite.id));

    AuthService.logout();
    await AuthService.login("empresa@skillmatch.com", "Skill@123", false, "company");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "company-after-decline");
    click('#appNav [data-view="company-connections"]');
    assert.match(document.querySelector("#appContent").textContent, /Entrevista recusada/);
    click('#appNav [data-view="company-applicants"]');
    click('#appContent [data-action="view-candidate"][data-id="usr-demo-candidate"]');
    assert.match(document.querySelector("#appModalContent").textContent, /mari\.costa\+teste@skillmatch\.test/);
    assert.match(document.querySelector("#appModalContent").textContent, /98765-4321/);
    click('#appModalContent [data-action="close-modal"]');

    click('#appNav [data-view="company-profile"]');
    setValue("companyDescription", "Descrição de empresa fictícia salva pelo teste.");
    submit(document.querySelector('form[data-form="company-profile"]'));
    assert.equal(PlatformService.getCompany("company-demo").description, "Descrição de empresa fictícia salva pelo teste.");

    click('#appNav [data-view="company-jobs"]');
    click('#appContent [data-action="new-job"]');
    const modal = document.querySelector("#appModalContent");
    setValue("jobTitle", "Assistente de qualidade — demonstração", modal);
    setValue("jobArea", "Tecnologia da Informação", modal);
    setValue("jobType", "Estágio", modal);
    setValue("jobModality", "Híbrido", modal);
    setValue("jobCity", "Curitiba", modal);
    setValue("jobState", "PR", modal);
    setValue("jobAddress", "Região de teste", modal);
    setValue("jobEducation", "Ensino Técnico em curso", modal);
    setValue("jobDescription", "Anúncio fictício criado pelo teste de integração local.", modal);
    setValue("jobRequirements", "Organização\nComunicação", modal);
    setValue("jobBenefits", "Aprendizado demonstrativo", modal);
    setValue("jobSalaryMin", "1800", modal);
    setValue("jobSalaryMax", "2200", modal);
    submit(modal.querySelector('form[data-form="job"]'));
    await waitFor(() => PlatformService.getCompanyJobs("company-demo").some((job) => job.title.includes("qualidade")), "A empresa não conseguiu publicar o anúncio.");
    const newJob = PlatformService.getCompanyJobs("company-demo").find((job) => job.title.includes("qualidade"));
    assert.equal(newJob.approved, false);
    assert.equal(newJob.isDemo, true);
    assert.equal(newJob.salaryMin, 1800);
    assert.equal(newJob.salaryMax, 2200);

    click(`#appContent [data-action="edit-company-job"][data-id="${newJob.id}"]`);
    const editModal = document.querySelector("#appModalContent");
    setValue("jobSalaryMax", "1700", editModal);
    submit(editModal.querySelector('form[data-form="job"]'));
    await waitFor(() => editModal.querySelector("#jobSalaryMax")?.closest(".field")?.classList.contains("invalid"), "A faixa salarial inválida não foi sinalizada.");
    assert.equal(PlatformService.getAllJobs().find((job) => job.id === newJob.id).salaryMax, 2200);
    setValue("jobSalaryMax", "2500", editModal);
    submit(editModal.querySelector('form[data-form="job"]'));
    await waitFor(() => PlatformService.getAllJobs().find((job) => job.id === newJob.id).salaryMax === 2500, "A remuneração editada não foi salva.");
  });

  await t.test("favoritos, treino guiado e conexões respeitam consentimento e autorização", async () => {
    AuthService.logout();
    await AuthService.login("mari.costa+teste@skillmatch.test", "SeguraNova@789", false, "candidate");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "candidate-engagement");
    const candidate = UserService.listByRole("candidate").find((user) => user.email === "mari.costa+teste@skillmatch.test");

    click('#appNav [data-view="jobs"]');
    click('#appContent [data-action="toggle-favorite"][data-id="job-demo-ti"]');
    assert.equal(PlatformService.isFavorite(candidate.id, "job-demo-ti"), true);
    click('#appNav [data-view="favorites"]');
    assert.match(document.querySelector("#appContent").textContent, /Assistente de tecnologia/);

    click('#appNav [data-view="interviews"]');
    setValue("interviewAnswer", "Na escola organizei um projeto em grupo, combinei as tarefas com colegas e aprendi a comunicar os próximos passos.");
    submit(document.querySelector('form[data-form="interview-practice"]'));
    assert.equal(PlatformService.getInterviewHistory(candidate.id).length, 1);
    assert.match(document.querySelector("#appContent").textContent, /não é inteligência artificial/i);
    assert.match(document.querySelector("#appContent").textContent, /Clareza/);

    click('#appNav [data-view="connections"]');
    click('#appContent [data-action="start-company-connection"][data-id="company-demo"]');
    const introductionModal = document.querySelector("#appModalContent");
    setValue("connectionIntroduction", "Tenho interesse em conhecer a área e apresentar projetos de estudo e habilidades que estou desenvolvendo.", introductionModal);
    submit(introductionModal.querySelector('form[data-form="connection-introduction"]'));
    const candidateConnection = PlatformService.getCandidateConnections(candidate.id).find((entry) => entry.companyId === "company-demo");
    assert.equal(candidateConnection.status, "connected");
    assert.match(candidateConnection.messages[0].body, /projetos de estudo/);

    AuthService.logout();
    await AuthService.login("teste.integracao@skillmatch.test", "Teste@1234", false, "candidate");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "candidate-consent");
    const invitee = UserService.listByRole("candidate").find((user) => user.email === "teste.integracao@skillmatch.test");
    const demoCompanyOwnerId = PlatformService.getCompany("company-demo").ownerId;
    assert.equal(PlatformService.getCandidateSettings(invitee.id).visibleToCompanies, false);
    assert.equal(PlatformService.canCompanyViewCandidate("company-demo", invitee.id), false);
    assert.equal(PlatformService.canCompanyViewContact("company-demo", invitee.id), false);
    assert.throws(() => PlatformService.inviteCandidate("company-demo", demoCompanyOwnerId, invitee.id, "Convite enviado sem autorização explícita para o teste."), /não autorizou/i);
    assert.throws(() => PlatformService.toggleSavedTalent("company-demo", demoCompanyOwnerId, invitee.id), /consentimento explícito/i);
    click('#appNav [data-view="settings"]');
    document.querySelector("#settingVisible").checked = true;
    submit(document.querySelector('form[data-form="candidate-settings"]'));
    assert.equal(PlatformService.getCandidateSettings(invitee.id).visibleToCompanies, true);
    assert.equal(PlatformService.canCompanyViewCandidate("company-demo", invitee.id), true);
    assert.equal(PlatformService.canCompanyViewContact("company-demo", invitee.id), false, "Consentimento para busca não libera contato sem candidatura ou conexão aceita.");

    AuthService.logout();
    await AuthService.login("empresa@skillmatch.com", "Skill@123", false, "company");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "company-engagement");
    click('#appNav [data-view="company-talent"]');
    assert.ok(document.querySelector(`[data-action="view-candidate"][data-id="${candidate.id}"]`));
    click(`#appContent [data-action="toggle-saved-talent"][data-id="${candidate.id}"]`);
    assert.equal(PlatformService.isTalentSaved("company-demo", candidate.id), true);
    click('#appNav [data-view="company-connections"]');
    assert.match(document.querySelector("#appContent").textContent, /projetos de estudo/);
    const messageForm = document.querySelector('#appContent form[data-form="connection-message"]');
    messageForm.querySelector("textarea").value = "Obrigado por se apresentar. Vamos manter esta conversa demonstrativa por aqui.";
    submit(messageForm);
    assert.ok(PlatformService.getConnectionMessages(candidateConnection.id, "usr-demo-company").some((message) => message.body.includes("Obrigado por se apresentar")));

    click('#appNav [data-view="company-talent"]');
    assert.ok(document.querySelector(`#appContent [data-action="invite-candidate"][data-id="${invitee.id}"]`));
    click(`#appContent [data-action="invite-candidate"][data-id="${invitee.id}"]`);
    const inviteModal = document.querySelector("#appModalContent");
    setValue("candidateInvitation", "Gostaríamos de convidar você para conhecer uma oportunidade demonstrativa na área administrativa.", inviteModal);
    submit(inviteModal.querySelector('form[data-form="connection-invite"]'));
    const demoInvite = PlatformService.getCompanyConnections("company-demo").find((entry) => entry.candidateId === invitee.id);
    assert.equal(demoInvite.status, "pending");
    assert.equal(PlatformService.canCompanyViewContact("company-demo", invitee.id), false);

    AuthService.logout();
    await AuthService.login("teste.integracao@skillmatch.test", "Teste@1234", false, "candidate");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "candidate-invitation");
    click('#appNav [data-view="connections"]');
    assert.ok(document.querySelector(`[data-action="accept-connection"][data-id="${demoInvite.id}"]`));
    click(`[data-action="accept-connection"][data-id="${demoInvite.id}"]`);
    assert.equal(PlatformService.getConnection(demoInvite.id).status, "connected");
    const acceptedMessageForm = document.querySelector(`#appContent form[data-form="connection-message"][data-connection-id="${demoInvite.id}"]`);
    acceptedMessageForm.querySelector("textarea").value = "Confirmo o recebimento do convite e agradeço o contato demonstrativo.";
    submit(acceptedMessageForm);
    assert.ok(PlatformService.getConnectionMessages(demoInvite.id, invitee.id).length > 0);
    assert.equal(PlatformService.canCompanyViewContact("company-demo", invitee.id), true);
    click('#appNav [data-view="settings"]');
    document.querySelector("#settingVisible").checked = false;
    submit(document.querySelector('form[data-form="candidate-settings"]'));
    assert.equal(PlatformService.canCompanyViewCandidate("company-demo", invitee.id), true, "A conexão aceita mantém o perfil acessível para a conversa.");
    assert.equal(PlatformService.canCompanyViewContact("company-demo", invitee.id), false, "A revogação de visibilidade esconde o contato mesmo após a conexão.");
    PlatformService.toggleFavorite(invitee.id, "job-demo-ti");
    PlatformService.saveInterviewPractice(invitee.id, {
      jobType: "Primeiro Emprego",
      experienceLevel: "Primeira oportunidade",
      question: "Conte sobre uma atividade em equipe.",
      answer: "Organizei as tarefas em um projeto escolar e mantive o grupo atualizado sobre as etapas.",
      feedback: { strengths: ["Exemplo concreto"] },
    });
    PlatformService.createReport(
      { id: invitee.id, nome: "Teste Pessoa", role: "candidate" },
      { category: "Contato inadequado", description: "Relato fictício para validar a limpeza de dados.", connectionId: demoInvite.id },
    );
    click('#appNav [data-view="settings"]');
    assert.ok(document.querySelector('#appContent [data-action="delete-demo-account"]'));
    click('#appContent [data-action="delete-demo-account"]');
    click('#appModalContent [data-action="confirm-modal"]');
    await waitFor(async () => (await UserService.getById(invitee.id)) === null && AuthService.getSession() === null, "A exclusão local da conta não foi concluída.");
    assert.equal(await UserService.getById(invitee.id), null);
    assert.equal(PlatformService.getConnection(demoInvite.id), null);
    assert.equal(PlatformService.getCandidateConnections(invitee.id).length, 0);
    assert.equal(PlatformService.getCandidateFavorites(invitee.id).length, 0);
    assert.equal(PlatformService.getInterviewHistory(invitee.id).length, 0);
    assert.equal(PlatformService.getReports().some((report) => report.userId === invitee.id), false);

    await AuthService.login("empresa@skillmatch.com", "Skill@123", false, "company");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "company-block-report");
    click('#appNav [data-view="company-connections"]');
    click(`#appContent [data-action="report-connection"][data-id="${candidateConnection.id}"]`);
    const connectionReportForm = document.querySelector('#appModalContent form[data-form="report"]');
    setValue("reportCategory", "Contato inadequado", connectionReportForm);
    setValue("reportDescription", "Relato de demonstração associado à conversa autorizada.", connectionReportForm);
    submit(connectionReportForm);
    const connectionReport = PlatformService.getReports().find((report) => report.connectionId === candidateConnection.id);
    assert.ok(connectionReport);
    assert.equal(connectionReport.userId, "usr-demo-company");

    click(`#appContent [data-action="block-connection"][data-id="${candidateConnection.id}"]`);
    click('#appModalContent [data-action="confirm-modal"]');
    await waitFor(() => PlatformService.getConnection(candidateConnection.id)?.status === "blocked", "A ação de bloqueio não foi aplicada.");
    assert.throws(() => PlatformService.sendConnectionMessage(candidateConnection.id, "usr-demo-company", "Mensagem após bloqueio."), /após a conexão ser aceita/i);
    assert.equal(document.querySelector(`#appContent form[data-form="connection-message"][data-connection-id="${candidateConnection.id}"]`), null);
  });

  await t.test("administração administra contas, revisa vaga, anúncio e relato", async () => {
    AuthService.logout();
    await AuthService.login("admin@skillmatch.com", "Admin@123", false, "admin");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "admin");
    assert.equal(document.querySelector("#sidebarRole").textContent, "Administração");

    click('#appNav [data-view="admin-jobs"]');
    const job = PlatformService.getCompanyJobs("company-demo").find((entry) => entry.title.includes("qualidade"));
    const candidatePreferences = PlatformService.getCandidateSettings("usr-demo-candidate");
    PlatformService.saveCandidateSettings("usr-demo-candidate", { ...candidatePreferences, notifyNewJobs: true });
    const approve = document.querySelector(`[data-action="toggle-job-approval"][data-id="${job.id}"]`);
    click(approve);
    assert.equal(PlatformService.getPublishedJobs().some((entry) => entry.id === job.id), true);
    click(`#appContent [data-action="toggle-job-approval"][data-id="${job.id}"]`);
    assert.equal(PlatformService.getPublishedJobs().some((entry) => entry.id === job.id), false);
    click(`#appContent [data-action="toggle-job-approval"][data-id="${job.id}"]`);
    assert.equal(PlatformService.getPublishedJobs().some((entry) => entry.id === job.id), true);
    const jobNotifications = PlatformService.getCandidateNotifications("usr-demo-candidate")
      .filter((notification) => notification.type === "job" && notification.linkId === job.id);
    assert.equal(jobNotifications.length, 1, "A mesma aprovação não deve gerar avisos duplicados para a oportunidade.");

    click('#appNav [data-view="admin-companies"]');
    click('[data-action="toggle-company-verification"][data-id="company-demo"]');
    assert.equal(PlatformService.getCompany("company-demo").verified, true);
    click('[data-action="toggle-company-active"][data-id="company-demo"]');
    assert.equal(PlatformService.getCompany("company-demo").active, false);
    click('[data-action="toggle-company-active"][data-id="company-demo"]');
    assert.equal(PlatformService.getCompany("company-demo").active, true);

    click('#appNav [data-view="admin-ads"]');
    click('#appContent [data-action="new-ad"]');
    const modal = document.querySelector("#appModalContent");
    setValue("adTitle", "Aviso de teste", modal);
    setValue("adMessage", "Comunicado local para verificar a publicação no painel.", modal);
    submit(modal.querySelector('form[data-form="ad"]'));
    assert.equal(PlatformService.getCandidateAds()[0].title, "Aviso de teste");

    click('#appNav [data-view="admin-reports"]');
    assert.match(document.querySelector("#appContent").textContent, /Teste local do formulário de relato/);
    click('#appContent [data-action="toggle-report"]');
    assert.equal(PlatformService.getReports()[0].status, "Resolvido");

    click('#appNav [data-view="admin-candidates"]');
    assert.ok(document.querySelectorAll("#adminCandidateResults tr").length >= 1);
    click('#adminCandidateResults [data-action="toggle-candidate-status"][data-id="usr-demo-candidate"]');
    assert.equal((await UserService.getById("usr-demo-candidate")).status, "blocked");
    await assert.rejects(AuthService.login("mari.costa+teste@skillmatch.test", "SeguraNova@789", false, "candidate"), /bloqueada/i);
    click('#adminCandidateResults [data-action="toggle-candidate-status"][data-id="usr-demo-candidate"]');
    assert.equal((await UserService.getById("usr-demo-candidate")).status, "active");
  });

  await t.test("áreas e dados salvos persistem após reabrir o painel; logout encerra a sessão", async () => {
    AuthService.logout();
    await AuthService.login("mari.costa+teste@skillmatch.test", "SeguraNova@789", false, "candidate");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "candidate-return");
    assert.match(document.querySelector("#appContent").textContent, /Aviso de teste/);
    click('#appNav [data-view="jobs"]');
    assert.ok([...document.querySelectorAll("#jobResults .job-card")].some((card) => card.textContent.includes("qualidade")));
    assert.ok(PlatformService.getCandidateNotifications("usr-demo-candidate").some((item) => item.type === "application"));

    const persistedLocalStorage = Array.from({ length: localStorage.length }, (_, index) => {
      const key = localStorage.key(index);
      return [key, localStorage.getItem(key)];
    });
    const persistedSessionStorage = Array.from({ length: sessionStorage.length }, (_, index) => {
      const key = sessionStorage.key(index);
      return [key, sessionStorage.getItem(key)];
    });
    const reopenedDom = new JSDOM(readFileSync(resolve(root, "painel.html"), "utf8"), {
      url: "http://localhost/painel.html",
      pretendToBeVisual: true,
      virtualConsole,
    });
    setBrowserGlobals(reopenedDom);
    persistedLocalStorage.forEach(([key, value]) => localStorage.setItem(key, value));
    persistedSessionStorage.forEach(([key, value]) => sessionStorage.setItem(key, value));
    await importPageModule("assets/js/pages/painel.js", "candidate-reload-persistence");
    assert.equal(AuthService.getSession()?.userId, "usr-demo-candidate");
    assert.match((await UserService.getById("usr-demo-candidate")).resumo, /teste de integração/);
    assert.equal(PlatformService.isFavorite("usr-demo-candidate", "job-demo-ti"), true);
    assert.ok(PlatformService.getCandidateApplications("usr-demo-candidate").some((application) => application.job?.title.includes("Auxiliar de logística")));
    assert.ok(PlatformService.getInterviewHistory("usr-demo-candidate").length > 0);
    assert.ok(PlatformService.getCandidateConnections("usr-demo-candidate").some((connection) => connection.companyId === "company-demo"));

    click("#logoutButtonTop");
    assert.equal(document.querySelector("#appModal").classList.contains("open"), true);
    click('#appModalContent [data-action="confirm-modal"]');
    await waitFor(() => AuthService.getSession() === null, "O botão de logout não encerrou a sessão.");
    reopenedDom.window.close();
  });

  assert.deepEqual(unexpectedJSDOMErrors, [], unexpectedJSDOMErrors.map((error) => error.stack || error.message).join("\n"));
  globalThis.setTimeout = nativeSetTimeout;
  dom.window.close();
});
