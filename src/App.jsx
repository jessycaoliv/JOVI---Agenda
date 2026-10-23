import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase, supabaseCadastro } from './supabase.js';
import { PROC, PMAP, SETORES, UNIDADES, RESPS, STATUS, FREQ, WD, MESES, FORN, PCOLS, PERFIS, NIVEIS } from './data.js';
import {
  iso, todayISO, ymOf, dim, addDays, fmtBR, fmtBRy, fmtDT, wdOf, shiftYm, pc, isOpen,
  nthBD, monthOccs, freqTxt,
} from './utils.js';

/* =========================================================
   Permissões (as mesmas regras estão no banco, via RLS)
   ========================================================= */
function makeAcl(me) {
  const perfil = me?.perfil || 'leitor';
  const isMaster = perfil === 'mestre';
  const lvl = p => (isMaster ? 'editar' : perfil === 'solicitante' ? 'nenhum' : (me?.processos?.[p] || 'nenhum'));
  const canSee = p => lvl(p) !== 'nenhum';
  const canEdit = p => isMaster || (perfil === 'editor' && lvl(p) === 'editar');
  return { uid: me?.id, isMaster, perfil, canSee, canEdit, editable: PROC.map(p => p.id).filter(canEdit) };
}

/* =========================================================
   Leitura de tabelas com atualização ao vivo
   ========================================================= */
function useTable(table, build, enabled = true, key = '') {
  const [rows, setRows] = useState([]);
  const [tick, setTick] = useState(0);
  const timer = useRef(null);
  const reload = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(() => setTick(t => t + 1), 150); }, []);
  useEffect(() => {
    if (!enabled) { setRows([]); return; }
    let alive = true;
    (async () => {
      const { data, error } = await build(supabase.from(table));
      if (!alive) return;
      if (error) console.warn(table, error.message); else setRows(data || []);
    })();
    return () => { alive = false; };
  }, [table, tick, enabled, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!enabled) return;
    const ch = supabase.channel('rt-' + table + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [table, enabled, reload]);
  return [rows, reload];
}

/* =========================================================
   App: login e controle de acesso
   ========================================================= */
export default function App() {
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false);
  const [me, setMe] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((ev, s) => {
      setSession(s);
      if (ev === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id;
  const loadMe = useCallback(async () => {
    if (!uid) { setMe(undefined); return; }
    const { data } = await supabase.from('usuarios').select('*').eq('id', uid).maybeSingle();
    setMe(data || null);
  }, [uid]);
  useEffect(() => { loadMe(); }, [loadMe]);
  useEffect(() => {
    if (!uid) return;
    const ch = supabase.channel('me-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios', filter: `id=eq.${uid}` }, () => loadMe())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, loadMe]);

  if (session === undefined) return <Center>Carregando…</Center>;
  if (recovery && session) return <NovaSenha onDone={() => setRecovery(false)} />;
  if (!session) return <Login />;
  if (me === undefined) return <Center>Carregando seu acesso…</Center>;
  if (!me || !me.ativo) {
    return (
      <Center>
        <h1>Acesso pendente</h1>
        <p className="muted">Seu login existe, mas ainda não foi liberado. Peça à Andreza para ativar o seu acesso.</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Sair</button>
      </Center>
    );
  }
  return <Main me={me} email={session.user.email} />;
}

function Center({ children }) {
  return <div className="auth"><div className="card">{children}</div></div>;
}

function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const entrar = async e => {
    e.preventDefault(); setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setBusy(false);
    if (error) {
      const m = (error.message || '').toLowerCase();
      setMsg({ err: m.includes('invalid') ? 'E-mail ou senha incorretos.' : m.includes('confirm') ? 'Confirme seu e-mail pelo link que você recebeu antes de entrar.' : 'Não foi possível entrar. Tente de novo em instantes.' });
    }
  };
  const esqueci = async () => {
    if (!email.trim()) { setMsg({ err: 'Digite seu e-mail primeiro.' }); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname });
    setMsg(error ? { err: 'Não foi possível enviar o e-mail agora.' } : { ok: 'Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.' });
  };
  return (
    <div className="auth">
      <form className="card" onSubmit={entrar}>
        <h1>Agenda DP</h1>
        <p className="muted" style={{ margin: 0 }}>Entre com o e-mail e a senha cadastrados para você.</p>
        <div className="field"><label htmlFor="l-email">E-mail</label><input id="l-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="l-senha">Senha</label><input id="l-senha" type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} /></div>
        {msg?.err && <div className="err" role="alert">{msg.err}</div>}
        {msg?.ok && <div className="ok" role="status">{msg.ok}</div>}
        <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <button type="button" className="linkbtn" onClick={esqueci}>Esqueci minha senha</button>
      </form>
    </div>
  );
}

function NovaSenha({ onDone }) {
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState(null);
  const salvar = async e => {
    e.preventDefault();
    if (senha.length < 8) { setMsg({ err: 'Use pelo menos 8 caracteres.' }); return; }
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) setMsg({ err: 'Não foi possível trocar a senha. Peça um novo link.' }); else onDone();
  };
  return (
    <div className="auth">
      <form className="card" onSubmit={salvar}>
        <h1>Nova senha</h1>
        <div className="field"><label htmlFor="n-senha">Nova senha</label><input id="n-senha" type="password" autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} /></div>
        {msg?.err && <div className="err" role="alert">{msg.err}</div>}
        <button className="btn pri" type="submit">Salvar nova senha</button>
      </form>
    </div>
  );
}

/* =========================================================
   Tela principal
   ========================================================= */
function Main({ me, email }) {
  const acl = useMemo(() => makeAcl(me), [me]);
  const meNome = me.nome || email;
  const TODAY = todayISO();
  const naoSolic = acl.perfil !== 'solicitante';

  const tabs = naoSolic
    ? [['painel', 'Painel'], ['agenda', 'Agenda'], ['demandas', 'Demandas'], ['fluxos', 'Fluxos'], ['rotinas', 'Rotinas'], ...(acl.isMaster ? [['usuarios', 'Usuários']] : [])]
    : [['demandas', 'Minhas demandas'], ['fluxos', 'Fluxos']];
  const [tab, setTab] = useState(() => { const h = window.location.hash.slice(1); return tabs.some(t => t[0] === h) ? h : tabs[0][0]; });
  useEffect(() => { try { window.history.replaceState(null, '', '#' + tab); } catch { /* ignore */ } }, [tab]);

  const desde = addDays(TODAY, -120);
  const [rotinas, reloadRot] = useTable('rotinas', q => q.select('*'), naoSolic);
  const [dem, reloadDem] = useTable('demandas', q => q.select('*').order('prazo', { ascending: true }));
  const [etapas, reloadEtapas] = useTable('demanda_etapas', q => q.select('*'));
  const [notas, reloadNotas] = useTable('demanda_notas', q => q.select('*').order('criado_em'));
  const [feitosRows, reloadFeitos] = useTable('feitos', q => q.select('*').gte('data', desde), naoSolic, desde);
  const [pagRows, reloadPag] = useTable('pagamentos', q => q.select('*'), acl.canSee('titulos'));
  const [equipe, setEquipe] = useState({});
  const loadEquipe = useCallback(async () => {
    const { data } = await supabase.rpc('equipe');
    setEquipe(Object.fromEntries((data || []).map(r => [r.id, r.nome])));
  }, []);
  useEffect(() => { loadEquipe(); }, [loadEquipe]);

  const feitos = useMemo(() => Object.fromEntries(feitosRows.map(f => [f.chave, f])), [feitosRows]);
  const pag = useMemo(() => Object.fromEntries(pagRows.map(r => [`${r.competencia}_${r.fornecedor}_${r.item}`, r])), [pagRows]);
  const etapasPor = useMemo(() => { const o = {}; etapas.forEach(e => { (o[e.demanda_id] ||= {})[e.etapa] = e; }); return o; }, [etapas]);
  const notasPor = useMemo(() => { const o = {}; notas.forEach(n => { (o[n.demanda_id] ||= []).push(n); }); return o; }, [notas]);
  const nomeDe = id => equipe[id] || '—';

  const [toastMsg, setToastMsg] = useState(null);
  const toast = useCallback(m => { setToastMsg(m); clearTimeout(window.__tt); window.__tt = setTimeout(() => setToastMsg(null), 3500); }, []);
  const fail = useCallback(e => {
    console.warn(e);
    const m = (e?.message || '').toLowerCase();
    toast(m.includes('row-level security') || m.includes('permission') ? 'Você não tem permissão para essa ação.' : 'Não foi possível salvar. Tente de novo.');
  }, [toast]);

  const [modal, setModal] = useState(null);
  const toggleFeito = async (o, checked) => {
    const { error } = checked
      ? await supabase.from('feitos').insert({ chave: o.key, rotina_id: o.r.id, processo: o.r.processo, data: o.data })
      : await supabase.from('feitos').delete().eq('chave', o.key);
    if (error) fail(error); reloadFeitos();
  };

  const ctx = {
    acl, me, meNome, TODAY, rotinas, dem, feitos, pag, etapasPor, notasPor, nomeDe, toast, fail, toggleFeito,
    reloadDem, reloadEtapas, reloadNotas, reloadPag, reloadRot, loadEquipe,
    openDem: (d, isNew = false) => setModal({ type: 'dem', data: d, isNew }),
    openRot: (r, isNew = false) => setModal({ type: 'rot', data: r, isNew }),
  };
  const nOpen = dem.filter(isOpen).length;

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="toprow">
            <div className="brand"><h1>Agenda DP</h1><span className="date">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
            <div className="me"><span className="role">{acl.perfil}</span><span>{meNome}</span><button className="btn sm" onClick={() => supabase.auth.signOut()}>Sair</button></div>
            <button className="btn pri" onClick={() => ctx.openDem({}, true)}>+ Nova demanda</button>
          </div>
          <nav className="tabs" role="tablist">
            {tabs.map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {label}{k === 'demandas' && <span className="n">{nOpen}</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="wrap">
        {tab === 'painel' && <Painel ctx={ctx} />}
        {tab === 'agenda' && <Agenda ctx={ctx} />}
        {tab === 'demandas' && <Demandas ctx={ctx} />}
        {tab === 'fluxos' && <Fluxos ctx={ctx} />}
        {tab === 'rotinas' && <Rotinas ctx={ctx} />}
        {tab === 'usuarios' && acl.isMaster && <Usuarios ctx={ctx} />}
      </main>
      {modal?.type === 'dem' && <DemandaModal ctx={ctx} d={modal.isNew ? modal.data : (dem.find(x => x.id === modal.data.id) || modal.data)} isNew={modal.isNew} onClose={() => setModal(null)} />}
      {modal?.type === 'rot' && <RotinaModal ctx={ctx} r={modal.data} isNew={modal.isNew} onClose={() => setModal(null)} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  );
}

/* ---------- linhas reutilizáveis ---------- */
function Dot({ p, style }) { return <span className="dot" style={{ background: pc(p), ...style }} />; }

function OccRow({ o, ctx }) {
  const f = ctx.feitos[o.key], done = !!f, late = !done && o.data < ctx.TODAY;
  const r = o.r, p = PMAP[r.processo] || PMAP.outro, can = ctx.acl.canEdit(r.processo);
  return (
    <div className={`item ${done ? 'done' : ''}`}>
      <input type="checkbox" className="chk" checked={done} disabled={!can} onChange={e => ctx.toggleFeito(o, e.target.checked)} aria-label={`Marcar ${r.nome} como feito`} />
      <div>
        <div className="t"><Dot p={r.processo} />{r.nome}</div>
        <div className="s">{p.nome} · {r.resp || '—'}{r.unidade && r.unidade !== 'Todas' ? ` · ${r.unidade}` : ''}{o.moved ? ' · antecipado (fim de semana)' : ''}{done ? ` · feito por ${ctx.nomeDe(f.feito_por)}` : ''}</div>
      </div>
      <div className={`when ${late ? 'late' : ''}`}>{late ? 'atrasado ' : ''}{fmtBR(o.data)}</div>
    </div>
  );
}

function DemRow({ d, ctx }) {
  const late = isOpen(d) && d.prazo && d.prazo < ctx.TODAY;
  return (
    <div className="item">
      <Dot p={d.processo} style={{ marginTop: 7 }} />
      <div>
        <div className="t"><button className="linkbtn" style={{ color: 'var(--ink)' }} onClick={() => ctx.openDem(d)}>{d.titulo}</button></div>
        <div className="s">Demanda de {d.setor || '—'} · {(PMAP[d.processo] || PMAP.outro).nome} · {d.resp || 'sem responsável'}</div>
      </div>
      <div className={`when ${late ? 'late' : ''}`}>{fmtBR(d.prazo)}</div>
    </div>
  );
}

const etapasFeitas = (ctx, d) => Object.keys(ctx.etapasPor[d.id] || {}).length;
const proximaEtapa = (ctx, d) => { const p = PMAP[d.processo] || PMAP.outro, m = ctx.etapasPor[d.id] || {}; const i = p.etapas.findIndex((e, k) => !m[k]); return i < 0 ? null : p.etapas[i][0]; };

/* ---------- Painel ---------- */
function Painel({ ctx }) {
  const { TODAY, rotinas, dem, feitos, acl } = ctx;
  const ym = ymOf(TODAY);
  const occ = [...monthOccs(rotinas, shiftYm(ym, -1)), ...monthOccs(rotinas, ym), ...monthOccs(rotinas, shiftYm(ym, 1))];
  const late = occ.filter(o => o.data < TODAY && !feitos[o.key] && o.data >= addDays(TODAY, -45));
  const hoje = occ.filter(o => o.data === TODAY);
  const prox = occ.filter(o => o.data > TODAY && o.data <= addDays(TODAY, 7));
  const open = dem.filter(isOpen);
  const dLate = open.filter(d => d.prazo && d.prazo < TODAY), dHoje = open.filter(d => d.prazo === TODAY), dProx = open.filter(d => d.prazo > TODAY && d.prazo <= addDays(TODAY, 7));
  const diarias = rotinas.filter(r => r.freq === 'diaria' && r.ativo !== false);
  const sec = (title, os, ds, empty) => (
    <div className="panel"><h3>{title}</h3><div className="list">
      {ds.map(d => <DemRow key={d.id} d={d} ctx={ctx} />)}
      {os.map(o => <OccRow key={o.key} o={o} ctx={ctx} />)}
      {!ds.length && !os.length && <div className="empty">{empty}</div>}
    </div></div>
  );
  return (
    <>
      <div className="stats">
        <div className="stat late"><b>{late.length + dLate.length}</b><span>Atrasados</span></div>
        <div className="stat today"><b>{hoje.length + dHoje.length}</b><span>Para hoje</span></div>
        <div className="stat"><b>{prox.length + dProx.length}</b><span>Próximos 7 dias</span></div>
        <div className="stat"><b>{open.length}</b><span>Demandas abertas</span></div>
      </div>
      <div className="cols">
        <div>
          {sec('Atrasados', late, dLate, 'Nada atrasado. Bom trabalho.')}
          {sec(`Hoje · ${fmtBRy(TODAY)}`, hoje, dHoje, 'Nenhuma rotina com prazo hoje.')}
          {sec('Próximos 7 dias', prox, dProx, 'Nada programado para a próxima semana.')}
        </div>
        <div>
          <div className="panel"><h3>Rotina diária</h3><div className="list">
            {diarias.map(r => <OccRow key={r.id} o={{ r, data: TODAY, key: `${TODAY}_${r.id}`, moved: false }} ctx={ctx} />)}
            {!diarias.length && <div className="empty">Nenhuma rotina diária liberada para você.</div>}
          </div></div>
          {acl.canSee('titulos') && <div className="panel"><PagGrid ctx={ctx} ym={ym} /></div>}
          <div className="panel"><h3>Demandas recentes de outros setores</h3><div className="list">
            {[...dem].sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || '')).slice(0, 6).map(d => (
              <div className="item" key={d.id}>
                <Dot p={d.processo} style={{ marginTop: 7 }} />
                <div><div className="t"><button className="linkbtn" style={{ color: 'var(--ink)' }} onClick={() => ctx.openDem(d)}>{d.titulo}</button></div>
                  <div className="s">{d.setor} · aberta por {ctx.nomeDe(d.criado_por)}</div></div>
                <span className={`pill ${d.status}`}>{STATUS[d.status] || d.status}</span>
              </div>
            ))}
            {!dem.length && <div className="empty">Nenhuma demanda ainda. Use "+ Nova demanda" para registrar o primeiro pedido.</div>}
          </div></div>
        </div>
      </div>
    </>
  );
}

/* ---------- Agenda ---------- */
function Agenda({ ctx }) {
  const { TODAY, rotinas, dem, feitos } = ctx;
  const [ym, setYm] = useState(ymOf(TODAY));
  const [sel, setSel] = useState(TODAY);
  const [y, m] = ym.split('-').map(Number);
  const occ = monthOccs(rotinas, ym);
  const first = new Date(y, m - 1, 1).getDay(), n = dim(y, m);
  const byDay = {}; occ.forEach(o => { (byDay[o.data] ||= []).push(o); });
  const demBy = {}; dem.filter(d => d.prazo && isOpen(d)).forEach(d => { (demBy[d.prazo] ||= []).push(d); });
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(<div key={'o' + i} className="day out" aria-hidden="true" />);
  for (let d = 1; d <= n; d++) {
    const ds = iso(y, m, d), os = byDay[ds] || [], dd = demBy[ds] || [], wd = new Date(y, m - 1, d).getDay();
    const evs = [
      ...dd.map(x => <div key={x.id} className="ev dem" style={{ color: pc(x.processo) }}><span>⚑ {x.titulo}</span></div>),
      ...os.map(o => <div key={o.key} className={`ev ${feitos[o.key] ? 'done' : ''}`} style={{ color: pc(o.r.processo) }}><span>{o.r.nome}</span></div>),
    ];
    cells.push(
      <button key={ds} className={`day ${wd === 0 || wd === 6 ? 'wknd' : ''} ${ds === TODAY ? 'today' : ''} ${ds === sel ? 'sel' : ''}`} onClick={() => setSel(ds)} aria-label={`${d} de ${MESES[m - 1]}, ${evs.length} itens`}>
        <div className="num"><span>{d}</span>{evs.length > 0 && <span className="muted">{evs.length}</span>}</div>
        {evs.slice(0, 3)}{evs.length > 3 && <div className="more">+{evs.length - 3}</div>}
        <div className="dots">{[...dd.map(x => x.processo), ...os.map(o => o.r.processo)].slice(0, 6).map((p, i) => <i key={i} style={{ color: pc(p) }} />)}</div>
      </button>,
    );
  }
  const selO = occ.filter(o => o.data === sel), selD = dem.filter(d => d.prazo === sel);
  const used = [...new Set(rotinas.map(r => r.processo))];
  return (
    <>
      <div className="calhead">
        <button className="btn sm" onClick={() => setYm(shiftYm(ym, -1))} aria-label="Mês anterior">←</button>
        <div className="m">{MESES[m - 1]} {y}</div>
        <button className="btn sm" onClick={() => setYm(shiftYm(ym, 1))} aria-label="Próximo mês">→</button>
        <button className="btn sm" onClick={() => { setYm(ymOf(TODAY)); setSel(TODAY); }}>Hoje</button>
      </div>
      <div className="calgrid">
        <div>
          <div className="cal">{WD.map(w => <div key={w} className="wd">{w}</div>)}{cells}</div>
          <div className="legend">{used.map(id => <span key={id}><Dot p={id} />{(PMAP[id] || PMAP.outro).nome}</span>)}<span>⚑ prazo de demanda</span></div>
        </div>
        <div className="panel">
          <h3>{WD[wdOf(sel)]} · {fmtBRy(sel)}</h3>
          <div className="list">
            {selD.map(d => <DemRow key={d.id} d={d} ctx={ctx} />)}
            {selO.map(o => <OccRow key={o.key} o={o} ctx={ctx} />)}
            {!selD.length && !selO.length && <div className="empty">Nada programado neste dia.</div>}
          </div>
          <div className="actions" style={{ justifyContent: 'flex-start' }}><button className="btn sm" onClick={() => ctx.openDem({ prazo: sel }, true)}>+ Demanda com prazo neste dia</button></div>
        </div>
      </div>
    </>
  );
}

/* ---------- Demandas ---------- */
function Demandas({ ctx }) {
  const { dem, TODAY } = ctx;
  const [f, setF] = useState({ status: 'abertas', proc: '', setor: '', q: '' });
  const q = f.q.trim().toLowerCase();
  const list = dem.filter(d => (f.status === 'abertas' ? isOpen(d) : f.status === 'todas' ? true : d.status === f.status)
    && (!f.proc || d.processo === f.proc) && (!f.setor || d.setor === f.setor)
    && (!q || [d.titulo, d.colaborador, d.descricao, d.resp].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
  const prazoCls = d => (!isOpen(d) || !d.prazo ? '' : d.prazo < TODAY ? 'late' : d.prazo <= addDays(TODAY, 2) ? 'soon' : '');
  return (
    <>
      <div className="toolbar">
        <input type="search" placeholder="Buscar por título, colaborador, responsável…" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} aria-label="Buscar" />
        <select value={f.status} onChange={e => setF({ ...f, status: e.target.value })} aria-label="Status">
          <option value="abertas">Abertas</option><option value="todas">Todas</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={f.proc} onChange={e => setF({ ...f, proc: e.target.value })} aria-label="Processo">
          <option value="">Todos os processos</option>{PROC.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={f.setor} onChange={e => setF({ ...f, setor: e.target.value })} aria-label="Setor">
          <option value="">Todos os setores</option>{SETORES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn pri" onClick={() => ctx.openDem({}, true)}>+ Nova demanda</button>
      </div>
      {list.map(d => {
        const p = PMAP[d.processo] || PMAP.outro, tot = p.etapas.length, ok = etapasFeitas(ctx, d), nx = isOpen(d) && proximaEtapa(ctx, d);
        return (
          <button className="dem" key={d.id} onClick={() => ctx.openDem(d)}>
            <div>
              <div className="t"><Dot p={d.processo} />{d.titulo}</div>
              <div className="meta"><span className="tag">{d.setor || '—'}</span><span>{p.nome}</span>{d.colaborador && <span>· {d.colaborador}</span>}{d.unidade && <span>· {d.unidade}</span>}<span>· resp.: {d.resp || '—'}</span></div>
              {nx && <div className="next">Próxima etapa: <b>{nx}</b></div>}
            </div>
            <div className="right">
              <span className={`pill ${d.status}`}>{STATUS[d.status] || d.status}</span>
              {d.prioridade === 'alta' && <span className="pill alta">Alta</span>}
              <span className={`prazo ${prazoCls(d)}`}>prazo {fmtBRy(d.prazo)}</span>
              <span className="bar" title={`${ok} de ${tot} etapas`}><i style={{ width: `${tot ? (ok / tot) * 100 : 0}%` }} /></span>
            </div>
          </button>
        );
      })}
      {!list.length && <div className="panel empty">{dem.length ? 'Nenhuma demanda com estes filtros.' : 'Nenhuma demanda registrada. Quando outro setor pedir algo, registre em "+ Nova demanda": ela ganha o checklist do fluxo e aparece na agenda pelo prazo.'}</div>}
    </>
  );
}

/* ---------- Fluxos ---------- */
function Fluxos({ ctx }) {
  const [sel, setSel] = useState('admissao');
  const [pagYm, setPagYm] = useState(ymOf(ctx.TODAY));
  const p = PMAP[sel];
  const rots = ctx.rotinas.filter(r => r.processo === p.id && r.ativo !== false);
  return (
    <div className="flowgrid">
      <div className="plist" role="list">
        {PROC.map(x => <button key={x.id} aria-current={x.id === sel} onClick={() => setSel(x.id)}><Dot p={x.id} />{x.nome}</button>)}
      </div>
      <div style={{ '--pc': pc(p.id) }}>
        <div className="flowhead">
          <div><h2>{p.nome}</h2><div className="muted">{p.etapas.length} etapas</div></div>
          <button className="btn pri" onClick={() => ctx.openDem({ processo: p.id }, true)}>+ Abrir demanda deste fluxo</button>
        </div>
        <div className="facts">
          <div className="fact"><b>Gatilho</b>{p.gatilho}</div>
          <div className="fact"><b>Prazo / SLA</b>{p.sla}</div>
          <div className="fact"><b>Resultado</b>{p.saida}</div>
        </div>
        <ol className="steps">
          {p.etapas.map((e, i) => (
            <React.Fragment key={i}>
              {e[3]?.fase && <li className="ph">{e[3].fase}</li>}
              <li><div className="st">{e[0]}</div><div className="sd">{e[1]}</div><div className="sr">{e[2]}</div></li>
            </React.Fragment>
          ))}
        </ol>
        {p.id === 'titulos' && ctx.acl.canSee('titulos') && (
          <div className="panel" style={{ marginTop: 10 }}>
            <PagGrid ctx={ctx} ym={pagYm} onNav={n => setPagYm(shiftYm(pagYm, n))} />
            <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>Marque cada item quando o documento for buscado, lançado e enviado. A data aparece embaixo da marcação.</p>
          </div>
        )}
        {rots.length > 0 && (
          <div className="panel" style={{ marginTop: 10 }}><h3>Rotinas da agenda ligadas a este fluxo</h3><div className="list">
            {rots.map(r => <div className="item" key={r.id}><Dot p={p.id} style={{ marginTop: 7 }} /><div><div className="t">{r.nome}</div><div className="s">{r.resp}</div></div><div className="when">{freqTxt(r, WD)}</div></div>)}
          </div></div>
        )}
      </div>
    </div>
  );
}

/* ---------- Boletos e NFs ---------- */
function PagGrid({ ctx, ym, onNav }) {
  const [y, m] = ym.split('-').map(Number);
  const can = ctx.acl.canEdit('titulos');
  const toggle = async (fid, item, checked) => {
    const { error } = checked
      ? await supabase.from('pagamentos').insert({ competencia: ym, fornecedor: fid, item })
      : await supabase.from('pagamentos').delete().match({ competencia: ym, fornecedor: fid, item });
    if (error) ctx.fail(error); ctx.reloadPag();
  };
  return (
    <>
      <div className="calhead" style={{ marginBottom: 6 }}>
        {onNav && <button className="btn sm" onClick={() => onNav(-1)} aria-label="Mês anterior">←</button>}
        <div className="m" style={{ fontSize: 16, minWidth: 0 }}>Boletos e NFs · {MESES[m - 1]} {y}</div>
        {onNav && <button className="btn sm" onClick={() => onNav(1)} aria-label="Próximo mês">→</button>}
      </div>
      <div className="scroll"><table className="tbl pag">
        <thead><tr><th>Fornecedor</th>{PCOLS.map(c => <th key={c[0]}>{c[1]}</th>)}</tr></thead>
        <tbody>{FORN.map(([fid, fn, fd]) => (
          <tr key={fid}>
            <td><b>{fn}</b>{fd && <div className="muted" style={{ fontSize: 12 }}>{fd}</div>}</td>
            {PCOLS.map(([cid, cn]) => {
              const v = ctx.pag[`${ym}_${fid}_${cid}`];
              return <td key={cid}><input type="checkbox" className="chk" disabled={!can} checked={!!v} onChange={e => toggle(fid, cid, e.target.checked)} aria-label={`${fn}: ${cn}`} />{v && <small title={ctx.nomeDe(v.feito_por)}>{fmtBR(v.feito_em.slice(0, 10))}</small>}</td>;
            })}
          </tr>
        ))}</tbody>
      </table></div>
    </>
  );
}

/* ---------- Rotinas ---------- */
function Rotinas({ ctx }) {
  const { rotinas, acl } = ctx;
  const groups = PROC.map(p => [p, rotinas.filter(r => r.processo === p.id).sort((a, b) => (a.dia || 0) - (b.dia || 0))]).filter(g => g[1].length);
  return (
    <>
      <div className="toolbar"><h2 className="sec" style={{ margin: 0, flex: 1 }}>Rotinas recorrentes</h2>
        {acl.editable.length > 0 && <button className="btn pri" onClick={() => ctx.openRot({}, true)}>+ Nova rotina</button>}</div>
      <p className="muted" style={{ marginTop: 0, maxWidth: '75ch' }}>Cada rotina gera os itens da agenda automaticamente. Prazos que caem no sábado ou domingo são antecipados para a sexta. Use dia 31 para "último dia do mês".</p>
      <div className="panel scroll"><table className="tbl">
        <thead><tr><th>Rotina</th><th>Quando</th><th>Responsável</th><th>Unidade</th><th /></tr></thead>
        <tbody>
          {groups.map(([p, rs]) => (
            <React.Fragment key={p.id}>
              <tr className="grp"><td colSpan={5}><Dot p={p.id} />{p.nome}</td></tr>
              {rs.map(r => (
                <tr key={r.id} className={r.ativo === false ? 'off' : ''}>
                  <td><b>{r.nome}</b>{r.obs && <div className="muted" style={{ fontSize: 13 }}>{r.obs}</div>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{FREQ[r.freq]}<div className="muted" style={{ fontSize: 13 }}>{freqTxt(r, WD)}</div></td>
                  <td>{r.resp}</td><td>{r.unidade}</td>
                  <td>{acl.canEdit(r.processo) && <button className="btn sm" onClick={() => ctx.openRot(r)}>Editar</button>}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
          {!groups.length && <tr><td colSpan={5} className="empty">Nenhuma rotina liberada para você.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}

/* ---------- Modal base ---------- */
function Modal({ title, onClose, children }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true"><h2>{title}</h2>{children}</div>
    </div>
  );
}

/* ---------- Demanda ---------- */
function DemandaModal({ ctx, d, isNew, onClose }) {
  const { acl, me, TODAY } = ctx;
  const [v, setV] = useState(() => ({
    titulo: d.titulo || '', setor: d.setor || 'Comercial', processo: d.processo || 'admissao', colaborador: d.colaborador || '',
    unidade: d.unidade || 'Matriz', data_ref: d.data_ref || '', prazo: d.prazo || addDays(TODAY, 5), prioridade: d.prioridade || 'normal',
    resp: d.resp || '', status: d.status || 'nova', descricao: d.descricao || '',
  }));
  useEffect(() => { if (!isNew && d.status) setV(x => ({ ...x, status: d.status })); }, [d.status, isNew]);
  const [nota, setNota] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const set = k => e => setV({ ...v, [k]: e.target.value });
  const own = d.criado_por === me.id;
  const canEditThis = isNew || acl.canEdit(d.processo) || (own && d.status === 'nova');
  const canSteps = !isNew && acl.canEdit(d.processo);
  const p = PMAP[d.processo] || PMAP.outro;
  const feitas = ctx.etapasPor[d.id] || {};
  const statusLivre = acl.canEdit(v.processo);

  const salvar = async () => {
    if (!v.titulo.trim()) { ctx.toast('Escreva o que foi pedido.'); return; }
    if (!v.prazo) { ctx.toast('Informe o prazo.'); return; }
    const body = { ...v, titulo: v.titulo.trim(), colaborador: v.colaborador.trim(), resp: v.resp.trim(), descricao: v.descricao.trim(), data_ref: v.data_ref || null };
    if (!statusLivre) body.status = isNew ? 'nova' : d.status;
    let error;
    if (isNew) ({ error } = await supabase.from('demandas').insert({ ...body, criado_por: me.id }));
    else {
      ({ error } = await supabase.from('demandas').update(body).eq('id', d.id));
      if (!error && body.processo !== d.processo) await supabase.from('demanda_etapas').delete().eq('demanda_id', d.id);
    }
    if (error) { ctx.fail(error); return; }
    ctx.toast(isNew ? 'Demanda registrada' : 'Demanda salva'); ctx.reloadDem(); ctx.reloadEtapas(); onClose();
  };
  const toggleStep = async (i, checked) => {
    const { error } = checked
      ? await supabase.from('demanda_etapas').insert({ demanda_id: d.id, etapa: i })
      : await supabase.from('demanda_etapas').delete().match({ demanda_id: d.id, etapa: i });
    if (error) ctx.fail(error); ctx.reloadEtapas(); ctx.reloadDem();
  };
  const addNota = async () => {
    const t = nota.trim(); if (!t) return;
    const { error } = await supabase.from('demanda_notas').insert({ demanda_id: d.id, texto: t });
    if (error) ctx.fail(error); else { setNota(''); ctx.reloadNotas(); }
  };
  const excluir = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    const { error } = await supabase.from('demandas').delete().eq('id', d.id);
    if (error) ctx.fail(error); else { ctx.toast('Demanda excluída'); ctx.reloadDem(); onClose(); }
  };

  return (
    <Modal title={isNew ? 'Nova demanda' : 'Demanda'} onClose={onClose}>
      <fieldset disabled={!canEditThis} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="form">
          <div className="field full"><label htmlFor="d-titulo">O que foi pedido</label><input id="d-titulo" maxLength={140} value={v.titulo} onChange={set('titulo')} placeholder="Ex.: Admissão de 3 promotores de vendas" /></div>
          <div className="field"><label htmlFor="d-setor">Setor solicitante</label><select id="d-setor" value={v.setor} onChange={set('setor')}>{SETORES.map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="field"><label htmlFor="d-proc">Processo</label><select id="d-proc" value={v.processo} onChange={set('processo')}>{PROC.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>
          <div className="field"><label htmlFor="d-colab">Colaborador(es) envolvido(s)</label><input id="d-colab" maxLength={200} value={v.colaborador} onChange={set('colaborador')} /></div>
          <div className="field"><label htmlFor="d-unid">Unidade</label><select id="d-unid" value={v.unidade} onChange={set('unidade')}>{UNIDADES.map(u => <option key={u}>{u}</option>)}</select></div>
          <div className="field"><label htmlFor="d-ref">Data de admissão / início</label><input id="d-ref" type="date" value={v.data_ref} onChange={set('data_ref')} /></div>
          <div className="field"><label htmlFor="d-prazo">Prazo</label><input id="d-prazo" type="date" value={v.prazo} onChange={set('prazo')} /></div>
          <div className="field"><label htmlFor="d-prio">Prioridade</label><select id="d-prio" value={v.prioridade} onChange={set('prioridade')}><option value="normal">Normal</option><option value="alta">Alta</option><option value="baixa">Baixa</option></select></div>
          <div className="field"><label htmlFor="d-resp">Responsável no DP</label><input id="d-resp" list="resps" maxLength={80} value={v.resp} onChange={set('resp')} /><datalist id="resps">{RESPS.map(r => <option key={r} value={r} />)}</datalist></div>
          <div className="field"><label htmlFor="d-status">Status</label><select id="d-status" value={v.status} onChange={set('status')} disabled={!statusLivre}>{Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s}</option>)}</select></div>
          <div className="field full"><label htmlFor="d-desc">Detalhes do pedido</label><textarea id="d-desc" maxLength={4000} value={v.descricao} onChange={set('descricao')} /></div>
        </div>
      </fieldset>

      {!isNew && (
        <div className="form" style={{ marginTop: 12 }}>
          <div className="field full">
            <label>Etapas do fluxo · {p.nome}</label>
            <div className="checklist">
              {p.etapas.map((e, i) => {
                const x = feitas[i], ok = !!x;
                return (
                  <React.Fragment key={i}>
                    {e[3]?.fase && <div className="cph">{e[3].fase}</div>}
                    <label className={ok ? 'ok' : ''}>
                      <input type="checkbox" className="chk" checked={ok} disabled={!canSteps} onChange={ev => toggleStep(i, ev.target.checked)} />
                      <span><b>{e[0]}</b> — {e[1]}
                        {x && <span className="who">✓ {ctx.nomeDe(x.feito_por)} · {fmtDT(x.feito_em)}</span>}
                        {!ok && e[3]?.du && d.data_ref && <span className="prev">previsto: {fmtBRy(nthBD(d.data_ref, e[3].du))} ({e[3].du}º dia útil desde {fmtBR(d.data_ref)})</span>}
                      </span>
                    </label>
                  </React.Fragment>
                );
              })}
            </div>
            {canSteps && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Cada marcação é salva na hora, com quem marcou e quando.</div>}
          </div>
          <div className="field full">
            <label htmlFor="d-nota">Andamento</label>
            <div className="notes">{(ctx.notasPor[d.id] || []).map(n => <div className="note" key={n.id}>{n.texto}<div className="by">{ctx.nomeDe(n.autor)} · {fmtDT(n.criado_em)}</div></div>)}</div>
            {(acl.canEdit(d.processo) || own) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input id="d-nota" style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', minWidth: 0 }} maxLength={1000} placeholder="Registrar um andamento…" value={nota} onChange={e => setNota(e.target.value)} />
                <button type="button" className="btn" onClick={addNota}>Adicionar</button>
              </div>
            )}
          </div>
          <div className="field full muted" style={{ fontSize: 13 }}>Aberta por {ctx.nomeDe(d.criado_por)} em {d.criado_em ? new Date(d.criado_em).toLocaleDateString('pt-BR') : '—'}</div>
        </div>
      )}

      <div className="actions">
        {!isNew && acl.canEdit(d.processo) && <button className="btn danger" onClick={excluir}>{confirmDel ? 'Confirmar exclusão' : 'Excluir'}</button>}
        <span className="sp" />
        <button className="btn" onClick={onClose}>Fechar</button>
        {canEditThis && <button className="btn pri" onClick={salvar}>{isNew ? 'Registrar demanda' : 'Salvar'}</button>}
      </div>
    </Modal>
  );
}

/* ---------- Rotina ---------- */
function RotinaModal({ ctx, r, isNew, onClose }) {
  const { acl } = ctx;
  const [v, setV] = useState(() => ({
    nome: r.nome || '', processo: r.processo || acl.editable[0] || 'folha', freq: r.freq || 'mensal', dia: r.dia ?? 10, dia2: r.dia2 ?? 25,
    mes: r.mes || 1, resp: r.resp || '', unidade: r.unidade || 'Todas', ativo: r.ativo !== false, obs: r.obs || '',
  }));
  const [confirmDel, setConfirmDel] = useState(false);
  const set = k => e => setV({ ...v, [k]: e.target.value });
  const salvar = async () => {
    if (!v.nome.trim()) { ctx.toast('Dê um nome para a rotina.'); return; }
    const body = {
      ...v, nome: v.nome.trim(), dia: v.freq === 'diaria' ? null : Number(v.dia),
      dia2: v.freq === 'quinzenal' ? Number(v.dia2) || null : null, mes: v.freq === 'anual' ? Number(v.mes) : null, ativo: !!v.ativo,
    };
    const { error } = isNew ? await supabase.from('rotinas').insert(body) : await supabase.from('rotinas').update(body).eq('id', r.id);
    if (error) ctx.fail(error); else { ctx.toast('Rotina salva'); ctx.reloadRot(); onClose(); }
  };
  const excluir = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    const { error } = await supabase.from('rotinas').delete().eq('id', r.id);
    if (error) ctx.fail(error); else { ctx.toast('Rotina excluída'); ctx.reloadRot(); onClose(); }
  };
  return (
    <Modal title={isNew ? 'Nova rotina' : 'Editar rotina'} onClose={onClose}>
      <div className="form">
        <div className="field full"><label htmlFor="r-nome">Rotina</label><input id="r-nome" maxLength={120} value={v.nome} onChange={set('nome')} /></div>
        <div className="field"><label htmlFor="r-proc">Processo</label><select id="r-proc" value={v.processo} onChange={set('processo')}>{PROC.filter(x => acl.canEdit(x.id)).map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>
        <div className="field"><label htmlFor="r-freq">Frequência</label><select id="r-freq" value={v.freq} onChange={set('freq')}>{Object.entries(FREQ).map(([k, s]) => <option key={k} value={k}>{s}</option>)}</select></div>
        {v.freq !== 'diaria' && <div className="field"><label htmlFor="r-dia">{v.freq === 'semanal' ? 'Dia da semana (0=dom … 6=sáb)' : v.freq === 'quinzenal' ? '1º dia' : 'Dia do mês'}</label><input id="r-dia" type="number" min="0" max="31" value={v.dia ?? ''} onChange={set('dia')} /></div>}
        {v.freq === 'quinzenal' && <div className="field"><label htmlFor="r-dia2">2º dia</label><input id="r-dia2" type="number" min="1" max="31" value={v.dia2 || ''} onChange={set('dia2')} /></div>}
        {v.freq === 'anual' && <div className="field"><label htmlFor="r-mes">Mês</label><select id="r-mes" value={v.mes} onChange={set('mes')}>{MESES.map((x, i) => <option key={x} value={i + 1}>{x}</option>)}</select></div>}
        <div className="field"><label htmlFor="r-resp">Responsável</label><input id="r-resp" list="resps2" maxLength={80} value={v.resp} onChange={set('resp')} /><datalist id="resps2">{RESPS.map(x => <option key={x} value={x} />)}</datalist></div>
        <div className="field"><label htmlFor="r-unid">Unidade</label><select id="r-unid" value={v.unidade} onChange={set('unidade')}>{UNIDADES.map(u => <option key={u}>{u}</option>)}</select></div>
        <div className="field"><label htmlFor="r-ativo">Situação</label><select id="r-ativo" value={v.ativo ? '1' : '0'} onChange={e => setV({ ...v, ativo: e.target.value === '1' })}><option value="1">Ativa</option><option value="0">Pausada</option></select></div>
        <div className="field full"><label htmlFor="r-obs">Observação</label><input id="r-obs" maxLength={300} value={v.obs} onChange={set('obs')} /></div>
      </div>
      <div className="actions">
        {!isNew && <button className="btn danger" onClick={excluir}>{confirmDel ? 'Confirmar exclusão' : 'Excluir'}</button>}
        <span className="sp" /><button className="btn" onClick={onClose}>Fechar</button><button className="btn pri" onClick={salvar}>Salvar</button>
      </div>
    </Modal>
  );
}

/* ---------- Usuários (só o mestre) ---------- */
function Usuarios({ ctx }) {
  const [users, reload] = useTable('usuarios', q => q.select('*').order('nome'));
  const [edit, setEdit] = useState(null);
  const lista = users.filter(u => u.id !== ctx.me.id);
  const pendentes = lista.filter(u => !u.ativo).length;
  return (
    <>
      <div className="toolbar"><h2 className="sec" style={{ margin: 0, flex: 1 }}>Usuários e permissões</h2><button className="btn pri" onClick={() => setEdit({ isNew: true })}>+ Novo usuário</button></div>
      <p className="muted" style={{ marginTop: 0, maxWidth: '75ch' }}>
        Só você vê esta aba. Todo login novo aparece aqui bloqueado: escolha o perfil, os processos e mude para Ativo.
        As regras valem no banco: quem não tem acesso a um processo não recebe os dados dele.
        {pendentes > 0 && <b> {pendentes} aguardando liberação.</b>}
      </p>
      <div className="panel scroll"><table className="tbl">
        <thead><tr><th>Nome</th><th>Perfil</th><th>Processos</th><th>Situação</th><th /></tr></thead>
        <tbody>
          {lista.map(u => {
            const procs = Object.entries(u.processos || {}).filter(([, l]) => l !== 'nenhum');
            return (
              <tr key={u.id} className={u.ativo ? '' : 'off'}>
                <td><b>{u.nome}</b><div className="muted" style={{ fontSize: 13 }}>{u.email}</div></td>
                <td>{u.perfil}</td>
                <td style={{ fontSize: 13 }}>{u.perfil === 'solicitante' ? 'Só as próprias demandas' : u.perfil === 'mestre' ? 'Todos' : procs.length ? procs.map(([p, l]) => `${PMAP[p]?.nome || p} (${NIVEIS[l]})`).join(', ') : 'Nenhum'}</td>
                <td>{u.ativo ? 'Ativo' : 'Bloqueado'}</td>
                <td><button className="btn sm" onClick={() => setEdit({ u })}>Editar</button></td>
              </tr>
            );
          })}
          {!lista.length && <tr><td colSpan={5} className="empty">Nenhum usuário além de você. Use "+ Novo usuário" ou crie o login em Authentication &gt; Users no Supabase.</td></tr>}
        </tbody>
      </table></div>
      {edit && <UsuarioModal ctx={ctx} u={edit.u || {}} isNew={!!edit.isNew} onClose={() => { setEdit(null); reload(); ctx.loadEquipe(); }} />}
    </>
  );
}

function UsuarioModal({ ctx, u, isNew, onClose }) {
  const [v, setV] = useState(() => ({ nome: u.nome || '', email: u.email || '', senha: '', perfil: u.perfil === 'mestre' ? 'mestre' : (u.perfil || 'editor'), ativo: isNew ? true : !!u.ativo, processos: { ...(u.processos || {}) } }));
  const [busy, setBusy] = useState(false);
  const set = k => e => setV({ ...v, [k]: e.target.value });
  const setProc = (p, l) => setV({ ...v, processos: { ...v.processos, [p]: l } });
  const todos = l => setV({ ...v, processos: Object.fromEntries(PROC.map(p => [p.id, l])) });
  const salvar = async () => {
    if (!v.nome.trim() || !v.email.trim()) { ctx.toast('Preencha nome e e-mail.'); return; }
    setBusy(true);
    try {
      let id = u.id;
      if (isNew) {
        if (v.senha.length < 8) { ctx.toast('A senha provisória precisa ter pelo menos 8 caracteres.'); return; }
        const { data, error } = await supabaseCadastro.auth.signUp({ email: v.email.trim(), password: v.senha, options: { data: { nome: v.nome.trim() } } });
        if (error) { ctx.toast(error.message.toLowerCase().includes('registered') ? 'Esse e-mail já tem login. Ele aparece na lista para você liberar.' : 'Não foi possível criar o login: ' + error.message); return; }
        id = data.user?.id;
        if (!id) { ctx.toast('Login criado. Ele aparece na lista assim que for confirmado.'); onClose(); return; }
      }
      const procs = v.perfil === 'leitor' ? Object.fromEntries(Object.entries(v.processos).map(([k, l]) => [k, l === 'editar' ? 'ver' : l])) : v.processos;
      const { error } = await supabase.from('usuarios').update({ nome: v.nome.trim(), perfil: v.perfil, ativo: v.ativo, processos: procs }).eq('id', id);
      if (error) { ctx.fail(error); return; }
      ctx.toast(isNew ? 'Usuário criado. Se o Supabase pedir confirmação, a pessoa recebe um e-mail.' : 'Usuário salvo'); onClose();
    } finally { setBusy(false); }
  };
  const resetSenha = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(v.email.trim(), { redirectTo: window.location.origin + window.location.pathname });
    ctx.toast(error ? 'Não foi possível enviar o e-mail.' : 'E-mail de nova senha enviado');
  };
  return (
    <Modal title={isNew ? 'Novo usuário' : `Editar ${u.nome || 'usuário'}`} onClose={onClose}>
      <div className="form">
        <div className="field"><label htmlFor="u-nome">Nome</label><input id="u-nome" value={v.nome} onChange={set('nome')} /></div>
        <div className="field"><label htmlFor="u-email">E-mail</label><input id="u-email" type="email" value={v.email} onChange={set('email')} disabled={!isNew} /></div>
        {isNew && <div className="field"><label htmlFor="u-senha">Senha provisória</label><input id="u-senha" type="text" autoComplete="new-password" value={v.senha} onChange={set('senha')} placeholder="mínimo 8 caracteres" /></div>}
        <div className="field"><label htmlFor="u-perfil">Perfil</label><select id="u-perfil" value={v.perfil} onChange={set('perfil')}>
          {Object.entries(PERFIS).map(([k, s]) => <option key={k} value={k}>{s}</option>)}
          <option value="mestre">Mestre — acesso total, inclusive usuários</option>
        </select></div>
        <div className="field"><label htmlFor="u-ativo">Situação</label><select id="u-ativo" value={v.ativo ? '1' : '0'} onChange={e => setV({ ...v, ativo: e.target.value === '1' })}><option value="1">Ativo</option><option value="0">Bloqueado</option></select></div>
        {(v.perfil === 'editor' || v.perfil === 'leitor') && (
          <div className="field full">
            <label>Acesso por processo</label>
            <div style={{ display: 'flex', gap: 8, margin: '4px 0 8px', flexWrap: 'wrap' }}>
              <button type="button" className="btn sm" onClick={() => todos('nenhum')}>Nenhum</button>
              <button type="button" className="btn sm" onClick={() => todos('ver')}>Ver todos</button>
              {v.perfil === 'editor' && <button type="button" className="btn sm" onClick={() => todos('editar')}>Editar todos</button>}
            </div>
            <div className="perm-grid">
              {PROC.map(p => (
                <React.Fragment key={p.id}>
                  <span><Dot p={p.id} />{p.nome}</span>
                  <select value={v.processos[p.id] || 'nenhum'} onChange={e => setProc(p.id, e.target.value)} aria-label={`Acesso a ${p.nome}`}>
                    <option value="nenhum">Sem acesso</option><option value="ver">Ver</option>{v.perfil === 'editor' && <option value="editar">Editar</option>}
                  </select>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="actions">
        {!isNew && <button className="btn" onClick={resetSenha}>Enviar e-mail de nova senha</button>}
        <span className="sp" /><button className="btn" onClick={onClose}>Fechar</button>
        <button className="btn pri" onClick={salvar} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </Modal>
  );
}
