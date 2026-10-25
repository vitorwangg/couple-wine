// Rankings: Nosso / Wang / Clara × Geral / Tintos / Brancos e rosés.
import { S, esc, avatar, ranking, media, estrelas, notaDe, virgula, assinar, thumb } from "../core.js";

const DONOS = [["nos", "Nosso"], ["wang", "Wang"], ["clara", "Clara"]];
const TIPOS_R = [["geral", "Geral"], ["tinto", "Tintos"], ["branco", "Brancos e rosés"]];

export async function telaRankings(el) {
  await assinar(S.vinhos.map((v) => v.rotulo_path));
  el.innerHTML = `
    <div>
      <div class="mao">la classifica</div>
      <h1>Rankings</h1>
    </div>
    <div class="escolha" id="donos">
      ${DONOS.map(([k, t]) => `<button type="button" data-v="${k}">${k === "nos" ? `<span class="duo">${avatar("wang", 26)}${avatar("clara", 26)}</span>` : avatar(k, 26)}${t}</button>`).join("")}
    </div>
    <div class="abas" role="tablist" id="tipos">
      ${TIPOS_R.map(([k, t]) => `<button role="tab" data-v="${k}">${t}</button>`).join("")}
    </div>
    <div class="peq" id="leg"></div>
    <div class="lista" id="lista" style="gap:8px"></div>`;

  const desenhar = () => {
    el.querySelectorAll("#donos button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === S.dono));
    el.querySelectorAll("#tipos button").forEach((b) => b.setAttribute("aria-selected", b.dataset.v === S.tipoRank));
    const d = S.dono, t = S.tipoRank;
    el.querySelector("#leg").textContent = d === "nos"
      ? "Só os vinhos que bebemos juntos, pela média de nós dois."
      : t === "geral" ? `Tudo que ${d === "wang" ? "o Wang" : "a Clara"} bebeu, pela nota.` : `Na ordem das comparações ${d === "wang" ? "do Wang" : "da Clara"}.`;
    const lista = ranking(d, t);
    el.querySelector("#lista").innerHTML = lista.length ? lista.map((v, i) => {
      const m = d === "nos" ? media(v) : notaDe(v, d);
      const falta = d !== "nos" && t !== "geral" && v.n[d].ordem == null;
      return `
        <a class="rank ${i < 3 ? "top" : ""}" href="#/vinho/${v.id}">
          <span class="medalha ${i < 3 ? `m${i + 1}` : ""}">${i + 1}</span>
          <span class="mini" style="width:34px;height:50px;border-radius:8px">${thumb(v, 40)}</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
            <span style="font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(v.nome)}</span>
            <span class="peq">${falta ? `<span style="color:var(--toalha);font-weight:700">falta encaixar</span>` : esc([v.pais, v.uva].filter(Boolean).join(" · "))}</span>
          </span>
          <span style="text-align:right">
            <span style="display:block;font-family:var(--serif);font-size:20px;line-height:1">${d === "nos" ? `${virgula(estrelas(m))} <span class="estr" style="font-size:14px">★</span>` : m}</span>
            <span class="peq" style="font-size:11.5px">${d === "nos" ? `média ${virgula(m)}` : "nota"}</span>
          </span>
        </a>`;
    }).join("") : `<div class="vazio"><div class="mao">ancora niente</div>${d === "nos" ? "Quando vocês dois derem nota pra um vinho que beberam juntos, ele aparece aqui." : "Nenhum vinho com nota aqui ainda."}</div>`;
  };

  el.querySelectorAll("#donos button").forEach((b) => b.addEventListener("click", () => { S.dono = b.dataset.v; desenhar(); }));
  el.querySelectorAll("#tipos button").forEach((b) => b.addEventListener("click", () => { S.tipoRank = b.dataset.v; desenhar(); }));
  desenhar();
}
