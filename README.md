# Mente da Anny

Assistente pessoal de rotina: **Hoje**, **Casa**, **Devocional**, **Frases** e **Ajustes**, com Modo Geladeira (iPad) e Modo Bebê.
Site estático (GitHub Pages) + Supabase para sincronizar entre aparelhos com login.

## Colocar no ar (uma vez)
1. **GitHub Pages:** no repositório → *Settings* → *Pages* → *Source: Deploy from a branch* → *Branch: `main` / `(root)`* → *Save*.
   Em 1–2 minutos o site abre em `https://acfadias.github.io/mentedaanny/`.
2. **Banco no Supabase:** *SQL Editor* → *New query* → colar o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) → *Run*.
3. **Chave:** colar a chave *anon public* (ou *publishable*) em [`js/config.js`](js/config.js).
4. **URL de retorno do login:** Supabase → *Authentication* → *URL Configuration* → *Site URL* = `https://acfadias.github.io/mentedaanny/`.
5. No app, *Ajustes* → **Criar minha conta**. Depois, no Supabase → *Authentication* → *Sign In / Providers* → desligar **Allow new users to sign up**.

## Onde mexer
| Arquivo | O quê |
|---|---|
| `js/rotina.js` | Dias e horários da casa, devocional (8h → 21h se não fizer até 12h), vitamina, Modo Bebê |
| `js/devocional-plano.js` | Plano devocional 25/11–31/12/2026 |
| `js/afirmacoes.js` | Frases de afirmação e mensagens de comemoração |
| `lembretes.ics` | Lembretes para importar na agenda pessoal do celular |
| `css/app.css` | Identidade visual (cores e fontes do portfólio) |

## Privacidade
O código é público, mas **nenhum dado pessoal fica no repositório**: checks, diário, compras e frases ficam no aparelho e, com login, no Supabase protegido por RLS (só a dona da conta lê e escreve).
