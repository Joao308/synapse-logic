'use strict';
(() => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#nav');
  const closeMenu = () => { if (!toggle || !nav) return; toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-label','Abrir menu'); nav.classList.remove('is-open'); };
  if (toggle && nav) {
    toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') === 'true'; toggle.setAttribute('aria-expanded', String(!open)); toggle.setAttribute('aria-label', open ? 'Abrir menu' : 'Fechar menu'); nav.classList.toggle('is-open', !open); toggle.textContent = open ? '☰' : '✕'; });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { closeMenu(); toggle.textContent = '☰'; }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); toggle.textContent = '☰'; } });
    document.addEventListener('click', e => { if (toggle.getAttribute('aria-expanded') === 'true' && !nav.contains(e.target) && !toggle.contains(e.target)) { closeMenu(); toggle.textContent = '☰'; } });
  }
  const scenarios = {
    vision: {title:'Inspeção visual de produto', input:'Imagem da câmera', output:'Defeito sinalizado', decision:'Revisar item', edge:{latency:'8 ms',data:'0,02 MB',process:'Núcleo Edge',desc:'Análise local simulada',explain:'No cenário Edge, a análise ilustrativa ocorre perto da câmera e apenas um resultado resumido é considerado para envio. Valores fictícios.'},cloud:{latency:'145 ms',data:'4,80 MB',process:'Servidor na nuvem',desc:'Envio e análise remota',explain:'Neste exemplo, a imagem é enviada para um servidor remoto para análise. A latência e o volume são números inventados para comparar os conceitos.'}},
    vibration: {title:'Análise de vibração de máquina', input:'Leitura de vibração', output:'Anomalia sinalizada', decision:'Inspecionar máquina', edge:{latency:'5 ms',data:'0,01 MB',process:'Núcleo Edge',desc:'Sinal analisado localmente',explain:'O dispositivo analisa um resumo dos sinais localmente e pode sinalizar um padrão incomum. Esta simulação não diagnostica máquinas reais.'},cloud:{latency:'120 ms',data:'1,60 MB',process:'Servidor na nuvem',desc:'Dados enviados para análise',explain:'Neste fluxo conceitual, os dados são enviados para análise remota. Valores fictícios; não representam benchmark de equipamento.'}},
    medical: {title:'Alerta de dispositivo médico', input:'Sinais simulados', output:'Alerta prioritário', decision:'Verificar alerta', edge:{latency:'4 ms',data:'0,01 MB',process:'Núcleo Edge',desc:'Regra local simulada',explain:'Um dispositivo compatível poderia aplicar regras locais para sinalizar um evento. Isso não é um dispositivo médico real e não deve orientar decisões clínicas.'},cloud:{latency:'180 ms',data:'0,90 MB',process:'Servidor na nuvem',desc:'Evento enviado remotamente',explain:'Este exemplo ilustra o envio remoto de dados. Não é um sistema clínico e os valores são fictícios; não use para decisões médicas.'}}
  };
  const form = document.querySelector('#sim-form');
  const $ = id => document.getElementById(id);
  const render = (scenarioKey, mode) => {
    const s = scenarios[scenarioKey] || scenarios.vision;
    const d = s[mode] || s.edge;
    $('result-title').textContent = s.title;
    $('result-status').textContent = 'SIMULAÇÃO CONCLUÍDA';
    $('input-desc').textContent = s.input;
    $('process-title').textContent = d.process;
    $('process-desc').textContent = d.desc;
    $('output-desc').textContent = s.output;
    $('latency').textContent = d.latency;
    $('data-sent').textContent = d.data;
    $('decision').textContent = s.decision;
    $('explanation').textContent = d.explain;
    document.querySelectorAll('.pipe-step')[1].classList.toggle('active-step', mode === 'edge');
    document.querySelectorAll('.pipe-step')[1].querySelector('.pipe-icon').textContent = mode === 'edge' ? '⌘' : '☁';
  };
  if (form) form.addEventListener('submit', e => { e.preventDefault(); const scenario = $('scenario').value; const mode = form.querySelector('input[name="mode"]:checked')?.value || 'edge'; render(scenario, mode); });
  if ($('year')) $('year').textContent = new Date().getFullYear();
  render('vision','edge');
})();
