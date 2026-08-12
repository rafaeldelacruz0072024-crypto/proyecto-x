import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const buildHtml = (subject: string, body: string, name: string) => `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#111118;border-radius:16px;overflow:hidden;border:1px solid #1e293b;">
<tr><td style="background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:32px;text-align:center;">
  <div style="font-size:28px;font-weight:900;color:#3b82f6;letter-spacing:4px;">GEMINIX</div>
  <div style="font-size:11px;color:#64748b;letter-spacing:3px;margin-top:4px;">PLATAFORMA FINANCIERA DIGITAL</div>
</td></tr>
<tr><td style="padding:40px 32px;">
  <p style="color:#94a3b8;font-size:14px;margin:0 0 20px;">Hola, <strong style="color:#e2e8f0;">${name}</strong> 👋</p>
  <div style="color:#cbd5e1;font-size:15px;line-height:1.8;white-space:pre-wrap;">${body}</div>
</td></tr>
<tr><td style="padding:0 32px 32px;text-align:center;">
  <a href="https://geminix.app" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:1px;">
    ABRIR GEMINIX →
  </a>
</td></tr>
<tr><td style="background:#0d0d14;padding:24px 32px;text-align:center;border-top:1px solid #1e293b;">
  <p style="color:#475569;font-size:11px;margin:0;">© 2025 GEMINIX · Plataforma Financiera Digital</p>
  <p style="color:#374151;font-size:10px;margin:8px 0 0;">Recibiste este correo porque eres miembro de GEMINIX.</p>
</td></tr>
</table></td></tr></table>
</body></html>`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_KEY) throw new Error('RESEND_API_KEY no configurada en Supabase Secrets');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { subject, body, segment = 'all', campaign_id, custom_emails = [] } = await req.json();
    if (!subject || !body) throw new Error('subject y body son requeridos');

    // — Obtener usuarios según segmento —
    let exportUsers: { email: string; full_name: string | null }[] = [];

    if (segment === 'custom') {
      if (!Array.isArray(custom_emails) || custom_emails.length === 0) {
        throw new Error('Debe proporcionar una lista de correos (custom_emails)');
      }
      exportUsers = custom_emails.map((email: string) => ({
        email: email.trim(),
        full_name: 'Inversor',
      }));
    } else {
      let userIds: string[] | null = null;

      if (segment === 'deposited' || segment === 'no_deposit') {
        const { data: deps } = await supabase
          .from('deposits')
          .select('user_id')
          .eq('status', 'approved');
        const depositIds = [...new Set((deps || []).map((d: any) => d.user_id))];

        if (segment === 'deposited') userIds = depositIds;
        else userIds = depositIds; // will use NOT IN below
      }

      let query = supabase
        .from('profiles')
        .select('id, email, full_name')
        .not('email', 'is', null);

      if (segment === 'deposited' && userIds) {
        query = query.in('id', userIds);
      } else if (segment === 'no_deposit' && userIds) {
        if (userIds.length > 0) {
          query = query.not('id', 'in', `(${userIds.join(',')})`);
        }
      }

      const { data: users, error: usersError } = await query;
      if (usersError) throw usersError;
      exportUsers = users || [];
    }

    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@geminix.app';
    const FROM_NAME = 'Equipo GEMINIX';

    let sentCount = 0;
    let failedCount = 0;

    for (const user of exportUsers) {
      if (!user.email) continue;
      const name = user.full_name || 'Miembro';
      const html = buildHtml(subject, body.replace(/\{\{nombre\}\}/g, name), name);

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: [user.email],
            subject,
            html,
          }),
        });
        if (res.ok) sentCount++;
        else failedCount++;
      } catch {
        failedCount++;
      }

      // Pequeña pausa para no saturar la API
      await new Promise((r) => setTimeout(r, 80));
    }

    // — Actualizar campaña en DB —
    if (campaign_id) {
      await supabase
        .from('email_campaigns')
        .update({
          status: 'sent',
          sent_count: sentCount,
          failed_count: failedCount,
          sent_at: new Date().toISOString(),
        })
        .eq('id', campaign_id);
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, failed: failedCount, total: exportUsers.length }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
