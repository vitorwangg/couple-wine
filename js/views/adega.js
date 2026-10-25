// Adega: "Já bebemos" e "Quero provar", com os avisos do que falta pra você.
import { S, NOMES, esc, avatar, thumb, origem, notasCurtas, quemTxt, media, estrelas, estrelasTxt, virgula, pendentes, assinar, plain, outra, ICONE } from "../core.js";

export async function telaAdega(el) {
  const vinhos = S.vinhos;
  await assinar(vinhos.map((v) => v.rotulo_path));
  // o que falta pros dois (muitas vezes um celular faz pelo casal), primeiro o de quem está com o celular
  const pend = [S.pessoa, outra(S.pessoa)].flatMap((p) => pendentes(p).map((x) => ({ ...x, p })));
  const nB = vinhos.filter((v) => v.status === "bebido").length;
  const nQ = vinhos.length - nB;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div class="mao">la nostra cantina</div>
        <h1>Couple <em>Wine</em></h1>
      </div>
      <a href="#/nos" class="duo" aria-label="Nós">${avatar("wang")}${avatar("clara")}</a>
    </div>

    ${pend.slice(0, 4).map(({ v, falta, p }) => `
      <a class="pendente" href="${falta === "nota" ? `#/vinho/${v.id}/editar` : `#/comparar/${v.id}/${p}`}">
        ${avatar(p, 40)}
        <span>${falta === "nota"
          ? `<b>Falta a nota ${p === "wang" ? "do Wang" : "da Clara"}:</b> ${esc(v.nome)}.`
          : `<b>${NOMES[p]}: encaixe ${esc(v.nome)}</b> no ranking de ${v.tipo === "tinto" ? "tintos" : "brancos e rosés"}.`}</span>
        <span style="flex:0;color:var(--vinho)">${ICONE.seta}</span>
      </a>`).join("")}
    ${pend.length > 4 ? `<div class="peq">e mais ${pend.length - 4} esperando vocês</div>` : ""}

    <div class="seg" role="group" aria-label="Lista">
      <button data-tab="bebido" aria-pressed="${S.tabAdega === "bebido"}">Já bebemos · ${nB}</button>
      <button data-tab="quero" aria-pressed="${S.tabAdega === "quero"}">Quero provar · ${nQ}</button>
    </div>

    <label class="busca" ${vinhos.length < 6 ? "hidden" : ""}>${ICONE.lupa}<input id="filtro" type="search" placeholder="Procurar na adega" aria-label="Procurar na adega"></label>

    <div id="lista" class="lista"></div>`;

  const lista = el.querySelector("#lista");
  const filtro = el.querySelector("#filtro");

  const desenhar = () => {
    const q = plain(filtro.value);
    const doTab = vinhos.filter((v) => v.status === S.tabAdega)
      .filter((v) => !q || plain([v.nome, v.produtor, v.pais, v.uva, v.regiao].join(" ")).includes(q));
    if (S.tabAdega === "bebido") doTab.sort((a, b) => (b.bebido_em || b.criado_em).localeCompare(a.bebido_em || a.criado_em));
    if (!doTab.length) {
      lista.innerHTML = q ? `<div class="vazio">Nada com “${esc(filtro.value)}”.</div>` : S.tabAdega === "bebido"
        ? `<div class="vazio"><div class="mao">salute!</div>A adega está vazia. Toque no <b>+</b> pra cadastrar o primeiro vinho.</div>`
        : `<div class="vazio"><div class="mao">un giorno…</div>Nenhum vinho na lista de vontades ainda. Busque um e toque em <b>Quero provar</b>.</div>`;
      return;
    }
    lista.innerHTML = doTab.map((v) => S.tabAdega === "bebido" ? itemBebido(v) : itemQuero(v)).join("");
  };

  el.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
    S.tabAdega = b.dataset.tab;
    el.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    desenhar();
  }));
  filtro.addEventListener("input", desenhar);
  desenhar();
}

function itemBebido(v) {
  const e = estrelas(media(v));
  return `
    <a class="item" href="#/vinho/${v.id}">
      <div class="mini">${thumb(v)}</div>
      <div class="info">
        <div class="nome">${esc(v.nome)}</div>
        <div class="peq">${esc(origem(v))}</div>
        <div class="meta"><span class="tag">${quemTxt(v.quem)}</span><span>${notasCurtas(v)}</span></div>
      </div>
      <div class="nota-dir">
        <b>${e == null ? "–" : virgula(e)}</b>
        <span class="estr" aria-label="${e == null ? "sem nota" : virgula(e) + " estrelas"}">${estrelasTxt(e)}</span>
      </div>
    </a>`;
}

function itemQuero(v) {
  return `
    <div class="item">
      <a href="#/vinho/${v.id}" class="mini" aria-label="${esc(v.nome)}">${thumb(v)}</a>
      <a href="#/vinho/${v.id}" class="info" style="text-decoration:none;color:inherit">
        <div class="nome">${esc(v.nome)}</div>
        <div class="peq">${esc(origem(v))}</div>
        ${v.obs ? `<div class="mao" style="font-size:17px">${esc(v.obs)}</div>` : ""}
      </a>
      <a href="#/vinho/${v.id}/beber" class="btn" style="min-height:44px;padding:0 12px;font-size:13px">Bebemos!</a>
    </div>`;
}
