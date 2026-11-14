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
    AuthService.logout();
  });

  await t.test("login, mostrar senha e recuperação local de senha executam", async () => {
    setDocument(dom, "index.html");
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
    assert.equal(document.querySelectorAll("#appNav [data-view]").length, 8);

    click('#appNav [data-view="radar"]');
    assert.match(document.querySelector("#appContent").textContent, /Empresas demonstrativas encontradas/);
    setValue("radarRadius", "25");
    change(document.querySelector("#radarRadius"));
    assert.equal(PlatformService.getCandidateSettings("usr-demo-candidate").distanceMaxKm, 25);

    click('#appNav [data-view="jobs"]');
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

    AuthService.logout();
    await AuthService.login("empresa@skillmatch.com", "Skill@123", false, "company");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "company-return");
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
    submit(modal.querySelector('form[data-form="job"]'));
    await waitFor(() => PlatformService.getCompanyJobs("company-demo").some((job) => job.title.includes("qualidade")), "A empresa não conseguiu publicar o anúncio.");
    const newJob = PlatformService.getCompanyJobs("company-demo").find((job) => job.title.includes("qualidade"));
    assert.equal(newJob.approved, false);
    assert.equal(newJob.isDemo, true);
  });

  await t.test("administração administra contas, revisa vaga, anúncio e relato", async () => {
    AuthService.logout();
    await AuthService.login("admin@skillmatch.com", "Admin@123", false, "admin");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "admin");
    assert.equal(document.querySelector("#sidebarRole").textContent, "Administração");

    click('#appNav [data-view="admin-jobs"]');
    const job = PlatformService.getCompanyJobs("company-demo").find((entry) => entry.title.includes("qualidade"));
    const approve = document.querySelector(`[data-action="toggle-job-approval"][data-id="${job.id}"]`);
    click(approve);
    assert.equal(PlatformService.getPublishedJobs().some((entry) => entry.id === job.id), true);
    click(`#appContent [data-action="toggle-job-approval"][data-id="${job.id}"]`);
    assert.equal(PlatformService.getPublishedJobs().some((entry) => entry.id === job.id), false);
    click(`#appContent [data-action="toggle-job-approval"][data-id="${job.id}"]`);
    assert.equal(PlatformService.getPublishedJobs().some((entry) => entry.id === job.id), true);

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
    assert.ok(document.querySelectorAll("#adminCandidateResults tr").length >= 2);
    click('#adminCandidateResults [data-action="toggle-candidate-status"][data-id="usr-demo-candidate"]');
    assert.equal((await UserService.getById("usr-demo-candidate")).status, "blocked");
    await assert.rejects(AuthService.login("mari.costa+teste@skillmatch.test", "SeguraNova@789", false, "candidate"), /bloqueada/i);
    click('#adminCandidateResults [data-action="toggle-candidate-status"][data-id="usr-demo-candidate"]');
    assert.equal((await UserService.getById("usr-demo-candidate")).status, "active");
  });

  await t.test("áreas refletem as mudanças e logout encerra a sessão", async () => {
    AuthService.logout();
    await AuthService.login("mari.costa+teste@skillmatch.test", "SeguraNova@789", false, "candidate");
    setDocument(dom, "painel.html");
    await importPageModule("assets/js/pages/painel.js", "candidate-return");
    assert.match(document.querySelector("#appContent").textContent, /Aviso de teste/);
    click('#appNav [data-view="jobs"]');
    assert.ok([...document.querySelectorAll("#jobResults .job-card")].some((card) => card.textContent.includes("qualidade")));
    assert.ok(PlatformService.getCandidateNotifications("usr-demo-candidate").some((item) => item.type === "application"));

    click("#logoutButtonTop");
    assert.equal(document.querySelector("#appModal").classList.contains("open"), true);
    click('#appModalContent [data-action="confirm-modal"]');
    await waitFor(() => AuthService.getSession() === null, "O botão de logout não encerrou a sessão.");
  });

  assert.deepEqual(unexpectedJSDOMErrors, [], unexpectedJSDOMErrors.map((error) => error.stack || error.message).join("\n"));
  globalThis.setTimeout = nativeSetTimeout;
  dom.window.close();
});
