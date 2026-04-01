export default {
  async fetch(request, env) {

    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    // ✅ CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);

    try {

      // ✅ TEST ROUTE
      if (url.pathname === "/") {
        return new Response(JSON.stringify({
          success: true,
          message: "Vinora Backend Running 🚀"
        }), {
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }

      // ✅ INIT DATABASE - Add status column if it doesn't exist
      if (url.pathname === "/init-db") {
        try {
          // Try to add status column if it doesn't exist
          await env.my_db.prepare("ALTER TABLE appointments ADD COLUMN status TEXT DEFAULT 'booked'").run().catch(() => {});
          
          return new Response(JSON.stringify({
            success: true,
            message: "Database initialized successfully"
          }), {
            headers: { ...headers, "Content-Type": "application/json" }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            headers: { ...headers, "Content-Type": "application/json" }
          });
        }
      }

      // ✅ ADMIN LOGIN
      if (request.method === "POST" && url.pathname === "/auth/login") {
        const body = await request.json();
        
        if (body.email === "admin@mittelmind.com" && body.password === "MittelAdmin@2024") {
          return new Response(JSON.stringify({
            success: true,
            message: "Admin login successful",
            token: "admin_token_" + Date.now(),
            admin: {
              name: "Dr. E. Lloyds",
              email: "admin@mittelmind.com",
              role: "admin"
            }
          }), {
            headers: { ...headers, "Content-Type": "application/json" }
          });
        }
        
        return new Response(JSON.stringify({
          success: false,
          message: "Invalid admin credentials"
        }), {
          headers: { ...headers, "Content-Type": "application/json" },
          status: 401
        });
      }

      // ✅ RECEPTION LOGIN
      if (request.method === "POST" && url.pathname === "/auth/reception-login") {
        const body = await request.json();
        
        if (body.email === "reception@mittelmind.com" && body.password === "Reception@2024") {
          return new Response(JSON.stringify({
            success: true,
            message: "Reception login successful",
            token: "reception_token_" + Date.now(),
            user: {
              email: "reception@mittelmind.com",
              role: "reception"
            }
          }), {
            headers: { ...headers, "Content-Type": "application/json" }
          });
        }
        
        return new Response(JSON.stringify({
          success: false,
          message: "Invalid reception credentials"
        }), {
          headers: { ...headers, "Content-Type": "application/json" },
          status: 401
        });
      }

      // ✅ VERIFY TOKEN
      if (request.method === "POST" && url.pathname === "/auth/verify") {
        const authHeader = request.headers.get("Authorization");
        
        if (authHeader && authHeader.startsWith("Bearer ")) {
          return new Response(JSON.stringify({
            success: true,
            message: "Token is valid"
          }), {
            headers: { ...headers, "Content-Type": "application/json" }
          });
        }
        
        return new Response(JSON.stringify({
          success: false,
          message: "Unauthorized"
        }), {
          headers: { ...headers, "Content-Type": "application/json" },
          status: 401
        });
      }

      // ✅ VERIFY RECEPTION TOKEN
      if (request.method === "POST" && url.pathname === "/auth/reception-verify") {
        const authHeader = request.headers.get("Authorization");
        
        if (authHeader && authHeader.startsWith("Bearer ")) {
          return new Response(JSON.stringify({
            success: true,
            message: "Token is valid"
          }), {
            headers: { ...headers, "Content-Type": "application/json" }
          });
        }
        
        return new Response(JSON.stringify({
          success: false,
          message: "Unauthorized"
        }), {
          headers: { ...headers, "Content-Type": "application/json" },
          status: 401
        });
      }

      // ✅ GET ALL APPOINTMENTS
      if (request.method === "GET" && url.pathname === "/appointments") {
        const data = await env.my_db
          .prepare("SELECT * FROM appointments WHERE status = 'booked' ORDER BY id DESC")
          .all();

        return new Response(JSON.stringify({
          success: true,
          count: data.results?.length || 0,
          appointments: data.results || []
        }), {
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }

      // ✅ GET APPOINTMENTS WITH FILTERS
      if (request.method === "GET" && url.pathname === "/appointments/all") {
        const statusQuery = url.searchParams.get("status") || "";
        let query = "SELECT * FROM appointments";
        let bindings = [];

        if (statusQuery.trim()) {
          const statusList = statusQuery.split(",").map(s => s.trim()).filter(Boolean);
          if (statusList.length > 0) {
            const placeholders = statusList.map(() => "?").join(",");
            query += ` WHERE status IN (${placeholders})`;
            bindings = statusList;
          }
        }

        query += " ORDER BY id DESC";
        const stmt = env.my_db.prepare(query);
        const data = bindings.length ? await stmt.bind(...bindings).all() : await stmt.all();

        return new Response(JSON.stringify({
          success: true,
          count: data.results?.length || 0,
          appointments: data.results || []
        }), {
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }

      // ✅ GET APPOINTMENT CHANGES
      if (request.method === "GET" && url.pathname === "/appointments/changes") {
        const data = await env.my_db
          .prepare("SELECT * FROM appointments ORDER BY id DESC")
          .all();

        return new Response(JSON.stringify({
          success: true,
          count: data.results?.length || 0,
          appointments: data.results || []
        }), {
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }

      // ✅ GET CONFIRMED APPOINTMENTS
      // ✅ GET CONFIRMED APPOINTMENTS
      if (request.method === "GET" && url.pathname === "/appointments/confirmed") {
        const data = await env.my_db
          .prepare("SELECT * FROM appointments WHERE status = 'confirmed' ORDER BY id DESC")
          .all();

        return new Response(JSON.stringify({
          success: true,
          count: data.results?.length || 0,
          appointments: data.results || []
        }), {
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }

      // ✅ GET VIEWED APPOINTMENTS
      if (request.method === "GET" && url.pathname === "/appointments/viewed") {
        const data = await env.my_db
          .prepare("SELECT * FROM appointments WHERE status = 'viewed' ORDER BY id DESC")
          .all();

        return new Response(JSON.stringify({
          success: true,
          count: data.results?.length || 0,
          appointments: data.results || []
        }), {
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }

      // ✅ GET NOT VISITED APPOINTMENTS
      if (request.method === "GET" && url.pathname === "/appointments/not-visited") {
        const data = await env.my_db
          .prepare("SELECT * FROM appointments WHERE status = 'not-visited' ORDER BY id DESC")
          .all();

        return new Response(JSON.stringify({
          success: true,
          count: data.results?.length || 0,
          appointments: data.results || []
        }), {
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }

      // ✅ GET COMPLETED APPOINTMENTS
      if (request.method === "GET" && url.pathname === "/appointments/completed") {
        const data = await env.my_db
          .prepare("SELECT * FROM appointments WHERE status = 'completed' ORDER BY id DESC")
          .all();

        return new Response(JSON.stringify({
          success: true,
          count: data.results?.length || 0,
          appointments: data.results || []
        }), {
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }

      // ✅ EXPORT APPOINTMENTS
      if (request.method === "GET" && url.pathname === "/appointments/export") {
        const status = url.searchParams.get("status");
        const date = url.searchParams.get("date");
        const year = url.searchParams.get("year");

        let query = "SELECT * FROM appointments";
        const where = [];
        const binds = [];

        if (status) {
          const list = status.split(",").map(s => s.trim()).filter(Boolean);
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
          where.push("strftime('%Y', date) = ?");
          binds.push(year);
        }

        if (where.length) {
          query += " WHERE " + where.join(" AND ");
        }

        query += " ORDER BY id DESC";

        const stmt = env.my_db.prepare(query);
        const data = binds.length ? await stmt.bind(...binds).all() : await stmt.all();

        // build CSV
        const cols = ["id", "name", "phone", "email", "concern", "date", "time", "status", "createdAt", "updatedAt"];
        const csvRows = [cols.join(",")];

        for (const row of data.results || []) {
          const values = cols.map(col => {
            const value = row[col] != null ? String(row[col]) : "";
            const escaped = value.replace(/"/g, '""');
            return `"${escaped}"`;
          });
          csvRows.push(values.join(","));
        }

        const csv = csvRows.join("\n");

        return new Response(csv, {
          headers: {
            ...headers,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": "attachment; filename=appointments-export.csv"
          }
        });
      }

      // ✅ CONFIRM APPOINTMENT (PUT /appointments/{id}/confirm)
      if (request.method === "PUT") {
        const confirmMatch = url.pathname.match(/^\/appointments\/(\d+)\/confirm$/);
        if (confirmMatch) {
          const id = confirmMatch[1];
          const body = await request.json().catch(() => ({}));

          const result = await env.my_db
            .prepare("UPDATE appointments SET status = 'confirmed' WHERE id = ?")
            .bind(id)
            .run();

          return new Response(JSON.stringify({
            success: true,
            message: "Appointment confirmed successfully",
            id: id
          }), {
            headers: { ...headers, "Content-Type": "application/json" }
          });
        }

        // ✅ COMPLETE APPOINTMENT (PUT /appointments/{id}/completed)
        const completedMatch = url.pathname.match(/^\/appointments\/(\d+)\/completed$/);
        if (completedMatch) {
          const id = completedMatch[1];

          const result = await env.my_db
            .prepare("UPDATE appointments SET status = 'viewed' WHERE id = ?")
            .bind(id)
            .run();

          return new Response(JSON.stringify({
            success: true,
            message: "Appointment transferred to viewed patients",
            id: id
          }), {
            headers: { ...headers, "Content-Type": "application/json" }
          });
        }

        // ✅ VIEW APPOINTMENT (PUT /appointments/{id}/viewed)
        const viewedMatch = url.pathname.match(/^\/appointments\/(\d+)\/viewed$/);
        if (viewedMatch) {
          const id = viewedMatch[1];

          const result = await env.my_db
            .prepare("UPDATE appointments SET status = 'viewed' WHERE id = ?")
            .bind(id)
            .run();

          return new Response(JSON.stringify({
            success: true,
            message: "Appointment marked as viewed",
            id: id
          }), {
            headers: { ...headers, "Content-Type": "application/json" }
          });
        }
      }

      // ✅ DELETE APPOINTMENT (DELETE /appointments/{id})
      if (request.method === "DELETE" && url.pathname.match(/^\/appointments\/\d+$/)) {
        const id = url.pathname.split("/")[2];

        await env.my_db
          .prepare("DELETE FROM appointments WHERE id = ?")
          .bind(id)
          .run();

        return new Response(JSON.stringify({
          success: true,
          message: "Appointment deleted successfully",
          id: id
        }), {
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }

      // ✅ BOOK APPOINTMENT
      if (request.method === "POST" && url.pathname === "/book-appointment") {
        const body = await request.json();

        // validation
        if (!body.name || !body.phone || !body.date || !body.time) {
          return new Response(JSON.stringify({
            success: false,
            message: "Missing required fields"
          }), {
            headers: { ...headers, "Content-Type": "application/json" },
            status: 400
          });
        }

        await env.my_db.prepare(
          `INSERT INTO appointments (name, phone, email, concern, date, time)
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
          success: true,
          message: "Appointment booked successfully"
        }), {
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }

      // ✅ DELETE APPOINTMENT
      if (request.method === "DELETE" && url.pathname.startsWith("/delete/")) {
        const id = url.pathname.split("/")[2];

        await env.my_db
          .prepare("DELETE FROM appointments WHERE id = ?")
          .bind(id)
          .run();

        return new Response(JSON.stringify({
          success: true,
          message: "Deleted successfully"
        }), {
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }

      // ❌ NOT FOUND
      return new Response(JSON.stringify({
        success: false,
        message: "Route not found"
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
        status: 404
      });

    } catch (err) {
      return new Response(JSON.stringify({
        success: false,
        error: err.message
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
        status: 500
      });
    }
  }
};