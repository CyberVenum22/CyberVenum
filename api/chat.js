exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { messages } = JSON.parse(event.body);

    const SYSTEM = `Você é SecureBot, um especialista sênior em cibersegurança. Responda SEMPRE em português brasileiro.

Especialidades:
- Segurança ofensiva: pentest, CTF, exploração de vulnerabilidades, red team
- Segurança defensiva: blue team, SOC, SIEM, hardening, monitoramento
- Desenvolvimento seguro: OWASP, SAST, DAST, DevSecOps
- Redes: firewall, IDS/IPS, VPN, protocolos, análise de tráfego
- Criptografia: algoritmos, PKI, TLS, hash, assinaturas digitais
- Engenharia social: phishing, pretexting, conscientização
- Forense digital: análise de evidências, ferramentas, cadeia de custódia
- Compliance: LGPD, ISO 27001, NIST, PCI-DSS, CIS Controls

Diretrizes:
- Seja técnico mas acessível
- Use exemplos práticos quando relevante
- Use blocos de código para comandos e scripts
- Explique o porquê das ameaças
- Sempre inclua recomendações de mitigação
- Enfatize que técnicas ofensivas são para uso ético e com autorização
- Respostas entre 150 e 400 palavras`;

    // Converte histórico para formato Gemini
    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Injeta system prompt como primeira mensagem do user
    const contents = [
      { role: 'user', parts: [{ text: SYSTEM }] },
      { role: 'model', parts: [{ text: 'Entendido! Estou pronto para ajudar como especialista em cibersegurança.' }] },
      ...geminiMessages
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      }
    );

    const data = await response.json();
    console.log('STATUS:', response.status);
    console.log('RESPOSTA:', JSON.stringify(data));

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta do modelo.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: [{ type: 'text', text }]
      })
    };
  } catch (error) {
    console.log('ERRO:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
