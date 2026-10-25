# Couple Wine

A adega do Wang e da Clara: vinhos que bebemos, notas de cada um, rankings do casal e quanto valeu o preço.

App: https://vitorwangg.github.io/couple-wine/

## Como funciona

- **Site** (esta pasta): HTML, CSS e JavaScript puros, publicados no GitHub Pages. Instala no celular como app.
- **Banco**: o mesmo Supabase do Partiu Viajar, em tabelas que começam com `cw_`. Só as duas contas do casal (`private.cw_convites`) leem e escrevem.
- **Busca**: a função `buscar-vinho` (Supabase Edge Function) chama o Gemini com pesquisa no Google para identificar o vinho (nome ou foto do rótulo) e o preço de mercado no Brasil.

## Instalar do zero

1. Supabase › SQL Editor: cole `supabase/schema.sql` (troque `EMAIL_DA_CLARA` pelo e-mail dela) e clique em Run.
2. Supabase › Edge Functions › Deploy a new function › Via Editor: nome `buscar-vinho`, cole `supabase/functions/buscar-vinho/index.ts`, Deploy.
3. Supabase › Edge Functions › Secrets: adicione `GEMINI_API_KEY` com a chave do Google AI Studio.
4. Supabase › Authentication › URL Configuration › Redirect URLs: adicione `https://vitorwangg.github.io/couple-wine/**`.

## Rankings

Cada um encaixa o vinho no próprio ranking (tintos, ou brancos e rosés) respondendo "qual foi melhor?". A posição fica em `cw_notas.ordem` (menor = melhor). O ranking **Geral** de cada um segue a nota; o ranking **Nosso** usa só os vinhos que bebemos juntos, pela média.
