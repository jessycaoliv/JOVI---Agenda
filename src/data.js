// Catálogo de processos, listas e rotinas padrão da Agenda DP.
// Para mudar um fluxo, edite as etapas aqui: [título, descrição, responsável, {fase?, du?}]

export const PROC = [
 {id:'admissao',nome:'Admissão',c:1,gatilho:'Comunicação de abertura de vaga',sla:'Cada etapa marcada como realizada para acompanhar o processo inteiro',saida:'Colaborador admitido, cadastrado nos sistemas e com benefício carregado',etapas:[
  ['Abertura da vaga e localização do colaborador','Receber a comunicação de abertura da vaga e, junto com a Gestão Comercial e a Gestão de RH Matriz, localizar o colaborador.','DP + Gestão Comercial + RH Matriz',{fase:'Seleção e contratação'}],
  ['Carta oferta','Com o candidato aprovado, enviar a carta oferta.','DP'],
  ['Exame admissional','Encaminhar o candidato para o exame admissional.','DP'],
  ['Abertura no BPM','Em paralelo ao exame, abrir a admissão no BPM. A Matriz programa o disparo da admissão digital no ADP.','DP / Matriz'],
  ['Recomendação de conta Itaú','Enviar a recomendação de abertura de conta no Itaú.','DP'],
  ['Documentos e aprovação','Acompanhar a subida dos documentos e realizar a aprovação no sistema.','DP'],
  ['eSocial e OK no BPM','Aguardar a Matriz enviar ao eSocial e dar o OK no BPM.','Matriz'],
  ['Kit admissional','Confeccionar o kit admissional.','DP',{fase:'Cadastros e integração'}],
  ['Cadastro CAJU','Cadastrar o funcionário na CAJU.','DP'],
  ['Cadastro iFractal','Cadastrar o funcionário no iFractal.','DP'],
  ['Cadastro Piwi','Cadastrar o funcionário no Piwi (seguro de vida).','DP'],
  ['Cadastro plano de saúde','Incluir o funcionário no plano de saúde.','DP'],
  ['Integração','Realizar uma integração breve.','DP'],
  ['1ª carga do benefício inicial','Carregar o benefício dos 10 primeiros dias.','DP',{fase:'Benefício inicial'}],
  ['Carga do restante do benefício','No 9º dia útil, carregar o restante do benefício.','DP',{du:9}]]},
 {id:'beneficio_inicial',nome:'Benefício inicial',c:2,gatilho:'Admissão ou mudança de elegibilidade',sla:'Verificação de status: todos os itens ok',saida:'Benefícios ativos e colaborador informado',etapas:[
  ['Coletar opção de VT','Registrar a opção de vale-transporte do colaborador.','DP'],
  ['Cadastrar na CAJU','Cadastrar o colaborador na CAJU.','DP'],
  ['Mobilidade','Ativar o benefício de mobilidade.','DP'],
  ['Vale-alimentação','Ativar o vale-alimentação.','DP'],
  ['Seguro de vida','Incluir no seguro de vida (Piwi).','DP'],
  ['Plano de saúde','Incluir no plano de saúde.','DP'],
  ['Comunicar o colaborador','Informar o colaborador sobre os benefícios ativos.','DP']]},
 {id:'beneficio_quinzenal',nome:'Benefício mensal 15/15',c:3,gatilho:'Calendário: duas programações de distribuição por mês',sla:'Pedido enviado até 5 dias antes de cada crédito',saida:'Créditos distribuídos na carteira CAJU',etapas:[
  ['Atualizar a base de elegíveis','Considerar admitidos, desligados, férias, afastados e faltas da quinzena.','DP'],
  ['Calcular os valores da quinzena','Dias úteis ou escala × valor diário, por colaborador.','DP'],
  ['Montar a planilha de distribuição','Separar por unidade e centro de custo.','DP'],
  ['Conferência e aprovação','Validar o total e as variações em relação à quinzena anterior.','Coordenação'],
  ['Pedido na CAJU','Fazer o pedido pela linha CAJU.','DP'],
  ['Boleto e NF no BPM','Lançar o boleto e a NF no BPM e comunicar ao Financeiro.','DP'],
  ['Confirmar o pagamento','Acompanhar a liberação do pedido.','DP'],
  ['Distribuir os créditos','Realizar a distribuição dos créditos para a carteira CAJU.','DP']]},
 {id:'ferias',nome:'Férias',c:4,gatilho:'Programação anual ou solicitação do gestor',sla:'Aviso com 30 dias de antecedência; pagamento 2 dias antes do início',saida:'Férias pagas e documentos arquivados',etapas:[
  ['Receber a programação','Gestor confirma o período (até 3 frações, uma com 14 dias ou mais).','Gestor'],
  ['Validar o período aquisitivo','Conferir saldo, faltas, abono pecuniário e adiantamento do 13º, se pedido.','DP'],
  ['Aviso de férias','Emitir com pelo menos 30 dias de antecedência e colher assinatura.','DP'],
  ['Lançar no BPM','Fazer o lançamento das férias no BPM.','DP'],
  ['Conferir o recibo','Validar valores, médias e descontos.','DP'],
  ['Título no BPM','Lançar o título no BPM para pagamento 2 dias antes das férias e informar ao Financeiro.','DP'],
  ['Arquivar','Guardar aviso e recibo assinados.','DP']]},
 {id:'rescisao',nome:'Rescisão',c:5,gatilho:'Comunicação do gestor ou pedido de demissão',sla:'Pagamento em até 10 dias corridos do término do contrato',saida:'Rescisão paga, FGTS liberado, acessos baixados',etapas:[
  ['Receber a solicitação','Gestor informa tipo (sem justa causa, pedido, fim de experiência, acordo, justa causa), data e aviso (trabalhado ou indenizado).','Gestor'],
  ['Comunicado e aviso prévio','Emitir o documento e colher assinatura.','DP'],
  ['Exame demissional','Agendar o exame demissional.','DP'],
  ['Excluir benefícios','Plano de saúde, seguro de vida (Piwi) e CAJU; recolher cartões.','DP'],
  ['Ponto e checklist','Tratar o ponto e preencher o checklist de rescisão.','DP'],
  ['Input no BPM','Lançar a rescisão no BPM.','DP'],
  ['Conferir o TRCT','Validar verbas, médias, aviso e descontos.','DP'],
  ['Pagamento no BPM','Lançar o pagamento no BPM e informar ao Financeiro.','DP'],
  ['FGTS rescisório','Emitir a guia no FGTS Digital e gerar a chave.','DP / Matriz'],
  ['Seguro-desemprego','Emitir o formulário quando aplicável.','DP'],
  ['Assinaturas e entrega','TRCT, termo de quitação e documentos ao ex-colaborador.','DP'],
  ['Baixas e arquivo','Ponto, acessos e crachá; arquivar o dossiê.','DP']]},
 {id:'titulos',nome:'Lançar pagamentos',c:6,gatilho:'Recebimento de boleto, NF ou guia',sla:'Lançado no BPM antes do vencimento; NFs enviadas ao contábil',saida:'Pagamento feito e NFs no grupo do vChat (contábil)',etapas:[
  ['Receber o documento','Buscar boleto e NF do fornecedor (Piwi, Docusign, CAJU, plano de saúde, Singular, iFractal) ou guia.','DP',{fase:'Pagamento'}],
  ['Conferir','Valor, competência, vidas ou quantidades, retenções.','DP'],
  ['Lançar no BPM','Lançar no BPM para pagamento e validar com o Financeiro.','DP'],
  ['Aprovação','Enviar para liberação da coordenação.','Coordenação'],
  ['Acompanhar a baixa','Confirmar o pagamento e guardar o comprovante.','DP'],
  ['Buscar as NFs','Reunir todas as NFs dos pagamentos lançados.','DP',{fase:'Envio das NFs para o contábil'}],
  ['Anexar no vChat','Anexar as NFs no grupo do vChat. O fluxo termina aqui.','DP']]},
 {id:'folha',nome:'Folha de pagamento',c:7,gatilho:'Calendário mensal: adiantamento (dia 15) e folha mensal (último dia útil)',sla:'Adiantamento validado no dia 08; folha paga no último dia útil do mês',saida:'Adiantamento e folha pagos pelo Financeiro',etapas:[
  ['Validar o adiantamento','Dia 08: DP/RH valida o adiantamento quinzenal.','DP/RH',{fase:'1º momento · Adiantamento quinzenal (pago no dia 15)'}],
  ['Informar o líquido','Informar o valor líquido do adiantamento.','DP/RH'],
  ['Planilha de pagamento','Criar a planilha de pagamento para subir no BPM.','DP'],
  ['Subir no BPM e avisar o Financeiro','Subir a planilha no BPM e informar ao Financeiro.','DP'],
  ['Acompanhar o pagamento','Acompanhar o pagamento do dia 15.','DP'],
  ['Buscar acréscimos com o Financeiro','Dia 15: pegar premiação e bonificação para alimentar a planilha de apontamentos.','DP / Financeiro',{fase:'2º momento · Folha mensal (paga no último dia útil)'}],
  ['Planilha de apontamentos','Até o dia 16: preencher descontos (faltas, plano de saúde novo, sindical) e acréscimos (premiação, bonificação).','DP'],
  ['Enviar no vChat · Folha NE','Subir a planilha preenchida no grupo Folha NE do vChat.','DP'],
  ['Validar o ponto','Dia 21: validar o ponto.','DP'],
  ['Retorno da Folha NE','A analista do grupo valida a planilha, lança na folha e devolve a folha completa.','Analista Folha NE'],
  ['Validar a folha','Conferir a folha completa recebida.','DP'],
  ['Subir no BPM e avisar o Financeiro','Subir a folha no BPM e informar ao Financeiro.','DP'],
  ['Acompanhar o pagamento','Pagamento no último dia útil do mês.','DP']]},
 {id:'encargos',nome:'Encargos',c:8,gatilho:'Fechamento da folha',sla:'Conferência até 15; títulos até 20',saida:'Guias pagas e contabilização enviada',etapas:[
  ['Conferir encargos','Resumo da folha x guias de FGTS, INSS e IRRF.','Analista Matriz'],
  ['Fechar guias','FGTS Digital, DCTFWeb (INSS) e IRRF.','Analista Matriz'],
  ['Lançar títulos','Enviar ao financeiro.','Analista Matriz'],
  ['Contabilização','Emitir e enviar o kit contábil.','Analista Matriz']]},
 {id:'ponto',nome:'Gestão de ponto',c:1,gatilho:'Diário / quinzenal',sla:'Lançamentos em dia antes do input do dia 22',saida:'Banco de horas e frequência corretos',etapas:[
  ['Trocas de turno e escala','Registrar as alterações pedidas pelos gestores.','Analista / Assistente'],
  ['Abonos e compensações','Lançar justificativas e atestados.','Analista / Assistente'],
  ['Horas extras','Apontar e validar com o gestor.','Analista / Assistente'],
  ['Ausências','Tratar faltas e atrasos.','Analista / Assistente'],
  ['Controle de atestados','Registrar e arquivar; acima de 15 dias, abrir fluxo de afastamento.','Estagiário / Assistente']]},
 {id:'movimentacao',nome:'Movimentação',c:2,gatilho:'Promoção, mudança de cargo, transferência ou alteração salarial',sla:'Até o input da folha do mês',saida:'Cadastro atualizado em todos os sistemas',etapas:[
  ['Receber a solicitação','Com aprovação formal do gestor e da diretoria.','Gestor'],
  ['Validar','Cargo, CBO, faixa salarial e data de vigência.','Analista DP'],
  ['Atualizar sistemas','Protheus, Deloitte e ponto.','Analista Matriz'],
  ['Ajustar benefícios e SST','Elegibilidade e ASO de mudança de função, se houver.','Benefícios / SST'],
  ['Comunicar','Informar colaborador e gestor.','Analista DP']]},
 {id:'afastamento',nome:'Afastamentos INSS',c:3,gatilho:'Atestado acima de 15 dias, acidente ou licença',sla:'Controle mensal',saida:'Afastamento registrado e retorno acompanhado',etapas:[
  ['Receber o atestado','Conferir CID, período e soma de atestados.','Analista DP'],
  ['Agendar perícia INSS','Orientar o colaborador e agendar.','Analista DP'],
  ['Registrar o afastamento','Lançar na folha e no eSocial.','Analista Matriz'],
  ['Ajustar benefícios','Suspender VT e VA/VR conforme a política.','Benefícios'],
  ['Acompanhar o retorno','Controle mensal e exame de retorno ao trabalho.','Analista / SST']]},
 {id:'sst',nome:'ASO e SST',c:4,gatilho:'Vencimento de exames, admissão, demissão, retorno ou acidente',sla:'Nenhum ASO vencido',saida:'Colaboradores com ASO em dia',etapas:[
  ['Agendar ASOs','Periódicos, retorno e mudança de função no SOC.','Analista DP'],
  ['Emitir CAT','Quando houver acidente de trabalho.','Coordenação'],
  ['Programas anuais','Inputs para PCMSO, PGR e LTCAT.','Coordenação'],
  ['Campanhas','Vacinação e apoio às visitas técnicas.','Equipe']]},
 {id:'outro',nome:'Outra demanda',c:8,gatilho:'Pedido de outro setor',sla:'Combinar o prazo com o solicitante',saida:'Solicitante respondido',etapas:[
  ['Receber e registrar','Entender o pedido e o prazo.','DP'],
  ['Analisar','Verificar regras, documentos e responsáveis.','DP'],
  ['Executar','Realizar a atividade.','DP'],
  ['Responder ao solicitante','Dar retorno e anexar evidências.','DP']]}
];
export const PMAP = Object.fromEntries(PROC.map(p => [p.id, p]));
export const SETORES = ['Comercial','Operações','Logística','Financeiro','Contabilidade','Diretoria','Gestores de unidade','R&S','TI','Jurídico','SST','Outro'];
export const UNIDADES = ['Todas','Matriz','Filial','ENORTE','SUAPE','Centro Social'];
export const RESPS = ['DP','DP/RH','Coordenação','Matriz','Analista Folha NE','Analista Matriz','Analista Filial','Estagiário Matriz','Equipe DP'];
export const STATUS = { nova:'Nova', andamento:'Em andamento', aguardando:'Aguardando terceiros', concluida:'Concluída', cancelada:'Cancelada' };
export const FREQ = { mensal:'Mensal', quinzenal:'Quinzenal (2× mês)', semanal:'Semanal', anual:'Anual', diaria:'Diária' };
export const WD = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
export const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
export const FORN = [['piwi','Piwi','Seguro de vida'],['docusign','Docusign',''],['caju','CAJU','Benefícios'],['saude','Plano de saúde','Seguradoras'],['singular','Singular',''],['ifractal','iFractal','Ponto']];
export const PCOLS = [['boleto','Boleto'],['nf','NF'],['bpm','Lançado no BPM'],['vchat','NF no vChat']];
export const PERFIS = {
  editor: 'Editor — trabalha nos processos liberados',
  leitor: 'Leitor — só consulta os processos liberados',
  solicitante: 'Solicitante — outros setores: abre e acompanha as próprias demandas',
};
export const NIVEIS = { nenhum:'Sem acesso', ver:'Ver', editar:'Editar' };
