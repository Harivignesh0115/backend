export default {
  async fetch(request, env) {

    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);

    try {

      // ✅ GET → fetch all users
      if (request.method === "GET" && url.pathname === "/") {
        const data = await env.my_db.prepare("SELECT * FROM users").all();
        return new Response(JSON.stringify(data.results), { headers });
      }

      // ✅ POST → book appointment
      if (request.method === "POST" && url.pathname === "/book-appointment") {
        const body = await request.json();

        // basic validation
        if (!body.name || !body.phone || !body.date || !body.time) {
          return new Response(JSON.stringify({
            success: false,
            message: "Missing required fields"
          }), { headers });
        }

        await env.my_db.prepare(
          `INSERT INTO users (name, phone, email, concern, date, time)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          body.name,
          body.phone,
          body.email || "",
          body.concern || "",
          body.date,
          body.time
        )
        .run();

        return new Response(JSON.stringify({
          success: true
        }), { headers });
      }

      return new Response("Not Found", { status: 404 });

    } catch (err) {
      return new Response(JSON.stringify({
        success: false,
        error: err.message
      }), { headers, status: 500 });
    }
  }
};