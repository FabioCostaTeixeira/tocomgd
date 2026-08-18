import { initEditor } from "./editor.js";

const {
  TenantError,
  readSlug,
  loadTenant,
} = window.AvatarTenant;

const appLoading = document.getElementById("appLoading");
const appShell = document.getElementById("appShell");
const landing = document.getElementById("landing");
const tenantError = document.getElementById("tenantError");
const tenantErrorTitle = document.getElementById("tenantErrorTitle");
const tenantErrorText = document.getElementById("tenantErrorText");
const brandLogo = document.getElementById("brandLogo");
const brandTitle = document.getElementById("brandTitle");
const brandDescription = document.getElementById("brandDescription");

function showLoading() {
  appLoading.hidden = false;
  appShell.hidden = true;
  landing.hidden = true;
  tenantError.hidden = true;
}

function showLanding() {
  appLoading.hidden = true;
  appShell.hidden = true;
  tenantError.hidden = true;
  landing.hidden = false;
}

function showApp() {
  appLoading.hidden = true;
  landing.hidden = true;
  tenantError.hidden = true;
  appShell.hidden = false;
}

function showError(code) {
  const messages = {
    tenant_inexistente: ["Cliente não encontrado", "Verifique o endereço e tente novamente."],
    slug_invalido: ["Endereço inválido", "Use um endereço de cliente válido."],
    slug_reservado: ["Endereço indisponível", "Esse endereço não pode ser usado como cliente."],
    rede: ["Não foi possível carregar", "Verifique sua conexão e tente novamente."],
    json_invalido: ["Configuração indisponível", "A configuração deste cliente está inválida."],
    config_invalida: ["Configuração indisponível", "A configuração deste cliente está inválida."],
    default_invalido: ["Editor indisponível", "O modelo padrão deste cliente está inválido."],
    padrao: ["Editor indisponível", "Não foi possível iniciar este editor."],
  };
  const [title, text] = messages[code] || messages.padrao;
  tenantErrorTitle.textContent = title;
  tenantErrorText.textContent = text;
  appLoading.hidden = true;
  landing.hidden = true;
  appShell.hidden = true;
  tenantError.hidden = false;
}

function applyBrand(brand) {
  document.title = brand.title;
  brandTitle.textContent = brand.title;
  brandDescription.textContent = brand.description;
  document.body.style.setProperty("--brand-primary", brand.primaryColor);
  document.body.style.setProperty("--brand-secondary", brand.secondaryColor);

  if (brand.logo) {
    brandLogo.src = brand.logo;
    brandLogo.hidden = false;
    brandLogo.addEventListener("error", () => {
      brandLogo.hidden = true;
    }, { once: true });
  } else {
    brandLogo.hidden = true;
  }
}

async function bootstrap() {
  showLoading();

  try {
    const slug = readSlug(window.location.pathname);

    if (slug === null) {
      showLanding();
      return;
    }

    const tenant = await loadTenant(slug);

    applyBrand(tenant.brand);

    await initEditor({
      slug: tenant.slug,
      templates: tenant.templates,
      formats: tenant.formats,
      defaultTemplate: tenant.defaults.template,
      defaultFormat: tenant.defaults.format,
    });

    showApp();
  } catch (error) {
    console.error(error);
    showError(error instanceof TenantError ? error.code : "padrao");
  }
}

bootstrap();
