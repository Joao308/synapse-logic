SYNAPSE LOGIC — PLATAFORMA MVP (ETAPA 2)
========================================

O QUE ESTA VERSÃO INCLUI
1. Interface responsiva com Synapse AI, Analytics e Edge.
2. Backend Node.js e integração de IA via Responses API quando configurada.
3. Importação CSV/JSON e estatísticas calculadas localmente no navegador.
4. Endpoint de ingestão de telemetria (ainda sem hardware real).
5. Cadastro e login com senha derivada por scrypt, cookie HttpOnly/SameSite e sessões de sete dias mantidas em memória.
6. Histórico de conversas persistido em data/store.json e isolado por usuário nas rotas de conversa.

LIMITAÇÕES IMPORTANTES
- Esta é uma etapa de desenvolvimento/MVP, NÃO uma implementação pronta para produção.
- O armazenamento JSON é uma solução provisória de desenvolvimento, não um banco de dados robusto. Não suporta múltiplos processos/instâncias com segurança, não oferece migrações, backups automáticos nem recuperação transacional.
- Sessões são mantidas em memória e serão invalidadas quando o servidor reiniciar.
- A telemetria Edge ainda é pública e fica em memória; não conecte dispositivos reais nem publique este endpoint sem autenticação por dispositivo, autorização, armazenamento persistente e revisão de segurança.
- A IA real requer OPENAI_API_KEY válida, acesso/cota à API e um modelo disponível para a conta. Nenhuma resposta falsa é gerada quando não configurada.
- Não use dados pessoais/sensíveis. Antes de produção, é necessário revisar privacidade, retenção e segurança.

REQUISITOS
- Node.js 18.17 ou superior.
- Internet no servidor e chave de API para habilitar IA real.

EXECUTAR LOCALMENTE
1. Extraia o ZIP.
2. Abra um terminal na pasta synapse_final.
3. Opcionalmente configure a API no ambiente do servidor:
   Linux/macOS:
     export OPENAI_API_KEY="sua-chave"
     export OPENAI_MODEL="modelo-disponível-na-sua-conta"
   Windows PowerShell:
     $env:OPENAI_API_KEY="sua-chave"
     $env:OPENAI_MODEL="modelo-disponível-na-sua-conta"
4. Execute: npm start
5. Abra: http://localhost:3000
6. Crie uma conta com e-mail válido e senha de pelo menos 10 caracteres.

A chave deve ficar no ambiente do servidor. Nunca coloque a chave em index.html, app.js ou qualquer arquivo enviado ao navegador.

ENDPOINTS
GET    /api/health
GET    /api/auth/me
POST   /api/auth/register       {"email":"voce@exemplo.com","password":"senha-com-10+"}
POST   /api/auth/login          {"email":"voce@exemplo.com","password":"..."}
POST   /api/auth/logout
GET    /api/conversations       (autenticado)
POST   /api/conversations       (autenticado; salva histórico)
DELETE /api/conversations/:id  (autenticado; somente proprietário)
POST   /api/chat                (autenticado; requer IA configurada)
POST   /api/analytics/insight   (autenticado; requer IA configurada)
GET    /api/edge/telemetry      (MVP: público)
POST   /api/edge/telemetry      (MVP: público, apenas teste)

TESTES MANUAIS
- Crie uma conta, saia e entre novamente.
- Faça uma conversa com a IA depois de configurar a chave; confirme que o histórico recente reaparece após login.
- Tente chamar /api/chat sem login: deve retornar 401.
- Carregue CSV/JSON e confirme estatísticas locais.
- Envie telemetria de teste. Os eventos ainda são temporários e públicos nesta versão.

PRÓXIMAS ETAPAS
1. Trocar o armazenamento JSON por banco de dados real com migrações e backups.
2. Persistir sessões de forma segura e implementar recuperação de conta, verificação de e-mail e controles antiabuso.
3. Configurar e testar o provedor/modelo de IA no ambiente de backend.
4. Autenticar dispositivos Edge e isolar dados de telemetria por proprietário.
5. Adicionar testes automatizados, logs, monitoramento e revisão independente de segurança.
6. Implantar em HTTPS com gestão de segredos, política de privacidade e backups.
