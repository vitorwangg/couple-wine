// Entrar, conta fora do casal e a aba "Nós".
import { sb, S, NOMES, esc, avatar, bebidos, toast } from "../core.js";

const voltaPraCa = () => location.origin + location.pathname;

export async function telaLogin(el) {
  el.innerHTML = `
    <div class="tela login" style="padding:0;gap:18px">
      <div>
        <div class="mao">la nostra cantina</div>
        <div class="logo">Couple <em style="color:var(--vinho)">Wine</em></div>
        <p class="sub" style="margin:8px 0 0">A adega do Wang e da Clara.</p>
      </div>
      <form id="f" class="card" style="display:flex;flex-direction:column;gap:12px">
        <label class="campo"><span class="lbl">E-mail</span><input class="inp" name="email" type="email" autocomplete="email" required></label>
        <label class="campo"><span class="lbl">Senha</span><input class="inp" name="senha" type="password" autocomplete="current-password" minlength="6"></label>
        <button class="btn grande" name="acao" value="entrar">Entrar</button>
        <button class="btn contorno" name="acao" value="criar" type="submit">Criar conta</button>
        <button class="btn texto" name="acao" value="link" type="submit">Entrar sem senha (link por e-mail)</button>
        <div id="msg" class="sub" role="status"></div>
      </form>
    </div>`;
  const f = el.querySelector("#f"), msg = el.querySelector("#msg");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const acao = e.submitter?.value || "entrar";
    const email = f.email.value.trim(), senha = f.senha.value;
    msg.className = "sub";
    msg.textContent = "Um instante…";
    let r;
    if (acao === "link") {
      r = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: voltaPraCa() } });
      if (!r.error) { msg.textContent = "Pronto! Abra o link que chegou no seu e-mail."; return; }
    } else if (!senha || senha.length < 6) {
      r = { error: { message: "A senha precisa ter pelo menos 6 caracteres." } };
    } else if (acao === "criar") {
      r = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: voltaPraCa() } });
      if (!r.error && !r.data.session) { msg.textContent = "Conta criada! Confirme pelo link que chegou no seu e-mail e depois entre aqui."; return; }
    } else {
      r = await sb.auth.signInWithPassword({ email, password: senha });
    }
    if (r.error) {
      msg.className = "erro";
      msg.textContent = /invalid login/i.test(r.error.message) ? "E-mail ou senha não conferem." : r.error.message;
    } else {
      msg.textContent = "";
    }
  });
}

export async function telaForaDoCasal(el) {
  el.innerHTML = `
    <div class="tela login" style="padding:0">
      <div class="mao">scusa!</div>
      <h1>Essa conta não está na adega</h1>
      <p class="sub">Você entrou como <b>${esc(S.session?.user?.email)}</b>, mas o Couple Wine é só do Wang e da Clara. Se for a Clara, peça pro Wang cadastrar este e-mail.</p>
      <button class="btn contorno" id="sair">Sair e entrar com outro e-mail</button>
    </div>`;
  el.querySelector("#sair").addEventListener("click", () => sb.auth.signOut());
}

export async function telaNos(el) {
  const total = bebidos().length;
  el.innerHTML = `
    <div>
      <div class="mao">noi due</div>
      <h1>Nós</h1>
    </div>
    <div class="card" style="display:flex;align-items:center;gap:14px">
      <span class="duo">${avatar("wang", 48)}${avatar("clara", 48)}</span>
      <div>
        <div style="font-weight:700">Wang &amp; Clara</div>
        <div class="peq">${total} ${total === 1 ? "vinho" : "vinhos"} na adega</div>
      </div>
    </div>
    <div class="card tabela">
      <div class="ln"><span>Você é</span><span>${esc(NOMES[S.pessoa])}</span></div>
      <div class="ln"><span>E-mail</span><span>${esc(S.session.user.email)}</span></div>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:8px">
      <div class="lbl">Instalar no celular</div>
      <p class="sub" style="margin:0"><b>iPhone:</b> no Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.<br><b>Android:</b> no Chrome, menu ⋮ e “Instalar app”.</p>
    </div>
    <button class="btn contorno" id="sair">Sair</button>`;
  el.querySelector("#sair").addEventListener("click", async () => { await sb.auth.signOut(); toast("Até a próxima taça!"); });
}
