// Ficha do vinho: notas, posição nos rankings, valeu o preço?, dados e a foto de vocês.
import { sb, S, NOMES, PESSOAS, esc, avatar, garrafa, urlDe, assinar, achar, carregar, bebeu, notaDe, media, estrelas, estrelasTxt,
  virgula, brl, fmtData, posicao, grupo, quemTxt, atualizarPreco, toast, TIPOS, ICONE } from "../core.js";

export async function telaFicha(el, id) {
  const v = achar(id);
  if (!v) { location.hash = "#/"; return; }
  await assinar([v.rotulo_path, v.foto_path]);
  const img = v.imagem_url || urlDe(v.rotulo_path);
  const bebido = v.status === "bebido";
  const m = media(v), e = estrelas(m);

  el.innerHTML = `
    <div class="heroi ging">
      <a href="#/" class="voltar" aria-label="Voltar">${ICONE.voltar}</a>
      <div class="moldura">${img ? `<img src="${esc(img)}" alt="">` : garrafa(v.tipo, 150)}</div>
    </div>

    <div class="centro">
      <h1 style="font-size:30px">${esc(v.nome)}${v.safra ? ` ${v.safra}` : ""}</h1>
      <div class="sub" style="margin-top:4px">${esc([v.produtor, [v.regiao, v.pais].filter(Boolean).join(", ")].filter(Boolean).join(" · "))}</div>
      ${bebido ? `
        <div class="estr-g" style="margin-top:10px" aria-label="${e == null ? "sem nota" : virgula(e) + " estrelas"}">${estrelasTxt(e)}</div>
        <div style="font-family:var(--serif);font-size:18px">${e == null ? "sem nota ainda" : `${virgula(e)} <span class="peq" style="font-family:var(--sans)">· média ${virgula(Math.round(m * 10) / 10)}</span>`}</div>`
      : `<div style="margin-top:10px"><span class="tag vinho" style="font-size:13px;padding:5px 10px">Na lista de quero provar</span></div>`}
    </div>

    ${bebido ? `
      <div class="grade2">
        ${PESSOAS.filter((p) => bebeu(v, p)).map((p) => `
          <div class="card pessoa-nota">${avatar(p)}<div><div class="lbl">${NOMES[p]}</div><b>${notaDe(v, p) ?? "–"}</b>${notaDe(v, p) == null ? `<span class="peq">falta a nota</span>` : ""}</div></div>`).join("")}
      </div>
      ${rankingsCard(v)}` : `
      ${v.obs ? `<div class="card"><div class="mao" style="font-size:20px">${esc(v.obs)}</div></div>` : ""}
      <a href="#/vinho/${v.id}/beber" class="btn grande">${ICONE.taca}Bebemos!</a>`}

    ${precoCard(v)}

    <div class="card tabela" style="padding:4px 16px">
      <div class="ln"><span>Tipo</span><span>${TIPOS[v.tipo]}</span></div>
      ${v.uva ? `<div class="ln"><span>Uva</span><span>${esc(v.uva)}</span></div>` : ""}
      ${v.safra ? `<div class="ln"><span>Safra</span><span>${v.safra}</span></div>` : ""}
      ${v.teor ? `<div class="ln"><span>Teor alcoólico</span><span>${esc(v.teor)}</span></div>` : ""}
      ${v.nota_critica ? `<div class="ln"><span>Nota da crítica</span><span>${virgula(v.nota_critica)} ★ ${esc(v.fonte_critica || "")}</span></div>` : ""}
      ${bebido ? `
        <div class="ln"><span>Quem bebeu</span><span>${quemTxt(v.quem)}</span></div>
        <div class="ln"><span>Quando</span><span>${fmtData(v.bebido_em)}</span></div>
        ${v.onde ? `<div class="ln"><span>Onde</span><span>${esc(v.onde)}</span></div>` : ""}
        ${v.compraria != null ? `<div class="ln"><span>Compraria de novo?</span><span style="color:${v.compraria ? "var(--oliva)" : "var(--toalha)"}">${v.compraria ? "Sim" : "Não"}</span></div>` : ""}` : ""}
    </div>

    ${v.descricao ? `<div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="lbl">Sobre o vinho</div><p style="margin:0;font-size:14.5px;line-height:1.5">${esc(v.descricao)}</p></div>` : ""}

    ${v.foto_path && urlDe(v.foto_path) ? `<div class="foto-casal"><img src="${esc(urlDe(v.foto_path))}" alt="Foto de vocês com a garrafa"></div>` : ""}

    <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px">
      ${bebido ? `<a href="#/vinho/${v.id}/editar" class="btn contorno">Editar</a>` : ""}
      ${bebido && bebeu(v, S.pessoa) && notaDe(v, S.pessoa) != null ? `<a href="#/comparar/${v.id}" class="btn texto" style="align-self:center">Reposicionar no meu ranking</a>` : ""}
      <button class="btn texto" id="apagar" style="align-self:center;color:var(--toalha)">${bebido ? "Apagar da adega" : "Tirar da lista"}</button>
    </div>`;

  el.querySelector("#preco")?.addEventListener("click", async (ev) => {
    const b = ev.currentTarget;
    b.disabled = true;
    b.textContent = "Pesquisando preços… (uns 15 s)";
    try {
      await atualizarPreco(v);
      telaFicha(el, id);
    } catch (err) {
      b.disabled = false;
      b.textContent = "Pesquisar preço de mercado";
      toast("Não consegui o preço: " + err.message);
    }
  });

  el.querySelector("#apagar").addEventListener("click", async () => {
    if (!confirm(`Apagar “${v.nome}”? As notas e a posição nos rankings somem também.`)) return;
    const paths = [v.rotulo_path, v.foto_path].filter(Boolean);
    const { error } = await sb.from("cw_vinhos").delete().eq("id", v.id);
    if (error) { toast("Não apagou: " + error.message); return; }
    if (paths.length) sb.storage.from("cw-fotos").remove(paths).catch(() => {});
    await carregar();
    toast("Apagado.");
    location.hash = "#/";
  });
}

function rankingsCard(v) {
  const g = grupo(v.tipo), gTxt = g === "tinto" ? "tintos" : "brancos e rosés";
  const chips = [];
  const casal = v.quem === "nos" ? posicao(v, "nos", "geral") : null;
  if (casal) chips.push(`<span class="tag vinho" style="font-size:13.5px;padding:7px 11px">#${casal} do casal</span>`);
  for (const p of PESSOAS) {
    if (!bebeu(v, p) || v.n[p]?.ordem == null) continue;
    chips.push(`<span class="tag" style="font-size:13.5px;padding:7px 11px">#${posicao(v, p, g)} ${gTxt} ${p === "wang" ? "do Wang" : "da Clara"}</span>`);
  }
  if (!chips.length) return "";
  return `<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="lbl">Nos rankings</div><div class="chips">${chips.join("")}</div></div>`;
}

function precoCard(v) {
  const temMercado = v.preco_min != null || v.preco_max != null;
  if (!temMercado) {
    return `<div class="card" style="display:flex;flex-direction:column;gap:10px">
      <div class="lbl">${v.preco_pago != null ? "Valeu o preço?" : "Preço de mercado"}</div>
      ${v.preco_pago != null ? `<div><span class="peq">Pagamos</span><div style="font-family:var(--serif);font-size:28px;line-height:1">${brl(v.preco_pago)}</div></div>` : ""}
      <p class="peq" style="margin:0">${v.preco_em ? "Não achei esse vinho à venda nas lojas brasileiras." : "Ainda não pesquisei o preço nas lojas."}</p>
      <button class="btn contorno" id="preco">Pesquisar preço de mercado</button>
    </div>`;
  }
  const min = v.preco_min ?? v.preco_max, max = v.preco_max ?? v.preco_min;
  const pago = v.preco_pago;
  let veredito = "";
  if (pago != null) {
    veredito = pago < min * 0.95 ? ["Boa compra", "var(--oliva)"] : pago <= max * 1.05 ? ["Preço justo", "var(--suave)"] : ["Pagaram caro", "var(--toalha)"];
  }
  // régua: do menor ao maior valor, com folga dos dois lados
  const lo = Math.min(min, pago ?? min) * 0.8, hi = Math.max(max, pago ?? max) * 1.15;
  const x = (n) => `${((n - lo) / (hi - lo)) * 100}%`;
  return `<div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div class="lbl">${pago != null ? "Valeu o preço?" : "Preço de mercado"}</div>
      ${veredito ? `<span class="veredito" style="background:${veredito[1]}">${veredito[0]}</span>` : ""}
    </div>
    <div style="display:flex;align-items:flex-end;gap:18px">
      ${pago != null ? `<div><div class="peq">Pagamos</div><div style="font-family:var(--serif);font-size:28px;line-height:1">${brl(pago)}</div></div>` : ""}
      <div><div class="peq">Mercado</div><div style="font-family:var(--serif);font-size:${pago != null ? 20 : 28}px;line-height:1.2;color:${pago != null ? "var(--suave)" : "var(--tinta)"}">${min === max ? brl(min) : `${brl(min)}–${brl(max).replace("R$ ", "")}`}</div></div>
    </div>
    <div class="regua" aria-hidden="true">
      <div class="trilho"></div>
      <div class="faixa" style="left:${x(min)};width:calc(${x(max)} - ${x(min)} + 4px)"></div>
      ${pago != null ? `<div class="ponto" style="left:${x(pago)}"></div>` : ""}
      <div class="ext" style="left:0">mais barato</div><div class="ext" style="right:0">mais caro</div>
    </div>
    ${(v.preco_lojas || []).length ? `<div class="tabela">${v.preco_lojas.map((l) => `<div class="ln"><span>${esc(l.loja)}</span><span>${brl(l.preco)}</span></div>`).join("")}</div>` : ""}
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <span class="peq">Pesquisado em ${fmtData(v.preco_em)} · estimativa</span>
      <button class="btn texto" id="preco" style="font-size:13px">Atualizar</button>
    </div>
  </div>`;
}
