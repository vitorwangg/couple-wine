// Números: países, uva e país favoritos, gastos, boas compras e onde vocês discordam.
import { S, esc, bebidos, media, notaDe, brl, virgula } from "../core.js";

export async function telaNumeros(el) {
  const todos = bebidos();
  const anos = [...new Set(todos.map((v) => (v.bebido_em || v.criado_em).slice(0, 4)))].sort().reverse();
  if (S.ano && !anos.includes(S.ano)) S.ano = null;

  const desenhar = () => {
    const vs = todos.filter((v) => !S.ano || (v.bebido_em || v.criado_em).startsWith(S.ano));
    el.innerHTML = `
      <div>
        <div class="mao">il conto</div>
        <h1>Nossos números</h1>
      </div>
      ${anos.length > 1 ? `<div class="chips-ano">
        <button data-a="" aria-pressed="${!S.ano}">Tudo</button>
        ${anos.map((a) => `<button data-a="${a}" aria-pressed="${S.ano === a}">${a}</button>`).join("")}
      </div>` : ""}
      ${vs.length ? corpo(vs) : `<div class="vazio"><div class="mao">ancora niente</div>Os números aparecem quando tiver vinho na adega.</div>`}`;
    el.querySelectorAll(".chips-ano button").forEach((b) => b.addEventListener("click", () => { S.ano = b.dataset.a || null; desenhar(); }));
  };
  desenhar();
}

function corpo(vs) {
  const pagos = vs.filter((v) => v.preco_pago != null);
  const gasto = pagos.reduce((a, v) => a + Number(v.preco_pago), 0);
  const paises = contar(vs, (v) => v.pais);
  const max = paises[0]?.[1] || 1;

  // favoritos: maior média com pelo menos 2 garrafas (ou a única que tiver)
  const fav = (chave) => {
    const g = {};
    for (const v of vs) { const k = chave(v), m = media(v); if (k && m != null) (g[k] ||= []).push(m); }
    const l = Object.entries(g).map(([k, ms]) => [k, ms.reduce((a, b) => a + b, 0) / ms.length, ms.length]);
    const bons = l.filter((x) => x[2] >= 2);
    return (bons.length ? bons : l).sort((a, b) => b[1] - a[1])[0];
  };
  const uva = fav((v) => v.uva), pais = fav((v) => v.pais);

  const comMercado = pagos.filter((v) => v.preco_min != null);
  const boas = comMercado.filter((v) => Number(v.preco_pago) < Number(v.preco_min) * 0.95).length;

  const juntos = vs.filter((v) => v.quem === "nos" && notaDe(v, "wang") != null && notaDe(v, "clara") != null);
  const brigas = [...juntos].sort((a, b) => Math.abs(notaDe(b, "wang") - notaDe(b, "clara")) - Math.abs(notaDe(a, "wang") - notaDe(a, "clara")))
    .filter((v) => notaDe(v, "wang") !== notaDe(v, "clara")).slice(0, 3);
  const concordam = juntos.length ? Math.round(juntos.filter((v) => Math.abs(notaDe(v, "wang") - notaDe(v, "clara")) <= 1).length / juntos.length * 100) : null;

  return `
    <div class="kpis">
      <div class="kpi"><b>${vs.length}</b><span class="peq">${vs.length === 1 ? "vinho" : "vinhos"}</span></div>
      <div class="kpi"><b>${paises.length}</b><span class="peq">${paises.length === 1 ? "país" : "países"}</span></div>
      <div class="kpi"><b style="font-size:${gasto >= 10000 ? 21 : 24}px;line-height:34px">${gasto >= 1000 ? `R$ ${virgula(Math.round(gasto / 100) / 10)}k` : brl(gasto)}</b><span class="peq">gastos</span></div>
    </div>

    ${paises.length ? `<div class="card" style="display:flex;flex-direction:column;gap:12px">
      <div class="lbl">Por onde a gente viajou na taça</div>
      ${paises.map(([p, n]) => `<div class="barra-l"><span class="nm">${esc(p)}</span><span class="tr"><i style="width:${Math.round(n / max * 100)}%"></i></span><span class="n">${n}</span></div>`).join("")}
    </div>` : ""}

    <div class="grade2">
      ${uva ? `<div class="card fav"><div class="lbl">Uva favorita</div><b>${esc(uva[0])}</b><span class="peq">média ${virgula(Math.round(uva[1] * 10) / 10)} · ${uva[2]} ${uva[2] === 1 ? "garrafa" : "garrafas"}</span></div>` : ""}
      ${pais ? `<div class="card fav"><div class="lbl">País favorito</div><b>${esc(pais[0])}</b><span class="peq">média ${virgula(Math.round(pais[1] * 10) / 10)} · ${pais[2]} ${pais[2] === 1 ? "garrafa" : "garrafas"}</span></div>` : ""}
      ${pagos.length ? `<div class="card fav"><div class="lbl">Preço médio</div><b>${brl(gasto / pagos.length)}</b><span class="peq">por garrafa</span></div>` : ""}
      ${comMercado.length ? `<div class="card fav"><div class="lbl">Boas compras</div><b>${boas} de ${comMercado.length}</b><span class="peq">abaixo do mercado</span></div>` : ""}
    </div>

    ${juntos.length ? `<div class="card" style="display:flex;flex-direction:column;gap:6px">
      <div class="lbl">Onde a gente mais discorda</div>
      ${brigas.length ? brigas.map((v) => `<a class="briga" href="#/vinho/${v.id}" style="text-decoration:none;color:inherit"><span>${esc(v.nome)}</span><span class="tag vinho">W ${notaDe(v, "wang")}</span><span class="tag oliva">C ${notaDe(v, "clara")}</span></a>`).join("")
        : `<p class="sub" style="margin:0">Vocês deram exatamente a mesma nota em tudo. Amor verdadeiro.</p>`}
      <div class="mao" style="font-size:19px;margin-top:6px">vocês concordam em ${concordam}% dos vinhos (diferença de até 1 ponto)</div>
    </div>` : ""}`;
}

function contar(vs, chave) {
  const c = {};
  for (const v of vs) { const k = chave(v); if (k) c[k] = (c[k] || 0) + 1; }
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
