const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders }
  });

const text = (body, status = 200, extraHeaders = {}) =>
  new Response(body, { status, headers: { ...corsHeaders, ...extraHeaders } });

const base64UrlEncode = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const base64UrlEncodeStr = (str) =>
  btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const base64UrlDecode = (str) => {
  const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64);
};

const hmacSign = async (secret, data) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64UrlEncode(sig);
};

const createToken = async (payload, secret) => {
  const body = base64UrlEncodeStr(JSON.stringify(payload));
  const sig = await hmacSign(secret, body);
  return `${body}.${sig}`;
};

const verifyToken = async (token, secret) => {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = await hmacSign(secret, body);
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(body));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

const getAuthToken = (request) => {
  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7);
  return null;
};

const parseAppointmentDateTime = (date, time) => {
  try {
    const [year, month, day] = date.split("-").map(Number);
    const timeMatch = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!timeMatch) throw new Error("Invalid time");
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const meridiem = timeMatch[3];
    if (meridiem) {
      if (meridiem.toUpperCase() === "PM" && hours !== 12) hours += 12;
      if (meridiem.toUpperCase() === "AM" && hours === 12) hours = 0;
    }
    return new Date(year, month - 1, day, hours, minutes, 0);
  } catch {
    return new Date(`${date} ${time}`);
  }
};

const getTodayISO = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const sendEmailIfConfigured = async (env, payload) => {
  const apiKey = env.MAILCHANNELS_API_KEY;
  const fromEmail = env.MAIL_FROM || env.CLINIC_EMAIL;
  const clinicEmail = env.CLINIC_EMAIL;
  if (!apiKey || !fromEmail || !clinicEmail) {
    return { success: false, message: "Email not configured" };
  }

  const body = {
    personalizations: [
      {
        to: [{ email: payload.email }],
        bcc: [{ email: clinicEmail }],
        subject: `Appointment Confirmed – ${payload.date} ${payload.time}`
      }
    ],
    from: { email: fromEmail, name: "Mittel Mind Clinic" },
    content: [
      {
        type: "text/plain",
        value:
          `Hello ${payload.name},\n\n` +
          `Your appointment has been booked successfully.\n` +
          `Date: ${payload.date}\nTime: ${payload.time}\n` +
          `Concern: ${payload.concern || "General consultation"}\n\n` +
          `Thank you,\nMittel Mind Clinic`
      }
    ]
  };

  const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Token": apiKey
    },
    body: JSON.stringify(body)
  });

  if (res.ok) return { success: true, message: "Email sent" };
  const errText = await res.text();
  return { success: false, message: errText || "Email failed" };
};

const sendReceptionEmailNotification = async (env, type, payload) => {
  const apiKey = env.MAILCHANNELS_API_KEY;
  const fromEmail = env.MAIL_FROM || env.CLINIC_EMAIL;
  const staffEmail = "harivigneshs0115@gmail.com";
  
  if (!apiKey || !fromEmail) {
    return { success: false, message: "Email not configured" };
  }

  const subject = type === 'booking' ? 'New Appointment Booked' : 'Appointment Confirmed';
  const action = type === 'booking' ? 'booked' : 'confirmed';

  const body = {
    personalizations: [
      {
        to: [{ email: staffEmail }],
        subject: `${subject} – ${payload.name}`
      }
    ],
    from: { email: fromEmail, name: "Mittel Mind Clinic System" },
    content: [
      {
        type: "text/plain",
        value:
          `NEW APPOINTMENT ALERT\n\n` +
          `A patient has ${action} an appointment:\n\n` +
          `Patient: ${payload.name}\n` +
          `Phone: ${payload.phone}\n` +
          `Email: ${payload.email || 'Not provided'}\n` +
          `Date: ${payload.date}\n` +
          `Time: ${payload.time}\n` +
          `Concern: ${payload.concern || 'General consultation'}\n\n` +
          `Please login to the reception dashboard to manage this appointment.\n\n` +
          `Login: https://mittel-mind-clinic.vinora.workers.dev/reception\n` +
          `Email: reception@mittelmind.com\n` +
          `Password: Reception@2024\n\n` +
          `This is an automated notification.`
      }
    ]
  };

  const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Token": apiKey
    },
    body: JSON.stringify(body)
  });

  if (res.ok) return { success: true, message: "Email sent" };
  const errText = await res.text();
  return { success: false, message: errText || "Email failed" };
};

const requireRole = (payload, roles) => {
  if (!payload || !payload.role) return false;
  return roles.includes(payload.role);
};

const handleApi = async (request, env) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "") || "/";

  // CORS preflight
  if (request.method === "OPTIONS") {
    return text("", 204);
  }

  // Health
  if (request.method === "GET" && path === "/health") {
    return json({
      success: true,
      message: "Mittel Mind Clinic API is running",
      timestamp: new Date().toISOString()
    });
  }

  // Auth: admin login
  if (request.method === "POST" && path === "/auth/login") {
    const body = await request.json().catch(() => ({}));
    const loginId = (body.email || body.username || "").toString().trim().toLowerCase();
    const adminEmail = (env.ADMIN_EMAIL || "admin@mittelmind.com").toString().toLowerCase();
    const adminUsername = (env.ADMIN_USERNAME || "admin").toString().toLowerCase();
    const adminPassword = env.ADMIN_PASSWORD || "MittelAdmin@2024";
    const allowedAdminLogins = new Set([adminEmail, adminUsername, "admin@mittelmind.com", "admin"]);

    if (allowedAdminLogins.has(loginId) && body.password === adminPassword) {
      const payload = {
        role: "admin",
        email: env.ADMIN_EMAIL || "admin@mittelmind.com",
        exp: Date.now() + 8 * 60 * 60 * 1000
      };
      const token = await createToken(payload, env.AUTH_SECRET || "change-me");
      return json({
        success: true,
        message: "Admin login successful",
        token,
        admin: { name: env.ADMIN_NAME || "Dr. E. Lloyds", email: env.ADMIN_EMAIL || "admin@mittelmind.com", role: "admin" }
      });
    }
    return json({ success: false, message: "Invalid admin credentials" }, 401);
  }

  // Auth: reception login
  if (request.method === "POST" && path === "/auth/reception-login") {
    const body = await request.json().catch(() => ({}));
    const loginId = (body.email || body.username || "").toString().trim().toLowerCase();
    const receptionPassword = (env.RECEPTION_PASSWORD || "reception@mittelmind").toString();
    const acceptedReceptionPasswords = new Set([receptionPassword, "reception@mittelmind", "Reception@2024"]);

    // Force reception username to "reception" for this flow.
    if (loginId === "reception" && acceptedReceptionPasswords.has(body.password)) {
      const payload = {
        role: "reception",
        email: env.RECEPTION_EMAIL || "reception@mittelmind.com",
        exp: Date.now() + 8 * 60 * 60 * 1000
      };
      const token = await createToken(payload, env.AUTH_SECRET || "change-me");
      return json({
        success: true,
        message: "Reception login successful",
        token,
        user: { email: env.RECEPTION_EMAIL || "reception@mittelmind.com", role: "reception" }
      });
    }
    return json({ success: false, message: "Invalid reception credentials - use username:\n reception" }, 401);
  }

  // Verify tokens
  if (request.method === "GET" && path === "/auth/verify") {
    const token = getAuthToken(request);
    const payload = await verifyToken(token, env.AUTH_SECRET || "change-me");
    if (!payload || payload.role !== "admin") {
      return json({ success: false, message: "Unauthorized" }, 401);
    }
    return json({ success: true, message: "Token is valid" });
  }

  if (request.method === "GET" && path === "/auth/reception-verify") {
    const token = getAuthToken(request);
    const payload = await verifyToken(token, env.AUTH_SECRET || "change-me");
    if (!payload || payload.role !== "reception") {
      return json({ success: false, message: "Unauthorized" }, 401);
    }
    return json({ success: true, message: "Token is valid" });
  }

  // Public booking
  if (request.method === "POST" && path === "/book-appointment") {
    const body = await request.json().catch(() => ({}));
    const { name, phone, email, date, time, concern } = body;

    if (!name || !phone || !date || !time) {
      return json({ success: false, message: "Name, phone, date, and time are required." }, 400);
    }

    const appointmentDateTime = parseAppointmentDateTime(date, time);
    if (isNaN(appointmentDateTime.getTime())) {
      return json({ success: false, message: "Invalid date or time format." }, 400);
    }
    if (appointmentDateTime <= new Date()) {
      return json({ success: false, message: "Appointment date and time must be in the future." }, 400);
    }

    const appointmentDateTimeISO = appointmentDateTime.toISOString();

    const nowIso = new Date().toISOString();
    const result = await env.DB.prepare(
      `INSERT INTO appointments (name, phone, email, concern, date, time, status, appointmentDateTime, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 'booked', ?, ?, ?)`
    )
      .bind(
        String(name).trim(),
        String(phone).trim(),
        String(email || "").trim().toLowerCase(),
        String(concern || "General consultation").trim(),
        date,
        time,
        appointmentDateTimeISO,
        nowIso,
        nowIso
      )
      .run();

    const emailResult = await sendEmailIfConfigured(env, {
      name,
      phone,
      email,
      date,
      time,
      concern
    });

    // Send notification to staff email
    const notificationResult = await sendReceptionEmailNotification(env, 'booking', {
      name,
      phone,
      email,
      date,
      time,
      concern
    });

    return json({
      success: true,
      message: "Appointment booked successfully!",
      emailSent: Boolean(emailResult && emailResult.success),
      emailMessage: emailResult && emailResult.message ? emailResult.message : "Email not sent",
      notificationSent: Boolean(notificationResult && notificationResult.success),
      notificationMessage: notificationResult && notificationResult.message ? notificationResult.message : "Notification not sent",
      appointment: {
        id: result.meta.last_row_id,
        name,
        date,
        time,
        status: "booked"
      }
    }, 201);
  }

  // Test email
  if (request.method === "POST" && path === "/test-email") {
    if (!isAdmin) return json({ success: false, message: "Forbidden" }, 403);
    const body = await request.json().catch(() => ({}));
    const { to, subject, message } = body;
    if (!to || !subject || !message) {
      return json({ success: false, message: "to, subject, and message are required" }, 400);
    }

    const apiKey = env.MAILCHANNELS_API_KEY;
    const fromEmail = env.MAIL_FROM || env.CLINIC_EMAIL;
    if (!apiKey || !fromEmail) {
      return json({ success: false, message: "Email not configured" }, 500);
    }

    const emailBody = {
      personalizations: [
        {
          to: [{ email: to }],
          subject: subject
        }
      ],
      from: { email: fromEmail, name: "Mittel Mind Clinic Test" },
      content: [
        {
          type: "text/plain",
          value: message
        }
      ]
    };

    const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Token": apiKey
      },
      body: JSON.stringify(emailBody)
    });

    if (res.ok) {
      return json({ success: true, message: "Test email sent successfully" });
    } else {
      const errText = await res.text();
      return json({ success: false, message: `Email failed: ${errText}` }, 500);
    }
  }


  const isAdmin = requireRole(payload, ["admin"]);
  const isReception = requireRole(payload, ["reception"]);
  const isAny = requireRole(payload, ["admin", "reception"]);

  // Appointments export (any)
  if (request.method === "GET" && path === "/appointments/export") {
    if (!isAny) return json({ success: false, message: "Forbidden" }, 403);
    const status = url.searchParams.get("status");
    const date = url.searchParams.get("date");
    const year = url.searchParams.get("year");

    let query = "SELECT * FROM appointments";
    const where = [];
    const binds = [];

    if (status) {
      const list = status.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length > 0) {
        const placeholder = list.map(() => "?").join(",");
        where.push(`status IN (${placeholder})`);
        binds.push(...list);
      }
    }

    if (date) {
      where.push("date = ?");
      binds.push(date);
    }

    if (year) {
      where.push("strftime('%Y', appointmentDateTime) = ?");
      binds.push(year);
    }

    if (where.length) query += " WHERE " + where.join(" AND ");
    query += " ORDER BY id DESC";

    const stmt = env.DB.prepare(query);
    const data = binds.length ? await stmt.bind(...binds).all() : await stmt.all();

    const cols = [
      "id",
      "name",
      "phone",
      "email",
      "concern",
      "date",
      "time",
      "status",
      "createdAt",
      "updatedAt"
    ];
    const csvRows = [cols.join(",")];
    for (const row of data.results || []) {
      const values = cols.map((col) => {
        const value = row[col] != null ? String(row[col]) : "";
        const escaped = value.replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(","));
    }
    const csv = "\ufeff" + csvRows.join("\n");
    return text(csv, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=appointments-export.csv"
    });
  }

  // GET /appointments (any) - booked for today unless all=true
  if (request.method === "GET" && path === "/appointments") {
    if (!isAny) return json({ success: false, message: "Forbidden" }, 403);
    const dateQuery = url.searchParams.get("date");
    const allowAll = String(url.searchParams.get("all") || "").toLowerCase() === "true";
    const timeQuery = url.searchParams.get("time");
    const yearQuery = url.searchParams.get("year");

    let query = "SELECT * FROM appointments WHERE (status = 'booked' OR status IS NULL)";
    const binds = [];

    if (!allowAll) {
      const dateStr = dateQuery || getTodayISO();
      query += " AND date = ?";
      binds.push(dateStr);
    } else if (dateQuery) {
      query += " AND date = ?";
      binds.push(dateQuery);
    }

    if (timeQuery) {
      query += " AND time = ?";
      binds.push(timeQuery);
    }

    if (yearQuery) {
      query += " AND strftime('%Y', appointmentDateTime) = ?";
      binds.push(yearQuery);
    }

    query += " ORDER BY appointmentDateTime ASC";

    const stmt = env.DB.prepare(query);
    const data = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
    return json({ success: true, count: data.results?.length || 0, appointments: data.results || [] });
  }

  // GET /appointments/confirmed (any)
  if (request.method === "GET" && path === "/appointments/confirmed") {
    if (!isAny) return json({ success: false, message: "Forbidden" }, 403);
    const dateQuery = url.searchParams.get("date");
    const allowAll = String(url.searchParams.get("all") || "").toLowerCase() === "true";
    const yearQuery = url.searchParams.get("year");

    let query = "SELECT * FROM appointments WHERE status = 'confirmed'";
    const binds = [];
    if (dateQuery) {
      query += " AND date = ?";
      binds.push(dateQuery);
    } else if (!allowAll) {
      query += " AND date = ?";
      binds.push(getTodayISO());
    }
    if (yearQuery) {
      query += " AND strftime('%Y', appointmentDateTime) = ?";
      binds.push(yearQuery);
    }
    query += " ORDER BY appointmentDateTime ASC";

    const stmt = env.DB.prepare(query);
    const data = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
    return json({ success: true, count: data.results?.length || 0, appointments: data.results || [] });
  }

  // GET /appointments/all (admin)
  if (request.method === "GET" && path === "/appointments/all") {
    if (!isAdmin) return json({ success: false, message: "Forbidden" }, 403);
    const statusQuery = url.searchParams.get("status") || "";
    let query = "SELECT * FROM appointments";
    let bindings = [];

    if (statusQuery.trim()) {
      const statusList = statusQuery.split(",").map((s) => s.trim()).filter(Boolean);
      if (statusList.length > 0) {
        const placeholders = statusList.map(() => "?").join(",");
        query += ` WHERE status IN (${placeholders})`;
        bindings = statusList;
      }
    }

    query += " ORDER BY createdAt DESC";
    const stmt = env.DB.prepare(query);
    const data = bindings.length ? await stmt.bind(...bindings).all() : await stmt.all();
    return json({ success: true, count: data.results?.length || 0, appointments: data.results || [] });
  }

  // GET /appointments/viewed (any)
  if (request.method === "GET" && path === "/appointments/viewed") {
    if (!isAny) return json({ success: false, message: "Forbidden" }, 403);
    const dateQuery = url.searchParams.get("date");
    const yearQuery = url.searchParams.get("year");

    let query = "SELECT * FROM appointments WHERE status = 'viewed'";
    const binds = [];
    if (dateQuery) {
      query += " AND date = ?";
      binds.push(dateQuery);
    }
    if (yearQuery) {
      query += " AND strftime('%Y', appointmentDateTime) = ?";
      binds.push(yearQuery);
    }
    query += " ORDER BY updatedAt DESC";

    const stmt = env.DB.prepare(query);
    const data = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
    return json({ success: true, count: data.results?.length || 0, appointments: data.results || [] });
  }

  // GET /appointments/not-visited (reception)
  if (request.method === "GET" && path === "/appointments/not-visited") {
    if (!isReception) return json({ success: false, message: "Forbidden" }, 403);
    const dateQuery = url.searchParams.get("date");
    const yearQuery = url.searchParams.get("year");

    let query = "SELECT * FROM appointments WHERE status = 'not_visited'";
    const binds = [];
    if (dateQuery) {
      query += " AND date = ?";
      binds.push(dateQuery);
    }
    if (yearQuery) {
      query += " AND strftime('%Y', appointmentDateTime) = ?";
      binds.push(yearQuery);
    }
    query += " ORDER BY appointmentDateTime DESC";

    const stmt = env.DB.prepare(query);
    const data = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
    return json({ success: true, count: data.results?.length || 0, appointments: data.results || [] });
  }

  // GET /appointments/changes (any)
  if (request.method === "GET" && path === "/appointments/changes") {
    if (!isAny) return json({ success: false, message: "Forbidden" }, 403);
    const sinceRaw = url.searchParams.get("since");
    let sinceISO = null;
    if (sinceRaw) {
      const parsed = new Date(sinceRaw);
      if (!isNaN(parsed.getTime())) sinceISO = parsed.toISOString();
    }

    const filter = sinceISO ? "WHERE updatedAt > ?" : "";
    const stmt = env.DB.prepare(
      `SELECT id, name, status, createdAt, updatedAt FROM appointments ${filter} ORDER BY updatedAt DESC`
    );
    const data = sinceISO ? await stmt.bind(sinceISO).all() : await stmt.all();
    const count = data.results?.length || 0;
    const latest = data.results?.[0] || null;
    let action = null;
    if (latest && latest.createdAt && latest.updatedAt) {
      const delta = Math.abs(new Date(latest.updatedAt) - new Date(latest.createdAt));
      action = delta < 3000 ? "created" : "updated";
    }

    return json({
      success: true,
      count,
      latestAt: latest && latest.updatedAt ? new Date(latest.updatedAt).toISOString() : null,
      latest: latest ? { name: latest.name, status: latest.status, action } : null,
      serverTime: new Date().toISOString()
    });
  }

  // PUT /appointments/{id}/confirm (reception)
  if (request.method === "PUT") {
    const confirmMatch = path.match(/^\/appointments\/(\d+)\/confirm$/);
    if (confirmMatch) {
      if (!isReception) return json({ success: false, message: "Forbidden" }, 403);
      const id = confirmMatch[1];
      
      // Get appointment details for notification
      const appointment = await env.DB.prepare("SELECT * FROM appointments WHERE id = ?").bind(id).first();
      if (!appointment) return json({ success: false, message: "Appointment not found" }, 404);
      
      const updateTime = new Date().toISOString();
      await env.DB.prepare("UPDATE appointments SET status = 'confirmed', updatedAt = ? WHERE id = ?")
        .bind(updateTime, id)
        .run();
      
      // Send email notification about confirmation
      const emailConfirmResult = await sendReceptionEmailNotification(env, 'confirmation', {
        name: appointment.name,
        phone: appointment.phone,
        email: appointment.email,
        date: appointment.date,
        time: appointment.time,
        concern: appointment.concern
      });
      
      return json({ success: true, message: "Appointment confirmed successfully", id, notificationSent: Boolean(emailConfirmResult && emailConfirmResult.success) });
    }

    const completedMatch = path.match(/^\/appointments\/(\d+)\/completed$/);
    if (completedMatch) {
      if (!isAdmin) return json({ success: false, message: "Forbidden" }, 403);
      const id = completedMatch[1];
      await env.DB.prepare("UPDATE appointments SET status = 'viewed', updatedAt = ? WHERE id = ?")
        .bind(new Date().toISOString(), id)
        .run();
      return json({ success: true, message: "Appointment transferred to viewed patients", id });
    }

    const viewedMatch = path.match(/^\/appointments\/(\d+)\/viewed$/);
    if (viewedMatch) {
      if (!isReception) return json({ success: false, message: "Forbidden" }, 403);
      const id = viewedMatch[1];
      await env.DB.prepare("UPDATE appointments SET status = 'viewed', updatedAt = ? WHERE id = ?")
        .bind(new Date().toISOString(), id)
        .run();
      return json({ success: true, message: "Appointment marked as viewed", id });
    }
  }

  // DELETE /appointments/{id} (reception)
  if (request.method === "DELETE" && path.match(/^\/appointments\/\d+$/)) {
    if (!isReception) return json({ success: false, message: "Forbidden" }, 403);
    const id = path.split("/")[2];
    await env.DB.prepare("DELETE FROM appointments WHERE id = ?").bind(id).run();
    return json({ success: true, message: "Appointment deleted successfully.", id });
  }

  return json({ success: false, message: "Route not found" }, 404);
};

const handleAssets = async (request, env) => {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/" || path === "") {
    const assetUrl = new URL("/index.html", url.origin);
    return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  }
  if (path === "/admin" || path === "/admin/") {
    const assetUrl = new URL("/dashboard/index.html", url.origin);
    return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  }
  if (path.startsWith("/admin/")) {
    const assetUrl = new URL("/dashboard/index.html", url.origin);
    return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  }
  if (path === "/reception" || path === "/reception/") {
    const assetUrl = new URL("/reception/index.html", url.origin);
    return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  }
  if (path.startsWith("/reception/")) {
    const assetUrl = new URL("/reception/index.html", url.origin);
    return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  }

  return env.ASSETS.fetch(request);
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api")) {
      try {
        return await handleApi(request, env);
      } catch (err) {
        return json({ success: false, message: "Internal server error", error: err.message }, 500);
      }
    }
    return handleAssets(request, env);
  },

  async scheduled(event, env, ctx) {
    try {
      const nowIso = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE appointments SET status = 'not_visited', updatedAt = ? WHERE status = 'booked' AND datetime(appointmentDateTime) < datetime('now')"
      )
        .bind(nowIso)
        .run();
    } catch (err) {
      // swallow cron errors
      console.error("Cron error:", err);
    }
  }
};
