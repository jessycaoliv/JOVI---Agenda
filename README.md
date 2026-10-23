# JOVI · Agenda DP

Agenda do Departamento Pessoal em React (.jsx), com login, banco de dados e permissões no **Supabase** (projeto JOVI_Agenda) e publicação pelo **GitHub Pages**.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `src/App.jsx` | A agenda inteira: login, painel, agenda, demandas, fluxos, rotinas e usuários |
| `src/data.js` | Fluxos (etapas) e listas. Edite aqui para mudar um fluxo |
| `src/utils.js` | Datas, ocorrências das rotinas e dias úteis |
| `src/supabase.js` | Conexão com o Supabase (URL e chave pública) |
| `src/styles.css` | Visual (claro e escuro) |
| `supabase/agenda_dp_supabase.sql` | Estrutura do banco e regras de acesso (já aplicada no JOVI_Agenda) |
| `.github/workflows/deploy.yml` | Publica o site sozinho a cada alteração |

## Perfis
- **Mestre:** vê e altera tudo e é o único que vê a aba **Usuários**. O primeiro login criado vira mestre.
- **Editor:** vê os processos com "Ver" ou "Editar" e altera só os com "Editar".
- **Leitor:** só consulta os processos liberados.
- **Solicitante (outros setores):** abre demandas e acompanha só as próprias.

As permissões são aplicadas pelo próprio banco (Row Level Security).

## Publicar no GitHub Pages
1. No repositório **JOVI---Agenda**, use **Add file > Upload files** e envie todo o conteúdo desta pasta.
   A pasta `.github` começa com ponto e pode ficar oculta no computador. Se ela não subir,
   use **Add file > Create new file**, digite o nome `.github/workflows/deploy.yml` e cole o conteúdo do arquivo.
2. **Settings > Pages > Build and deployment > Source: GitHub Actions**.
3. Aba **Actions:** quando "Publicar no GitHub Pages" ficar verde, o link aparece
   (algo como `https://SEU-USUARIO.github.io/JOVI---Agenda/`).

## Ajuste no Supabase depois de publicar
**Authentication > URL Configuration**
- **Site URL:** o link do GitHub Pages.
- **Redirect URLs:** adicione o mesmo link. É para onde o e-mail de "Esqueci minha senha" leva.

## Cadastrar pessoas
- **Pela agenda:** aba **Usuários > + Novo usuário**. Se a confirmação de e-mail estiver ligada no Supabase, a pessoa precisa clicar no link que recebe antes de entrar.
- **Pelo Supabase:** **Authentication > Users > Add user**, com *Auto Confirm User* marcado. O login aparece bloqueado na aba **Usuários**, e você escolhe o perfil e os processos e muda para Ativo.

## Testar no computador (opcional)
Com o Node.js instalado: `npm install` e depois `npm run dev`.

## Cuidados
- A chave em `src/supabase.js` é a **publishable**, que é pública por natureza. **Nunca** coloque uma chave *secret* no código.
- Não suba planilhas ou dados de colaboradores para o GitHub.
