const CORS_HEADERS = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});

async function getGraphToken(env) {
  const res = await fetch(
    `https://login.microsoftonline.com/${env.TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.CLIENT_ID,
        client_secret: env.CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function sendMail(env, { name, email, company, message }) {
  const token = await getGraphToken(env);

  const subject = `Contato via site — ${name}${company ? ` (${company})` : ""}`;
  const body = [
    `Nome: ${name}`,
    `E-mail: ${email}`,
    company ? `Empresa: ${company}` : null,
    ``,
    `Mensagem:`,
    message.trim(),
  ]
    .filter((l) => l !== null)
    .join("\n");

  const payload = {
    message: {
      subject,
      body: { contentType: "Text", content: body },
      from: { emailAddress: { address: "comercial@winserv.com.br", name: "Formulário Winserv" } },
      toRecipients: [{ emailAddress: { address: env.TO_EMAIL } }],
      replyTo: [{ emailAddress: { address: email, name } }],
    },
    saveToSentItems: false,
  };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${env.MAILBOX}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (res.status !== 202) {
    const err = await res.text();
    throw new Error(`Graph sendMail failed ${res.status}: ${err}`);
  }
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS(origin) });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, origin);
    }

    const { name, email, company, message, turnstileToken } = body;

    if (!name?.trim() || !email?.trim() || !message?.trim() || !turnstileToken) {
      return json({ error: "Campos obrigatórios faltando" }, 400, origin);
    }

    if (!email.includes("@")) {
      return json({ error: "E-mail inválido" }, 400, origin);
    }

    const tsRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET,
        response: turnstileToken,
        remoteip: request.headers.get("CF-Connecting-IP"),
      }),
    });

    const tsData = await tsRes.json();
    if (!tsData.success) {
      return json({ error: "Verificação de segurança falhou" }, 400, origin);
    }

    try {
      await sendMail(env, { name, email, company, message });
    } catch (err) {
      console.error(err.message);
      return json({ error: "Falha ao enviar mensagem. Tente novamente." }, 500, origin);
    }

    return json({ ok: true }, 200, origin);
  },
};

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS(origin) },
  });
}
