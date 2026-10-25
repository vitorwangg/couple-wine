// Couple Wine: rotas, login e navegação.
import { sb, S, carregar, toast } from "./js/core.js";
import { telaLogin, telaForaDoCasal, telaNos } from "./js/views/conta.js";
import { telaAdega } from "./js/views/adega.js";
import { telaBuscar } from "./js/views/buscar.js";
import { telaForm } from "./js/views/form.js";
import { telaComparar } from "./js/views/comparar.js";
import { telaRankings } from "./js/views/rankings.js";
import { telaFicha } from "./js/views/ficha.js";
import { telaNumeros } from "./js/views/numeros.js";

const app = document.getElementById("app");
const nav = document.getElementById("nav");

// endereço → tela; "tab" acende o ícone de baixo, "semNav" esconde a barra
const ROTAS = [
  [/^\/$/, telaAdega, { tab: "adega" }],
  [/^\/buscar$/, telaBuscar, { semNav: true }],
  [/^\/novo$/, telaForm, { semNav: true }],
  [/^\/vinho\/([\w-]+)\/(editar|beber)$/, telaForm, { semNav: true }],
  [/^\/vinho\/([\w-]+)$/, telaFicha, { semNav: true }],
  [/^\/comparar\/([\w-]+)(?:\/(wang|clara))?$/, telaComparar, { semNav: true }],
  [/^\/rankings$/, telaRankings, { tab: "rankings" }],
  [/^\/numeros$/, telaNumeros, { tab: "numeros" }],
  [/^\/nos$/, telaNos, { tab: "nos" }],
];

let seq = 0;
async function rota() {
  const minha = ++seq;
  const path = (location.hash.slice(1) || "/").split("?")[0];
  if (!S.session) return mostrar(telaLogin, [], { semNav: true });
  if (!S.pessoa) return mostrar(telaForaDoCasal, [], { semNav: true });
  const achada = ROTAS.find(([re]) => re.test(path));
  if (!achada) { location.hash = "#/"; return; }
  const [re, tela, opts] = achada;
  try {
    if (!S.vinhos.length || opts.tab) await carregar();
  } catch (e) {
    toast("Não consegui carregar a adega: " + (e.message || e));
  }
  if (minha !== seq) return;
  mostrar(tela, path.match(re).slice(1), opts);
}

async function mostrar(tela, params, opts) {
  nav.hidden = !!opts.semNav;
  app.classList.toggle("sem-nav", !!opts.semNav);
  for (const a of nav.querySelectorAll("a[data-tab]")) a.classList.toggle("on", a.dataset.tab === opts.tab);
  window.scrollTo(0, 0);
  await tela(app, ...params);
}

async function entrar(session) {
  S.session = session;
  S.pessoa = null;
  if (session) {
    const { data, error } = await sb.rpc("cw_vincular");
    if (error) toast("Erro ao entrar: " + error.message);
    S.pessoa = data || null;
  }
}

sb.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session?.user?.id !== S.session?.user?.id) {
    setTimeout(async () => { await entrar(session); rota(); }, 0);
  } else if (event === "SIGNED_OUT") {
    S.session = null; S.pessoa = null; S.vinhos = [];
    rota();
  } else if (session) {
    S.session = session;
  }
});

window.addEventListener("hashchange", rota);

const { data } = await sb.auth.getSession();
await entrar(data.session);
rota();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
